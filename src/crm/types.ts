export type ConversationStatus = "active" | "attending" | "archived";

export interface Conversation {
  id: string;
  phone: string;
  contactName: string | null;
  bitrixId: string | null;
  bitrixDocument: string | null;  // Número de documento del contacto en Bitrix
  avatarUrl: string | null;        // URL de la foto de perfil (WhatsApp o Bitrix)
  lastMessageAt: number;
  unread: number;
  status: ConversationStatus;
  lastMessagePreview: string | null;
}

export type MessageDirection = "incoming" | "outgoing";

export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "system";

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id: string;
  convId: string;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  mediaThumb: string | null;
  repliedToId: string | null;
  status: MessageStatus;
  createdAt: number;
}

export interface Attachment {
  id: string;
  msgId: string | null;
  filename: string;
  mime: string;
  size: number;
  url: string;
  thumbUrl: string | null;
  createdAt: number;
}

export interface ConversationBundle {
  conversation: Conversation;
  messages: Message[];
  attachments: Attachment[];
}
