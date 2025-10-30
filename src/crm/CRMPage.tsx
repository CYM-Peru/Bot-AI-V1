import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import type { Attachment, Conversation, Message } from "./types";
import { fetchConversations, fetchMessages, sendMessage, uploadAttachment } from "./crmApi";
import { createCrmSocket, type CrmSocket } from "./socket";
import { useNotifications } from "./useNotifications";
import { useSoundNotifications } from "./useSoundNotifications";
import { useDarkMode } from "./DarkModeContext";
import { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from "./useKeyboardShortcuts";
import { AdvisorStatusButton } from "./AdvisorStatusButton";
import MetricsDashboard from "./MetricsDashboard";

interface ConversationState {
  messages: Message[];
  attachments: Attachment[];
}

export default function CRMPage() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<Record<string, ConversationState>>({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const socketRef = useRef<CrmSocket | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem("crm:notifications:enabled");
    return saved ? JSON.parse(saved) : true;
  });
  const [showNotificationPreview, setShowNotificationPreview] = useState(() => {
    const saved = localStorage.getItem("crm:notifications:preview");
    return saved ? JSON.parse(saved) : true;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("crm:sound:enabled");
    return saved ? JSON.parse(saved) : true;
  });
  const [soundVolume, setSoundVolume] = useState(() => {
    const saved = localStorage.getItem("crm:sound:volume");
    return saved ? parseFloat(saved) : 0.7;
  });
  const [showMetrics, setShowMetrics] = useState(false);
  const fetchedConversationsRef = useRef<Set<string>>(new Set());

  // Use notifications hook for current conversation
  const currentMessages = selectedConversationId ? conversationData[selectedConversationId]?.messages ?? [] : [];
  useNotifications(currentMessages, {
    enabled: notificationsEnabled,
    showPreview: showNotificationPreview,
  });

  // Use sound notifications hook - now monitors ALL conversations except the current one
  useSoundNotifications(conversationData, selectedConversationId, {
    enabled: soundEnabled,
    volume: soundVolume,
  });

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    onSearch: () => {
      // Focus search input - we'll need to pass a ref to ConversationList
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput?.focus();
    },
    onToggleSettings: () => {
      setShowSettings((prev) => !prev);
    },
    onEscape: () => {
      setShowSettings(false);
    },
  });

  // Save notification preferences to localStorage
  useEffect(() => {
    localStorage.setItem("crm:notifications:enabled", JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("crm:notifications:preview", JSON.stringify(showNotificationPreview));
  }, [showNotificationPreview]);

  useEffect(() => {
    localStorage.setItem("crm:sound:enabled", JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("crm:sound:volume", soundVolume.toString());
  }, [soundVolume]);

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
      setConversationData((prev) => updateConversationData(prev, message.convId, (state) => {
        return {
          messages: state.messages.map((item) => (item.id === message.id ? message : item)),
          attachments: attachment
            ? [...state.attachments.filter((item) => item.id !== attachment.id), attachment]
            : state.attachments,
        };
      }));
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

    // Skip if we've already fetched or are currently fetching this conversation
    if (fetchedConversationsRef.current.has(convId)) {
      return;
    }

    // Mark as being fetched
    fetchedConversationsRef.current.add(convId);

    // Fetch messages for this conversation
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
        // Remove from set if fetch failed so it can be retried
        fetchedConversationsRef.current.delete(convId);
      });
  }, [selectedConversationId]);

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
      {/* CRM Header with Advisor Status */}
      <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">{showMetrics ? "Dashboard de Métricas" : "Chat en vivo"}</h2>
          <span className="text-xs text-slate-500">{showMetrics ? "Analítica y KPIs" : "Gestiona tus conversaciones"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              showMetrics
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showMetrics ? "💬 Volver a Chats" : "📊 Métricas"}
          </button>
          <AdvisorStatusButton userId="user-1" />
        </div>
      </div>

      {showMetrics ? (
        <div className="flex-1 overflow-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
          <MetricsDashboard />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl relative">
          <div className="w-[320px] flex-shrink-0 h-full">
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

        {/* Settings Button - Bottom left corner */}
        <div className="absolute bottom-4 left-4 z-10">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-slate-200 shadow-lg hover:bg-slate-50 hover:border-slate-300 transition"
            title="Configuración"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Settings Panel - Opens from bottom left */}
        {showSettings && (
          <div className="absolute bottom-20 left-4 z-20 w-80 bg-white rounded-xl border-2 border-slate-200 shadow-2xl">
            <div className="bg-gradient-to-r from-blue-50 to-white px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Configuración CRM</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Notifications Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Notificaciones</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Activar notificaciones</p>
                      <p className="text-xs text-slate-500 mt-0.5">Recibir alertas de nuevos mensajes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Mostrar vista previa</p>
                      <p className="text-xs text-slate-500 mt-0.5">Ver contenido del mensaje en la notificación</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={showNotificationPreview}
                      onChange={(e) => setShowNotificationPreview(e.target.checked)}
                      disabled={!notificationsEnabled}
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
              </div>

              {notificationsEnabled && "Notification" in window && Notification.permission === "denied" && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-900">Permisos bloqueados</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Las notificaciones están bloqueadas. Por favor, habilítalas en la configuración de tu navegador.
                  </p>
                </div>
              )}

              {/* Sound Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Sonido</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Sonido de notificación</p>
                      <p className="text-xs text-slate-500 mt-0.5">Reproducir sonido con nuevos mensajes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  {soundEnabled && (
                    <div className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-900">Volumen</label>
                        <span className="text-xs font-medium text-slate-600">{Math.round(soundVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={soundVolume}
                        onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Appearance Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Apariencia</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Modo oscuro</p>
                      <p className="text-xs text-slate-500 mt-0.5">Cambiar a tema oscuro</p>
                    </div>
                    <button
                      onClick={toggleDarkMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        isDarkMode ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isDarkMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>

              {/* Keyboard Shortcuts Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Atajos de Teclado</h4>
                <div className="space-y-2">
                  {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <span className="text-sm text-slate-700">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="px-2 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded shadow-sm"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-900">
                    <span className="font-semibold">Tip:</span> En Mac, usa Cmd en lugar de Ctrl
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
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
