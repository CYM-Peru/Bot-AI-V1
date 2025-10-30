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
  const isInitialMount = useRef(true);

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

  // Scroll to bottom on mount (immediate) and when new messages arrive (smooth)
  useEffect(() => {
    if (isInitialMount.current) {
      // First render: scroll immediately without animation
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialMount.current = false;

      // Also scroll after images load (with a small delay)
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }, 300);
    } else {
      // Subsequent updates: smooth scroll
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((message) => {
          // Render system messages differently
          if (message.type === "system") {
            return (
              <div key={message.id} className="flex justify-center my-2">
                <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200 max-w-md text-center shadow-sm">
                  {message.text}
                </div>
              </div>
            );
          }

          // Render regular messages
          return (
            <MessageBubble
              key={message.id}
              message={message}
              attachments={attachmentMap.get(message.id) ?? []}
              repliedTo={message.repliedToId ? messageMap.get(message.repliedToId) ?? null : null}
              repliedAttachments={message.repliedToId ? attachmentMap.get(message.repliedToId) ?? [] : []}
              onReply={() => onReply(message)}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
