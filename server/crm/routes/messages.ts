import { Router } from "express";
import { crmDb } from "../db";
import { metricsTracker } from "../metrics-tracker";
import type { CrmRealtimeManager } from "../ws";
import type { BitrixService } from "../services/bitrix";
import { sendOutboundMessage } from "../services/whatsapp";
import { sendWspTestMessage, type WspTestResult } from "../../services/wsp";
import type { MessageType } from "../models";
import { uploadToWhatsAppMedia } from "../../services/whatsapp";
import { attachmentStorage } from "../storage";

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

    // Obtener nombre del asesor para mensajes salientes
    const sentBy = req.user?.username ?? null;

    const message = crmDb.appendMessage({
      convId: conversation.id,
      direction: "outgoing",
      type,
      text: payload.isInternal ? `🔒 NOTA INTERNA: ${payload.text ?? ""}` : payload.text ?? null,
      mediaUrl: attachments[0]?.url ?? null,
      mediaThumb: attachments[0]?.thumbUrl ?? null,
      repliedToId: payload.replyToId ?? null,
      status: payload.isInternal ? "sent" : "pending",
      sentBy,  // Guardar nombre del asesor (no se envía al cliente, solo visible internamente)
    });

    // Link attachment and re-fetch to get updated msgId
    let linkedAttachment = attachments[0] ?? null;
    if (attachments.length > 0 && payload.attachmentId) {
      crmDb.linkAttachmentToMessage(payload.attachmentId, message.id);
      // Re-fetch to get the attachment with msgId set
      linkedAttachment = crmDb.getAttachment(payload.attachmentId) ?? linkedAttachment;
    }

    socketManager.emitNewMessage({ message, attachment: linkedAttachment });

    // Track message for metrics (only outgoing non-internal messages)
    if (!payload.isInternal) {
      metricsTracker.recordMessage(conversation.id, true);
    }

    // Auto-cambiar a "attending" cuando el asesor responde (excepto notas internas)
    // Y asignar al asesor si la conversación estaba en cola
    if (!payload.isInternal && conversation.status === "active") {
      const advisorId = req.user?.userId || "unknown";
      const now = Date.now();

      crmDb.updateConversationMeta(conversation.id, {
        status: "attending",
        assignedTo: advisorId,
        assignedAt: now,
      });

      // Add advisor to attendedBy list
      crmDb.addAdvisorToAttendedBy(conversation.id, advisorId);

      // Start tracking metrics for this conversation with full context
      metricsTracker.startConversation(conversation.id, advisorId, {
        queueId: conversation.queueId || undefined,
        channelType: conversation.channel as any,
        channelId: conversation.channelConnectionId || undefined,
      });
    }

    // Mark conversation as active when advisor sends a message
    if (!payload.isInternal && conversation.status === "attending") {
      metricsTracker.markConversationActive(conversation.id);
    }

    // If advisor sends a message while attending, add to attendedBy (if not already there)
    if (!payload.isInternal && req.user?.userId) {
      crmDb.addAdvisorToAttendedBy(conversation.id, req.user.userId);
    }

    socketManager.emitConversationUpdate({ conversation: crmDb.getConversationById(conversation.id)! });

    let providerResult: WspTestResult | null = null;
    // Solo enviar a WhatsApp si NO es una nota interna
    if (conversation.phone && !payload.isInternal) {
      // Get WhatsApp message ID from replied-to message if replying
      let replyToWhatsAppMessageId: string | null = null;
      if (payload.replyToId) {
        const repliedToMessages = crmDb.listMessages(conversation.id);
        const repliedToMessage = repliedToMessages.find(m => m.id === payload.replyToId);
        if (repliedToMessage?.providerMetadata && typeof repliedToMessage.providerMetadata === 'object') {
          const metadata = repliedToMessage.providerMetadata as Record<string, unknown>;
          replyToWhatsAppMessageId = metadata.whatsapp_message_id as string ?? null;
        }
      }

      if (!attachments.length && payload.text) {
        // Send text message (with reply context if available)
        const outbound = await sendOutboundMessage({
          phone: conversation.phone,
          text: payload.text,
          replyToWhatsAppMessageId,
          channelConnectionId: conversation.channelConnectionId, // Use the conversation's WhatsApp number
        });
        providerResult = {
          ok: outbound.ok,
          providerStatus: outbound.status,
          body: outbound.body,
          error: outbound.error,
        };
      } else if (attachments.length > 0) {
        // Si hay adjunto, subirlo a WhatsApp Media API primero
        let mediaId: string | undefined;
        const attachment = attachments[0]!;

        try {
          const stream = await attachmentStorage.getStream(attachment.id);
          if (stream) {
            const uploadResult = await uploadToWhatsAppMedia({
              stream,
              filename: attachment.filename,
              mimeType: attachment.mime,
              channelConnectionId: conversation.channelConnectionId, // Use the conversation's WhatsApp number
            });

            if (uploadResult.ok && uploadResult.mediaId) {
              mediaId = uploadResult.mediaId;
              console.log(`[CRM] Archivo subido a WhatsApp Media API: ${mediaId}`);
            } else {
              console.error(`[CRM] Error subiendo archivo a WhatsApp: ${uploadResult.error}`);
            }
          }
        } catch (error) {
          console.error("[CRM] Error obteniendo stream del archivo:", error);
        }

        // Enviar mensaje con mediaId o fallar
        if (mediaId) {
          // Get WhatsApp message ID from replied-to message if replying
          let replyToWhatsAppMessageId: string | null = null;
          if (payload.replyToId) {
            const repliedToMessages = crmDb.listMessages(conversation.id);
            const repliedToMessage = repliedToMessages.find(m => m.id === payload.replyToId);
            if (repliedToMessage?.providerMetadata && typeof repliedToMessage.providerMetadata === 'object') {
              const metadata = repliedToMessage.providerMetadata as Record<string, unknown>;
              replyToWhatsAppMessageId = metadata.whatsapp_message_id as string ?? null;
            }
          }

          const outbound = await sendOutboundMessage({
            phone: conversation.phone,
            text: payload.text ?? undefined,
            mediaId,
            mediaType: inferTypeFromMime(attachment.mime),
            caption: payload.text ?? undefined,
            filename: attachment.filename ?? undefined,
            replyToWhatsAppMessageId,
            channelConnectionId: conversation.channelConnectionId, // Use the conversation's WhatsApp number
          });
          providerResult = {
            ok: outbound.ok,
            providerStatus: outbound.status,
            body: outbound.body,
            error: outbound.error,
          };
        } else {
          providerResult = {
            ok: false,
            providerStatus: 500,
            body: null,
            error: "Failed to upload media to WhatsApp",
          };
        }
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

      // SIEMPRE emitir update (sent o failed) para que el frontend actualice el mensaje
      const updatedMsg = { ...message, status };
      socketManager.emitMessageUpdate({ message: updatedMsg, attachment: linkedAttachment });
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
      attachment: linkedAttachment,
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
