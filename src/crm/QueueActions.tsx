import { useState } from "react";
import { authFetch } from "../lib/apiBase";

interface QueueActionsProps {
  conversationId: string;
  onSuccess?: () => void;
  isTransferred?: boolean;
  transferredFrom?: string;
}

export default function QueueActions({ conversationId, onSuccess, isTransferred, transferredFrom }: QueueActionsProps) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [advisors, setAdvisors] = useState<Array<{
    id: string;
    name: string;
    email?: string;
    isOnline?: boolean;
    currentStatus?: {
      id: string;
      name: string;
      action: string;
      color: string;
    } | null;
  }>>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState("");

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversationId}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        onSuccess?.();
      } else {
        const data = await response.json();
        alert(`Error: ${data.reason || 'No se pudo aceptar la conversación'}`);
      }
    } catch (error) {
      console.error('[QueueActions] Error accepting:', error);
      alert('Error al aceptar la conversación');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("¿Devolver esta conversación a la cola?")) return;

    setRejecting(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversationId}/reject`, {
        method: "POST",
      });

      if (response.ok) {
        onSuccess?.();
      } else {
        const data = await response.json();
        alert(`Error: ${data.message || 'No se pudo rechazar la conversación'}`);
      }
    } catch (error) {
      console.error('[QueueActions] Error rejecting:', error);
      alert('Error al rechazar la conversación');
    } finally {
      setRejecting(false);
    }
  };

  const openTransferModal = async () => {
    // Load advisors with presence status
    try {
      const response = await authFetch("/api/admin/advisors-with-presence");
      if (response.ok) {
        const data = await response.json();
        setAdvisors(data.advisors || []);
        setShowTransferModal(true);
      }
    } catch (error) {
      console.error('[QueueActions] Error loading advisors:', error);
      // Fallback to basic advisors endpoint
      try {
        const fallbackResponse = await authFetch("/api/admin/advisors");
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          setAdvisors(fallbackData.advisors || []);
          setShowTransferModal(true);
        }
      } catch (fallbackError) {
        console.error('[QueueActions] Fallback also failed:', fallbackError);
      }
    }
  };

  const handleTransfer = async () => {
    if (!selectedAdvisor) {
      alert("Selecciona un asesor");
      return;
    }

    setTransferring(true);
    try {
      const response = await authFetch(`/api/crm/conversations/${conversationId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "advisor",
          targetId: selectedAdvisor,
        }),
      });

      if (response.ok) {
        setShowTransferModal(false);
        onSuccess?.();
      } else {
        const errorData = await response.json();
        if (errorData.error === "advisor_not_available") {
          alert(`⚠️ ${errorData.message}`);
        } else {
          alert("Error al transferir la conversación");
        }
      }
    } catch (error) {
      console.error('[QueueActions] Error transferring:', error);
      alert('Error al transferir la conversación');
    } finally {
      setTransferring(false);
    }
  };

  const messageText = isTransferred
    ? "🔄 Chat transferido - Debes aceptarlo para iniciar nueva sesión"
    : "⚠️ Chat en cola - Debes aceptarlo para atender";

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-br from-amber-50 to-orange-50 border-t border-amber-200">
        <p className="text-xs font-semibold text-amber-800">{messageText}</p>
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-800 bg-green-200/70 rounded-lg shadow-sm hover:bg-green-300/70 transition ${
              accepting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {accepting ? "..." : "Aceptar"}
          </button>

          <button
            onClick={openTransferModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-200/70 rounded-lg shadow-sm hover:bg-blue-300/70 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Transferir
          </button>

          <button
            onClick={handleReject}
            disabled={rejecting}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-200/70 rounded-lg shadow-sm hover:bg-red-300/70 transition ${
              rejecting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {rejecting ? "..." : "Rechazar"}
          </button>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900">🔀 Transferir a Asesor</h3>
            <p className="mt-2 text-xs text-slate-500">Selecciona el asesor que atenderá este chat</p>

            <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto">
              {advisors
                .sort((a, b) => {
                  // Sort: online + available first
                  const aOnline = a.isOnline ?? false;
                  const bOnline = b.isOnline ?? false;
                  if (aOnline !== bOnline) return bOnline ? 1 : -1;

                  const aAvailable = (!a.currentStatus || a.currentStatus.action === "accept") && aOnline;
                  const bAvailable = (!b.currentStatus || b.currentStatus.action === "accept") && bOnline;
                  if (aAvailable !== bAvailable) return bAvailable ? 1 : -1;

                  return 0;
                })
                .map((advisor) => {
                  const isOnline = advisor.isOnline ?? false;
                  const statusAllows = !advisor.currentStatus || advisor.currentStatus.action === "accept";
                  const isAvailable = isOnline && statusAllows;

                  let statusColor = "#6B7280"; // Gray
                  let statusName = "Desconectado";

                  if (isOnline) {
                    statusColor = advisor.currentStatus?.color || "#10b981"; // Green
                    statusName = advisor.currentStatus?.name || "Disponible";
                  }

                  return (
                    <label
                      key={advisor.id}
                      className={`flex items-center gap-2.5 rounded-lg border p-3 transition ${
                        isAvailable
                          ? `cursor-pointer ${selectedAdvisor === advisor.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`
                          : "cursor-not-allowed opacity-50 border-slate-200 bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="advisor"
                        value={advisor.id}
                        checked={selectedAdvisor === advisor.id}
                        onChange={() => setSelectedAdvisor(advisor.id)}
                        disabled={!isAvailable}
                        className="h-4 w-4 text-blue-600 disabled:opacity-50"
                      />
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0 relative">
                        {advisor.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        {/* Status indicator dot */}
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                          style={{ backgroundColor: statusColor }}
                          title={statusName}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{advisor.name}</p>
                        <p className="text-xs truncate" style={{ color: statusColor }}>
                          {isAvailable ? `✓ ${statusName}` : `✗ ${statusName}`}
                        </p>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex gap-3 border-t border-slate-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferring || !selectedAdvisor}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {transferring ? "Transfiriendo..." : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
