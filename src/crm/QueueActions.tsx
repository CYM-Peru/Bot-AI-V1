import { useState } from "react";
import { apiUrl } from "../lib/apiBase";

interface QueueActionsProps {
  conversationId: string;
  onSuccess?: () => void;
}

export default function QueueActions({ conversationId, onSuccess }: QueueActionsProps) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [advisors, setAdvisors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState("");

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversationId}/accept`), {
        method: "POST",
        credentials: "include",
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
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversationId}/reject`), {
        method: "POST",
        credentials: "include",
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
    // Load advisors
    try {
      const response = await fetch(apiUrl("/api/admin/advisors"), { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setAdvisors(data.advisors || []);
        setShowTransferModal(true);
      }
    } catch (error) {
      console.error('[QueueActions] Error loading advisors:', error);
    }
  };

  const handleTransfer = async () => {
    if (!selectedAdvisor) {
      alert("Selecciona un asesor");
      return;
    }

    setTransferring(true);
    try {
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversationId}/transfer`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  return (
    <>
      <div className="flex items-center justify-center gap-3 p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-t border-amber-200">
        <div className="text-center mb-3">
          <p className="text-sm font-semibold text-amber-800">⚠️ Chat en cola - Debes aceptarlo para atender</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold text-green-800 bg-green-200/70 rounded-xl shadow-sm hover:bg-green-300/70 transition ${
              accepting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {accepting ? "Aceptando..." : "Aceptar"}
          </button>

          <button
            onClick={openTransferModal}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-blue-800 bg-blue-200/70 rounded-xl shadow-sm hover:bg-blue-300/70 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Transferir
          </button>

          <button
            onClick={handleReject}
            disabled={rejecting}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold text-red-800 bg-red-200/70 rounded-xl shadow-sm hover:bg-red-300/70 transition ${
              rejecting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {rejecting ? "Rechazando..." : "Rechazar"}
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
            <h3 className="text-xl font-bold text-slate-900">Transferir a Asesor</h3>
            <p className="mt-2 text-sm text-slate-600">Selecciona el asesor que atenderá este chat</p>

            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {advisors.map((advisor) => (
                <label
                  key={advisor.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition"
                >
                  <input
                    type="radio"
                    name="advisor"
                    value={advisor.id}
                    checked={selectedAdvisor === advisor.id}
                    onChange={() => setSelectedAdvisor(advisor.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    {advisor.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{advisor.name}</span>
                </label>
              ))}
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
