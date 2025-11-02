import { type ChannelKey } from "../flow/types";
import { RuntimeEngine } from "../runtime/engine";
import { type IncomingMessage, type OutboundMessage } from "../runtime/executor";
import {
  type WhatsAppApiConfig,
  type WhatsAppApiResult,
  type WhatsAppButtonDefinition,
  type WhatsAppMediaType,
  sendButtonsMessage,
  sendMediaMessage,
  sendTextMessage,
} from "./whatsapp-sender";

export interface Logger {
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

export interface FlowResolution {
  sessionId: string;
  flowId: string;
  contactId: string;
  channel?: ChannelKey;
}

export interface WhatsAppMessageContext {
  value: ChangeValue;
  message: WhatsAppMessage;
  entryId: string;
}

export type FlowResolver = (context: WhatsAppMessageContext) => Promise<FlowResolution | null>;

export interface WhatsAppWebhookHandlerOptions {
  verifyToken: string;
  engine: RuntimeEngine;
  apiConfig: WhatsAppApiConfig;
  resolveApiConfig?: (phoneNumberId: string) => Promise<WhatsAppApiConfig | null> | WhatsAppApiConfig | null;
  resolveFlow: FlowResolver;
  logger?: Logger;
  onIncomingMessage?: (payload: {
    entryId: string;
    value: ChangeValue;
    message: WhatsAppMessage;
  }) => Promise<void> | void;
  onBotTransfer?: (payload: {
    phone: string;
    queueId: string | null;
    transferTarget?: string; // "queue", "advisor", or "bot"
    transferDestination?: string; // ID of queue/advisor/flow
  }) => Promise<void> | void;
  onBotMessage?: (payload: {
    phone: string;
    phoneNumberId?: string;
    message: OutboundMessage;
    result: {ok: boolean; status: number};
  }) => Promise<void> | void;
}

export class WhatsAppWebhookHandler {
  private readonly verifyToken: string;

  private readonly engine: RuntimeEngine;

  private readonly apiConfig: WhatsAppApiConfig;

  private readonly resolveApiConfig?: WhatsAppWebhookHandlerOptions["resolveApiConfig"];

  private readonly resolveFlow: FlowResolver;

  private readonly logger?: Logger;

  private readonly onIncomingMessage?: WhatsAppWebhookHandlerOptions["onIncomingMessage"];
  private readonly onBotTransfer?: WhatsAppWebhookHandlerOptions["onBotTransfer"];
  private readonly onBotMessage?: WhatsAppWebhookHandlerOptions["onBotMessage"];

  private currentPhoneNumberId?: string; // Track current incoming phoneNumberId

  constructor(options: WhatsAppWebhookHandlerOptions) {
    this.verifyToken = options.verifyToken;
    this.engine = options.engine;
    this.apiConfig = options.apiConfig;
    this.resolveApiConfig = options.resolveApiConfig;
    this.resolveFlow = options.resolveFlow;
    this.logger = options.logger;
    this.onIncomingMessage = options.onIncomingMessage;
    this.onBotTransfer = options.onBotTransfer;
    this.onBotMessage = options.onBotMessage;
  }

  async handle(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return this.handleVerify(request);
    }
    if (request.method === "POST") {
      return this.handleIncoming(request);
    }
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleVerify(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === this.verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  private async handleIncoming(request: Request): Promise<Response> {
    try {
      const payload = (await request.json()) as WhatsAppWebhookPayload;
      if (!payload.entry) {
        return this.ok();
      }
      for (const entry of payload.entry) {
        for (const change of entry.changes ?? []) {
          if (!change.value.messages) continue;
          for (const message of change.value.messages) {
            await this.processMessage(entry.id, change.value, message);
          }
        }
      }
      return this.ok();
    } catch (error) {
      this.logger?.error?.("Failed to handle webhook", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async processMessage(entryId: string, value: ChangeValue, message: WhatsAppMessage): Promise<void> {
    try {
      // CRITICAL: Store incoming phoneNumberId for correct response routing
      this.currentPhoneNumberId = value.metadata?.phone_number_id;

      const context: WhatsAppMessageContext = { entryId, value, message };
      const resolution = await this.resolveFlow(context);

      // Always process through CRM first
      await this.onIncomingMessage?.({ entryId, value, message });

      // If no flow assigned, skip bot execution (message only goes to CRM)
      if (!resolution) {
        this.logger?.info?.("No flow assigned - message forwarded to CRM only", {
          from: message.from,
          phoneNumberId: value.metadata?.phone_number_id,
        });
        return;
      }

      // Execute bot flow if assigned
      const incoming = convertMessageToRuntime(message);
      const result = await this.engine.processMessage({
        sessionId: resolution.sessionId,
        flowId: resolution.flowId,
        channel: resolution.channel ?? "whatsapp",
        contactId: resolution.contactId,
        message: incoming,
        metadata: { whatsapp: message },
      });
      for (const response of result.responses) {
        await this.dispatchOutbound(resolution.contactId, response, message.from);
      }
    } catch (error) {
      this.logger?.error?.("Runtime processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        entryId,
        messageId: message.id,
      });
    }
  }

  private async getActiveApiConfig(): Promise<WhatsAppApiConfig> {
    // CRITICAL: Use phoneNumberId from incoming message to get correct API config
    if (this.currentPhoneNumberId && this.resolveApiConfig) {
      const resolved = await this.resolveApiConfig(this.currentPhoneNumberId);
      if (resolved) {
        return resolved;
      }
    }
    // Fallback to default config
    return this.apiConfig;
  }

  private async dispatchOutbound(to: string, message: OutboundMessage, phone: string): Promise<void> {
    const apiConfig = await this.getActiveApiConfig();

    switch (message.type) {
      case "text": {
        await this.safeSend(() => sendTextMessage(apiConfig, to, message.text), message, phone);
        return;
      }
      case "buttons": {
        const buttons: WhatsAppButtonDefinition[] = message.buttons.map((button, index) => ({
          id: button.value ?? button.id ?? `BTN_${index + 1}`,
          title: button.label ?? `Opción ${index + 1}`,
        }));
        if (buttons.length === 0) {
          await this.safeSend(() => sendTextMessage(apiConfig, to, message.text), {
            type: "text",
            text: message.text,
          }, phone);
          return;
        }
        await this.safeSend(() => sendButtonsMessage(apiConfig, to, message.text, buttons), message, phone);
        return;
      }
      case "media": {
        const mediaType = normalizeMediaType(message.mediaType);
        await this.safeSend(
          () => sendMediaMessage(apiConfig, to, message.url, mediaType, message.caption),
          message,
          phone,
        );
        return;
      }
      case "menu": {
        const text = buildMenuText(message);
        await this.safeSend(() => sendTextMessage(apiConfig, to, text), message, phone);
        return;
      }
      case "system":
        this.logger?.info?.("System message received", { payload: message.payload });

        // CRITICAL: Process bot transfer to prevent conversations going to limbo
        if (message.payload?.action === "transfer_to_agent" || message.payload?.action === "transfer") {
          const payload = message.payload as any;
          const queueId = payload.queueId as string | null;
          const transferTarget = payload.transferTarget as string | undefined; // "queue", "advisor", or "bot"
          const transferDestination = payload.transferDestination as string | undefined;

          this.logger?.info?.("Bot transfer detected", {
            to,
            queueId,
            transferTarget,
            transferDestination
          });

          if (this.onBotTransfer) {
            await this.onBotTransfer({
              phone: to,
              queueId: queueId || null,
              transferTarget: transferTarget || "queue",
              transferDestination: transferDestination || "",
            });
          }
        }
        return;
      default:
        this.logger?.warn?.("Unknown outbound message type", { type: (message as OutboundMessage).type });
    }
  }

  private async safeSend(
    sender: () => Promise<WhatsAppApiResult>,
    message: OutboundMessage,
    phone: string,
  ): Promise<void> {
    try {
      const result = await sender();

      // Notify CRM about bot message
      if (this.onBotMessage) {
        await this.onBotMessage({
          phone,
          phoneNumberId: this.currentPhoneNumberId, // Pass phoneNumberId to CRM
          message,
          result: { ok: result.ok, status: result.status },
        });
      }

      if (!result.ok) {
        this.logger?.warn?.("WhatsApp API call failed", {
          status: result.status,
          body: result.body,
          message,
        });
      }
    } catch (error) {
      this.logger?.error?.("WhatsApp API call threw", {
        error: error instanceof Error ? error.message : "Unknown error",
        message,
      });
    }
  }

  private ok(): Response {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function convertMessageToRuntime(message: WhatsAppMessage): IncomingMessage {
  const raw = message as unknown as Record<string, unknown>;
  switch (message.type) {
    case "text":
      return { type: "text", text: message.text?.body ?? "", raw };
    case "button":
      return {
        type: "button",
        text: message.button?.text,
        payload: message.button?.payload ?? message.button?.text,
        raw,
      };
    case "interactive":
      if (message.interactive?.button_reply) {
        return {
          type: "button",
          text: message.interactive.button_reply.title,
          payload: message.interactive.button_reply.id,
          raw,
        };
      }
      if (message.interactive?.list_reply) {
        return {
          type: "button",
          text: message.interactive.list_reply.title,
          payload: message.interactive.list_reply.id,
          raw,
        };
      }
      return { type: "unknown", raw };
    case "image":
      return {
        type: "media",
        mediaUrl: message.image?.id ?? message.image?.link,
        mediaType: "image",
        caption: message.image?.caption,
        raw,
      };
    case "video":
      return {
        type: "media",
        mediaUrl: message.video?.id ?? message.video?.link,
        mediaType: "video",
        caption: message.video?.caption,
        raw,
      };
    case "document":
      return {
        type: "media",
        mediaUrl: message.document?.id ?? message.document?.link,
        mediaType: "document",
        caption: message.document?.caption,
        filename: message.document?.filename,
        raw,
      };
    case "audio":
      return {
        type: "media",
        mediaUrl: message.audio?.id ?? message.audio?.link,
        mediaType: "audio",
        raw,
      };
    case "sticker":
      return {
        type: "media",
        mediaUrl: message.sticker?.id ?? message.sticker?.link,
        mediaType: "sticker",
        raw,
      };
    default:
      return { type: "unknown", raw };
  }
}

function buildMenuText(message: Extract<OutboundMessage, { type: "menu" }>): string {
  const lines = [message.text];
  message.options.forEach((option, index) => {
    const label = option.label ?? option.value ?? `Opción ${index + 1}`;
    lines.push(`${index + 1}. ${label}`);
  });
  return lines.join("\n");
}

function normalizeMediaType(type: string): WhatsAppMediaType {
  switch (type) {
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker":
      return type;
    case "file":
    default:
      return "document";
  }
}

interface WhatsAppWebhookPayload {
  object: string;
  entry?: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;
  changes?: Change[];
}

interface Change {
  field: string;
  value: ChangeValue;
}

export interface ChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: WhatsAppMessage[];
}

interface WhatsAppMessageBase {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
}

interface TextMessage extends WhatsAppMessageBase {
  type: "text";
  text?: { body?: string };
}

interface ButtonMessage extends WhatsAppMessageBase {
  type: "button";
  button?: { text?: string; payload?: string };
}

interface InteractiveButtonMessage extends WhatsAppMessageBase {
  type: "interactive";
  interactive?: {
    type?: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface MediaMessage extends WhatsAppMessageBase {
  type: "image" | "video" | "document" | "audio" | "sticker";
  image?: { id?: string; link?: string; caption?: string; mime_type?: string };
  video?: { id?: string; link?: string; caption?: string; mime_type?: string };
  document?: { id?: string; link?: string; caption?: string; mime_type?: string; filename?: string };
  audio?: { id?: string; link?: string; mime_type?: string };
  sticker?: { id?: string; link?: string; mime_type?: string };
}

export type WhatsAppMessage = TextMessage | ButtonMessage | InteractiveButtonMessage | MediaMessage;
