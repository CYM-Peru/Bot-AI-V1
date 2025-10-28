import { sendMediaMessage, sendTextMessage } from "../../../src/api/whatsapp-sender";

interface SendOptions {
  phone: string;
  text?: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "audio" | "video" | "document" | "sticker";
  caption?: string | null;
}

export interface ProviderResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

function getConfigFromEnv() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  const baseUrl = process.env.WHATSAPP_API_BASE_URL;
  if (!accessToken || !phoneNumberId) {
    return null;
  }
  return { accessToken, phoneNumberId, apiVersion, baseUrl };
}

export async function sendOutboundMessage(options: SendOptions): Promise<ProviderResult> {
  const config = getConfigFromEnv();
  if (!config) {
    return { ok: false, status: 412, body: null, error: "whatsapp_not_configured" };
  }

  try {
    if (options.mediaUrl && options.mediaType) {
      const result = await sendMediaMessage(
        config,
        options.phone,
        options.mediaUrl,
        options.mediaType,
        options.caption ?? undefined,
      );
      return { ok: result.ok, status: result.status, body: result.body };
    }

    if (options.text) {
      const result = await sendTextMessage(config, options.phone, options.text);
      return { ok: result.ok, status: result.status, body: result.body };
    }

    return { ok: false, status: 400, body: null, error: "missing_payload" };
  } catch (error) {
    console.error("[CRM][WhatsApp] Error sending message", error);
    return { ok: false, status: 500, body: null, error: "provider_error" };
  }
}
