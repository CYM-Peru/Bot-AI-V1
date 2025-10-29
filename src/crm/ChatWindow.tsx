import { useMemo, useState } from "react";
import { X } from "lucide-react";
import BitrixContactCard from "./BitrixContactCard";
import Composer from "./Composer";
import MessageList from "./MessageList";
import type { Attachment, Conversation, Message } from "./types";
import { archiveConversation } from "./crmApi";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  attachments: Attachment[];
  onSend: (payload: { text: string; file?: File | null; replyToId?: string | null }) => Promise<void>;
}

export default function ChatWindow({ conversation, messages, attachments, onSend }: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<{ message: Message; attachments: Attachment[] } | null>(null);
  const [archiving, setArchiving] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  const handleSend = async (payload: { text: string; file?: File | null; replyToId?: string | null }) => {
    await onSend(payload);
    setReplyTo(null);
  };

  const handleArchive = async () => {
    if (!conversation || archiving) return;
    const confirmed = window.confirm(`¿Cerrar conversación con ${conversation.contactName || conversation.phone}?`);
    if (!confirmed) return;

    setArchiving(true);
    try {
      await archiveConversation(conversation.id);
      // The conversation list will update via WebSocket
    } catch (error) {
      console.error("[ChatWindow] Error archivando conversación", error);
      alert("No se pudo cerrar la conversación. Intenta nuevamente.");
    } finally {
      setArchiving(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Selecciona una conversación del panel izquierdo.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex flex-col gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{conversation.contactName || conversation.phone}</h2>
            <p className="text-xs text-slate-500">Último mensaje: {formatDate(conversation.lastMessageAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              Estado: {conversation.status === "archived" ? "Archivada" : "Activa"}
            </div>
            {conversation.status !== "archived" && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-600 disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                {archiving ? "Cerrando..." : "Cerrar"}
              </button>
            )}
          </div>
        </div>
        <BitrixContactCard conversation={conversation} />
      </header>
      <MessageList
        messages={sortedMessages}
        attachments={attachments}
        onReply={(message) => {
          const repliedAttachments = attachments.filter((item) => item.msgId === message.id);
          setReplyTo({ message, attachments: repliedAttachments });
        }}
      />
      <Composer replyingTo={replyTo} onCancelReply={() => setReplyTo(null)} onSend={handleSend} />
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
