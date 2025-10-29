import { Router } from "express";
import { crmDb } from "../db";
import type { CrmRealtimeManager } from "../ws";
import type { BitrixService } from "../services/bitrix";

export function createConversationsRouter(socketManager: CrmRealtimeManager, bitrixService: BitrixService) {
  const router = Router();

  router.get("/", (_req, res) => {
    const conversations = crmDb.listConversations();
    res.json(
      conversations.map((conversation) => ({
        id: conversation.id,
        phone: conversation.phone,
        contactName: conversation.contactName ?? null,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview ?? null,
        unread: conversation.unread,
        status: conversation.status,
        bitrixId: conversation.bitrixId ?? null,
      })),
    );
  });

  router.get("/:id/messages", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const messages = crmDb.listMessages(conversation.id);
    const attachments = crmDb.listAttachmentsByMessageIds(messages.map((message) => message.id));
    res.json({ messages, attachments });
  });

  router.get("/:id/bitrix", async (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!bitrixService.isAvailable) {
      res.json({ contact: null, bitrixId: conversation.bitrixId, status: "bitrix_not_configured" });
      return;
    }
    try {
      let contact = conversation.bitrixId ? await bitrixService.fetchContact(conversation.bitrixId) : null;
      if (!contact) {
        contact = await bitrixService.lookupByPhone(conversation.phone);
        if (contact?.ID) {
          bitrixService.attachConversation(conversation, contact.ID.toString());
        }
      }
      res.json({ contact, bitrixId: contact?.ID ?? conversation.bitrixId ?? null });
    } catch (error) {
      console.error("[CRM] bitrix fetch error", error);
      res.status(500).json({ error: "bitrix_lookup_failed" });
    }
  });

  router.post("/:id/archive", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    crmDb.archiveConversation(conversation.id);
    const updated = crmDb.getConversationById(conversation.id);
    if (updated) {
      socketManager.emitConversationUpdate({ conversation: updated });
    }
    res.json({ success: true });
  });

  router.post("/:id/transfer", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const { type, targetId } = req.body;

    if (!type || !targetId) {
      res.status(400).json({ error: "missing_parameters" });
      return;
    }

    if (type !== "advisor" && type !== "bot") {
      res.status(400).json({ error: "invalid_type" });
      return;
    }

    // Update conversation metadata with transfer info
    const metadata = conversation.metadata || {};
    metadata.transferredTo = targetId;
    metadata.transferType = type;
    metadata.transferredAt = Date.now();

    crmDb.updateConversationMeta(conversation.id, { metadata });

    // Optionally archive the conversation after transfer
    // crmDb.archiveConversation(conversation.id);

    const updated = crmDb.getConversationById(conversation.id);
    if (updated) {
      socketManager.emitConversationUpdate({ conversation: updated });
    }

    res.json({ success: true, transferred: { type, targetId } });
  });

  return router;
}
