import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import type { Attachment, Conversation, Message } from "./types";
import { fetchConversations, fetchMessages, sendMessage, uploadAttachment } from "./crmApi";
import { createCrmSocket, type CrmSocket } from "./socket";
import CrmDock from "../components/CRM/CrmDock";

interface ConversationState {
  messages: Message[];
  attachments: Attachment[];
}

export default function CRMPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<Record<string, ConversationState>>({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const socketRef = useRef<CrmSocket | null>(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoadingConversations(true);
      try {
        const items = await fetchConversations();
        if (!ignore) {
          setConversations(sortConversations(items));
          if (items.length > 0) {
            setSelectedConversationId((prev) => prev ?? items[0].id);
          }
        }
      } catch (error) {
        console.error("[CRM] No se pudieron cargar conversaciones", error);
      } finally {
        if (!ignore) {
          setLoadingConversations(false);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const socket = createCrmSocket();
    socketRef.current = socket;

    socket.on("crm:msg:new", ({ message, attachment }) => {
      setConversationData((prev) => updateConversationData(prev, message.convId, (state) => ({
        messages: [...state.messages, message],
        attachments: attachment ? [...state.attachments, attachment] : state.attachments,
      })));
    });

    socket.on("crm:msg:update", ({ message, attachment }) => {
      setConversationData((prev) => updateConversationData(prev, message.convId, (state) => ({
        messages: state.messages.map((item) => (item.id === message.id ? message : item)),
        attachments: attachment
          ? [...state.attachments.filter((item) => item.id !== attachment.id), attachment]
          : state.attachments,
      })));
    });

    socket.on("crm:conv:update", ({ conversation }) => {
      setConversations((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === conversation.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = { ...next[existingIndex], ...conversation };
          return sortConversations(next);
        }
        return sortConversations([...prev, conversation]);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const convId = selectedConversationId;
    if (!convId) return;

    if (!conversationData[convId]) {
      fetchMessages(convId)
        .then((data) => {
          setConversationData((prev) => ({
            ...prev,
            [convId]: {
              messages: data.messages,
              attachments: data.attachments,
            },
          }));
        })
        .catch((error) => {
          console.error("[CRM] Error cargando mensajes", error);
        });
    }
  }, [selectedConversationId, conversationData]);

  useEffect(() => {
    const convId = selectedConversationId;
    if (!convId) return;
    const socket = socketRef.current;
    socket?.emit("crm:read", convId);
    setConversations((prev) => prev.map((item) => (item.id === convId ? { ...item, unread: 0 } : item)));
  }, [selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const currentState = selectedConversationId ? conversationData[selectedConversationId] : undefined;

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversationId(conversation.id);
  }, []);

  const handleSend = useCallback(
    async (payload: { text: string; file?: File | null; replyToId?: string | null; isInternal?: boolean }) => {
      if (!selectedConversation) return;
      try {
        let attachmentId: string | undefined;
        if (payload.file) {
          const { attachment } = await uploadAttachment(payload.file);
          attachmentId = attachment.id;
        }
        const result = await sendMessage({
          convId: selectedConversation.id,
          text: payload.text,
          replyToId: payload.replyToId ?? undefined,
          attachmentId,
          isInternal: payload.isInternal ?? false,
        });
        setConversationData((prev) => updateConversationData(prev, selectedConversation.id, (state) => ({
          messages: [...state.messages, result.message],
          attachments: result.attachment ? [...state.attachments, result.attachment] : state.attachments,
        })));
        setConversations((prev) => sortConversations(
          prev.map((item) =>
            item.id === selectedConversation.id
              ? {
                  ...item,
                  lastMessageAt: result.message.createdAt,
                  lastMessagePreview: result.message.text ?? item.lastMessagePreview,
                }
              : item,
          ),
        ));
      } catch (error) {
        console.error("[CRM] Error enviando mensaje", error);
      }
    },
    [selectedConversation],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <CrmDock />
      <div className="flex flex-1 min-h-[480px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="w-[320px] flex-shrink-0">
          {loadingConversations && conversations.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Cargando conversaciones…
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversationId}
              onSelect={handleSelectConversation}
            />
          )}
        </div>
        <ChatWindow
          conversation={selectedConversation}
          messages={currentState?.messages ?? []}
          attachments={currentState?.attachments ?? []}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

function updateConversationData(
  current: Record<string, ConversationState>,
  convId: string,
  updater: (state: ConversationState) => ConversationState,
): Record<string, ConversationState> {
  const base = current[convId] ?? { messages: [], attachments: [] };
  const updated = updater(base);
  const uniqueMessages = dedupeById(updated.messages);
  const uniqueAttachments = dedupeById(updated.attachments);
  return {
    ...current,
    [convId]: { messages: uniqueMessages, attachments: uniqueAttachments },
  };
}

function sortConversations(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}
