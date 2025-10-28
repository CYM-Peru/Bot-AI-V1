import { httpRequest } from "../utils/http";
import { getWhatsAppEnv, isWhatsAppConfigured } from "../utils/env";

export interface WhatsAppSendOptions {
  phone: string;
  text?: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "audio" | "video" | "document" | "sticker";
  caption?: string | null;
}

export interface WhatsAppSendResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export interface WhatsAppCheckResult {
  ok: boolean;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  reason?: string;
  status?: number;
  details?: {
    baseUrl: string;
    apiVersion: string;
    hasAccessToken: boolean;
    hasVerifyToken: boolean;
  };
}

const MAX_MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker"]);

export async function sendWhatsAppMessage(options: WhatsAppSendOptions): Promise<WhatsAppSendResult> {
  const config = getWhatsAppEnv();
  if (!config.phoneNumberId || !config.accessToken) {
    return { ok: false, status: 412, body: null, error: "not_configured" };
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: options.phone,
  };

  if (options.mediaUrl && options.mediaType && MAX_MEDIA_TYPES.has(options.mediaType)) {
    payload.type = options.mediaType;
    payload[options.mediaType] = { link: options.mediaUrl };
    if (options.caption && (options.mediaType === "image" || options.mediaType === "video" || options.mediaType === "document")) {
      (payload[options.mediaType] as Record<string, unknown>).caption = options.caption;
    }
  } else if (options.text) {
    payload.type = "text";
    payload.text = { body: options.text, preview_url: false };
  } else {
    return { ok: false, status: 400, body: null, error: "missing_payload" };
  }

  const url = `${config.baseUrl.replace(/\/$/, "")}/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const response = await httpRequest(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    body: payload,
  });

  return {
    ok: response.ok,
    status: response.status,
    body: response.body,
    error: response.ok ? undefined : inferError(response.status, response.body),
  };
}

export async function checkWhatsAppConnection(): Promise<WhatsAppCheckResult> {
  const config = getWhatsAppEnv();
  const details = {
    baseUrl: config.baseUrl,
    apiVersion: config.apiVersion,
    hasAccessToken: Boolean(config.accessToken),
    hasVerifyToken: Boolean(config.verifyToken),
  } as WhatsAppCheckResult["details"];

  if (!config.phoneNumberId || !config.accessToken) {
    return { ok: false, reason: "not_configured", phoneNumberId: config.phoneNumberId ?? null, details };
  }

  const url = `${config.baseUrl.replace(/\/$/, "")}/${config.apiVersion}/${config.phoneNumberId}`;
  const response = await httpRequest<{ display_phone_number?: string; verified_name?: string }>(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: response.status === 401 ? "invalid_token" : "provider_error",
      status: response.status,
      phoneNumberId: config.phoneNumberId,
      details,
    };
  }

  return {
    ok: true,
    phoneNumberId: config.phoneNumberId,
    displayPhoneNumber: response.body?.display_phone_number ?? null,
    verifiedName: response.body?.verified_name ?? null,
    details,
  };
}

export function ensureWhatsAppConfigured(): void {
  if (!isWhatsAppConfigured()) {
    throw new Error("WhatsApp Cloud API no configurado");
  }
}

function inferError(status: number, body: unknown): string | undefined {
  if (status === 401) return "invalid_token";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 412) return "not_configured";
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return undefined;
}
