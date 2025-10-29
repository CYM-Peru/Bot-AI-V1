import { Router } from "express";
import { crmDb } from "../db";
import type { CrmRealtimeManager } from "../ws";
import type { BitrixService } from "../services/bitrix";
import { sendOutboundMessage } from "../services/whatsapp";
import { sendWspTestMessage, type WspTestResult } from "../../services/wsp";
import type { MessageType } from "../models";

interface SendPayload {
  convId?: string;
  phone?: string;
  text?: string;
  attachmentId?: string;
  replyToId?: string;
  type?: MessageType;
  isInternal?: boolean;
}

export function createMessagesRouter(socketManager: CrmRealtimeManager, bitrixService: BitrixService) {
  const router = Router();

  router.post("/send", async (req, res) => {
    const payload = req.body as SendPayload;
    if (!payload.convId && !payload.phone) {
      res.status(400).json({ error: "missing_destination" });
      return;
    }

    let conversation = payload.convId ? crmDb.getConversationById(payload.convId) : undefined;
    if (!conversation && payload.phone) {
      conversation = crmDb.createConversation(payload.phone);
    }
    if (!conversation) {
      res.status(404).json({ error: "conversation_not_found" });
      return;
    }

    const attachments = payload.attachmentId ? [crmDb.getAttachment(payload.attachmentId)].filter(Boolean) : [];
    const type: MessageType = payload.type
      ? payload.type
      : payload.isInternal
      ? "system"
      : attachments.length > 0
      ? inferTypeFromMime(attachments[0]!.mime)
      : "text";

    const message = crmDb.appendMessage({
      convId: conversation.id,
      direction: "outgoing",
      type,
      text: payload.isInternal ? `🔒 NOTA INTERNA: ${payload.text ?? ""}` : payload.text ?? null,
      mediaUrl: attachments[0]?.url ?? null,
      mediaThumb: attachments[0]?.thumbUrl ?? null,
      repliedToId: payload.replyToId ?? null,
      status: payload.isInternal ? "sent" : "pending",
    });

    if (attachments.length > 0 && payload.attachmentId) {
      crmDb.linkAttachmentToMessage(payload.attachmentId, message.id);
    }

    socketManager.emitNewMessage({ message, attachment: attachments[0] ?? null });
    socketManager.emitConversationUpdate({ conversation: crmDb.getConversationById(conversation.id)! });

    let providerResult: WspTestResult | null = null;
    // Solo enviar a WhatsApp si NO es una nota interna
    if (conversation.phone && !payload.isInternal) {
      if (!attachments.length && payload.text) {
        providerResult = await sendWspTestMessage({ to: conversation.phone, text: payload.text });
      } else {
        const outbound = await sendOutboundMessage({
          phone: conversation.phone,
          text: payload.text ?? undefined,
          mediaUrl: attachments[0]?.url ?? undefined,
          mediaType: attachments[0] ? inferTypeFromMime(attachments[0].mime) : undefined,
          caption: payload.text ?? undefined,
        });
        providerResult = {
          ok: outbound.ok,
          providerStatus: outbound.status,
          body: outbound.body,
          error: outbound.error,
        };
      }
    }

    // Si es nota interna, ya está marcada como "sent", sino actualizar según resultado del proveedor
    let status = message.status;
    if (!payload.isInternal) {
      status = providerResult?.ok ? "sent" : "failed";
      crmDb.updateMessageStatus(
        message.id,
        status,
        providerResult?.body && typeof providerResult.body === "object"
          ? (providerResult.body as Record<string, unknown>)
          : undefined,
      );

      if (status === "sent") {
        const updatedMsg = { ...message, status };
        socketManager.emitMessageUpdate({ message: updatedMsg, attachment: attachments[0] ?? null });
      }
    }

    if (!conversation.bitrixId && conversation.phone) {
      bitrixService
        .upsertContactByPhone(conversation.phone)
        .then((result) => {
          if (result.contactId) {
            bitrixService.attachConversation(conversation!, result.contactId);
            const refreshed = crmDb.getConversationById(conversation!.id);
            if (refreshed) {
              socketManager.emitConversationUpdate({ conversation: refreshed });
            }
          }
        })
        .catch((error) => {
          console.warn("[CRM] Bitrix sync failed", error);
        });
    }

    res.json({
      ok: payload.isInternal ? true : (providerResult?.ok ?? false),
      providerStatus: providerResult?.providerStatus ?? 0,
      echo: { convId: conversation.id, phone: conversation.phone, text: payload.text ?? null },
      message: { ...message, status },
      attachment: attachments[0] ?? null,
      error: providerResult?.error ?? null,
    });
  });

  return router;
}

function inferTypeFromMime(mime: string): MessageType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || mime.startsWith("application/")) return "document";
  return "document";
}
