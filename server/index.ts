import express, { type Request, type Response } from "express";
import cors from "cors";
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

// Load environment variables
dotenv.config();

ensureStorageSetup();

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

// Middleware
app.use(cors());
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

const webhookDispatcher = new HttpWebhookDispatcher();
const executor = new NodeExecutor({
  webhookDispatcher,
  bitrix24Client,
});

const runtimeEngine = new RuntimeEngine({
  flowProvider,
  sessionStore,
  executor,
});

// Conversational CRM module
const crmSocketManager = initCrmWSS(server);
const crmModule = registerCrmModule({
  app,
  socketManager: crmSocketManager,
  bitrixClient: bitrix24Client,
});

// Initialize WhatsApp Webhook Handler
const whatsappEnv = getWhatsAppEnv();

const whatsappHandler = new WhatsAppWebhookHandler({
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
    const defaultFlowId = process.env.DEFAULT_FLOW_ID || "default-flow";

    // Log conversation start
    const sessionId = `whatsapp_${phoneNumber}`;
    botLogger.logConversationStarted(sessionId, defaultFlowId);
    metricsTracker.startConversation(sessionId, defaultFlowId);

    return {
      sessionId,
      flowId: defaultFlowId,
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
    await crmModule.handleIncomingWhatsApp(payload);
  },
});

const healthHandler = (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

// Health check endpoints
app.get("/health", healthHandler);
app.get("/api/healthz", healthHandler);

// WhatsApp webhook endpoint
app.all("/webhook/whatsapp", async (req: Request, res: Response) => {
  try {
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

    res.status(response.status).send(body);
  } catch (error) {
    console.error("[ERROR] Failed to handle webhook:", error);
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

// Mount additional API routes (validation, simulation, monitoring, etc.)
app.use("/api", createApiRoutes({ flowProvider, sessionStore }));

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n⚙️  Configuration:`);
  console.log(`   - Verify Token: ${whatsappEnv.verifyToken ? "✓" : "✗"}`);
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
