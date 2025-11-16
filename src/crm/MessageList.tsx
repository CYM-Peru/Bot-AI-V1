import { useEffect, useMemo, useRef } from "react";
import type { Attachment, Message } from "./types";
import MessageBubble from "./MessageBubble";
import EventBubble from "./EventBubble";
import CollapsibleNotifications from "./CollapsibleNotifications";
import { useAuth } from "../hooks/useAuth";
import { Trash2 } from "lucide-react";
import { authFetch } from "../lib/apiBase";

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
  const { user } = useAuth();

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("¿Eliminar este mensaje del sistema?")) return;

    try {
      const response = await authFetch(`/api/crm/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || "Error al eliminar mensaje");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Error al eliminar mensaje");
    }
  };

  // Create a map of attachment ID -> Attachment for quick lookup
  const attachmentById = useMemo(() => {
    const map = new Map<string, Attachment>();
    for (const attachment of attachments) {
      map.set(attachment.id, attachment);
    }
    return map;
  }, [attachments]);

  // Create a map of message ID -> Attachments using msgId field
  const attachmentMap = useMemo(() => {
    const map = new Map<string, Attachment[]>();

    console.log('[AttachmentMap] Building map with', attachments.length, 'attachments and', messages.length, 'messages');

    // Build map using msgId field from attachments (more reliable than parsing mediaUrl)
    for (const attachment of attachments) {
      if (!attachment.msgId) continue;

      const existing = map.get(attachment.msgId) || [];
      map.set(attachment.msgId, [...existing, attachment]);
    }

    console.log('[AttachmentMap] After msgId mapping:', map.size, 'messages have attachments');

    // FALLBACK: For backwards compatibility, also try to extract from mediaUrl
    // This handles old messages where msgId might not be set
    for (const message of messages) {
      if (map.has(message.id)) continue; // Skip if already found via msgId
      if (!message.mediaUrl) continue;

      const match = message.mediaUrl.match(/\/attachments\/([a-f0-9-]+)/);
      if (!match) continue;

      const attachmentId = match[1];
      const attachment = attachmentById.get(attachmentId);
      if (attachment) {
        map.set(message.id, [attachment]);
        console.log('[AttachmentMap] FALLBACK: Mapped message', message.id, 'to attachment', attachmentId);
      } else {
        console.warn('[AttachmentMap] FALLBACK: Could not find attachment', attachmentId, 'for message', message.id);
      }
    }

    console.log('[AttachmentMap] Final map has', map.size, 'messages with attachments');
    return map;
  }, [messages, attachments, attachmentById]);

  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of messages) {
      map.set(message.id, message);
    }
    return map;
  }, [messages]);

  // Group messages by date with separators
  const messagesWithSeparators = useMemo(() => {
    const result: Array<{ type: 'message'; message: Message } | { type: 'separator'; date: string; label: string }> = [];
    let lastDate: string | null = null;

    console.log('[Date Separators] Processing', messages.length, 'messages');

    for (const message of messages) {
      const messageDate = new Date(message.createdAt);
      const dateKey = messageDate.toLocaleDateString('es-PE');

      if (dateKey !== lastDate) {
        // Insert date separator
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let label: string;
        if (dateKey === today.toLocaleDateString('es-PE')) {
          label = 'HOY';
        } else if (dateKey === yesterday.toLocaleDateString('es-PE')) {
          label = 'AYER';
        } else {
          // Format as "DD MMM" (e.g., "02 NOV")
          label = messageDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).toUpperCase();
        }

        console.log(`[Date Separators] Inserting separator "${label}" before message:`, {
          text: message.text?.substring(0, 30),
          createdAt: messageDate.toLocaleString('es-PE'),
          dateKey
        });

        result.push({ type: 'separator', date: dateKey, label });
        lastDate = dateKey;
      }

      result.push({ type: 'message', message });
    }

    return result;
  }, [messages]);

  // Group consecutive event notifications for collapsing
  const groupedMessages = useMemo(() => {
    const result: Array<
      | { type: 'message'; message: Message }
      | { type: 'separator'; date: string; label: string }
      | { type: 'notification_group'; notifications: Message[] }
    > = [];

    let notificationBuffer: Message[] = [];

    for (let i = 0; i < messagesWithSeparators.length; i++) {
      const item = messagesWithSeparators[i];

      if (item.type === 'separator') {
        // Flush any buffered notifications
        if (notificationBuffer.length > 0) {
          result.push({ type: 'notification_group', notifications: notificationBuffer });
          notificationBuffer = [];
        }
        result.push(item);
        continue;
      }

      const message = item.message;
      // Consider both type="event" AND type="system" with eventType as notifications
      const isNotification = message.type === 'event' || (message.type === 'system' && message.eventType);

      if (isNotification) {
        // Add to buffer
        notificationBuffer.push(message);
      } else {
        // Regular message - flush buffer first
        if (notificationBuffer.length > 0) {
          result.push({ type: 'notification_group', notifications: notificationBuffer });
          notificationBuffer = [];
        }
        result.push(item);
      }
    }

    // Flush any remaining notifications
    if (notificationBuffer.length > 0) {
      result.push({ type: 'notification_group', notifications: notificationBuffer });
    }

    return result;
  }, [messagesWithSeparators]);

  // Scroll to bottom on mount (immediate) and when new messages arrive (smooth)
  useEffect(() => {
    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
      // Try scrollIntoView first
      bottomRef.current?.scrollIntoView({ behavior, block: "end", inline: "nearest" });

      // Also try to scroll the parent container directly (in case scrollIntoView doesn't work)
      if (containerRef.current?.parentElement) {
        const parent = containerRef.current.parentElement;
        if (parent.scrollHeight > parent.clientHeight) {
          parent.scrollTop = parent.scrollHeight;
        }
      }
    };

    if (isInitialMount.current) {
      // First render: scroll immediately
      scrollToBottom("auto");
      isInitialMount.current = false;

      // Scroll multiple times with increasing delays to handle:
      // - Initial render (immediate)
      // - After separators render (100ms)
      // - After images start loading (300ms)
      // - After images fully load (800ms)
      // - Final safety scroll (1500ms)
      const delays = [100, 300, 800, 1500];
      const timeouts: NodeJS.Timeout[] = [];

      delays.forEach(delay => {
        timeouts.push(setTimeout(() => scrollToBottom("auto"), delay));
      });

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else {
      // Subsequent updates: smooth scroll
      scrollToBottom("smooth");
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
    <div className="h-full bg-slate-50 px-6 pt-4 pb-0" ref={containerRef}>
      <div className="flex flex-col gap-2">
        {groupedMessages.map((item, index) => {
          if (item.type === 'separator') {
            return (
              <div key={`separator-${item.date}`} className="flex items-center justify-center my-3">
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500 w-full max-w-md">
                  <div className="flex-1 h-px bg-slate-300"></div>
                  <span className="px-3 py-1 bg-white rounded-full shadow-sm border border-slate-200">
                    {item.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-300"></div>
                </div>
              </div>
            );
          }

          // Render grouped notifications with collapse functionality
          if (item.type === 'notification_group') {
            return (
              <div key={`notification-group-${index}`}>
                <CollapsibleNotifications notifications={item.notifications} />
              </div>
            );
          }

          const message = item.message;

          // Render event messages (trazabilidad) - should not reach here as they're grouped
          if (message.type === "event") {
            return (
              <div key={message.id} id={`message-${message.id}`}>
                <EventBubble message={message} />
              </div>
            );
          }

          // LEGACY: Render old system messages that have eventType using EventBubble
          // This provides backward compatibility for messages created before standardization
          if (message.type === "system" && message.eventType) {
            return (
              <div key={message.id} id={`message-${message.id}`}>
                <EventBubble message={message} />
              </div>
            );
          }

          // LEGACY FALLBACK: Render very old system messages without eventType
          // These are messages from before the event system was implemented
          if (message.type === "system") {
            // Format timestamp
            const timestamp = new Date(message.createdAt).toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });

            // Simplify multi-line text to single line
            const simplifiedText = message.text?.replace(/\n/g, ' ') || '';

            // Use metadata.backgroundColor if present, otherwise default gray
            const backgroundColor = message.metadata?.backgroundColor || '#6b7280';
            const textColor = 'white';

            return (
              <div key={message.id} id={`message-${message.id}`} className="flex justify-center my-2 group relative">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-sm"
                  style={{ backgroundColor, color: textColor }}
                >
                  <span>{simplifiedText}</span>
                  <span className="text-[10px] opacity-80">{timestamp}</span>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:bg-white/20 rounded p-1"
                      title="Eliminar mensaje"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                  )}
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
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
