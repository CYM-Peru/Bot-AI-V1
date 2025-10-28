import type { ChangeValue, WhatsAppMessage } from "../../src/api/whatsapp-webhook";
import { crmDb } from "./db";
import type { CrmRealtimeManager } from "./ws";
import type { BitrixService } from "./services/bitrix";
import { attachmentStorage } from "./storage";
import type { Attachment, MessageType } from "./models";

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

  if (!conversation.bitrixId) {
    args.bitrixService
      .upsertContactByPhone(phone)
      .then((result) => {
        if (result.contactId) {
          args.bitrixService.attachConversation(conversation!, result.contactId);
          const updated = crmDb.getConversationById(conversation.id);
          if (updated) {
            args.socketManager.emitConversationUpdate({ conversation: updated });
          }
        }
      })
      .catch((error) => {
        console.warn("[CRM] Bitrix sync incoming failed", error);
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
        return { type: "document", text: null, attachment: null };
      }
      const downloaded = await downloadMedia(mediaInfo.id, mediaInfo.mimeType ?? undefined);
      if (!downloaded) {
        return {
          type: mapType(message.type),
          text: mediaInfo.caption ?? null,
          attachment: null,
        };
      }
      const stored = await attachmentStorage.saveBuffer({
        buffer: downloaded.buffer,
        filename: downloaded.filename,
        mime: downloaded.mime,
      });
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
  if (!mediaId) return null;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return null;
  const baseUrl = process.env.WHATSAPP_API_BASE_URL ?? "https://graph.facebook.com";
  const version = process.env.WHATSAPP_API_VERSION ?? "v20.0";
  try {
    const metaResponse = await fetch(`${baseUrl}/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResponse.ok) {
      return null;
    }
    const meta = (await metaResponse.json()) as { url?: string; mime_type?: string; file_size?: number; id?: string }; // eslint-disable-line @typescript-eslint/consistent-type-assertions
    if (!meta.url) {
      return null;
    }
    const mediaResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaResponse.ok) {
      return null;
    }
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const mime = meta.mime_type ?? mimeHint ?? "application/octet-stream";
    const filename = `${mediaId}`;
    return { buffer: Buffer.from(arrayBuffer), filename, mime };
  } catch (error) {
    console.warn("[CRM] Unable to download WhatsApp media", error);
    return null;
  }
}
