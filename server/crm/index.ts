import type { Application } from "express";
import { Router } from "express";
import type { ChangeValue, WhatsAppMessage } from "../../src/api/whatsapp-webhook";
import type { Bitrix24Client } from "../../src/integrations/bitrix24";
import { createAttachmentsRouter } from "./routes/attachments";
import { createMessagesRouter } from "./routes/messages";
import { createConversationsRouter } from "./routes/conversations";
import { createBitrixService } from "./services/bitrix";
import { handleIncomingWhatsAppMessage } from "./inbound";
import type { CrmRealtimeManager } from "./ws";

export interface RegisterCrmOptions {
  app: Application;
  socketManager: CrmRealtimeManager;
  bitrixClient?: Bitrix24Client;
}

export function registerCrmModule(options: RegisterCrmOptions) {
  const router = Router();
  const realtime = options.socketManager;
  const bitrixService = createBitrixService(options.bitrixClient);

  router.get("/health", (_req, res) => {
    const status = realtime.getStatus();
    res.json({ ok: true, ws: status.clients >= 0, clients: status.clients });
  });

  router.use("/attachments", createAttachmentsRouter());
  router.use("/messages", createMessagesRouter(realtime, bitrixService));
  router.use("/conversations", createConversationsRouter(realtime, bitrixService));

  options.app.use("/api/crm", router);

  return {
    socketManager: realtime,
    bitrixService,
    handleIncomingWhatsApp: (payload: { entryId: string; value: ChangeValue; message: WhatsAppMessage }) =>
      handleIncomingWhatsAppMessage({
        entryId: payload.entryId,
        value: payload.value,
        message: payload.message,
        socketManager: realtime,
        bitrixService,
      }),
  };
}
