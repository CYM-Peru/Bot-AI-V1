import { useEffect, useMemo, useRef } from "react";
import type { Attachment, Message } from "./types";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  attachments: Attachment[];
  onReply: (message: Message) => void;
  activeUser?: string;
}

export default function MessageList({ messages, attachments, onReply }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const attachmentMap = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const attachment of attachments) {
      if (!attachment.msgId) continue;
      const list = map.get(attachment.msgId) ?? [];
      list.push(attachment);
      map.set(attachment.msgId, list);
    }
    return map;
  }, [attachments]);

  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of messages) {
      map.set(message.id, message);
    }
    return map;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            attachments={attachmentMap.get(message.id) ?? []}
            repliedTo={message.repliedToId ? messageMap.get(message.repliedToId) ?? null : null}
            repliedAttachments={message.repliedToId ? attachmentMap.get(message.repliedToId) ?? [] : []}
            onReply={() => onReply(message)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
