import type { Attachment, Conversation, Message } from "./types";
import { CrmSocket as WsGateway, type WsIncomingFrame } from "../utils/wsClient";

export interface AdvisorPresence {
  userId: string;
  user: {
    id: string;
    username: string;
    name?: string;
    email: string;
    role: string;
  };
  status: {
    id: string;
    name: string;
    color: string;
    action: "accept" | "redirect" | "pause";
  } | null;
  isOnline: boolean;
  activeConversations: number;
}

export type CrmSocketEvents = {
  "crm:msg:new": { message: Message; attachment?: Attachment | null };
  "crm:msg:update": { message: Message; attachment?: Attachment | null };
  "crm:msg:deleted": { messageId: string; convId: string };
  "crm:conv:update": { conversation: Conversation };
  "crm:typing": { convId: string; author?: string | null };
  "crm:read": string;
  "crm:advisor:presence": AdvisorPresence;
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
  const knownEvents: Array<keyof CrmSocketEvents> = [
    "connected",
    "crm:msg:new",
    "crm:msg:update",
    "crm:msg:deleted",
    "crm:conv:update",
    "crm:typing",
    "crm:read",
    "crm:advisor:presence",
  ];
  const knownEventSet = new Set(knownEvents);
  const gateway = new WsGateway();
  let currentClientId = "";

  const handleFrame = (frame: WsIncomingFrame) => {
    console.log('[CRM Socket] 🔄 handleFrame called:', {
      frameType: frame.type,
      isEvent: frame.type === 'event',
      timestamp: new Date().toISOString()
    });

    if (frame.type === "welcome") {
      currentClientId = frame.clientId;
      emitLocal("connected", { clientId: frame.clientId });

      // Send auth token after welcome to mark advisor as online
      const token = localStorage.getItem("token") || document.cookie.split("; ").find(row => row.startsWith("token="))?.split("=")[1];
      if (token) {
        console.log('[CRM Socket] Sending auth token to server');
        gateway.send("auth", { token });
      } else {
        console.warn('[CRM Socket] No auth token found');
      }
      return;
    }
    if (frame.type === "event") {
      const eventName = frame.event as keyof CrmSocketEvents;
      console.log('[CRM Socket] 🎯 Event frame received:', {
        eventName,
        isKnown: knownEventSet.has(eventName),
        knownEvents: Array.from(knownEventSet),
        hasPayload: !!frame.payload
      });
      if (!knownEventSet.has(eventName)) {
        console.warn('[CRM Socket] ⚠️  Event NOT in known set, ignoring:', eventName);
        return;
      }
      console.log('[CRM Socket] ✅ Calling emitLocal for:', eventName);
      emitLocal(eventName, frame.payload as CrmSocketEvents[keyof CrmSocketEvents]);
      return;
    }
    if (frame.type === "ack" && frame.event === "read") {
      const convId = (frame.payload as { convId?: string })?.convId;
      if (typeof convId === "string" && convId) {
        emitLocal("crm:read", convId);
      }
    }
  };

  gateway.on("frame", handleFrame);
  gateway.connect();
  gateway.send("hello", { scope: "crm-ui" });

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
      if (event === "crm:read") {
        gateway.send("read", { convId: payload });
      } else if (event === "crm:typing") {
        gateway.send("typing", payload);
      }
    },
    disconnect() {
      gateway.off("frame", handleFrame);
      gateway.disconnect();
      listeners.clear();
    },
  };

  function emitLocal(event: keyof CrmSocketEvents, payload: CrmSocketEvents[keyof CrmSocketEvents]) {
    const handlers = listeners.get(event);
    console.log('[CRM Socket] 🚀 emitLocal called:', {
      event,
      hasHandlers: !!handlers,
      handlerCount: handlers?.size || 0,
      allListeners: Array.from(listeners.keys())
    });
    if (!handlers) {
      console.warn('[CRM Socket] ⚠️  No handlers registered for event:', event);
      return;
    }
    console.log(`[CRM Socket] 📢 Calling ${handlers.size} handler(s) for ${event}`);
    for (const handler of handlers) {
      try {
        handler(payload as CrmSocketEvents[typeof event]);
        console.log('[CRM Socket] ✅ Handler executed successfully for:', event);
      } catch (error) {
        console.error("[CRM] Handler falló", error);
      }
    }
  }
}
