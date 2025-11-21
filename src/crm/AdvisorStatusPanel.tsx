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

    // Refresh every 5 minutes as fallback (WebSocket provides real-time updates)
    const interval = setInterval(() => {
      loadAdvisorPresence();
      loadActivityLogs();
    }, 300000); // 5 minutes
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Column 1: Connection Status (Login/Logout) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-green-50 to-white">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            Conexión
            <span className="ml-auto text-xs font-normal text-slate-500">
              {advisors.filter((a) => a.isOnline).length} / {advisors.length} en línea
            </span>
          </h3>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          {advisors.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay asesores
            </div>
          ) : (
            advisors.map((advisor) => (
              <div
                key={advisor.userId}
                className="px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-xs">
                      {(advisor.user.name || advisor.user.username).substring(0, 2).toUpperCase()}
                    </div>
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                      style={{
                        backgroundColor: advisor.isOnline ? "#10B981" : "#EF4444"
                      }}
                    ></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {advisor.user.name || advisor.user.username}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {advisor.user.email}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {advisor.isOnline ? (
                      <div className="px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700">
                        Conectado
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700">
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

      {/* Column 2: Work Status (Disponible/Ocupado/etc) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Estado de Trabajo
            <span className="ml-auto text-xs font-normal text-slate-500">
              {advisors.filter((a) => a.status?.action === "accept").length} disponibles
            </span>
          </h3>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          {advisors.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay asesores
            </div>
          ) : (
            advisors.map((advisor) => (
              <div
                key={advisor.userId}
                className="px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-xs">
                      {(advisor.user.name || advisor.user.username).substring(0, 2).toUpperCase()}
                    </div>
                    {advisor.status && (
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: advisor.status.color }}
                      ></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {advisor.user.name || advisor.user.username}
                    </div>
                    {advisor.activeConversations > 0 && (
                      <div className="text-xs text-blue-600 font-medium">
                        {advisor.activeConversations} chat{advisor.activeConversations !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {advisor.status ? (
                      <div
                        className="px-2 py-1 rounded-md text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: advisor.status.color }}
                      >
                        {advisor.status.name}
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-300 text-gray-700">
                        Sin estado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 3: Activity History */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Historial
            <span className="ml-auto text-xs font-normal text-slate-500">
              Últimos {activityLogs.length}
            </span>
          </h3>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          {logsLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Cargando...
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Sin registros
            </div>
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="text-lg flex-shrink-0">{getEventIcon(log.eventType)}</div>
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
