import express, { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { RuntimeEngine } from "../src/runtime/engine";
import { NodeExecutor } from "../src/runtime/executor";
import { InMemorySessionStore } from "../src/runtime/session";
import { WhatsAppWebhookHandler } from "../src/api/whatsapp-webhook";
import { LocalStorageFlowProvider } from "./flow-provider";
import { HttpWebhookDispatcher } from "./webhook-dispatcher";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Runtime Engine
const flowProvider = new LocalStorageFlowProvider();
const sessionStore = new InMemorySessionStore();
const webhookDispatcher = new HttpWebhookDispatcher();
const executor = new NodeExecutor({ webhookDispatcher });

const runtimeEngine = new RuntimeEngine({
  flowProvider,
  sessionStore,
  executor,
});

// Initialize WhatsApp Webhook Handler
const whatsappHandler = new WhatsAppWebhookHandler({
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "default_verify_token",
  engine: runtimeEngine,
  apiConfig: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v20.0",
  },
  resolveFlow: async (context) => {
    // Default flow resolution: map phone number to session
    // You can customize this logic based on your needs
    const phoneNumber = context.message.from;
    const defaultFlowId = process.env.DEFAULT_FLOW_ID || "default-flow";

    return {
      sessionId: `whatsapp_${phoneNumber}`,
      flowId: defaultFlowId,
      contactId: phoneNumber,
      channel: "whatsapp",
    };
  },
  logger: {
    info: (message, meta) => console.log(`[INFO] ${message}`, meta),
    warn: (message, meta) => console.warn(`[WARN] ${message}`, meta),
    error: (message, meta) => console.error(`[ERROR] ${message}`, meta),
  },
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp webhook: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n⚙️  Configuration:`);
  console.log(`   - Verify Token: ${process.env.WHATSAPP_VERIFY_TOKEN ? "✓" : "✗"}`);
  console.log(`   - Access Token: ${process.env.WHATSAPP_ACCESS_TOKEN ? "✓" : "✗"}`);
  console.log(`   - Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID ? "✓" : "✗"}`);
  console.log(`   - Default Flow ID: ${process.env.DEFAULT_FLOW_ID || "default-flow"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
