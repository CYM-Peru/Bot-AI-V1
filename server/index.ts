import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
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

// Load environment variables
dotenv.config();

ensureStorageSetup();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "..", "dist");

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

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
      const defaultFlowId = process.env.DEFAULT_FLOW_ID || "default-flow";

      let flowId = defaultFlowId;

      // Try to find flow assigned to this WhatsApp number
      if (phoneNumberId && flowProvider instanceof LocalStorageFlowProvider) {
        const assignedFlow = await flowProvider.findFlowByWhatsAppNumber(phoneNumberId);
        if (assignedFlow) {
          flowId = assignedFlow.id;
          console.log(`[WhatsApp] Using assigned flow ${flowId} for number ${phoneNumberId}`);
        } else {
          console.log(`[WhatsApp] No assignment found for number ${phoneNumberId}, using default flow ${defaultFlowId}`);
        }
      }

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
  console.log('[WhatsApp] Reloading handler with updated credentials...');
  whatsappHandler = createWhatsAppHandler();
  console.log('[WhatsApp] Handler reloaded successfully');
});

const healthHandler = (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

// Health check endpoints
app.get("/health", healthHandler);
app.get("/api/healthz", healthHandler);

// WhatsApp webhook endpoint (Meta for Developers configured URL)
app.all("/api/meta/webhook", async (req: Request, res: Response) => {
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
app.post("/api/flows/:flowId", express.json(), async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const flow = req.body;

    await flowProvider.saveFlow(flowId, flow);

    res.json({ success: true, flowId });
  } catch (error) {
    console.error("[ERROR] Failed to save flow:", error);
    res.status(500).json({ error: "Failed to save flow" });
  }
});

// API endpoint to get a flow
app.get("/api/flows/:flowId", async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const flow = await flowProvider.getFlow(flowId);

    if (!flow) {
      res.status(404).json({ error: "Flow not found" });
      return;
    }

    res.json(flow);
  } catch (error) {
    console.error("[ERROR] Failed to get flow:", error);
    res.status(500).json({ error: "Failed to get flow" });
  }
});

// API endpoint to list all flows
app.get("/api/flows", async (req: Request, res: Response) => {
  try {
    const flows = await flowProvider.listFlows();
    res.json({ flows });
  } catch (error) {
    console.error("[ERROR] Failed to list flows:", error);
    res.status(500).json({ error: "Failed to list flows" });
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
app.use("/api", requireAuth, createApiRoutes({ flowProvider, sessionStore }));

// Serve static files from dist directory (frontend)
app.use(express.static(distPath));

// SPA fallback: serve index.html for all non-API routes
// Use regex to exclude /api routes, preventing masking of undefined API endpoints
app.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Start server
server.listen(PORT, () => {
  const whatsappEnv = getWhatsAppEnv();
  const verifyToken = getWhatsAppVerifyToken();

  logDebug(`🚀 Server iniciado en puerto ${PORT}`);
  logDebug(`📱 WhatsApp webhook: http://localhost:${PORT}/api/meta/webhook`);
  logDebug(`⚙️  Access Token configurado: ${whatsappEnv.accessToken ? "SI" : "NO"}`);
  logDebug(`⚙️  Phone Number ID: ${whatsappEnv.phoneNumberId ? whatsappEnv.phoneNumberId : "NO CONFIGURADO"}`);

  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/api/meta/webhook`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n⚙️  Configuration:`);
  console.log(`   - Verify Token: ${verifyToken ? "✓" : "✗"}`);
  console.log(`   - Access Token: ${whatsappEnv.accessToken ? "✓" : "✗"}`);
  console.log(`   - Phone Number ID: ${whatsappEnv.phoneNumberId ? "✓" : "✗"}`);
  console.log(`   - Default Flow ID: ${process.env.DEFAULT_FLOW_ID || "default-flow"}`);
  console.log(`   - Session Storage: ${process.env.SESSION_STORAGE_TYPE || "file"}`);
  console.log(`   - Bitrix24: ${bitrix24Client ? "✓" : "✗"}`);
  console.log(`\n📊 Additional Endpoints:`);
  console.log(`   - Logs: GET http://localhost:${PORT}/api/logs`);
  console.log(`   - Stats: GET http://localhost:${PORT}/api/stats`);
  console.log(`   - Metrics: GET http://localhost:${PORT}/api/metrics`);
  console.log(`   - Active Conversations: GET http://localhost:${PORT}/api/conversations/active`);
  console.log(`   - Validate Flow: POST http://localhost:${PORT}/api/validate`);
  console.log(`   - Simulate Start: POST http://localhost:${PORT}/api/simulate/start`);
  console.log(`   - Simulate Message: POST http://localhost:${PORT}/api/simulate/message`);
});

export { server };

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
