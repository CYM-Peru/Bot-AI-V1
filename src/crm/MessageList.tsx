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
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Function to scroll to a specific message
  const handleScrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the message temporarily
      messageElement.classList.add("highlight-message");
      setTimeout(() => {
        messageElement.classList.remove("highlight-message");
      }, 2000);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 px-6 py-4" ref={containerRef}>
      <div className="flex flex-col gap-2">
        {messages.map((message) => {
          // Render system messages differently
          if (message.type === "system") {
            return (
              <div key={message.id} id={`message-${message.id}`} className="flex justify-center my-1">
                <div className="px-3 py-1.5 bg-gradient-to-br from-slate-600 to-slate-700 text-slate-50 text-[11px] font-medium rounded-lg max-w-md text-center shadow-md tracking-wide">
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
              onScrollToMessage={handleScrollToMessage}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
