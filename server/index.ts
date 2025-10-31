import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { RuntimeEngine } from "../src/runtime/engine";
import { NodeExecutor } from "../src/runtime/executor";
import { WhatsAppWebhookHandler } from "../src/api/whatsapp-webhook";
import { LocalStorageFlowProvider } from "./flow-provider";
import { HttpWebhookDispatcher } from "./webhook-dispatcher";
import { createSessionStore } from "./session-store";
import { Bitrix24Client } from "../src/integrations/bitrix24";
import { botLogger, metricsTracker } from "../src/runtime/monitoring";
import { createApiRoutes } from "./api-routes";
import { registerCrmModule } from "./crm";
import { initCrmWSS } from "./crm/ws";
import { ensureStorageSetup } from "./utils/storage";
import { getWhatsAppEnv, getWhatsAppVerifyToken } from "./utils/env";
import whatsappConnectionsRouter from "./connections/whatsapp-routes";
import { registerReloadCallback } from "./whatsapp-handler-manager";
import { createAdminRouter } from "./routes/admin";
import { createAuthRouter } from "./routes/auth";
import { requireAuth } from "./auth/middleware";
import { logDebug, logError } from "./utils/file-logger";
import { TimerScheduler } from "./timer-scheduler";
import { QueueScheduler } from "./queue-scheduler";
import { authLimiter, apiLimiter, webhookLimiter, flowLimiter } from "./middleware/rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import logger from "./utils/logger";
import { validateBody, validateParams } from "./middleware/validate";
import { flowSchema, flowIdSchema } from "./schemas/validation";
import { validateEnv } from "./utils/validate-env";

// Load environment variables
dotenv.config();

// Validate environment variables (exits if validation fails)
validateEnv();

ensureStorageSetup();

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

// Trust proxy - CRITICAL for rate limiting behind nginx/load balancer
// This allows Express to correctly identify client IPs from X-Forwarded-For header
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true, // Permitir envío de cookies
}));
app.use(cookieParser()); // Cookie parser ANTES de las rutas
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize Runtime Engine
const flowProvider = new LocalStorageFlowProvider();

// Create session store based on configuration
const sessionStore = createSessionStore({
  type: (process.env.SESSION_STORAGE_TYPE as "memory" | "file") || "file",
  fileStorageDir: process.env.SESSION_STORAGE_PATH || "./data/sessions",
});

// Initialize Bitrix24 client if configured
const bitrix24Client = process.env.BITRIX24_WEBHOOK_URL
  ? new Bitrix24Client({ webhookUrl: process.env.BITRIX24_WEBHOOK_URL })
  : undefined;

// Initialize TimerScheduler
const timerScheduler = new TimerScheduler("./data");

const webhookDispatcher = new HttpWebhookDispatcher();
const executor = new NodeExecutor({
  webhookDispatcher,
  bitrix24Client,
  timerScheduler,
});

const runtimeEngine = new RuntimeEngine({
  flowProvider,
  sessionStore,
  executor,
});

// Connect TimerScheduler to RuntimeEngine
timerScheduler.setEngine(runtimeEngine);

// Start timer checking (every 30 seconds)
timerScheduler.startChecking(30000);

// Conversational CRM module
const crmSocketManager = initCrmWSS(server);
const crmModule = registerCrmModule({
  app,
  socketManager: crmSocketManager,
  bitrixClient: bitrix24Client,
});

// Initialize Queue Scheduler for automatic conversation reassignment
const queueScheduler = new QueueScheduler(crmSocketManager);

// Start queue timeout checking (every minute)
queueScheduler.startChecking(60000);

// Set timeout rules: 10m, 30m, 1h, 2h, 4h, 8h, 12h
queueScheduler.setTimeoutRules([10, 30, 60, 120, 240, 480, 720]);

// Initialize WhatsApp Webhook Handler
function createWhatsAppHandler() {
  const whatsappEnv = getWhatsAppEnv();

  return new WhatsAppWebhookHandler({
    verifyToken: getWhatsAppVerifyToken() || "default_verify_token",
    engine: runtimeEngine,
    apiConfig: {
      accessToken: whatsappEnv.accessToken || "",
      phoneNumberId: whatsappEnv.phoneNumberId || "",
      apiVersion: whatsappEnv.apiVersion || "v20.0",
      baseUrl: whatsappEnv.baseUrl,
    },
    resolveFlow: async (context) => {
      const phoneNumber = context.message.from;
      const phoneNumberId = context.value.metadata?.phone_number_id;

      // Try to find flow assigned to this WhatsApp number
      if (phoneNumberId && flowProvider instanceof LocalStorageFlowProvider) {
        const assignedFlow = await flowProvider.findFlowByWhatsAppNumber(phoneNumberId);
        if (assignedFlow) {
          const flowId = assignedFlow.id;
          logger.info(`[WhatsApp] ✅ Flow assigned: ${flowId} for number ${phoneNumberId}`);

          // Log conversation start
          const sessionId = `whatsapp_${phoneNumber}`;
          botLogger.logConversationStarted(sessionId, flowId);
          metricsTracker.startConversation(sessionId, flowId);

          return {
            sessionId,
            flowId,
            contactId: phoneNumber,
            channel: "whatsapp",
          };
        } else {
          logger.info(`[WhatsApp] ℹ️  No flow assigned for number ${phoneNumberId} - message forwarded to CRM only`);
          return null; // No bot execution, message goes to CRM for human agent
        }
      }

      // If no phoneNumberId available, skip bot execution
      logger.warn(`[WhatsApp] ⚠️  No phone number ID in metadata - skipping bot execution`);
      return null;
    },
    logger: {
      info: (message, meta) => botLogger.info(message, meta),
      warn: (message, meta) => botLogger.warn(message, meta),
      error: (message, meta) => botLogger.error(message, undefined, meta),
    },
    onIncomingMessage: async (payload) => {
      logDebug(`[WEBHOOK] onIncomingMessage llamado - Mensaje tipo: ${payload.message.type}, From: ${payload.message.from}`);
      try {
        await crmModule.handleIncomingWhatsApp(payload);
        logDebug(`[WEBHOOK] CRM procesó mensaje exitosamente`);
      } catch (error) {
        logError(`[WEBHOOK] Error en CRM handleIncomingWhatsApp:`, error);
      }
    },
  });
}

let whatsappHandler = createWhatsAppHandler();

// Register reload callback for dynamic credential updates
registerReloadCallback(() => {
  logger.info('[WhatsApp] Reloading handler with updated credentials...');
  whatsappHandler = createWhatsAppHandler();
  logger.info('[WhatsApp] Handler reloaded successfully');
});

const healthHandler = (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

// Health check endpoints
app.get("/health", healthHandler);
app.get("/api/healthz", healthHandler);

// WhatsApp webhook endpoint (Meta for Developers configured URL)
app.all("/api/meta/webhook", webhookLimiter, async (req: Request, res: Response) => {
  try {
    logDebug(`[WEBHOOK] ${req.method} /api/meta/webhook - Body keys:`, Object.keys(req.body || {}));
    if (req.body) {
      logDebug(`[WEBHOOK] Full body:`, req.body);
    }

    const request = new Request(
      `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
      }
    );

    const response = await whatsappHandler.handle(request);
    const body = await response.text();

    logDebug(`[WEBHOOK] Response status: ${response.status}`);
    res.status(response.status).send(body);
  } catch (error) {
    logError("[ERROR] Failed to handle webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API endpoint to create/update flows
const saveFlowHandler = async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const flow = req.body;

    await flowProvider.saveFlow(flowId, flow);

    res.json({ success: true, flowId });
  } catch (error) {
    logger.error("[ERROR] Failed to save flow:", error);
    res.status(500).json({ error: "Failed to save flow" });
  }
};

// Support both POST and PUT for flow creation/update
app.post("/api/flows/:flowId", flowLimiter, validateParams(flowIdSchema), validateBody(flowSchema), saveFlowHandler);
app.put("/api/flows/:flowId", flowLimiter, validateParams(flowIdSchema), validateBody(flowSchema), saveFlowHandler);

// API endpoint to get a flow
app.get("/api/flows/:flowId", validateParams(flowIdSchema), async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const flow = await flowProvider.getFlow(flowId);

    if (!flow) {
      res.status(404).json({ error: "Flow not found" });
      return;
    }

    res.json(flow);
  } catch (error) {
    logger.error("[ERROR] Failed to get flow:", error);
    res.status(500).json({ error: "Failed to get flow" });
  }
});

// API endpoint to list all flows
app.get("/api/flows", async (req: Request, res: Response) => {
  try {
    const flowIds = await flowProvider.listFlows();

    // Get full flow data for each flow (for gallery)
    const fullFlows = await Promise.all(
      flowIds.map(async (id) => {
        try {
          const flow = await flowProvider.getFlow(id);
          return flow;
        } catch {
          return null;
        }
      })
    );

    // Filter out null values and return
    const validFlows = fullFlows.filter((f) => f !== null);
    res.json({ flows: validFlows });
  } catch (error) {
    logger.error("[ERROR] Failed to list flows:", error);
    res.status(500).json({ error: "Failed to list flows" });
  }
});

// API endpoint to delete a flow
app.delete("/api/flows/:flowId", validateParams(flowIdSchema), async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;

    // Check if flow exists before deleting
    const flow = await flowProvider.getFlow(flowId);
    if (!flow) {
      res.status(404).json({ error: "Flow not found" });
      return;
    }

    // Delete the flow
    if (flowProvider instanceof LocalStorageFlowProvider) {
      await flowProvider.deleteFlow(flowId);
      logger.info(`[API] Flow ${flowId} deleted successfully`);
      res.json({ success: true, flowId });
    } else {
      res.status(501).json({ error: "Delete not implemented for this storage type" });
    }
  } catch (error) {
    logger.error("[ERROR] Failed to delete flow:", error);
    res.status(500).json({ error: "Failed to delete flow" });
  }
});

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

// Auth routes (login, logout, me)
app.use("/api/auth", createAuthRouter());

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// WhatsApp connections routes - PROTEGIDAS
app.use("/api/connections/whatsapp", requireAuth, whatsappConnectionsRouter);

// Admin routes - PROTEGIDAS
app.use("/api/admin", requireAuth, createAdminRouter());

// Additional API routes (validation, simulation, monitoring, etc.) - PROTEGIDAS
app.use("/api", requireAuth, apiLimiter, createApiRoutes({ flowProvider, sessionStore }));

// Serve static files from dist directory (frontend)
app.use(express.static("dist"));

// SPA fallback: serve index.html for all non-API routes
// Use regex to exclude /api routes, preventing masking of undefined API endpoints
app.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
  res.sendFile("index.html", { root: "dist" });
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  const whatsappEnv = getWhatsAppEnv();
  const verifyToken = getWhatsAppVerifyToken();

  logDebug(`🚀 Server iniciado en puerto ${PORT}`);
  logDebug(`📱 WhatsApp webhook: http://localhost:${PORT}/api/meta/webhook`);
  logDebug(`⚙️  Access Token configurado: ${whatsappEnv.accessToken ? "SI" : "NO"}`);
  logDebug(`⚙️  Phone Number ID: ${whatsappEnv.phoneNumberId ? whatsappEnv.phoneNumberId : "NO CONFIGURADO"}`);

  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📱 WhatsApp webhook: http://localhost:${PORT}/api/meta/webhook`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
  logger.info(`⚙️  Configuration:`);
  logger.info(`   - Verify Token: ${verifyToken ? "✓" : "✗"}`);
  logger.info(`   - Access Token: ${whatsappEnv.accessToken ? "✓" : "✗"}`);
  logger.info(`   - Phone Number ID: ${whatsappEnv.phoneNumberId ? "✓" : "✗"}`);
  logger.info(`   - Default Flow ID: ${process.env.DEFAULT_FLOW_ID || "default-flow"}`);
  logger.info(`   - Session Storage: ${process.env.SESSION_STORAGE_TYPE || "file"}`);
  logger.info(`   - Bitrix24: ${bitrix24Client ? "✓" : "✗"}`);
  logger.info(`📊 Additional Endpoints:`);
  logger.info(`   - Logs: GET http://localhost:${PORT}/api/logs`);
  logger.info(`   - Stats: GET http://localhost:${PORT}/api/stats`);
  logger.info(`   - Metrics: GET http://localhost:${PORT}/api/metrics`);
  logger.info(`   - Active Conversations: GET http://localhost:${PORT}/api/conversations/active`);
  logger.info(`   - Validate Flow: POST http://localhost:${PORT}/api/validate`);
  logger.info(`   - Simulate Start: POST http://localhost:${PORT}/api/simulate/start`);
  logger.info(`   - Simulate Message: POST http://localhost:${PORT}/api/simulate/message`);
});

export { server };

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
