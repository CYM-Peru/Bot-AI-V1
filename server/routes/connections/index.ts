import { Router } from "express";
import { createBitrixConnectionsRouter } from "./bitrix";
import { createWhatsAppConnectionsRouter } from "./whatsapp";

export function createConnectionsRouter() {
  const router = Router();

  router.use("/whatsapp", createWhatsAppConnectionsRouter());
  router.use("/bitrix", createBitrixConnectionsRouter());

  return router;
}
