import { useState, useEffect } from "react";
import type { CrmSocket, AdvisorPresence } from "./socket";
import { apiUrl } from "../lib/apiBase";

interface Props {
  socket: CrmSocket | null;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  eventType: "login" | "logout" | "status_change";
  statusId?: string;
  statusName?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export function AdvisorStatusPanel({ socket }: Props) {
  const [advisors, setAdvisors] = useState<AdvisorPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadAdvisorPresence();
    loadActivityLogs();

    // Refresh every 30 seconds as fallback (WebSocket updates are primary)
    const interval = setInterval(() => {
      loadAdvisorPresence();
      loadActivityLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time presence updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handlePresenceUpdate = (presence: AdvisorPresence) => {
      setAdvisors((prev) => {
        const index = prev.findIndex((a) => a.userId === presence.userId);
        if (index === -1) {
          // New advisor, add to list
          return [...prev, presence];
        } else {
          // Update existing advisor
          const updated = [...prev];
          updated[index] = presence;
          return updated;
        }
      });
    };

    socket.on("crm:advisor:presence", handlePresenceUpdate);

    return () => {
      socket.off("crm:advisor:presence", handlePresenceUpdate);
    };
  }, [socket]);

  const loadAdvisorPresence = async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/advisor-presence"), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load advisor presence");
      }

      const data = await response.json();
      setAdvisors(data.advisors || []);
    } catch (error) {
      console.error("[AdvisorStatusPanel] Error loading presence:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await fetch(apiUrl("/api/admin/advisor-activity-logs?limit=50"), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load activity logs");
      }

      const data = await response.json();
      setActivityLogs(data.logs || []);
    } catch (error) {
      console.error("[AdvisorStatusPanel] Error loading activity logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "login":
        return "🟢";
      case "logout":
        return "🔴";
      case "status_change":
        return "🔄";
      default:
        return "📋";
    }
  };

  const getEventText = (log: ActivityLog) => {
    switch (log.eventType) {
      case "login":
        return "Inició sesión";
      case "logout":
        return "Cerró sesión";
      case "status_change":
        return `Cambió estado a: ${log.statusName || "Desconocido"}`;
      default:
        return log.eventType;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Advisor Status Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Estado de Asesores
          <span className="ml-auto text-xs font-normal text-slate-500">
            {advisors.filter((a) => a.isOnline).length} / {advisors.length} en línea
          </span>
        </h3>
      </div>

      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {advisors.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay asesores disponibles
          </div>
        ) : (
          advisors.map((advisor) => (
            <div
              key={advisor.userId}
              className="px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Status indicator with actual state color */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm">
                      {(advisor.user.name || advisor.user.username).substring(0, 2).toUpperCase()}
                    </div>
                    <div
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                      style={{
                        backgroundColor: advisor.isOnline
                          ? (advisor.status?.color || "#10B981") // Green by default if online without status
                          : "#9CA3AF" // gray-400 for offline
                      }}
                      title={
                        advisor.isOnline
                          ? (advisor.status?.name || "Disponible")
                          : "Desconectado"
                      }
                    ></div>
                  </div>

                  {/* Name and email */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {advisor.user.name || advisor.user.username}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {advisor.user.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Active conversations badge */}
                  {advisor.activeConversations > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      {advisor.activeConversations}
                    </div>
                  )}

                  {/* Status badge - only show status if online */}
                  {advisor.isOnline && advisor.status ? (
                    <div
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                      style={{ backgroundColor: advisor.status.color }}
                    >
                      {advisor.status.name}
                    </div>
                  ) : advisor.isOnline ? (
                    <div className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-sm">
                      Disponible
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-400 text-white shadow-sm">
                      Desconectado
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

      {/* Activity Logs Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Registro de Actividad
            <span className="ml-auto text-xs font-normal text-slate-500">
              Últimos {activityLogs.length} eventos
            </span>
          </h3>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {logsLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Cargando actividad...
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay registros de actividad
            </div>
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">{getEventIcon(log.eventType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{log.userName}</p>
                      <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(log.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{getEventText(log)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
