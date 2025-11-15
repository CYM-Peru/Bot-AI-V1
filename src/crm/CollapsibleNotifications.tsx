import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Message } from "./types";
import EventBubble from "./EventBubble";

interface CollapsibleNotificationsProps {
  notifications: Message[];
}

/**
 * Groups consecutive system/event notifications and allows collapsing them
 * Shows first notification + button to expand if there are more than 2
 */
export default function CollapsibleNotifications({ notifications }: CollapsibleNotificationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If 2 or less notifications, show all directly
  if (notifications.length <= 2) {
    return (
      <>
        {notifications.map((message) => (
          <div key={message.id} id={`message-${message.id}`}>
            <EventBubble message={message} />
          </div>
        ))}
      </>
    );
  }

  // More than 2 notifications: show first + collapse button
  const firstNotification = notifications[0];
  const hiddenCount = notifications.length - 1;

  return (
    <div className="space-y-2">
      {/* Always show first notification */}
      <div id={`message-${firstNotification.id}`}>
        <EventBubble message={firstNotification} />
      </div>

      {/* Collapse/Expand button */}
      <div className="flex justify-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-sm transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Ocultar notificaciones</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Ver {hiddenCount} notificación{hiddenCount > 1 ? 'es' : ''} más</span>
            </>
          )}
        </button>
      </div>

      {/* Hidden notifications (shown when expanded) */}
      {isExpanded && (
        <div className="space-y-2">
          {notifications.slice(1).map((message) => (
            <div key={message.id} id={`message-${message.id}`}>
              <EventBubble message={message} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
