import { useState } from "react";

interface QuickReply {
  id: string;
  title: string;
  message: string;
  category: string;
}

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  // Saludos
  { id: "q1", title: "Buenos días", message: "¡Buenos días! ¿En qué puedo ayudarte hoy?", category: "Saludos" },
  { id: "q2", title: "Buenas tardes", message: "¡Buenas tardes! Gracias por contactarnos. ¿En qué puedo ayudarte?", category: "Saludos" },

  // Espera
  { id: "q3", title: "Un momento", message: "Dame un momento por favor, estoy verificando la información.", category: "Espera" },
  { id: "q4", title: "Gracias por esperar", message: "Gracias por tu paciencia. Ya tengo la información que necesitas.", category: "Espera" },

  // Información
  { id: "q5", title: "Horario", message: "Nuestro horario de atención es de Lunes a Viernes de 9:00 AM a 6:00 PM", category: "Información" },
  { id: "q6", title: "Ubicación", message: "Puedes encontrarnos en [dirección]. También hacemos envíos a nivel nacional.", category: "Información" },

  // Despedidas
  { id: "q7", title: "Gracias", message: "¡Gracias por contactarnos! Que tengas un excelente día.", category: "Despedidas" },
  { id: "q8", title: "Estamos para ayudar", message: "Estamos aquí para ayudarte. No dudes en escribirnos si tienes más preguntas.", category: "Despedidas" },

  // Follow-up
  { id: "q9", title: "¿Te ayudó?", message: "¿Esta información resolvió tu consulta? ¿Hay algo más en lo que pueda ayudarte?", category: "Follow-up" },
  { id: "q10", title: "Seguimiento", message: "Te estaremos contactando pronto para darle seguimiento a tu solicitud.", category: "Follow-up" },
];

interface QuickRepliesProps {
  onSelectReply: (message: string) => void;
}

export default function QuickReplies({ onSelectReply }: QuickRepliesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const categories = Array.from(new Set(DEFAULT_QUICK_REPLIES.map(r => r.category)));

  const filteredReplies = DEFAULT_QUICK_REPLIES.filter(reply =>
    reply.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reply.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reply.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (reply: QuickReply) => {
    onSelectReply(reply.message);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 transition"
        title="Respuestas rápidas"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 w-96 max-h-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl z-50">
            <div className="bg-gradient-to-r from-emerald-50 to-white px-4 py-3 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-900">⚡ Respuestas Rápidas</h4>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar respuesta..."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {categories.map(category => {
                const categoryReplies = filteredReplies.filter(r => r.category === category);
                if (categoryReplies.length === 0) return null;

                return (
                  <div key={category} className="border-b border-slate-100 last:border-0">
                    <div className="bg-slate-50 px-4 py-2">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{category}</p>
                    </div>
                    {categoryReplies.map(reply => (
                      <button
                        key={reply.id}
                        onClick={() => handleSelect(reply)}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition group"
                      >
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
                          {reply.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{reply.message}</p>
                      </button>
                    ))}
                  </div>
                );
              })}

              {filteredReplies.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No se encontraron respuestas rápidas
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
