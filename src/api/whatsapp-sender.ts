export interface WhatsAppApiConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  baseUrl?: string;
}

export interface WhatsAppApiResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T | null;
}

const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com";
const DEFAULT_GRAPH_VERSION = "v20.0";

async function postToWhatsApp<T>(
  config: WhatsAppApiConfig,
  payload: Record<string, unknown>,
): Promise<WhatsAppApiResult<T>> {
  const baseUrl = config.baseUrl ?? DEFAULT_GRAPH_BASE_URL;
  const version = config.apiVersion ?? DEFAULT_GRAPH_VERSION;
  const url = `${baseUrl}/${version}/${config.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  let body: T | null = null;
  try {
    body = (await response.json()) as T;
  } catch (error) {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

export async function sendTextMessage(
  config: WhatsAppApiConfig,
  phoneNumber: string,
  text: string,
): Promise<WhatsAppApiResult> {
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: { body: text, preview_url: false },
  } as const;
  return postToWhatsApp(config, payload);
}

export interface WhatsAppButtonDefinition {
  id: string;
  title: string;
}

export async function sendButtonsMessage(
  config: WhatsAppApiConfig,
  phoneNumber: string,
  text: string,
  buttons: WhatsAppButtonDefinition[],
): Promise<WhatsAppApiResult> {
  const trimmed = buttons.slice(0, 3);
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: trimmed.map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  } as const;
  return postToWhatsApp(config, payload);
}

export type WhatsAppMediaType = "image" | "audio" | "video" | "document" | "sticker";

export async function sendMediaMessage(
  config: WhatsAppApiConfig,
  phoneNumber: string,
  mediaUrl: string,
  mediaType: WhatsAppMediaType,
  caption?: string,
): Promise<WhatsAppApiResult> {
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: mediaType,
    [mediaType]: { link: mediaUrl },
  };
  if (caption && (mediaType === "image" || mediaType === "video" || mediaType === "document")) {
    (payload[mediaType] as Record<string, unknown>).caption = caption;
  }
  return postToWhatsApp(config, payload);
}

export interface TemplateComponent {
  type: string;
  parameters?: Array<{ type: string; text?: string; image?: { link: string }; payload?: string }>;
}

export async function sendTemplateMessage(
  config: WhatsAppApiConfig,
  phoneNumber: string,
  templateName: string,
  language: string = "es",
  components?: TemplateComponent[],
): Promise<WhatsAppApiResult> {
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  } as const;
  return postToWhatsApp(config, payload);
}
