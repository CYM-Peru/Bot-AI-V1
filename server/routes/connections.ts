import { Router } from "express";
import { checkWhatsAppConnection } from "../services/whatsapp";
import { checkBitrixConnection } from "../services/bitrix";

export function createConnectionsRouter() {
  const router = Router();

  router.get("/whatsapp/check", async (_req, res) => {
    try {
      const status = await checkWhatsAppConnection();
      res.status(status.ok ? 200 : status.status && status.status >= 400 ? status.status : 200).json(status);
    } catch (error) {
      console.error("[Connections] WhatsApp check failed", error);
      res.status(500).json({ ok: false, reason: "unexpected_error" });
    }
  });

  router.get("/bitrix/check", async (_req, res) => {
    try {
      const status = await checkBitrixConnection();
      res.status(status.ok ? 200 : status.status && status.status >= 400 ? status.status : 200).json(status);
    } catch (error) {
      console.error("[Connections] Bitrix check failed", error);
      res.status(500).json({ ok: false, reason: "unexpected_error" });
    }
  });

  return router;
}
