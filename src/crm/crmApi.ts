import { apiUrl } from "../lib/apiBase";
import type { Attachment, Conversation, Message } from "./types";

export async function fetchConversations(): Promise<Conversation[]> {
  const response = await fetch(apiUrl("/api/crm/conversations"));
  if (!response.ok) {
    throw new Error("No se pudieron cargar las conversaciones");
  }
  const data = (await response.json()) as Conversation[];
  return data;
}

export async function fetchMessages(convId: string): Promise<{ messages: Message[]; attachments: Attachment[] }> {
  const response = await fetch(apiUrl(`/api/crm/conversations/${convId}/messages`));
  if (!response.ok) {
    throw new Error("No se pudieron cargar los mensajes");
  }
  return (await response.json()) as { messages: Message[]; attachments: Attachment[] };
}

export interface SendMessagePayload {
  convId?: string;
  phone?: string;
  text?: string;
  attachmentId?: string;
  replyToId?: string;
  type?: Message["type"];
}

export interface SendMessageResult {
  ok: boolean;
  providerStatus: number;
  echo: { convId: string; phone: string; text: string | null };
  message: Message;
  attachment: Attachment | null;
  error: string | null;
}

export async function sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
  const response = await fetch(apiUrl("/api/crm/messages/send"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "unknown" }));
    throw new Error(body.error ?? "Error enviando mensaje");
  }
  const data = (await response.json()) as SendMessageResult;
  return {
    ...data,
    attachment: data.attachment ?? null,
  };
}

export async function uploadAttachment(file: File) {
  const base64 = await fileToBase64(file);
  const response = await fetch(apiUrl("/api/crm/attachments/upload"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, mime: file.type || "application/octet-stream", data: base64 }),
  });
  if (!response.ok) {
    throw new Error("No se pudo subir el adjunto");
  }
  return (await response.json()) as { attachment: Attachment };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("reader_error"));
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export async function archiveConversation(convId: string) {
  const response = await fetch(apiUrl(`/api/crm/conversations/${convId}/archive`), {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("No se pudo archivar la conversación");
  }
  return (await response.json()) as { success: boolean };
}
