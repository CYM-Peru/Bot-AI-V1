import { API_BASE } from "../lib/apiBase";
import type { Attachment, Conversation, Message } from "./types";

const SOCKET_PATH = "/api/crm/socket";

export type CrmSocketEvents = {
  "crm:msg:new": { message: Message; attachment?: Attachment | null };
  "crm:msg:update": { message: Message; attachment?: Attachment | null };
  "crm:conv:update": { conversation: Conversation };
  "crm:typing": { convId: string; author?: string | null };
  "crm:read": string;
  connected: { clientId: string };
};

export interface CrmSocket {
  on<K extends keyof CrmSocketEvents>(event: K, handler: (payload: CrmSocketEvents[K]) => void): void;
  off<K extends keyof CrmSocketEvents>(event: K, handler: (payload: CrmSocketEvents[K]) => void): void;
  emit<K extends keyof CrmSocketEvents>(event: K, payload: CrmSocketEvents[K]): void;
  disconnect(): void;
  readonly clientId: string;
}

export function createCrmSocket(): CrmSocket {
  const listeners = new Map<keyof CrmSocketEvents, Set<(payload: CrmSocketEvents[keyof CrmSocketEvents]) => void>>();
  const pending: Array<{ event: keyof CrmSocketEvents; payload: CrmSocketEvents[keyof CrmSocketEvents] }> = [];
  const knownEvents: Array<keyof CrmSocketEvents> = [
    "connected",
    "crm:msg:new",
    "crm:msg:update",
    "crm:conv:update",
    "crm:typing",
    "crm:read",
  ];
  const knownEventSet = new Set(knownEvents);
  let currentClientId = "";
  let isClosed = false;

  const socket = new WebSocket(buildSocketUrl());

  socket.addEventListener("open", () => {
    for (const entry of pending.splice(0, pending.length)) {
      safeSend(entry.event, entry.payload);
    }
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      return;
    }
    try {
      const parsed = JSON.parse(event.data) as { event?: string; payload?: unknown };
      if (!parsed || typeof parsed.event !== "string") {
        return;
      }
      if (!knownEventSet.has(parsed.event as keyof CrmSocketEvents)) {
        return;
      }
      const eventName = parsed.event as keyof CrmSocketEvents;
      const payload = parsed.payload as CrmSocketEvents[keyof CrmSocketEvents];
      if (eventName === "connected" && payload && typeof payload === "object") {
        const client = payload as { clientId?: unknown };
        if (typeof client.clientId === "string") {
          currentClientId = client.clientId;
        }
      }
      emitLocal(eventName, payload);
    } catch (error) {
      console.warn("[CRM] Mensaje WebSocket inválido", error);
    }
  });

  socket.addEventListener("close", () => {
    isClosed = true;
    listeners.clear();
    pending.length = 0;
  });

  function emitLocal(event: keyof CrmSocketEvents, payload: CrmSocketEvents[keyof CrmSocketEvents]) {
    const handlers = listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload as CrmSocketEvents[typeof event]);
      } catch (error) {
        console.error("[CRM] Handler falló", error);
      }
    }
  }

  function safeSend(event: keyof CrmSocketEvents, payload: CrmSocketEvents[keyof CrmSocketEvents]) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ event, payload }));
      } catch (error) {
        console.error("[CRM] No se pudo enviar evento", error);
      }
    } else if (!isClosed) {
      pending.push({ event, payload });
    }
  }

  return {
    get clientId() {
      return currentClientId;
    },
    on(event, handler) {
      if (!knownEventSet.has(event)) return;
      const set = listeners.get(event) ?? new Set();
      set.add(handler as (payload: CrmSocketEvents[keyof CrmSocketEvents]) => void);
      listeners.set(event, set);
    },
    off(event, handler) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler as (payload: CrmSocketEvents[keyof CrmSocketEvents]) => void);
      if (set.size === 0) {
        listeners.delete(event);
      }
    },
    emit(event, payload) {
      if (!knownEventSet.has(event)) return;
      safeSend(event, payload);
    },
    disconnect() {
      isClosed = true;
      pending.length = 0;
      listeners.clear();
      if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        return;
      }
      socket.close();
    },
  };
}

function buildSocketUrl(): string {
  try {
    const base = new URL(API_BASE);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    base.pathname = joinPath(base.pathname, SOCKET_PATH);
    base.search = "";
    base.hash = "";
    return base.toString();
  } catch {
    const prefix = API_BASE.replace(/^http/, "ws");
    return `${prefix.replace(/\/$/, "")}${SOCKET_PATH}`;
  }
}

function joinPath(basePath: string, suffix: string) {
  const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return `${normalizedBase}${suffix}`;
}
