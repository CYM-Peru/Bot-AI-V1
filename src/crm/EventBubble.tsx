import type { Message } from "./types";
import { useAuth } from "../hooks/useAuth";
import { Trash2 } from "lucide-react";

interface EventBubbleProps {
  message: Message;
  onDelete?: (messageId: string) => void;
}

// Icons for each event type
const EVENT_ICONS: Record<string, string> = {
  conversation_accepted: "✅",
  conversation_rejected: "❌",
  conversation_transferred: "🔄",
  conversation_assigned: "🎯",
  advisor_joined: "➕",
  advisor_left: "➖",
  advisor_logout: "👋",
  advisor_status_change: "⏸️",
  conversation_queued: "📋",
  conversation_archived: "📁",
  conversation_reopened: "🔓",
  conversation_taken: "🔄",
  note_added: "📌",
  bot_started: "🤖",
  bot_transferred: "🤖",
  bot_finished: "🎬",
  client_recurring: "🔄",
  window_24h_expired: "⏰",
  status_change_final: "🔔",
  logout_final: "👋",
};

// SOLID background colors for each event type (NO pasteles!)
const EVENT_BG_COLORS: Record<string, string> = {
  conversation_accepted: "#10b981",      // Verde (DISPONIBLE original)
  conversation_rejected: "#f50a0a",      // Rojo fuerte (OCUPADO original)
  conversation_transferred: "#3b82f6",   // Azul
  conversation_assigned: "#8b5cf6",      // Violeta
  advisor_joined: "#a855f7",             // Morado
  advisor_left: "#6b7280",               // Gris
  advisor_logout: "#f97316",             // Naranja
  advisor_status_change: "#f59e0b",      // Ámbar
  conversation_queued: "#f59e0b",        // Ámbar
  conversation_archived: "#6b7280",      // Gris
  conversation_reopened: "#06b6d4",      // Cyan
  conversation_taken: "#3b82f6",         // Azul
  note_added: "#6366f1",                 // Índigo
  bot_started: "#a855f7",                // Morado
  bot_transferred: "#a855f7",            // Morado
  bot_finished: "#6b7280",               // Gris
  client_recurring: "#3b82f6",           // Azul
  window_24h_expired: "#dc2626",         // Rojo
  status_change_final: "#3b82f6",        // Azul (será sobrescrito por metadata)
  logout_final: "#6b7280",               // Gris (será sobrescrito por metadata)
};

export default function EventBubble({ message, onDelete }: EventBubbleProps) {
  const { user } = useAuth();

  if (!message.eventType) return null;

  const icon = EVENT_ICONS[message.eventType] || "📌";

  // PRIORITY: Use metadata.backgroundColor if present (for status changes)
  const backgroundColor = message.metadata?.backgroundColor || EVENT_BG_COLORS[message.eventType] || "#6b7280";

  // Format timestamp
  const date = new Date(message.createdAt);
  const timeString = date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este mensaje del sistema?")) return;

    try {
      const response = await fetch(`/api/crm/messages/${message.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || "Error al eliminar mensaje");
      } else {
        // Trigger refresh if onDelete callback provided
        if (onDelete) onDelete(message.id);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Error al eliminar mensaje");
    }
  };

  return (
    <div className="flex justify-center my-2 group relative">
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor }}
      >
        <span className="text-sm">{icon}</span>
        <span>{message.text}</span>
        <span className="text-[10px] opacity-80">{timeString}</span>
        {user?.role === 'admin' && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:bg-white/20 rounded p-1"
            title="Eliminar mensaje"
          >
            <Trash2 size={12} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
