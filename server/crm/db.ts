import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Attachment, Conversation, Message, MessageStatus, MessageType } from "./models";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "crm.json");

interface CRMStore {
  conversations: Conversation[];
  messages: Message[];
  attachments: Attachment[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): CRMStore {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    return { conversations: [], messages: [], attachments: [] };
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as CRMStore;
    return {
      conversations: parsed.conversations ?? [],
      messages: parsed.messages ?? [],
      attachments: parsed.attachments ?? [],
    };
  } catch (error) {
    console.warn("[CRM] No se pudo leer crm.json, se recreará", error);
    return { conversations: [], messages: [], attachments: [] };
  }
}

export class CRMDatabase {
  private store: CRMStore;

  constructor() {
    this.store = loadStore();
  }

  private save() {
    ensureDataDir();
    fs.writeFileSync(DB_PATH, JSON.stringify(this.store, null, 2), "utf8");
  }

  listConversations(): Conversation[] {
    return [...this.store.conversations].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  getConversationById(id: string): Conversation | undefined {
    return this.store.conversations.find((item) => item.id === id);
  }

  getConversationByPhone(phone: string): Conversation | undefined {
    return this.store.conversations.find((item) => item.phone === phone);
  }

  createConversation(phone: string, contactName?: string | null): Conversation {
    const existing = this.getConversationByPhone(phone);
    if (existing) return existing;
    const now = Date.now();
    const conversation: Conversation = {
      id: randomUUID(),
      phone,
      contactName: contactName ?? null,
      bitrixId: null,
      lastMessageAt: now,
      unread: 0,
      status: "active",
      lastMessagePreview: null,
    };
    this.store.conversations.push(conversation);
    this.save();
    return conversation;
  }

  updateConversationMeta(convId: string, update: Partial<Omit<Conversation, "id">>) {
    const index = this.store.conversations.findIndex((item) => item.id === convId);
    if (index === -1) return;
    this.store.conversations[index] = { ...this.store.conversations[index], ...update };
    this.save();
  }

  appendMessage(input: {
    convId: string;
    direction: Message["direction"];
    type: MessageType;
    text?: string | null;
    mediaUrl?: string | null;
    mediaThumb?: string | null;
    repliedToId?: string | null;
    status: MessageStatus;
    providerMetadata?: Record<string, unknown> | null;
  }): Message {
    const message: Message = {
      id: randomUUID(),
      convId: input.convId,
      direction: input.direction,
      type: input.type,
      text: input.text ?? null,
      mediaUrl: input.mediaUrl ?? null,
      mediaThumb: input.mediaThumb ?? null,
      repliedToId: input.repliedToId ?? null,
      status: input.status,
      createdAt: Date.now(),
      providerMetadata: input.providerMetadata ?? null,
    };
    this.store.messages.push(message);

    const conversation = this.getConversationById(input.convId);
    if (conversation) {
      const preview = this.buildPreviewForMessage(message);
      const unread = input.direction === "incoming" ? conversation.unread + 1 : conversation.unread;
      this.updateConversationMeta(input.convId, {
        lastMessageAt: message.createdAt,
        unread,
        lastMessagePreview: preview,
      });
    }

    this.save();
    return message;
  }

  private buildPreviewForMessage(message: Message): string {
    switch (message.type) {
      case "text":
        return message.text ?? "";
      case "image":
        return "📷 Imagen";
      case "video":
        return "🎬 Video";
      case "audio":
        return "🎧 Audio";
      case "document":
        return "📎 Documento";
      case "sticker":
        return "🪄 Sticker";
      default:
        return "Mensaje";
    }
  }

  updateMessageStatus(messageId: string, status: MessageStatus, providerMetadata?: Record<string, unknown> | null) {
    const index = this.store.messages.findIndex((item) => item.id === messageId);
    if (index === -1) return;
    this.store.messages[index] = {
      ...this.store.messages[index],
      status,
      providerMetadata: providerMetadata ?? this.store.messages[index].providerMetadata ?? null,
    };
    this.save();
  }

  listMessages(convId: string, limit = 200): Message[] {
    const messages = this.store.messages
      .filter((message) => message.convId === convId)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (messages.length <= limit) return messages;
    return messages.slice(messages.length - limit);
  }

  markConversationRead(convId: string) {
    const conversation = this.getConversationById(convId);
    if (!conversation) return;
    this.updateConversationMeta(convId, { unread: 0 });
    let mutated = false;
    this.store.messages = this.store.messages.map((message) => {
      if (message.convId === convId && message.direction === "incoming" && message.status !== "read") {
        mutated = true;
        return { ...message, status: "read" };
      }
      return message;
    });
    if (mutated) this.save();
  }

  archiveConversation(convId: string) {
    this.updateConversationMeta(convId, { status: "archived" });
  }

  storeAttachment(input: Omit<Attachment, "createdAt">): Attachment {
    const attachment: Attachment = { ...input, createdAt: Date.now() };
    this.store.attachments.push(attachment);
    this.save();
    return attachment;
  }

  linkAttachmentToMessage(attachmentId: string, messageId: string) {
    const index = this.store.attachments.findIndex((item) => item.id === attachmentId);
    if (index === -1) return;
    this.store.attachments[index] = { ...this.store.attachments[index], msgId: messageId };
    this.save();
  }

  getAttachment(attachmentId: string): Attachment | undefined {
    return this.store.attachments.find((item) => item.id === attachmentId);
  }

  listAttachmentsByMessageIds(messageIds: string[]): Attachment[] {
    if (messageIds.length === 0) return [];
    const set = new Set(messageIds);
    return this.store.attachments.filter((attachment) => attachment.msgId && set.has(attachment.msgId));
  }
}

export const crmDb = new CRMDatabase();
