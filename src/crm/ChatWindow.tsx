import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/apiBase";
import BitrixContactCard from "./BitrixContactCard";
import Composer from "./Composer";
import MessageList from "./MessageList";
import TemplateSelector from "./TemplateSelector";
import QueueActions from "./QueueActions";
import ChatWindowHeader from "./ChatWindowHeader";
import CreateLeadModal from "./CreateLeadModal";
// TEMPORARY: Disabled to fix infinite render loop
// import ConversationTags from "./ConversationTags";
import type { Attachment, Conversation, Message } from "./types";

import type { CrmSocket } from "./socket";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  attachments: Attachment[];
  onSend: (payload: { text: string; files?: File[]; replyToId?: string | null; isInternal?: boolean }) => Promise<void>;
  onDetach?: () => void;
  isDetached?: boolean;
  showToast?: (message: string, type: "success" | "error" | "info", duration?: number) => void;
  socket?: CrmSocket | null;
  userRole?: string;
}

const CHAT_BACKGROUNDS: Record<string, string> = {
  default: "from-slate-50 to-blue-50",
  purple: "from-purple-50 to-pink-50",
  green: "from-green-50 to-emerald-50",
  orange: "from-orange-50 to-amber-50",
  blue: "from-blue-50 to-cyan-50",
  rose: "from-rose-50 to-pink-50",
  gray: "from-gray-50 to-slate-50",
};

interface ChatTheme {
  chatBackgroundImage?: string;
  chatBackgroundColor?: string;
}

export default function ChatWindow({ conversation, messages, attachments, onSend, onDetach, isDetached, showToast, socket, userRole }: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<{ message: Message; attachments: Attachment[] } | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [chatBackground, setChatBackground] = useState(() => {
    return localStorage.getItem("crm:chat:background") || "default";
  });
  const [chatTheme, setChatTheme] = useState<ChatTheme>({
    chatBackgroundImage: "",
    chatBackgroundColor: "",
  });

  // Listen for background changes
  useEffect(() => {
    const handleBackgroundChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setChatBackground(customEvent.detail);
    };

    window.addEventListener("chat-background-changed", handleBackgroundChange);
    return () => window.removeEventListener("chat-background-changed", handleBackgroundChange);
  }, []);

  // Load and listen for chat theme changes
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await authFetch("/api/user-profile/chat-theme");
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.preferences) {
            setChatTheme({
              chatBackgroundImage: data.preferences.chatBackgroundImage || "",
              chatBackgroundColor: data.preferences.chatBackgroundColor || "",
            });
          }
        }
      } catch (error) {
        console.error("Error loading chat theme:", error);
      }
    };

    loadTheme();

    const handleThemeChange = (event: CustomEvent) => {
      const theme = event.detail;
      setChatTheme({
        chatBackgroundImage: theme.chatBackgroundImage || "",
        chatBackgroundColor: theme.chatBackgroundColor || "",
      });
    };

    window.addEventListener("chat-theme-changed", handleThemeChange as EventListener);
    return () => {
      window.removeEventListener("chat-theme-changed", handleThemeChange as EventListener);
    };
  }, []);

  const [transferType, setTransferType] = useState<"advisor" | "bot" | "queue">("advisor");
  const [advisors, setAdvisors] = useState<Array<{
    id: string;
    name: string;
    email?: string;
    isOnline?: boolean;
    lastSeen?: number | null;
    currentStatus?: {
      id: string;
      name: string;
      action: string;
      color: string;
    } | null;
  }>>([]);
  const [bots, setBots] = useState<Array<{ id: string; name: string }>>([]);
  const [queues, setQueues] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (!conversation || conversation.readAt) return;

    const markAsRead = async () => {
      try {
        await authFetch(`/api/crm/conversations/${conversation.id}/mark-read`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Failed to mark conversation as read:", error);
      }
    };

    markAsRead();
  }, [conversation?.id]);

  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Load advisors, bots, and queues for transfer
  useEffect(() => {
    const loadTransferTargets = async () => {
      try {
        // Load advisors with real-time presence data
        const advisorsRes = await authFetch("/api/admin/advisor-presence");
        if (advisorsRes.ok) {
          const data = await advisorsRes.json();
          // Map presence data to advisor format
          const advisorList = (data.advisors || []).map((presence: any) => ({
            id: presence.userId,
            name: presence.user.name || presence.user.username,
            email: presence.user.email,
            isOnline: presence.isOnline,
            currentStatus: presence.status
          }));
          setAdvisors(advisorList);
        }

        // Load bots (flows)
        const botsRes = await authFetch("/api/flows");
        if (botsRes.ok) {
          const data = await botsRes.json();
          const flowList = data.flows || [];
          setBots(flowList.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
        }

        // Load queues
        const queuesRes = await authFetch("/api/admin/queues");
        if (queuesRes.ok) {
          const data = await queuesRes.json();
          setQueues(data.queues || []);
        }
      } catch (error) {
        console.error("[CRM] Error loading transfer targets:", error);
      }
    };
    loadTransferTargets();
  }, []);

  // Listen for real-time advisor presence updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handlePresenceUpdate = (presence: any) => {
      setAdvisors((prev) => {
        const index = prev.findIndex((a) => a.id === presence.userId);
        const updatedAdvisor = {
          id: presence.userId,
          name: presence.user.name || presence.user.username,
          email: presence.user.email,
          isOnline: presence.isOnline,
          currentStatus: presence.status
        };

        if (index === -1) {
          // New advisor, add to list
          return [...prev, updatedAdvisor];
        } else {
          // Update existing advisor
          const updated = [...prev];
          updated[index] = updatedAdvisor;
          return updated;
        }
      });
    };

    socket.on("crm:advisor:presence", handlePresenceUpdate);

    return () => {
      socket.off("crm:advisor:presence", handlePresenceUpdate);
    };
  }, [socket]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowTransferDropdown(false);
    if (showTransferDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTransferDropdown]);

  const openTransferModal = (type: "advisor" | "bot" | "queue") => {
    setTransferType(type);
    setSelectedTarget("");
    setShowTransferModal(true);
    setShowTransferDropdown(false);
  };

  const handleTransfer = async () => {
    if (!conversation || !selectedTarget) return;

    setTransferring(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: transferType,
          targetId: selectedTarget,
        }),
      });

      if (response.ok) {
        console.log(`[CRM] Transferencia exitosa a ${transferType}:`, selectedTarget);
        setShowTransferModal(false);

        // Build detailed toast message
        let targetName = "";
        let extraInfo = "";
        const now = new Date().toLocaleTimeString("es-PE", { hour12: false });

        if (transferType === "queue") {
          const queue = queues.find(q => q.id === selectedTarget);
          targetName = queue?.name || "Cola";
          // Count advisors in this queue - for now just show it was transferred
          extraInfo = `\n→ Transferido a las ${now}`;
        } else if (transferType === "advisor") {
          const advisor = advisors.find(a => a.id === selectedTarget);
          targetName = advisor?.name || "Asesor";
          const status = advisor?.currentStatus;
          extraInfo = status ? `\n→ Estado: ${status.name}` : `\n→ ${now}`;
        } else if (transferType === "bot") {
          const bot = bots.find(b => b.id === selectedTarget);
          targetName = bot?.name || "Bot";
          extraInfo = `\n→ ${now}`;
        }

        if (showToast) {
          showToast(
            `✓ Chat transferido a: ${targetName}${extraInfo}`,
            "success",
            5000
          );
        }
      } else {
        const errorMsg = "Error al transferir la conversación";
        if (showToast) {
          showToast(errorMsg, "error");
        } else {
          alert(errorMsg);
        }
      }
    } catch (error) {
      console.error("[CRM] Error al transferir:", error);
      const errorMsg = "Error al transferir la conversación";
      if (showToast) {
        showToast(errorMsg, "error");
      } else {
        alert(errorMsg);
      }
    } finally {
      setTransferring(false);
    }
  };

  const handleSend = async (payload: { text: string; files?: File[]; replyToId?: string | null; isInternal?: boolean }) => {
    await onSend(payload);
    setReplyTo(null);
  };

  const handleArchive = async () => {
    if (!conversation) return;
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/archive`, {
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

  const handleUnarchive = async () => {
    if (!conversation) return;
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/unarchive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        console.log('[CRM] Conversación desarchivada exitosamente:', conversation.id);
      } else {
        console.error('[CRM] Error al desarchivar conversación:', response.statusText);
      }
    } catch (error) {
      console.error('[CRM] Error al desarchivar conversación:', error);
    }
  };

  const handleAccept = async () => {
    if (!conversation || accepting) return;
    setAccepting(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        console.log('[CRM] Conversación aceptada exitosamente:', conversation.id);
        // Conversation will be updated via WebSocket
      } else {
        const error = await response.json();
        alert(`Error: ${error.reason || 'No se pudo aceptar la conversación'}`);
      }
    } catch (error) {
      console.error('[CRM] Error al aceptar conversación:', error);
      alert('Error al aceptar la conversación');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!conversation || rejecting) return;

    if (!confirm('¿Estás seguro de devolver esta conversación a la cola?')) {
      return;
    }

    setRejecting(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        console.log('[CRM] Conversación rechazada exitosamente:', conversation.id);
        // Conversation will be updated via WebSocket
      } else {
        const error = await response.json();
        alert(`Error: ${error.reason || 'No se pudo rechazar la conversación'}`);
      }
    } catch (error) {
      console.error('[CRM] Error al rechazar conversación:', error);
      alert('Error al rechazar la conversación');
    } finally {
      setRejecting(false);
    }
  };

  const [takingOver, setTakingOver] = useState(false);

  const handleTakeOver = async () => {
    if (!conversation || takingOver) return;

    if (!confirm('¿Estás seguro de que quieres tomar este chat? Se reasignará a ti.')) {
      return;
    }

    setTakingOver(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        console.log('[CRM] Chat tomado exitosamente:', conversation.id);
        showToast?.('Chat tomado exitosamente', 'success');
        // Conversation will be updated via WebSocket
      } else {
        const error = await response.json();
        alert(`Error: ${error.reason || 'No se pudo tomar el chat'}`);
      }
    } catch (error) {
      console.error('[CRM] Error al tomar el chat:', error);
      alert('Error al tomar el chat');
    } finally {
      setTakingOver(false);
    }
  };

  const handleSendTemplate = async (templateName: string, language: string, components?: any[]) => {
    if (!conversation) return;

    try {
      console.log('[CRM] Sending template:', { templateName, language, components });

      const response = await authFetch("/api/crm/templates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: conversation.phone,
          templateName,
          language,
          components,
          channelConnectionId: conversation.channelConnectionId,
        }),
      });

      console.log('[CRM] Response status:', response.status, response.ok);

      const data = await response.json();
      console.log('[CRM] Response data:', data);

      if (!response.ok) {
        console.error('[CRM] Response not OK:', data);
        throw new Error(data.message || "Failed to send template");
      }

      console.log('[CRM] Template sent successfully!');
      // El mensaje aparecerá en el chat vía WebSocket
    } catch (error) {
      console.error('[CRM] Error sending template:', error);
      throw error;
    }
  };

  const handleJoinAdvisor = async () => {
    if (!conversation) return;

    // Call the join-advisor endpoint (joins the current logged-in advisor)
    try {
      const response = await authFetch(`/api/crm/conversations/${conversation.id}/join-advisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        console.log('[CRM] Successfully joined conversation:', conversation.id);
        if (showToast) {
          showToast('Te has unido a la conversación', 'success');
        }
      } else {
        const error = await response.json();
        console.error('[CRM] Error joining conversation:', error);
        if (showToast) {
          showToast('Error al unirse a la conversación', 'error');
        } else {
          alert('Error al unirse a la conversación');
        }
      }
    } catch (error) {
      console.error('[CRM] Error joining conversation:', error);
      if (showToast) {
        showToast('Error al unirse a la conversación', 'error');
      } else {
        alert('Error al unirse a la conversación');
      }
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatWindowHeader
        conversation={conversation}
        advisors={advisors}
        queues={queues}
        accepting={accepting}
        rejecting={rejecting}
        onAccept={handleAccept}
        onReject={handleReject}
        onTakeOver={handleTakeOver}
        takingOver={takingOver}
        onTransfer={(type) => openTransferModal(type)}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onShowInfo={() => setShowInfoModal(true)}
        onDetach={onDetach}
        onJoinAdvisor={handleJoinAdvisor}
        onShowTemplates={() => setShowTemplateSelector(true)}
        onCreateLead={() => setShowCreateLeadModal(true)}
        isDetached={isDetached}
        userRole={userRole}
      />
      <div
        className={`flex-1 overflow-y-auto ${!chatTheme.chatBackgroundImage && !chatTheme.chatBackgroundColor ? `bg-gradient-to-br ${CHAT_BACKGROUNDS[chatBackground]}` : ''}`}
        style={{
          backgroundColor: chatTheme.chatBackgroundColor || undefined,
          backgroundImage: chatTheme.chatBackgroundImage ? `url(${chatTheme.chatBackgroundImage})` : undefined,
          backgroundSize: chatTheme.chatBackgroundImage ? 'cover' : undefined,
          backgroundPosition: chatTheme.chatBackgroundImage ? 'center' : undefined,
          backgroundRepeat: chatTheme.chatBackgroundImage ? 'no-repeat' : undefined,
        }}
      >
        <MessageList
          messages={sortedMessages}
          attachments={attachments}
          onReply={(message) => {
            const repliedAttachments = attachments.filter((item) => item.msgId === message.id);
            setReplyTo({ message, attachments: repliedAttachments });
          }}
        />
      </div>

      {/* Bot Interrupt Button - Show when conversation is assigned to a bot */}
      {conversation.status === "active" && conversation.assignedTo?.startsWith('bot-') && (
        <div className="flex-shrink-0 border-t border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-cyan-900">🤖 Bot atendiendo</p>
              <p className="text-xs text-cyan-700">El bot está interactuando con el cliente</p>
            </div>
            <button
              onClick={handleTakeOver}
              disabled={takingOver}
              className="rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {takingOver ? "Interrumpiendo..." : "⚡ Interrumpir Bot"}
            </button>
          </div>
        </div>
      )}

      {/* Queue Actions - Show when:
          1. Conversation is in queue and not assigned (waiting for accept)
          2. OR conversation is assigned but not yet accepted (status !== "attending")
          3. EXCLUDE bots (they have their own button above)
      */}
      {conversation.status !== "archived" && conversation.status !== "attending" && (
        conversation.queueId || conversation.assignedTo
      ) && !conversation.assignedTo?.startsWith('bot-') && (
        <QueueActions
          conversationId={conversation.id}
          isTransferred={!!conversation.transferredFrom}
          transferredFrom={conversation.transferredFrom || undefined}
          onSuccess={() => {
            // No need to reload - WebSocket will update conversation automatically
            console.log('[ChatWindow] Conversation accepted/rejected - waiting for WebSocket update');
          }}
        />
      )}

      <div className="flex-shrink-0">
        <Composer
          disabled={
            conversation.status === "archived" || // Bloqueado si está archivado (FINALIZADOS)
            (conversation.status === "active" && !conversation.assignedTo) // Bloqueado si está en cola/bot sin asesor (EN COLA / BOT)
          }
          replyingTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={handleSend}
        />
      </div>

      {/* Modal Info Cliente */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-white px-6 py-4">
              <h3 className="text-xl font-bold text-slate-900">ℹ️ Información del Cliente</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <BitrixContactCard conversation={conversation} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Transferencia */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-6 py-4">
              <h3 className="text-xl font-bold text-slate-900">
                {transferType === "advisor" ? "🔀 Transferir a Asesor" : "🤖 Transferir a Bot"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Selecciona el destino para transferir esta conversación
              </p>
            </div>

            {/* FIXED: Added max-height and overflow for scroll */}
            <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
              <div className="space-y-2">
                {transferType === "advisor" ? (
                  advisors.length > 0 ? (
                    advisors
                      .sort((a, b) => {
                        // Sort: online + available first, then online + busy, then offline
                        const aOnline = a.isOnline ?? false;
                        const bOnline = b.isOnline ?? false;
                        if (aOnline !== bOnline) return bOnline ? 1 : -1;

                        const aAvailable = (!a.currentStatus || a.currentStatus.action === "accept") && aOnline;
                        const bAvailable = (!b.currentStatus || b.currentStatus.action === "accept") && bOnline;
                        if (aAvailable !== bAvailable) return bAvailable ? 1 : -1;

                        return 0;
                      })
                      .map((advisor) => {
                        // CRITICAL: Only available if ONLINE + status allows
                        const isOnline = advisor.isOnline ?? false;
                        const statusAllows = !advisor.currentStatus || advisor.currentStatus.action === "accept";
                        const isAvailable = isOnline && statusAllows;

                        // Status display
                        let statusColor = "#6B7280"; // Gray by default
                        let statusName = "Desconectado";

                        if (isOnline) {
                          statusColor = advisor.currentStatus?.color || "#10b981"; // Green by default
                          statusName = advisor.currentStatus?.name || "Disponible";
                        }

                      return (
                        <label
                          key={advisor.id}
                          className={`flex items-center gap-2.5 rounded-lg border p-3 transition ${
                            isAvailable
                              ? `cursor-pointer ${selectedTarget === advisor.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`
                              : "cursor-not-allowed opacity-50 border-slate-200 bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="transfer-target"
                            value={advisor.id}
                            checked={selectedTarget === advisor.id}
                            onChange={(e) => setSelectedTarget(e.target.value)}
                            disabled={!isAvailable}
                            className="h-4 w-4 text-blue-600 disabled:opacity-50"
                          />
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex-shrink-0 relative">
                            {advisor.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                            {/* Status indicator dot - COMPACT */}
                            <div
                              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                              style={{ backgroundColor: statusColor }}
                              title={statusName}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{advisor.name}</p>
                            <p className="text-xs truncate" style={{ color: statusColor }}>
                              {isAvailable ? `✓ ${statusName}` : `✗ ${statusName}`}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      <p>No hay asesores disponibles</p>
                    </div>
                  )
                ) : transferType === "bot" ? (
                  bots.length > 0 ? (
                    bots.map((bot) => (
                      <label
                        key={bot.id}
                        className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition ${
                          selectedTarget === bot.id
                            ? "border-purple-500 bg-purple-50"
                            : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="transfer-target"
                          value={bot.id}
                          checked={selectedTarget === bot.id}
                          onChange={(e) => setSelectedTarget(e.target.value)}
                          className="h-4 w-4 text-purple-600"
                        />
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">{bot.name}</p>
                          <p className="text-xs text-slate-500">Bot automatizado</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      <p>No hay bots configurados</p>
                    </div>
                  )
                ) : (
                  queues.length > 0 ? (
                    queues.map((queue) => (
                      <label
                        key={queue.id}
                        className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition ${
                          selectedTarget === queue.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="transfer-target"
                          value={queue.id}
                          checked={selectedTarget === queue.id}
                          onChange={(e) => setSelectedTarget(e.target.value)}
                          className="h-4 w-4 text-emerald-600"
                        />
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">{queue.name}</p>
                          <p className="text-xs text-slate-500">Cola de espera</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      <p>No hay colas configuradas</p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedTarget || transferring}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transferring ? "Transfiriendo..." : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && conversation && (
        <TemplateSelector
          phone={conversation.phone}
          onSend={handleSendTemplate}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}

      {/* Create Lead Modal (Bitrix24) */}
      {showCreateLeadModal && conversation && (
        <CreateLeadModal
          isOpen={showCreateLeadModal}
          onClose={() => setShowCreateLeadModal(false)}
          phone={conversation.phone}
          onSuccess={(leadId) => {
            console.log(`Lead created: ${leadId}`);
            // Optionally show toast notification
            if (showToast) {
              showToast(`Prospecto creado exitosamente en Bitrix24 (ID: ${leadId})`, "success");
            }
          }}
        />
      )}
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
