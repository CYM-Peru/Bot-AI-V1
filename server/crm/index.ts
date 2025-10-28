import type { Application } from "express";
import { Router } from "express";
import type { Server } from "http";
import type { ChangeValue, WhatsAppMessage } from "../../src/api/whatsapp-webhook";
import type { Bitrix24Client } from "../../src/integrations/bitrix24";
import { createCrmRealtimeManager } from "./sockets";
import { createAttachmentsRouter } from "./routes/attachments";
import { createMessagesRouter } from "./routes/messages";
import { createConversationsRouter } from "./routes/conversations";
import { createBitrixService } from "./services/bitrix";
import { handleIncomingWhatsAppMessage } from "./inbound";

export interface RegisterCrmOptions {
  app: Application;
  server: Server;
  bitrixClient?: Bitrix24Client;
}

export function registerCrmModule(options: RegisterCrmOptions) {
  const router = Router();
  const realtime = createCrmRealtimeManager(options.server);
  const bitrixService = createBitrixService(options.bitrixClient);

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
