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
import { logDebug, logError, logInfo } from "./utils/file-logger";
import logger from "./utils/logger";
import { TimerScheduler } from "./timer-scheduler";
import { QueueScheduler } from "./queue-scheduler";
import { authLimiter, apiLimiter, webhookLimiter, flowLimiter } from "./middleware/rate-limit";
import { validate } from "./middleware/validation";
import { saveFlowSchema, getFlowSchema } from "./validation/flow.schemas";
import { errorHandler, notFoundHandler, setupUnhandledRejectionHandler, setupUncaughtExceptionHandler, asyncHandler } from "./middleware/error-handler";
import { NotFoundError, InternalServerError } from "./utils/errors";
import { validateEnvironment, printEnvironmentConfig } from "./utils/env-validator";

// Load environment variables
dotenv.config();

// Validate environment variables
try {
  validateEnvironment();
  printEnvironmentConfig();
} catch (error) {
  console.error("❌ Environment validation failed:");
  console.error((error as Error).message);
  process.exit(1);
}

// Setup global error handlers for unhandled rejections and exceptions
setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

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
      const defaultFlowId = process.env.DEFAULT_FLOW_ID || "default-flow";

      let flowId = defaultFlowId;

      // Try to find flow assigned to this WhatsApp number
      if (phoneNumberId && flowProvider instanceof LocalStorageFlowProvider) {
        const assignedFlow = await flowProvider.findFlowByWhatsAppNumber(phoneNumberId);
        if (assignedFlow) {
          flowId = assignedFlow.id;
          logInfo(`Using assigned flow ${flowId} for WhatsApp number ${phoneNumberId}`, {
            component: 'WhatsApp',
            flowId,
            phoneNumberId
          });
        } else {
          logInfo(`No flow assignment found for WhatsApp number ${phoneNumberId}, using default`, {
            component: 'WhatsApp',
            phoneNumberId,
            defaultFlowId
          });
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
  logInfo('Reloading WhatsApp handler with updated credentials', { component: 'WhatsApp' });
  whatsappHandler = createWhatsAppHandler();
  logInfo('WhatsApp handler reloaded successfully', { component: 'WhatsApp' });
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
app.post("/api/flows/:flowId", flowLimiter, express.json(), validate(saveFlowSchema), asyncHandler(async (req: Request, res: Response) => {
  const { flowId } = req.params;
  const flow = req.body;

  await flowProvider.saveFlow(flowId, flow);

  res.json({ success: true, flowId });
}));

// API endpoint to get a flow
app.get("/api/flows/:flowId", validate(getFlowSchema), asyncHandler(async (req: Request, res: Response) => {
  const { flowId } = req.params;
  const flow = await flowProvider.getFlow(flowId);

  if (!flow) {
    throw new NotFoundError("Flow not found");
  }

  res.json(flow);
}));

// API endpoint to list all flows
app.get("/api/flows", asyncHandler(async (req: Request, res: Response) => {
  const flows = await flowProvider.listFlows();
  res.json({ flows });
}));

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

  // Log startup info for debugging (these still go to debug.log via file-logger)
  logDebug(`🚀 Server iniciado en puerto ${PORT}`);
  logDebug(`📱 WhatsApp webhook: http://localhost:${PORT}/api/meta/webhook`);
  logDebug(`⚙️  Access Token configurado: ${whatsappEnv.accessToken ? "SI" : "NO"}`);
  logDebug(`⚙️  Phone Number ID: ${whatsappEnv.phoneNumberId ? whatsappEnv.phoneNumberId : "NO CONFIGURADO"}`);

  // Structured logging for server startup
  logger.info(`Server running on port ${PORT}`, {
    component: 'Server',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    config: {
      verifyToken: !!verifyToken,
      accessToken: !!whatsappEnv.accessToken,
      phoneNumberId: !!whatsappEnv.phoneNumberId,
      defaultFlowId: process.env.DEFAULT_FLOW_ID || "default-flow",
      sessionStorage: process.env.SESSION_STORAGE_TYPE || "file",
      bitrix24: !!bitrix24Client,
    }
  });

  // Console output for visibility
  logger.info(`📱 WhatsApp webhook: http://localhost:${PORT}/api/meta/webhook`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
  logger.info(`\n⚙️  Configuration:`);
  logger.info(`   - Verify Token: ${verifyToken ? "✓" : "✗"}`);
  logger.info(`   - Access Token: ${whatsappEnv.accessToken ? "✓" : "✗"}`);
  logger.info(`   - Phone Number ID: ${whatsappEnv.phoneNumberId ? "✓" : "✗"}`);
  logger.info(`   - Default Flow ID: ${process.env.DEFAULT_FLOW_ID || "default-flow"}`);
  logger.info(`   - Session Storage: ${process.env.SESSION_STORAGE_TYPE || "file"}`);
  logger.info(`   - Bitrix24: ${bitrix24Client ? "✓" : "✗"}`);
  logger.info(`\n📊 Additional Endpoints:`);
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
  logger.info("SIGTERM received, shutting down gracefully...", { component: 'Server' });
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully...", { component: 'Server' });
  process.exit(0);
});
