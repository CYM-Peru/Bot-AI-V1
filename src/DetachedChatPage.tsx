import { useEffect, useState } from "react";
import DetachedChatWindow from "./crm/DetachedChatWindow";
import type { Attachment, Conversation, Message } from "./crm/types";
import { sendMessage, uploadAttachment } from "./crm/crmApi";
import { createCrmSocket, type CrmSocket } from "./crm/socket";

export default function DetachedChatPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const conversationId = urlParams.get("conversationId");

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const socketRef = useState<CrmSocket | null>(null)[0];

  useEffect(() => {
    if (!conversationId) {
      console.error("[DetachedChat] No conversation ID provided");
      return;
    }

    // Load initial data from localStorage (set by parent window)
    const storedData = localStorage.getItem(`detached-chat-${conversationId}`);
    if (storedData) {
      const data = JSON.parse(storedData);
      setConversation(data.conversation);
      setMessages(data.messages);
      setAttachments(data.attachments);
    }

    // Connect to WebSocket for real-time updates
    const socket = createCrmSocket();

    socket.on("crm:msg:new", (data) => {
      if (data.message.convId === conversationId) {
        setMessages((prev) => [...prev, data.message]);
        if (data.attachment && data.attachment !== null && data.attachment !== undefined) {
          setAttachments((prev) => [...prev, data.attachment!]);
        }
      }
    });

    socket.on("crm:conv:update", (data) => {
      if (data.conversation.id === conversationId) {
        setConversation(data.conversation);
      }
    });

    // Listen for sync events from parent window
    const channel = new BroadcastChannel("crm-chat-sync");
    channel.onmessage = (event) => {
      if (event.data.type === "sync-data" && event.data.conversationId === conversationId) {
        setConversation(event.data.conversation);
        setMessages(event.data.messages);
        setAttachments(event.data.attachments);
      }
    };

    return () => {
      socket.disconnect();
      channel.close();
    };
  }, [conversationId]);

  const handleSend = async (payload: {
    text: string;
    files?: File[];
    replyToId?: string | null;
    isInternal?: boolean
  }) => {
    if (!conversationId) return;

    try {
      // Handle multiple file uploads
      const attachmentIds: string[] = [];
      if (payload.files && payload.files.length > 0) {
        for (const file of payload.files) {
          const { attachment } = await uploadAttachment(file);
          attachmentIds.push(attachment.id);
        }
      }

      // Send messages - one for each attachment, or one text-only message
      if (attachmentIds.length === 0) {
        const result = await sendMessage({
          convId: conversationId,
          text: payload.text,
          replyToId: payload.replyToId ?? undefined,
          isInternal: payload.isInternal ?? false,
        });
        setMessages((prev) => [...prev, result.message]);
      } else {
        const newMessages: Message[] = [];
        const newAttachments: Attachment[] = [];

        for (let i = 0; i < attachmentIds.length; i++) {
          const isFirst = i === 0;
          const result = await sendMessage({
            convId: conversationId,
            text: isFirst ? payload.text : "",
            replyToId: isFirst ? (payload.replyToId ?? undefined) : undefined,
            attachmentId: attachmentIds[i],
            isInternal: payload.isInternal ?? false,
          });
          newMessages.push(result.message);
          if (result.attachment) {
            newAttachments.push(result.attachment);
          }
        }

        setMessages((prev) => [...prev, ...newMessages]);
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch (error) {
      console.error("[DetachedChat] Error sending message:", error);
    }
  };

  const handleReattach = () => {
    // Notificar a la ventana padre
    const channel = new BroadcastChannel("crm-chat-sync");
    channel.postMessage({ type: "reattach-request", conversationId });
    channel.close();

    window.close();
  };

  if (!conversationId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Error</p>
          <p className="text-sm text-slate-600 mt-2">No se especificó una conversación</p>
        </div>
      </div>
    );
  }

  return (
    <DetachedChatWindow
      conversation={conversation}
      messages={messages}
      attachments={attachments}
      onSend={handleSend}
      onReattach={handleReattach}
    />
  );
}
