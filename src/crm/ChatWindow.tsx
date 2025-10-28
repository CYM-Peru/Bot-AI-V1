import { useMemo, useState } from "react";
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

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex flex-col gap-2 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{conversation.contactName || conversation.phone}</h2>
            <p className="text-xs text-slate-500">Último mensaje: {formatDate(conversation.lastMessageAt)}</p>
          </div>
          <div className="text-xs text-slate-400">
            Estado: {conversation.status === "archived" ? "Archivada" : "Activa"}
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
