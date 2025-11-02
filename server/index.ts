import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { promises as fs } from "fs";
import path from "path";
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
import { getWhatsAppEnv, getWhatsAppVerifyToken, getBitrixClientConfig } from "./utils/env";
import whatsappConnectionsRouter from "./connections/whatsapp-routes";
import { registerReloadCallback } from "./whatsapp-handler-manager";
import { createAdminRouter } from "./routes/admin";
import { createAuthRouter } from "./routes/auth";
import { createBitrixRouter } from "./routes/bitrix";
import { createCampaignsRouter } from "./campaigns/routes";
import { requireAuth } from "./auth/middleware";
import { adminDb } from "./admin-db";
import { logDebug, logError } from "./utils/file-logger";
import { TimerScheduler } from "./timer-scheduler";
import { QueueScheduler } from "./queue-scheduler";
import { authLimiter, apiLimiter, webhookLimiter, flowLimiter } from "./middleware/rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import logger from "./utils/logger";
import { validateBody, validateParams } from "./middleware/validate";
import { flowSchema, flowIdSchema } from "./schemas/validation";
import { validateEnv } from "./utils/validate-env";
import { REQUEST_BODY_SIZE_LIMIT, validateConfig } from "./config";

// Load environment variables
dotenv.config();

// Validate environment variables (exits if validation fails)
validateEnv();

// Validate critical server configuration
validateConfig();

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

// ⚠️ CONFIGURACIÓN PROTEGIDA - NO MODIFICAR DIRECTAMENTE ⚠️
// El límite de tamaño del cuerpo de las peticiones está definido en server/config.ts
// Este valor debe ser al menos 2500mb para soportar flujos complejos
app.use(express.json({ limit: REQUEST_BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_SIZE_LIMIT }));

// Initialize Runtime Engine
const flowProvider = new LocalStorageFlowProvider();

// Create session store based on configuration
const sessionStore = createSessionStore({
  type: (process.env.SESSION_STORAGE_TYPE as "memory" | "file") || "file",
  fileStorageDir: process.env.SESSION_STORAGE_PATH || "./data/sessions",
});

// Initialize Bitrix24 client if configured (OAuth o webhook)
const bitrixConfig = getBitrixClientConfig();
const bitrix24Client = bitrixConfig ? new Bitrix24Client(bitrixConfig) : undefined;

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
  flowProvider,
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
    onBotTransfer: async (payload) => {
      // CRITICAL: Assign conversation to queue when bot transfers
      try {
        const { crmDb } = await import('./crm/db');
        const conversation = crmDb.getConversationByPhone(payload.phone);

        if (!conversation) {
          logger.warn(`[Bot Transfer] Conversation not found for phone: ${payload.phone}`);
          return;
        }

        if (payload.queueId) {
          crmDb.updateConversationQueue(conversation.id, payload.queueId);
          logger.info(`[Bot Transfer] ✅ Conversation ${conversation.id} assigned to queue: ${payload.queueId}`);
        } else {
          logger.warn(`[Bot Transfer] ⚠️ No queueId provided - conversation ${conversation.id} may go to limbo`);
        }
      } catch (error) {
        logError(`[Bot Transfer] Error:`, error);
      }
    },
    onBotMessage: async (payload) => {
      // Register bot messages in CRM
      try {
        const { crmDb } = await import('./crm/db');
        let conversation = crmDb.getConversationByPhone(payload.phone);

        if (!conversation) {
          conversation = crmDb.createConversation(payload.phone);
        }

        // Extract text from bot message
        let text = '';
        let mediaUrl: string | null = null;
        let type: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';

        if (payload.message.type === 'text') {
          text = payload.message.text;
        } else if (payload.message.type === 'buttons') {
          text = payload.message.text;
        } else if (payload.message.type === 'menu') {
          text = payload.message.text || '';
          if (payload.message.header) text = `${payload.message.header}\n\n${text}`;
          if (payload.message.footer) text = `${text}\n\n${payload.message.footer}`;
        } else if (payload.message.type === 'media') {
          text = payload.message.caption || '';
          mediaUrl = payload.message.url;
          type = payload.message.mediaType === 'image' ? 'image' :
                 payload.message.mediaType === 'video' ? 'video' :
                 payload.message.mediaType === 'audio' ? 'audio' : 'document';
        }

        // Append bot message to CRM
        crmDb.appendMessage({
          convId: conversation.id,
          direction: 'outgoing',
          type,
          text: text || '🤖 [Bot]',
          mediaUrl,
          mediaThumb: null,
          repliedToId: null,
          status: payload.result.ok ? 'sent' : 'failed',
          providerMetadata: { bot: true },
        });

        logDebug(`[Bot Message] Registered in CRM for ${payload.phone}`);
      } catch (error) {
        logError(`[Bot Message] Failed to register in CRM:`, error);
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
    let payload = req.body;

    // Basic validation
    if (!payload || typeof payload !== 'object') {
      logger.error(`[ERROR] Invalid flow data for ${flowId}: not an object`);
      res.status(400).json({ error: "Invalid flow data" });
      return;
    }

    // CRITICAL FIX: Unwrap flow if it's wrapped in {flow: {...}, positions: {...}}
    // Frontend sends wrapped format, but we need to store only the flow
    let flow;
    if (payload.flow && typeof payload.flow === 'object') {
      logger.info(`[INFO] Unwrapping flow ${flowId} from wrapped format`);
      flow = payload.flow;
    } else {
      flow = payload;
    }

    // Validate the unwrapped flow has required fields
    if (!flow.id || !flow.nodes || typeof flow.nodes !== 'object') {
      logger.error(`[ERROR] Invalid flow structure for ${flowId}:`, {
        hasId: !!flow.id,
        hasNodes: !!flow.nodes,
        bodyKeys: Object.keys(flow).slice(0, 10)
      });
      res.status(400).json({ error: "Invalid flow structure - missing id or nodes" });
      return;
    }

    logger.info(`[INFO] Saving flow ${flowId}`, {
      flowName: flow.name,
      nodeCount: Object.keys(flow.nodes || {}).length,
      hasRootId: !!flow.rootId,
      flowId: flow.id
    });

    // Create backup before saving
    if (flowProvider instanceof LocalStorageFlowProvider) {
      try {
        const existingFlow = await flowProvider.getFlow(flowId);
        if (existingFlow) {
          const backupPath = path.join(process.cwd(), "data", "flows", `${flowId}.backup`);
          await fs.writeFile(backupPath, JSON.stringify(existingFlow, null, 2), "utf-8");
          logger.info(`[INFO] Created backup for flow ${flowId}`);
        }
      } catch (backupError) {
        logger.warn(`[WARN] Failed to create backup for flow ${flowId}:`, backupError);
        // Continue with save even if backup fails
      }
    }

    await flowProvider.saveFlow(flowId, flow);

    logger.info(`[INFO] Flow ${flowId} saved successfully`);
    res.json({ success: true, flowId });
  } catch (error) {
    logger.error("[ERROR] Failed to save flow:", {
      flowId: req.params.flowId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to save flow" });
  }
};

// Support both POST and PUT for flow creation/update
// NOTE: Body validation removed for flows - they have complex, dynamic structure
app.post("/api/flows/:flowId", flowLimiter, validateParams(flowIdSchema), saveFlowHandler);
app.put("/api/flows/:flowId", flowLimiter, validateParams(flowIdSchema), saveFlowHandler);

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
          // Validar que el flujo tenga un ID válido
          if (!flow || !flow.id) {
            logger.error(`[ERROR] Flow sin ID válido: ${id}`, flow);
            return null;
          }
          return flow;
        } catch (error) {
          logger.error(`[ERROR] Failed to load flow ${id}:`, error);
          return null;
        }
      })
    );

    // Filter out null values and flows without valid IDs
    const validFlows = fullFlows.filter((f) => f !== null && f.id);
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

// Bitrix OAuth routes (MUST be public for OAuth callbacks)
app.use("/api/bitrix", createBitrixRouter());

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// WhatsApp connections routes - PROTEGIDAS
app.use("/api/connections/whatsapp", requireAuth, whatsappConnectionsRouter);

// Admin routes
const adminRouter = createAdminRouter();

// Make whatsapp-numbers endpoint PUBLIC for canvas use (BEFORE auth middleware)
app.get("/api/admin/whatsapp-numbers", (req, res) => {
  try {
    const numbers = adminDb.getAllWhatsAppNumbers();
    res.json({ numbers });
  } catch (error) {
    logger.error("[Admin] Error getting WhatsApp numbers:", error);
    res.status(500).json({ error: "Failed to get WhatsApp numbers" });
  }
});

// All other admin routes REQUIRE AUTH
app.use("/api/admin", requireAuth, adminRouter);

// Campaigns routes - PROTEGIDAS CON AUTH
app.use("/api/campaigns", requireAuth, createCampaignsRouter());

// Additional API routes (validation, simulation, monitoring, etc.) - PROTEGIDAS
app.use("/api", requireAuth, apiLimiter, createApiRoutes({ flowProvider, sessionStore }));

// Serve static files from dist directory (frontend)
// Serve static files with no-cache headers to prevent stale JS bundles
app.use(express.static("dist", {
  setHeaders: (res, path) => {
    // Disable caching for HTML and JS files to ensure latest code is loaded
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// SPA fallback: serve index.html for all non-API routes
// Use regex to exclude /api routes, preventing masking of undefined API endpoints
app.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile("index.html", { root: "dist" });
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server
server.listen(PORT, async () => {
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

  // ========== PROACTIVE BITRIX24 TOKEN REFRESH ==========
  // Auto-refresh Bitrix24 tokens BEFORE they expire (every hour)
  // Check every 10 minutes, refresh if token is near expiration
  const { refreshBitrixTokens, readTokens } = await import("./routes/bitrix");

  setInterval(async () => {
    try {
      const tokens = readTokens();
      if (!tokens?.refresh_token || !tokens?.expires) {
        return; // No tokens to refresh or no expiration time
      }

      const now = Date.now();
      const expiresAt = tokens.expires;
      const timeUntilExpiry = expiresAt - now;
      const threshold = 15 * 60 * 1000; // 15 minutes before expiration

      // Refresh if token expires in less than 15 minutes
      if (timeUntilExpiry < threshold && timeUntilExpiry > 0) {
        logger.info("[Bitrix] Proactive token refresh triggered", {
          expires_in_minutes: Math.floor(timeUntilExpiry / 60000),
          threshold_minutes: 15
        });
        await refreshBitrixTokens();
        logger.info("[Bitrix] Proactive token refresh completed successfully");
      }
    } catch (err) {
      logger.error("[Bitrix] Proactive token refresh failed", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }, 10 * 60 * 1000); // Check every 10 minutes

  logger.info("[Bitrix] Proactive token refresh mechanism initialized", {
    check_interval_minutes: 10,
    refresh_threshold_minutes: 15
  });
  // ========== END PROACTIVE BITRIX24 TOKEN REFRESH ==========
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
