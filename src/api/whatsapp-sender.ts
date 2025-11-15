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

  console.log(`[WhatsApp] POST ${url}`);
  console.log(`[WhatsApp] Payload:`, JSON.stringify(payload, null, 2));

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

  if (!response.ok) {
    console.error(`[WhatsApp] Error ${response.status}:`, body);
  }

  return { ok: response.ok, status: response.status, body };
}

export async function sendTextMessage(
  config: WhatsAppApiConfig,
  phoneNumber: string,
  text: string,
  previewUrl: boolean = true,
): Promise<WhatsAppApiResult> {
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: { body: text, preview_url: previewUrl },
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

export interface WhatsAppListOption {
  id: string;
  title: string;
  description?: string;
}

export async function sendListMessage(
  config: WhatsAppApiConfig,
  phoneNumber: string,
  bodyText: string,
  buttonText: string,
  options: WhatsAppListOption[],
): Promise<WhatsAppApiResult> {
  // WhatsApp lists support up to 10 options
  const trimmed = options.slice(0, 10);

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: [
          {
            title: "Opciones",
            rows: trimmed.map((option) => ({
              id: option.id,
              title: option.title,
              description: option.description || "",
            })),
          },
        ],
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
  filename?: string,
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
  // CRITICAL: Add filename for documents so they appear with proper name in WhatsApp
  if (filename && mediaType === "document") {
    (payload[mediaType] as Record<string, unknown>).filename = filename;
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

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    example?: {
      body_text?: string[][];
      header_text?: string[];
      header_handle?: string[];
    };
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

/**
 * Fetch message templates from WhatsApp Business API
 * Note: Requires the WABA ID, not the phone number ID
 */
export async function fetchMessageTemplates(
  wabaId: string,
  accessToken: string,
): Promise<{ ok: boolean; templates: WhatsAppTemplate[] }> {
  try {
    const url = `${DEFAULT_GRAPH_BASE_URL}/${DEFAULT_GRAPH_VERSION}/${wabaId}/message_templates`;
    console.log(`[WhatsApp] Fetching templates from: ${url}`);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[WhatsApp] Failed to fetch templates:", response.status, response.statusText);
      console.error("[WhatsApp] Error body:", errorBody);
      return { ok: false, templates: [] };
    }

    const data = await response.json();
    const templates = (data.data || []).filter((t: WhatsAppTemplate) => t.status === "APPROVED");
    console.log(`[WhatsApp] Successfully fetched ${templates.length} approved templates`);

    return { ok: true, templates };
  } catch (error) {
    console.error("[WhatsApp] Error fetching templates:", error);
    return { ok: false, templates: [] };
  }
}

/**
 * Upload media (image, video, document, audio) to WhatsApp
 * Returns a media_id that can be used in template messages
 */
export async function uploadMedia(
  config: WhatsAppApiConfig,
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<WhatsAppApiResult<{ id: string }>> {
  const baseUrl = config.baseUrl ?? DEFAULT_GRAPH_BASE_URL;
  const version = config.apiVersion ?? DEFAULT_GRAPH_VERSION;
  const url = `${baseUrl}/${version}/${config.phoneNumberId}/media`;

  console.log(`[WhatsApp] Uploading media: ${fileName} (${mimeType})`);

  try {
    // Create FormData for multipart upload
    const formData = new FormData();
    const uint8Array = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    formData.append('file', blob, fileName);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
      body: formData,
    });

    const body = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp] Media upload failed:`, body);
      return { ok: false, status: response.status, body };
    }

    console.log(`[WhatsApp] Media uploaded successfully. ID: ${body.id}`);
    return { ok: true, status: response.status, body };
  } catch (error) {
    console.error('[WhatsApp] Error uploading media:', error);
    return { ok: false, status: 500, body: null };
  }
}

/**
 * Get media URL from media_id (for downloading/verification)
 */
export async function getMediaUrl(
  config: WhatsAppApiConfig,
  mediaId: string
): Promise<WhatsAppApiResult<{ url: string; mime_type: string; sha256: string; file_size: number }>> {
  const baseUrl = config.baseUrl ?? DEFAULT_GRAPH_BASE_URL;
  const version = config.apiVersion ?? DEFAULT_GRAPH_VERSION;
  const url = `${baseUrl}/${version}/${mediaId}`;

  console.log(`[WhatsApp] Getting media URL for ID: ${mediaId}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    const body = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp] Get media URL failed:`, body);
      return { ok: false, status: response.status, body };
    }

    return { ok: true, status: response.status, body };
  } catch (error) {
    console.error('[WhatsApp] Error getting media URL:', error);
    return { ok: false, status: 500, body: null };
  }
}
