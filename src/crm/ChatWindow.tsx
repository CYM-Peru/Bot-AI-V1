import { useMemo, useState } from "react";
import { apiUrl } from "../lib/apiBase";
import BitrixContactCard from "./BitrixContactCard";
import Composer from "./Composer";
import MessageList from "./MessageList";
import type { Attachment, Conversation, Message } from "./types";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  attachments: Attachment[];
  onSend: (payload: { text: string; file?: File | null; replyToId?: string | null }) => Promise<void>;
}

export default function ChatWindow({ conversation, messages, attachments, onSend }: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<{ message: Message; attachments: Attachment[] } | null>(null);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  const handleSend = async (payload: { text: string; file?: File | null; replyToId?: string | null }) => {
    await onSend(payload);
    setReplyTo(null);
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Selecciona una conversación del panel izquierdo.</p>
      </div>
    );
  }

  const handleArchive = async () => {
    if (!conversation) return;
    try {
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/archive`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        console.log('[CRM] Conversación archivada exitosamente:', conversation.id);
      } else {
        console.error('[CRM] Error al archivar conversación:', response.statusText);
      }
    } catch (error) {
      console.error('[CRM] Error al archivar conversación:', error);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 flex-shrink-0 border-b border-slate-200 bg-gradient-to-br from-emerald-50 to-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-semibold">
                {(conversation.contactName || conversation.phone).charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{conversation.contactName || conversation.phone}</h2>
                <p className="text-xs text-slate-600">
                  {conversation.phone} · Último mensaje: {formatDate(conversation.lastMessageAt)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs px-3 py-1 rounded-full font-medium bg-white border border-slate-200">
              {conversation.status === "archived" ? "🗂️ Archivada" : "✓ Activa"}
            </div>
            {conversation.status !== "archived" && (
              <>
                <button
                  onClick={() => console.log('[CRM] Transferir a asesor')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                  title="Transferir a otro asesor"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Asesor
                </button>
                <button
                  onClick={() => console.log('[CRM] Transferir a bot')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-600 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition"
                  title="Transferir a bot"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Bot
                </button>
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition"
                  title="Archivar conversación"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
        <BitrixContactCard conversation={conversation} />
      </header>
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={sortedMessages}
          attachments={attachments}
          onReply={(message) => {
            const repliedAttachments = attachments.filter((item) => item.msgId === message.id);
            setReplyTo({ message, attachments: repliedAttachments });
          }}
        />
      </div>
      <div className="flex-shrink-0">
        <Composer replyingTo={replyTo} onCancelReply={() => setReplyTo(null)} onSend={handleSend} />
      </div>
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
