export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";

type EventHandler<T> = (payload: T) => void;

type ClientEvents = {
  state: ConnectionState;
  frame: WsIncomingFrame;
  error: { message: string };
};

export type WsIncomingFrame =
  | { type: "welcome"; serverTime: number; clientId: string }
  | { type: "event"; event: string; payload?: unknown }
  | { type: "ack"; event?: string; payload?: unknown; serverTime?: number }
  | { type: "error"; message: string }
  | { type: "pong"; serverTime?: number }
  | { type: "unknown"; raw: unknown };

interface QueuedMessage {
  type: string;
  payload?: unknown;
}

const MAX_BACKOFF = 10_000;
const INITIAL_BACKOFF = 1_000;

function computeWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  return `${protocol}${window.location.host}/api/crm/ws`;
}

export class CrmSocket {
  private readonly listeners: { [K in keyof ClientEvents]: Set<EventHandler<ClientEvents[K]>> } = {
    state: new Set(),
    frame: new Set(),
    error: new Set(),
  };
  private socket: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private reconnectAttempts = 0;
  private readonly queue: QueuedMessage[] = [];
  private shouldReconnect = true;
  private readonly url: string;

  constructor(url?: string) {
    this.url = url ?? computeWsUrl();
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.shouldReconnect = true;
    this.openSocket();
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.updateState("closed");
    this.queue.length = 0;
    for (const set of Object.values(this.listeners)) {
      set.clear();
    }
  }

  on<K extends keyof ClientEvents>(event: K, handler: EventHandler<ClientEvents[K]>) {
    this.listeners[event].add(handler);
  }

  off<K extends keyof ClientEvents>(event: K, handler: EventHandler<ClientEvents[K]>) {
    this.listeners[event].delete(handler);
  }

  send(type: string, payload?: unknown) {
    const frame = JSON.stringify({ type, payload });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(frame);
      return;
    }
    if (this.state === "closed") return;
    this.queue.push({ type, payload });
  }

  private openSocket() {
    try {
      this.socket = new WebSocket(this.url);
    } catch (error) {
      this.emit("error", { message: error instanceof Error ? error.message : String(error) });
      this.scheduleReconnect();
      return;
    }

    this.updateState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    this.socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.updateState("connected");
      const pending = this.queue.splice(0);
      for (const message of pending) {
        this.send(message.type, message.payload);
      }
    });

    this.socket.addEventListener("message", (event) => {
      const frame = parseFrame(event.data);
      this.emit("frame", frame);
    });

    this.socket.addEventListener("error", (event) => {
      const message = (event as ErrorEvent)?.message ?? "ws_error";
      this.emit("error", { message });
    });

    this.socket.addEventListener("close", () => {
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      } else {
        this.updateState("closed");
      }
    });
  }

  private scheduleReconnect() {
    this.updateState("reconnecting");
    const delay = Math.min(MAX_BACKOFF, INITIAL_BACKOFF * 2 ** this.reconnectAttempts);
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, 6);
    setTimeout(() => {
      if (!this.shouldReconnect) return;
      this.openSocket();
    }, delay);
  }

  private emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]) {
    for (const handler of this.listeners[event]) {
      try {
        handler(payload);
      } catch (error) {
        console.error("[CRM] WS handler error", error);
      }
    }
  }

  private updateState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.emit("state", next);
  }
}

function parseFrame(data: unknown): WsIncomingFrame {
  if (typeof data !== "string") {
    return { type: "unknown", raw: data };
  }
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (typeof parsed.type !== "string") {
      return { type: "unknown", raw: parsed };
    }
    switch (parsed.type) {
      case "welcome":
        return {
          type: "welcome",
          serverTime: Number(parsed.serverTime) || Date.now(),
          clientId: typeof parsed.clientId === "string" ? parsed.clientId : "",
        };
      case "event":
        return {
          type: "event",
          event: typeof parsed.event === "string" ? parsed.event : "",
          payload: parsed.payload,
        };
      case "ack":
        return {
          type: "ack",
          event: typeof parsed.event === "string" ? parsed.event : undefined,
          payload: parsed.payload,
          serverTime: typeof parsed.serverTime === "number" ? parsed.serverTime : undefined,
        };
      case "error":
        return {
          type: "error",
          message: typeof parsed.message === "string" ? parsed.message : "unknown_error",
        };
      case "pong":
        return {
          type: "pong",
          serverTime: typeof parsed.serverTime === "number" ? parsed.serverTime : undefined,
        };
      default:
        return { type: "unknown", raw: parsed };
    }
  } catch (error) {
    console.warn("[CRM] No se pudo parsear frame WS", error);
    return { type: "unknown", raw: data };
  }
}
