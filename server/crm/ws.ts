import { randomUUID } from "crypto";
import type { Server } from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { crmDb } from "./db";
import type { CRMEmitConversation, CRMEmitMessage } from "./models";
import { botLogger } from "../../src/runtime/monitoring";

const WS_PATH = "/api/crm/ws";
const HEARTBEAT_INTERVAL = 30_000;
const MAX_FRAME_SIZE = 2 * 1024 * 1024; // 2MB

const allowedOrigins = (process.env.CRM_WS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

function isOriginAllowed(originHeader: string | undefined): boolean {
  if (!originHeader) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(originHeader.trim());
}

interface ClientContext {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
}

interface IncomingFrame {
  type?: unknown;
  payload?: unknown;
}

interface ReadPayload {
  convId?: unknown;
}

export class CrmRealtimeGateway {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<string, ClientContext>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: WS_PATH });

    this.wss.on("connection", (socket, req) => {
      const origin = req.headers.origin;
      if (!isOriginAllowed(origin)) {
        botLogger.warn("[CRM] WS connection rejected", {
          origin: origin ?? null,
          remoteAddress: req.socket.remoteAddress,
        });
        socket.close(1008, "origin_not_allowed");
        return;
      }

      const clientId = randomUUID();
      const client: ClientContext = { id: clientId, socket, isAlive: true };
      this.clients.set(clientId, client);

      botLogger.info("[CRM] WS client connected", {
        clientId,
        totalClients: this.clients.size,
        remoteAddress: req.socket.remoteAddress,
      });

      socket.once("close", (code, reason) => {
        const reasonText = Buffer.isBuffer(reason) ? reason.toString("utf8") : String(reason ?? "");
        this.dropClient(clientId, code, reasonText);
      });
      socket.on("error", (error) => {
        botLogger.warn("[CRM] WS client error", { clientId, error: error instanceof Error ? error.message : String(error) });
      });
      socket.on("pong", () => {
        client.isAlive = true;
      });
      socket.on("message", (data) => {
        this.handleClientMessage(client, data);
      });

      this.sendFrame(client, {
        type: "welcome",
        serverTime: Date.now(),
        clientId,
      });
    });

    this.wss.on("error", (error) => {
      botLogger.error("[CRM] WS server error", error instanceof Error ? error : new Error(String(error)));
    });

    this.heartbeat = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.isAlive) {
          botLogger.warn("[CRM] WS heartbeat timeout", { clientId: client.id });
          client.socket.terminate();
          this.clients.delete(client.id);
          continue;
        }
        client.isAlive = false;
        try {
          client.socket.ping();
        } catch (error) {
          botLogger.warn("[CRM] WS ping failed", { clientId: client.id, error: error instanceof Error ? error.message : String(error) });
          client.socket.terminate();
          this.clients.delete(client.id);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  emitNewMessage(payload: CRMEmitMessage) {
    this.broadcast("crm:msg:new", payload);
  }

  emitMessageUpdate(payload: CRMEmitMessage) {
    this.broadcast("crm:msg:update", payload);
  }

  emitConversationUpdate(payload: CRMEmitConversation) {
    this.broadcast("crm:conv:update", payload);
  }

  close() {
    clearInterval(this.heartbeat);
    for (const client of this.clients.values()) {
      client.socket.close();
    }
    this.clients.clear();
    this.wss.close();
  }

  getStatus() {
    return {
      path: WS_PATH,
      clients: this.clients.size,
      allowedOrigins,
    };
  }

  private handleClientMessage(client: ClientContext, raw: RawData) {
    if (this.isFrameTooLarge(raw)) {
      botLogger.warn("[CRM] WS payload demasiado grande", { clientId: client.id });
      return;
    }

    let parsed: IncomingFrame;
    try {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      parsed = JSON.parse(text) as IncomingFrame;
    } catch (error) {
      botLogger.warn("[CRM] WS frame inválido", { clientId: client.id });
      this.sendFrame(client, { type: "error", message: "invalid_frame" });
      return;
    }

    if (!parsed || typeof parsed.type !== "string") {
      this.sendFrame(client, { type: "error", message: "invalid_type" });
      return;
    }

    switch (parsed.type) {
      case "hello": {
        this.sendFrame(client, { type: "welcome", serverTime: Date.now(), clientId: client.id });
        break;
      }
      case "typing": {
        if (parsed.payload && typeof parsed.payload === "object") {
          this.broadcast("crm:typing", parsed.payload, client.id);
        }
        break;
      }
      case "read": {
        this.handleReadCommand(client, parsed.payload as ReadPayload);
        break;
      }
      case "message": {
        this.sendFrame(client, {
          type: "ack",
          event: "message",
          serverTime: Date.now(),
          payload: parsed.payload ?? null,
        });
        break;
      }
      default: {
        this.sendFrame(client, { type: "error", message: "unknown_type" });
        break;
      }
    }
  }

  private isFrameTooLarge(raw: RawData): boolean {
    if (typeof raw === "string") {
      return Buffer.byteLength(raw, "utf8") > MAX_FRAME_SIZE;
    }
    if (Buffer.isBuffer(raw)) {
      return raw.byteLength > MAX_FRAME_SIZE;
    }
    if (Array.isArray(raw)) {
      const total = raw.reduce((sum, chunk) => sum + chunk.length, 0);
      return total > MAX_FRAME_SIZE;
    }
    if (raw instanceof ArrayBuffer) {
      return raw.byteLength > MAX_FRAME_SIZE;
    }
    return false;
  }

  private handleReadCommand(client: ClientContext, payload: ReadPayload) {
    if (!payload || typeof payload.convId !== "string") {
      this.sendFrame(client, { type: "error", message: "invalid_read_payload" });
      return;
    }

    crmDb.markConversationRead(payload.convId);
    const conversation = crmDb.getConversationById(payload.convId);
    if (conversation) {
      this.emitConversationUpdate({ conversation });
    }

    this.sendFrame(client, {
      type: "ack",
      event: "read",
      serverTime: Date.now(),
      payload: { convId: payload.convId },
    });
  }

  private broadcast(event: string, payload: unknown, skipClientId?: string) {
    for (const client of this.clients.values()) {
      if (skipClientId && client.id === skipClientId) continue;
      if (client.socket.readyState !== WebSocket.OPEN) continue;
      this.sendFrame(client, { type: "event", event, payload });
    }
  }

  private sendFrame(client: ClientContext, frame: Record<string, unknown>) {
    if (client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      client.socket.send(JSON.stringify(frame));
    } catch (error) {
      botLogger.warn("[CRM] WS send failed", {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private dropClient(clientId: string, code: number, reason: string) {
    if (!this.clients.has(clientId)) return;
    this.clients.delete(clientId);
    botLogger.info("[CRM] WS client disconnected", {
      clientId,
      code,
      reason,
      totalClients: this.clients.size,
    });
  }
}

const gateways = new WeakMap<Server, CrmRealtimeGateway>();

export function initCrmWSS(server: Server): CrmRealtimeGateway {
  const existing = gateways.get(server);
  if (existing) {
    return existing;
  }
  const gateway = new CrmRealtimeGateway(server);
  gateways.set(server, gateway);
  return gateway;
}

export type CrmRealtimeManager = CrmRealtimeGateway;
