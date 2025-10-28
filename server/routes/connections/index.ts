import { Router } from "express";
import { createWhatsAppConnectionsRouter } from "./whatsapp";

export function createConnectionsRouter() {
  const router = Router();

  router.use("/whatsapp", createWhatsAppConnectionsRouter());

  return router;
}
