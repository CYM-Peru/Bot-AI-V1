import type { ChangeValue, WhatsAppMessage } from "../../src/api/whatsapp-webhook";
import { crmDb } from "./db";
import type { CrmRealtimeManager } from "./ws";
import type { BitrixService } from "./services/bitrix";
import { attachmentStorage } from "./storage";
import type { Attachment, MessageType } from "./models";
import { logDebug, logError } from "../utils/file-logger";
import { getWhatsAppEnv } from "../utils/env";
import axios from "axios";

interface HandleIncomingArgs {
  entryId: string;
  value: ChangeValue;
  message: WhatsAppMessage;
  socketManager: CrmRealtimeManager;
  bitrixService: BitrixService;
}

export async function handleIncomingWhatsAppMessage(args: HandleIncomingArgs): Promise<void> {
  const phone = args.message.from;
  if (!phone) {
    return;
  }
  let conversation = crmDb.getConversationByPhone(phone);
  if (!conversation) {
    conversation = crmDb.createConversation(phone);
  }

  const { type, text, attachment } = await translateMessage(args.message);

  const storedMessage = crmDb.appendMessage({
    convId: conversation.id,
    direction: "incoming",
    type,
    text,
    mediaUrl: attachment?.url ?? null,
    mediaThumb: attachment?.thumbUrl ?? null,
    repliedToId: null,
    status: "delivered",
  });

  let storedAttachment: Attachment | null = null;
  if (attachment) {
    storedAttachment = crmDb.storeAttachment({
      id: attachment.id,
      msgId: storedMessage.id,
      filename: attachment.filename,
      mime: attachment.mime,
      size: attachment.size,
      url: attachment.url,
      thumbUrl: attachment.thumbUrl,
    });
  }

  args.socketManager.emitNewMessage({ message: storedMessage, attachment: storedAttachment });
  const refreshed = crmDb.getConversationById(conversation.id);
  if (refreshed) {
    args.socketManager.emitConversationUpdate({ conversation: refreshed });
  }

  // NO CREAR AUTOMÁTICAMENTE - Solo buscar contacto existente en Bitrix24
  if (!conversation.bitrixId && args.bitrixService.isAvailable) {
    args.bitrixService
      .lookupByPhone(phone)
      .then((contact) => {
        if (contact?.ID) {
          // Encontró contacto existente, asociarlo
          args.bitrixService.attachConversation(conversation!, contact.ID.toString());
          const updated = crmDb.getConversationById(conversation.id);
          if (updated) {
            args.socketManager.emitConversationUpdate({ conversation: updated });
          }
          console.log(`[CRM][Bitrix] Contacto existente encontrado: ${contact.ID} para ${phone}`);
        } else {
          // No hay contacto en Bitrix, se mostrará solo con datos de Meta (phone + profileName)
          console.log(`[CRM][Bitrix] No se encontró contacto para ${phone}. Mostrando solo datos de Meta.`);
        }
      })
      .catch((error) => {
        console.warn("[CRM][Bitrix] lookup failed", error);
      });
  }
}

async function translateMessage(message: WhatsAppMessage): Promise<{
  type: MessageType;
  text: string | null;
  attachment: Attachment | null;
}> {
  switch (message.type) {
    case "text":
      return { type: "text", text: message.text?.body ?? null, attachment: null };
    case "interactive": {
      const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
      return {
        type: "text",
        text: reply?.title ?? "",
        attachment: null,
      };
    }
    case "button":
      return { type: "text", text: message.button?.text ?? message.button?.payload ?? "", attachment: null };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const mediaInfo = getMediaInfo(message);
      if (!mediaInfo) {
        logError(`[CRM][Media] No se pudo extraer info de media del mensaje tipo ${message.type}`);
        return { type: "document", text: null, attachment: null };
      }
      logDebug(`[CRM][Media] Descargando ${message.type} con ID: ${mediaInfo.id} (usando axios)`);
      const downloaded = await downloadMedia(mediaInfo.id, mediaInfo.mimeType ?? undefined);
      if (!downloaded) {
        logError(`[CRM][Media] Falló descarga de ${message.type} con ID: ${mediaInfo.id}`);
        return {
          type: mapType(message.type),
          text: mediaInfo.caption ?? null,
          attachment: null,
        };
      }
      logDebug(`[CRM][Media] Descarga exitosa: ${downloaded.filename} (${downloaded.mime}, ${downloaded.buffer.length} bytes)`);
      const stored = await attachmentStorage.saveBuffer({
        buffer: downloaded.buffer,
        filename: downloaded.filename,
        mime: downloaded.mime,
      });
      logDebug(`[CRM][Media] Guardado en storage: ${stored.url}`);
      return {
        type: mapType(message.type),
        text: mediaInfo.caption ?? null,
        attachment: {
          id: stored.id,
          msgId: null,
          filename: downloaded.filename,
          mime: downloaded.mime,
          size: stored.size,
          url: stored.url,
          thumbUrl: stored.url,
          createdAt: Date.now(),
        },
      };
    }
    default:
      return { type: "system", text: null, attachment: null };
  }
}

function mapType(type: WhatsAppMessage["type"]): MessageType {
  switch (type) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "document":
      return "document";
    case "sticker":
      return "sticker";
    default:
      return "text";
  }
}

function getMediaInfo(message: WhatsAppMessage):
  | { id: string; mimeType?: string; caption?: string }
  | null {
  switch (message.type) {
    case "image":
      return { id: message.image?.id ?? "", mimeType: message.image?.mime_type, caption: message.image?.caption ?? undefined };
    case "video":
      return { id: message.video?.id ?? "", mimeType: message.video?.mime_type, caption: message.video?.caption ?? undefined };
    case "audio":
      return { id: message.audio?.id ?? "", mimeType: message.audio?.mime_type };
    case "document":
      return { id: message.document?.id ?? "", mimeType: message.document?.mime_type, caption: message.document?.caption ?? undefined };
    case "sticker":
      return { id: message.sticker?.id ?? "", mimeType: message.sticker?.mime_type };
    default:
      return null;
  }
}

async function downloadMedia(mediaId: string, mimeHint?: string): Promise<{ buffer: Buffer; filename: string; mime: string } | null> {
  if (!mediaId) {
    logError("[CRM][Media] downloadMedia: mediaId vacío");
    return null;
  }
  const whatsappEnv = getWhatsAppEnv();
  if (!whatsappEnv.accessToken) {
    logError("[CRM][Media] downloadMedia: WHATSAPP_ACCESS_TOKEN no configurado");
    return null;
  }
  const baseUrl = whatsappEnv.baseUrl;
  const version = whatsappEnv.apiVersion;
  try {
    // Step 1: Get metadata usando axios
    const metaUrl = `${baseUrl}/${version}/${mediaId}`;
    logDebug(`[CRM][Media] Obteniendo metadata de: ${metaUrl}`);

    const metaResponse = await axios.get(metaUrl, {
      headers: {
        Authorization: `Bearer ${whatsappEnv.accessToken}`,
      },
    });

    const meta = metaResponse.data as { url?: string; mime_type?: string; file_size?: number; id?: string };
    if (!meta.url) {
      logError("[CRM][Media] Metadata no contiene URL del archivo");
      return null;
    }

    logDebug(`[CRM][Media] URL completa de descarga: ${meta.url}`);
    logDebug(`[CRM][Media] Descargando con axios (responseType: arraybuffer)...`);

    // Step 2: Download usando axios con arraybuffer
    // Según reportes de Stack Overflow, axios funciona donde fetch falla
    const mediaResponse = await axios.get(meta.url, {
      headers: {
        Authorization: `Bearer ${whatsappEnv.accessToken}`,
        "User-Agent": "curl/7.64.1",
      },
      responseType: "arraybuffer",
      maxRedirects: 5,
      timeout: 30000, // 30 segundos
    });

    const buffer = Buffer.from(mediaResponse.data);
    const mime = meta.mime_type ?? mimeHint ?? "application/octet-stream";
    const filename = `${mediaId}`;

    logDebug(`[CRM][Media] ✅ Descarga exitosa con axios: ${buffer.length} bytes`);
    return { buffer, filename, mime };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError(`[CRM][Media] Axios error: HTTP ${error.response?.status}`, error.response?.data);
    } else {
      logError("[CRM][Media] Error descargando media", error);
    }
    return null;
  }
}
