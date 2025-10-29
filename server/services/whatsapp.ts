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
  displayNumber?: string | null;
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

  // DEBUG: Log configuration details
  console.log("[WhatsApp API] sendWhatsAppMessage called with:", {
    phone: options.phone,
    hasText: Boolean(options.text),
    hasMediaUrl: Boolean(options.mediaUrl),
    mediaType: options.mediaType,
  });
  console.log("[WhatsApp API] Config:", {
    baseUrl: config.baseUrl,
    apiVersion: config.apiVersion,
    phoneNumberId: config.phoneNumberId,
    hasAccessToken: Boolean(config.accessToken),
    tokenLength: config.accessToken?.length,
    tokenLast10: config.accessToken ? `...${config.accessToken.slice(-10)}` : "NO_TOKEN",
  });

  if (!config.phoneNumberId || !config.accessToken) {
    console.error("[WhatsApp API] Missing configuration!", {
      hasPhoneNumberId: Boolean(config.phoneNumberId),
      hasAccessToken: Boolean(config.accessToken),
    });
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
    console.error("[WhatsApp API] Missing payload - no text or media");
    return { ok: false, status: 400, body: null, error: "missing_payload" };
  }

  const url = `${config.baseUrl.replace(/\/$/, "")}/${config.apiVersion}/${config.phoneNumberId}/messages`;

  console.log("[WhatsApp API] Making request:", {
    url,
    method: "POST",
    payload: JSON.stringify(payload),
    authHeader: `Bearer ...${config.accessToken.slice(-10)}`,
  });

  const response = await httpRequest(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}` },
    body: payload,
  });

  console.log("[WhatsApp API] Response received:", {
    ok: response.ok,
    status: response.status,
    body: JSON.stringify(response.body),
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
    return {
      ok: false,
      reason: "not_configured",
      phoneNumberId: config.phoneNumberId ?? null,
      displayNumber: config.displayNumber ?? null,
      details,
    };
  }

  const url = `${config.baseUrl.replace(/\/$/, "")}/${config.apiVersion}/${config.phoneNumberId}`;
  const response = await httpRequest<{ display_phone_number?: string; verified_name?: string }>(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    retries: 2,
    retryDelayMs: 600,
  });

  if (!response.ok) {
    const reason =
      response.status === 401
        ? "invalid_token"
        : response.status === 400
          ? "missing_phone_id"
          : "provider_error";
    return {
      ok: false,
      reason,
      status: response.status,
      phoneNumberId: config.phoneNumberId,
      displayNumber: config.displayNumber ?? null,
      details,
    };
  }

  return {
    ok: true,
    phoneNumberId: config.phoneNumberId,
    displayNumber: config.displayNumber ?? null,
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
