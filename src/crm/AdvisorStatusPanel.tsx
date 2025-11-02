import { useState, useEffect } from "react";
import type { CrmSocket, AdvisorPresence } from "./socket";

interface Props {
  socket: CrmSocket | null;
}

export function AdvisorStatusPanel({ socket }: Props) {
  const [advisors, setAdvisors] = useState<AdvisorPresence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdvisorPresence();

    // Refresh every 30 seconds as fallback (WebSocket updates are primary)
    const interval = setInterval(loadAdvisorPresence, 30000);
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
      const response = await fetch("/api/admin/advisor-presence", {
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
                  {/* Online indicator */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm">
                      {(advisor.user.name || advisor.user.username).substring(0, 2).toUpperCase()}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        advisor.isOnline ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                      title={advisor.isOnline ? "En línea" : "Desconectado"}
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

                  {/* Status badge */}
                  {advisor.status ? (
                    <div
                      className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                      style={{ backgroundColor: advisor.status.color }}
                    >
                      {advisor.status.name}
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
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
  );
}
