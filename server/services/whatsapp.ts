import { httpRequest } from "../utils/http";
import { getWhatsAppEnv, isWhatsAppConfigured } from "../utils/env";
import FormData from "form-data";
import type { Readable } from "stream";
import fetch from "node-fetch";

export interface WhatsAppSendOptions {
  phone: string;
  text?: string;
  mediaUrl?: string | null;
  mediaId?: string | null;
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
  if (!config.phoneNumberId || !config.accessToken) {
    return { ok: false, status: 412, body: null, error: "not_configured" };
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: options.phone,
  };

  if (options.mediaType && MAX_MEDIA_TYPES.has(options.mediaType) && (options.mediaUrl || options.mediaId)) {
    payload.type = options.mediaType;
    if (options.mediaId) {
      // Usar media_id de WhatsApp (archivos ya subidos a WhatsApp Media API)
      payload[options.mediaType] = { id: options.mediaId };
    } else if (options.mediaUrl) {
      // Usar link público (debe ser HTTPS y accesible públicamente)
      payload[options.mediaType] = { link: options.mediaUrl };
    }
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

export interface WhatsAppMediaUploadResult {
  ok: boolean;
  mediaId?: string;
  error?: string;
}

/**
 * Sube un archivo a WhatsApp Media API y devuelve el media_id
 * Este media_id puede ser usado para enviar el archivo a través de WhatsApp
 */
export async function uploadToWhatsAppMedia(options: {
  stream: Readable;
  filename: string;
  mimeType: string;
}): Promise<WhatsAppMediaUploadResult> {
  const config = getWhatsAppEnv();
  if (!config.phoneNumberId || !config.accessToken) {
    return { ok: false, error: "not_configured" };
  }

  try {
    const form = new FormData();
    form.append("file", options.stream, {
      filename: options.filename,
      contentType: options.mimeType,
    });
    form.append("messaging_product", "whatsapp");
    form.append("type", options.mimeType);

    const url = `${config.baseUrl.replace(/\/$/, "")}/${config.apiVersion}/${config.phoneNumberId}/media`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const body = await response.json() as { id?: string; error?: { message?: string } };

    if (!response.ok) {
      return {
        ok: false,
        error: body.error?.message || `Upload failed with status ${response.status}`,
      };
    }

    if (!body.id) {
      return { ok: false, error: "No media_id returned" };
    }

    return { ok: true, mediaId: body.id };
  } catch (error) {
    console.error("[WhatsApp] Media upload error:", error);
    return { ok: false, error: String(error) };
  }
}
