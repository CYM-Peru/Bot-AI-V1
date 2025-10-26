import type { ChannelButtonLimit } from "./types";

export const CHANNEL_BUTTON_LIMITS: ChannelButtonLimit[] = [
  {
    channel: "whatsapp",
    max: 3,
    source: "https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages#interactive-object",
    note: "WhatsApp interactive reply buttons accept up to 3 options.",
  },
  {
    channel: "facebook",
    max: 3,
    source: "https://developers.facebook.com/docs/messenger-platform/send-messages/buttons",
    note: "Messenger templates allow up to 3 buttons per message.",
  },
  {
    channel: "telegram",
    max: 100,
    source: "https://core.telegram.org/bots/api#inlinekeyboardmarkup",
    note: "Telegram allows many buttons; the default limit uses the strictest platform instead.",
  },
  {
    channel: "web",
    max: 5,
    source: "https://www.w3.org/TR/wai-aria-practices/examples/dialog-modal/",
    note: "Web chat uses UX guidance; the effective default remains the most restrictive cross-channel limit.",
  },
];

export const DEFAULT_BUTTON_LIMIT = Math.min(...CHANNEL_BUTTON_LIMITS.map((entry) => entry.max));
