import { Router } from "express";
import { crmDb } from "../db";
import type { CrmRealtimeManager } from "../../ws/crmGateway";
import type { BitrixService } from "../services/bitrix";

export function createConversationsRouter(socketManager: CrmRealtimeManager, bitrixService: BitrixService) {
  const router = Router();

  router.get("/", (_req, res) => {
    const conversations = crmDb.listConversations();
    res.json({ conversations });
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

  return router;
}
