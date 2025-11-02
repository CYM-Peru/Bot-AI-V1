export type ConversationStatus = "active" | "attending" | "archived";

export type ChannelType = "whatsapp" | "facebook" | "instagram" | "tiktok";

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
  assignedTo: string | null;       // Advisor email/ID who accepted the conversation
  assignedAt: number | null;       // Timestamp when assigned
  queuedAt: number | null;         // Timestamp when entered queue (first "active" status)
  queueId: string | null;          // CRITICAL: Queue ID - prevents conversations from going to limbo when bot transfers
  channel: ChannelType;            // CRITICAL: Channel type (whatsapp, facebook, etc)
  channelConnectionId: string | null;  // CRITICAL: ID of the specific WhatsApp number/connection
  displayNumber: string | null;    // Display number for this connection (e.g., "+51 1 6193636")
  attendedBy: string[];            // Array of advisor userIds who have attended this conversation
  ticketNumber: number | null;     // Número correlativo del ticket/chat
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
  providerMetadata?: Record<string, unknown> | null;
  sentBy?: string | null;  // Nombre del asesor que envió el mensaje (solo para mensajes outgoing, no visible para el cliente)
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

export interface CRMEmitMessage {
  message: Message;
  attachment?: Attachment | null;
}

export interface CRMEmitConversation {
  conversation: Conversation;
}

export interface UploadResult {
  attachment: Attachment;
}
