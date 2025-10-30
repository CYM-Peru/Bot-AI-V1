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

  /**
   * POST /:id/bitrix/create
   * Crea manualmente un contacto/lead en Bitrix24 desde el CRM
   */
  router.post("/:id/bitrix/create", async (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!bitrixService.isAvailable) {
      res.status(503).json({ error: "bitrix_not_configured" });
      return;
    }
    try {
      const { phone, name } = req.body;
      const result = await bitrixService.createContactWithCustomFields({
        phone: phone || conversation.phone,
        profileName: name || conversation.contactName || undefined,
      });

      if (result.contactId) {
        bitrixService.attachConversation(conversation, result.contactId);
        const contact = await bitrixService.fetchContact(result.contactId);
        res.json({ success: true, contact, bitrixId: result.contactId, entityType: result.entityType });
      } else {
        res.status(500).json({ error: "create_failed", reason: result.reason });
      }
    } catch (error) {
      console.error("[CRM] bitrix create error", error);
      res.status(500).json({ error: "bitrix_create_failed" });
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

  router.post("/:id/unarchive", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    // Cambiar el estado a "active" para desarchivar
    crmDb.updateConversationMeta(conversation.id, { status: "active" });
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

  // Queue management endpoints
  router.get("/queue", (_req, res) => {
    const queuedConversations = crmDb.listQueuedConversations();
    res.json({ conversations: queuedConversations });
  });

  router.post("/:id/accept", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Get advisor ID from auth (user email)
    const advisorId = req.user?.email || "unknown";

    const accepted = crmDb.acceptConversation(conversation.id, advisorId);
    if (!accepted) {
      res.status(400).json({ error: "cannot_accept", reason: "Conversation is not in queue" });
      return;
    }

    const updated = crmDb.getConversationById(conversation.id);
    if (updated) {
      socketManager.emitConversationUpdate({ conversation: updated });
    }

    res.json({ success: true, conversation: updated });
  });

  router.post("/:id/release", (req, res) => {
    const conversation = crmDb.getConversationById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const released = crmDb.releaseConversation(conversation.id);
    if (!released) {
      res.status(400).json({ error: "cannot_release", reason: "Conversation is not being attended" });
      return;
    }

    const updated = crmDb.getConversationById(conversation.id);
    if (updated) {
      socketManager.emitConversationUpdate({ conversation: updated });
    }

    res.json({ success: true, conversation: updated });
  });

  return router;
}
