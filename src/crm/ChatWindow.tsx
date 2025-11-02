import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../lib/apiBase";
import { Avatar } from "./Avatar";
import BitrixContactCard from "./BitrixContactCard";
import Composer from "./Composer";
import MessageList from "./MessageList";
import TemplateSelector from "./TemplateSelector";
// TEMPORARY: Disabled to fix infinite render loop
// import ConversationTags from "./ConversationTags";
import SatisfactionSurvey from "./SatisfactionSurvey";
import type { Attachment, Conversation, Message } from "./types";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  attachments: Attachment[];
  onSend: (payload: { text: string; files?: File[]; replyToId?: string | null; isInternal?: boolean }) => Promise<void>;
  onDetach?: () => void;
  isDetached?: boolean;
}

export default function ChatWindow({ conversation, messages, attachments, onSend, onDetach, isDetached }: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<{ message: Message; attachments: Attachment[] } | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showSatisfactionSurvey, setShowSatisfactionSurvey] = useState(false);
  const [transferType, setTransferType] = useState<"advisor" | "bot" | "queue">("advisor");
  const [advisors, setAdvisors] = useState<Array<{ id: string; name: string }>>([]);
  const [bots, setBots] = useState<Array<{ id: string; name: string }>>([]);
  const [queues, setQueues] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Load advisors, bots, and queues for transfer
  useEffect(() => {
    const loadTransferTargets = async () => {
      try {
        // Load advisors
        const advisorsRes = await fetch(apiUrl("/api/admin/advisors"));
        if (advisorsRes.ok) {
          const data = await advisorsRes.json();
          setAdvisors(data.advisors || []);
        }

        // Load bots (flows)
        const botsRes = await fetch(apiUrl("/api/flows"));
        if (botsRes.ok) {
          const data = await botsRes.json();
          const flowList = data.flows || [];
          setBots(flowList.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
        }

        // Load queues
        const queuesRes = await fetch(apiUrl("/api/admin/queues"));
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
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/transfer`), {
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
        // Optionally show success message or refresh conversation
      } else {
        alert("Error al transferir la conversación");
      }
    } catch (error) {
      console.error("[CRM] Error al transferir:", error);
      alert("Error al transferir la conversación");
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
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/archive`), {
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
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/unarchive`), {
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
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/accept`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  const handleSendTemplate = async (templateName: string, language: string, components?: any[]) => {
    if (!conversation) return;

    try {
      const response = await fetch(apiUrl("/api/crm/templates/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone: conversation.phone,
          templateName,
          language,
          components,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send template");
      }

      console.log('[CRM] Template sent successfully');
    } catch (error) {
      console.error('[CRM] Error sending template:', error);
      throw error;
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
      <header className="flex flex-col gap-3 flex-shrink-0 border-b border-slate-200 bg-gradient-to-br from-emerald-50 to-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Avatar
                src={conversation.avatarUrl}
                alt={conversation.contactName || conversation.phone}
                size="md"
              />
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {conversation.bitrixId && conversation.contactName
                    ? conversation.contactName
                    : conversation.contactName || conversation.phone}
                </h2>
                <p className="text-xs text-slate-600">
                  {conversation.bitrixId && conversation.bitrixDocument ? (
                    <>
                      Doc: {conversation.bitrixDocument} · {conversation.phone}
                    </>
                  ) : (
                    <>
                      {conversation.phone}
                    </>
                  )}
                  {" · Último mensaje: "}
                  {formatDate(conversation.lastMessageAt)}
                </p>
                {/* Tags - TEMPORARY: Disabled to fix infinite render loop */}
                {/* {conversation?.id && (
                  <div className="mt-2">
                    <ConversationTags conversationId={conversation.id} />
                  </div>
                )} */}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100">
            {/* Status badge */}
            <div className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white border border-slate-200">
              {conversation.status === "archived"
                ? "🗂️ Archivada"
                : conversation.status === "attending"
                ? "✓ Atendiendo"
                : "⏱️ En cola"}
            </div>

            {/* Grupo 1: Acciones principales (Aceptar/Rechazar para conversaciones en cola) */}
            {conversation.status === "active" && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-emerald-500 rounded hover:bg-emerald-600 transition ${
                    accepting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Aceptar conversación de la cola"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {accepting ? "..." : "Aceptar"}
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-red-500 rounded hover:bg-red-600 transition ${
                    rejecting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Devolver conversación a la cola"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {rejecting ? "..." : "Rechazar"}
                </button>
              </div>
            )}

            {/* Grupo 2: Enlaces externos y ventana */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
              {conversation.bitrixId && (
                <a
                  href={`https://azaleaparaguay.bitrix24.com/crm/contact/details/${conversation.bitrixId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-orange-600 bg-white border border-orange-200 rounded hover:bg-orange-50 transition"
                  title="Ver en Bitrix24"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  B24
                </a>
              )}
              {!isDetached && onDetach && (
                <button
                  onClick={onDetach}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-violet-600 bg-white border border-violet-200 rounded hover:bg-violet-50 transition"
                  title="Desacoplar ventana de chat"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Desacoplar
                </button>
              )}
            </div>

            {/* Grupo 3: Transferir (Dropdown) + Info */}
            {conversation.status !== "archived" && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                {/* Transfer Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTransferDropdown(!showTransferDropdown);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-blue-600 bg-white border border-blue-200 rounded hover:bg-blue-50 transition"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Transferir
                    <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showTransferDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                      {/* Transfer to Bot */}
                      <button
                        onClick={() => openTransferModal("bot")}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 rounded-t-lg transition flex items-center gap-2"
                      >
                        🤖 A Bot
                      </button>

                      {/* Transfer to Advisor */}
                      <button
                        onClick={() => openTransferModal("advisor")}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-purple-50 transition flex items-center gap-2"
                      >
                        👤 A Asesor
                      </button>

                      {/* Transfer to Queue */}
                      <button
                        onClick={() => openTransferModal("queue")}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 rounded-b-lg transition flex items-center gap-2"
                      >
                        📋 A Cola
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-cyan-600 bg-white border border-cyan-200 rounded hover:bg-cyan-50 transition"
                  title="Ver información del cliente"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Info
                </button>
              </div>
            )}

            {/* Grupo 4: Plantillas y Encuesta */}
            {conversation.status !== "archived" && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                <button
                  onClick={() => setShowTemplateSelector(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition"
                  title="Enviar plantilla de WhatsApp"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Plantillas
                </button>
                <button
                  onClick={() => setShowSatisfactionSurvey(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-600 bg-white border border-amber-200 rounded hover:bg-amber-50 transition"
                  title="Enviar encuesta de satisfacción"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Encuesta
                </button>
              </div>
            )}

            {/* Grupo 5: Solo Reabrir (removido botón Cerrar) */}
            {conversation.status === "archived" && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300">
                <button
                  onClick={handleUnarchive}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-green-600 bg-white border border-green-200 rounded hover:bg-green-50 transition"
                  title="Desarchivar conversación"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Reabrir
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={sortedMessages}
          attachments={attachments}
          onReply={(message) => {
            const repliedAttachments = attachments.filter((item) => item.msgId === message.id);
            setReplyTo({ message, attachments: repliedAttachments });
          }}
        />
      </div>
      <div className="flex-shrink-0">
        <Composer
          disabled={conversation.status === "active"}
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

            <div className="p-6">
              <div className="space-y-3">
                {transferType === "advisor" ? (
                  advisors.length > 0 ? (
                    advisors.map((advisor) => (
                      <label
                        key={advisor.id}
                        className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition ${
                          selectedTarget === advisor.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="transfer-target"
                          value={advisor.id}
                          checked={selectedTarget === advisor.id}
                          onChange={(e) => setSelectedTarget(e.target.value)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex-shrink-0">
                          {advisor.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{advisor.name}</p>
                          <p className="text-xs text-slate-500">Asesor disponible</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p>No hay asesores disponibles</p>
                    </div>
                  )
                ) : transferType === "bot" ? (
                  bots.length > 0 ? (
                    bots.map((bot) => (
                      <label
                        key={bot.id}
                        className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition ${
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{bot.name}</p>
                          <p className="text-xs text-slate-500">Bot automatizado</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p>No hay bots configurados</p>
                    </div>
                  )
                ) : (
                  queues.length > 0 ? (
                    queues.map((queue) => (
                      <label
                        key={queue.id}
                        className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition ${
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{queue.name}</p>
                          <p className="text-xs text-slate-500">Cola de espera</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
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

      {/* Satisfaction Survey Modal */}
      {showSatisfactionSurvey && conversation && (
        <SatisfactionSurvey
          conversationId={conversation.id}
          onClose={() => setShowSatisfactionSurvey(false)}
          onSubmit={(score) => {
            console.log(`[CRM] Satisfaction score ${score} recorded for conversation ${conversation.id}`);
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
