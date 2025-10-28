import { Router } from "express";
import { crmDb } from "../db";
import type { CrmRealtimeManager } from "../sockets";
import type { BitrixService } from "../services/bitrix";
import { sendOutboundMessage } from "../services/whatsapp";
import type { MessageType } from "../models";

interface SendPayload {
  convId?: string;
  phone?: string;
  text?: string;
  attachmentId?: string;
  replyToId?: string;
  type?: MessageType;
}

export function createMessagesRouter(socketManager: CrmRealtimeManager, bitrixService: BitrixService) {
  const router = Router();

  router.get("/conversations/:id/messages", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const messages = crmDb.listMessages(conversation.id);
    const attachments = crmDb.listAttachmentsByMessageIds(messages.map((m) => m.id));
    res.json({ messages, attachments });
  });

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
      : attachments.length > 0
      ? inferTypeFromMime(attachments[0]!.mime)
      : "text";

    const message = crmDb.appendMessage({
      convId: conversation.id,
      direction: "outgoing",
      type,
      text: payload.text ?? null,
      mediaUrl: attachments[0]?.url ?? null,
      mediaThumb: attachments[0]?.thumbUrl ?? null,
      repliedToId: payload.replyToId ?? null,
      status: "pending",
    });

    if (attachments.length > 0 && payload.attachmentId) {
      crmDb.linkAttachmentToMessage(payload.attachmentId, message.id);
    }

    socketManager.emitNewMessage({ message, attachment: attachments[0] ?? null });
    socketManager.emitConversationUpdate({ conversation: crmDb.getConversationById(conversation.id)! });

    let providerResult = null;
    if (conversation.phone) {
      providerResult = await sendOutboundMessage({
        phone: conversation.phone,
        text: payload.text ?? undefined,
        mediaUrl: attachments[0]?.url ?? undefined,
        mediaType: attachments[0] ? inferTypeFromMime(attachments[0].mime) : undefined,
        caption: payload.text ?? undefined,
      });
    }

    const status = providerResult?.ok ? "sent" : "failed";
    crmDb.updateMessageStatus(message.id, status, providerResult?.body && typeof providerResult.body === "object" ? providerResult.body as Record<string, unknown> : undefined);

    if (status === "sent") {
      const updatedMsg = { ...message, status };
      socketManager.emitMessageUpdate({ message: updatedMsg, attachment: attachments[0] ?? null });
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

    res.json({ message: { ...message, status }, attachment: attachments[0] ?? null, providerResult });
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
