import { useState } from "react";
import { authFetch } from "../lib/apiBase";

interface SatisfactionSurveyProps {
  conversationId: string;
  onClose: () => void;
  onSubmit?: (score: number) => void;
}

export default function SatisfactionSurvey({ conversationId, onClose, onSubmit }: SatisfactionSurveyProps) {
  const [score, setScore] = useState<number | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === null) {
      alert("Por favor selecciona una calificación");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authFetch(`/api/crm/metrics/${conversationId}/satisfaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });

      if (response.ok) {
        onSubmit?.(score);
        onClose();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || "No se pudo guardar la encuesta"}`);
      }
    } catch (error) {
      console.error("[Survey] Error:", error);
      alert("Error al enviar la encuesta");
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreLabel = (s: number) => {
    switch (s) {
      case 1:
        return "Muy Insatisfecho";
      case 2:
        return "Insatisfecho";
      case 3:
        return "Neutral";
      case 4:
        return "Satisfecho";
      case 5:
        return "Muy Satisfecho";
      default:
        return "";
    }
  };

  const getScoreColor = (s: number) => {
    switch (s) {
      case 1:
        return "text-red-500";
      case 2:
        return "text-orange-500";
      case 3:
        return "text-yellow-500";
      case 4:
        return "text-green-500";
      case 5:
        return "text-emerald-500";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Encuesta de Satisfacción</h2>
            <p className="text-sm text-slate-600">¿Cómo calificarías esta atención?</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Star Rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScore(s)}
                onMouseEnter={() => setHoveredScore(s)}
                onMouseLeave={() => setHoveredScore(null)}
                className={`transition-all transform hover:scale-110 ${
                  score !== null && s <= score ? getScoreColor(score) : hoveredScore !== null && s <= hoveredScore ? getScoreColor(hoveredScore) : "text-slate-300"
                }`}
              >
                <svg
                  className="w-12 h-12"
                  fill={score !== null && s <= score ? "currentColor" : hoveredScore !== null && s <= hoveredScore ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={score !== null && s <= score ? 0 : hoveredScore !== null && s <= hoveredScore ? 0 : 2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </button>
            ))}
          </div>

          {/* Score label */}
          {(score !== null || hoveredScore !== null) && (
            <p className={`text-center text-lg font-semibold mb-4 ${getScoreColor(score ?? hoveredScore!)}`}>
              {getScoreLabel(score ?? hoveredScore!)}
            </p>
          )}

          {/* Optional message */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mensaje al cliente (opcional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej: Gracias por tu tiempo. Tu opinión es muy importante para nosotros."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-emerald-400 focus:ring focus:ring-emerald-100 resize-none"
              rows={3}
            />
            <p className="text-xs text-slate-500 mt-1">
              Este mensaje se enviará al cliente junto con la solicitud de calificación
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || score === null}
            className={`px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition ${
              submitting || score === null ? "opacity-50 cursor-not-allowed" : ""
            }`}
            type="button"
          >
            {submitting ? "Enviando..." : "Enviar Encuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}
