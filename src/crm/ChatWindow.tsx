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
  onSend: (payload: { text: string; file?: File | null; replyToId?: string | null; isInternal?: boolean }) => Promise<void>;
}

export default function ChatWindow({ conversation, messages, attachments, onSend }: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<{ message: Message; attachments: Attachment[] } | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showSatisfactionSurvey, setShowSatisfactionSurvey] = useState(false);
  const [transferType, setTransferType] = useState<"advisor" | "bot">("advisor");
  const [advisors, setAdvisors] = useState<Array<{ id: string; name: string }>>([]);
  const [bots, setBots] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [transferring, setTransferring] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  const [accepting, setAccepting] = useState(false);

  // Load advisors and bots for transfer
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
      } catch (error) {
        console.error("[CRM] Error loading transfer targets:", error);
      }
    };
    loadTransferTargets();
  }, []);

  const openTransferModal = (type: "advisor" | "bot") => {
    setTransferType(type);
    setSelectedTarget("");
    setShowTransferModal(true);
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

  const handleSend = async (payload: { text: string; file?: File | null; replyToId?: string | null; isInternal?: boolean }) => {
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
          <div className="flex items-center gap-2">
            {/* Status badge */}
            <div className="text-xs px-3 py-1 rounded-full font-medium bg-white border border-slate-200">
              {conversation.status === "archived"
                ? "🗂️ Archivada"
                : conversation.status === "attending"
                ? "✓ Atendiendo"
                : "⏱️ En cola"}
            </div>

            {/* Accept button - only for queued conversations */}
            {conversation.status === "active" && (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 border-0 rounded-lg shadow-md hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 ${
                  accepting ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title="Aceptar conversación de la cola"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {accepting ? "Aceptando..." : "Aceptar"}
              </button>
            )}

            {conversation.status !== "archived" && (
              <>
                <button
                  onClick={() => openTransferModal("advisor")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                  title="Transferir a otro asesor"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Asesor
                </button>
                <button
                  onClick={() => openTransferModal("bot")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-600 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition"
                  title="Transferir a bot"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Bot
                </button>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-600 bg-white border border-cyan-200 rounded-lg hover:bg-cyan-50 hover:border-cyan-300 transition"
                  title="Ver información del cliente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Info
                </button>
                <button
                  onClick={() => setShowTemplateSelector(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition"
                  title="Enviar plantilla de WhatsApp"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Plantillas
                </button>
                <button
                  onClick={() => setShowSatisfactionSurvey(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-600 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition"
                  title="Enviar encuesta de satisfacción"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Encuesta
                </button>
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition"
                  title="Archivar conversación"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Cerrar
                </button>
              </>
            )}
            {conversation.status === "archived" && (
              <button
                onClick={handleUnarchive}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-600 bg-white border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition"
                title="Desarchivar conversación"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Reabrir
              </button>
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
        <Composer replyingTo={replyTo} onCancelReply={() => setReplyTo(null)} onSend={handleSend} />
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
                ) : (
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
