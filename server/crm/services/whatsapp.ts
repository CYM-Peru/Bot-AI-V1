import { sendWhatsAppMessage, type WhatsAppSendResult } from "../../services/whatsapp";

type SendOptions = {
  phone: string;
  text?: string;
  mediaUrl?: string | null;
  mediaId?: string | null;
  mediaType?: "image" | "audio" | "video" | "document" | "sticker";
  caption?: string | null;
};

export interface ProviderResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export async function sendOutboundMessage(options: SendOptions): Promise<ProviderResult> {
  const result: WhatsAppSendResult = await sendWhatsAppMessage({
    phone: options.phone,
    text: options.text,
    mediaUrl: options.mediaUrl,
    mediaId: options.mediaId,
    mediaType: options.mediaType,
    caption: options.caption,
  });

  return {
    ok: result.ok,
    status: result.status,
    body: result.body,
    error: result.error,
  };
}
