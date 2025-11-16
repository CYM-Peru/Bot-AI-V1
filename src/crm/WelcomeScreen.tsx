import { useEffect, useState } from "react";
import type { Conversation } from "./types";
import { authFetch } from "../lib/apiBase";

interface WelcomeScreenProps {
  conversations: Conversation[];
  userName?: string;
  userRole?: string;
}

interface Stats {
  unread: number;
  queued: number;
  attending: number;
  total: number;
}

interface StatsResponse {
  userRole: string;
  personal: Stats;
  global: Stats;
}

const TIPS = [
  "💡 Usa Ctrl+K para buscar conversaciones rápidamente",
  "⚡ Presiona Ctrl+/ para ver todos los atajos de teclado",
  "📌 Puedes desacoplar cualquier chat para trabajar en múltiples ventanas",
  "🎨 Cambia el fondo del chat desde el menú de acciones",
  "🔔 Configura tus notificaciones desde el panel de ajustes",
  "✨ Los mensajes internos solo son visibles para otros asesores",
  "🤝 Puedes colaborar con otros asesores en el mismo chat",
];

export default function WelcomeScreen({ conversations, userName, userRole }: WelcomeScreenProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch stats from API and refresh every 10 seconds
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await authFetch("/api/crm/conversations/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("[WelcomeScreen] Error loading stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    // Initial fetch
    fetchStats();

    // Refresh stats every 10 seconds for real-time updates
    const interval = setInterval(() => {
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Also refresh stats when conversations prop changes (instant update)
  useEffect(() => {
    // Only refetch if we already have stats loaded (to avoid duplicate initial load)
    if (stats !== null && conversations.length > 0) {
      const fetchStats = async () => {
        try {
          const response = await authFetch("/api/crm/conversations/stats");
          if (response.ok) {
            const data = await response.json();
            setStats(data);
          }
        } catch (error) {
          console.error("[WelcomeScreen] Error updating stats:", error);
        }
      };
      fetchStats();
    }
  }, [conversations.length]);

  // Rotate tips every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initial fade-in animation
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const greeting = getGreeting();

  // Determine which stats to show based on role
  const isAsesor = userRole === "asesor";
  const isSupervisor = userRole === "supervisor" || userRole === "admin" || userRole === "gerencia";
  const personalStats = stats?.personal || { unread: 0, queued: 0, attending: 0, total: 0 };
  const globalStats = stats?.global || { unread: 0, queued: 0, attending: 0, total: 0 };

  return (
    <div
      className={`flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 transition-opacity duration-500 ${
        isAnimating ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="max-w-2xl px-8 text-center">
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full animate-pulse opacity-20"></div>
          </div>
          <div className="relative w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
            <svg
              className="w-16 h-16 text-white animate-bounce-slow"
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
          </div>
        </div>

        {/* Welcome Message */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {greeting}, {userName || "Asesor"}! 👋
          </h1>
          <p className="text-lg text-slate-600">
            Selecciona una conversación de la lista para comenzar a atender
          </p>
        </div>

        {/* Stats Cards */}
        {loadingStats ? (
          <div className="flex items-center justify-center mb-8 py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="mb-8 space-y-6">
            {/* Personal Stats - Only for asesores (supervisors skip this section) */}
            {isAsesor && (
              <div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{personalStats.unread}</p>
                    <p className="text-xs text-slate-600 font-medium">Sin leer</p>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{personalStats.queued}</p>
                    <p className="text-xs text-slate-600 font-medium">En cola</p>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{personalStats.attending}</p>
                    <p className="text-xs text-slate-600 font-medium">Atendiendo</p>
                  </div>
                </div>
              </div>
            )}

            {/* Global Stats - Only for supervisors and admins */}
            {isSupervisor && (
              <div>
                <div className="flex items-center justify-center mb-3">
                  <div className="flex items-center space-x-2 bg-purple-100 px-4 py-1.5 rounded-full">
                    <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">Estadísticas del Equipo</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-red-50 to-white rounded-xl p-4 shadow-lg border-2 border-red-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{globalStats.unread}</p>
                    <p className="text-xs text-slate-600 font-medium">Sin leer (total)</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-white rounded-xl p-4 shadow-lg border-2 border-orange-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{globalStats.queued}</p>
                    <p className="text-xs text-slate-600 font-medium">En cola (total)</p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 shadow-lg border-2 border-emerald-200 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{globalStats.attending}</p>
                    <p className="text-xs text-slate-600 font-medium">Atendiendo (total)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rotating Tips */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 shadow-xl">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-white/90 uppercase tracking-wide mb-1">
                Tip del día
              </p>
              <p
                key={currentTipIndex}
                className="text-sm text-white font-medium animate-fade-in"
              >
                {TIPS[currentTipIndex]}
              </p>
            </div>
          </div>
          {/* Tip Progress Indicator */}
          <div className="flex space-x-1 mt-4 justify-center">
            {TIPS.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentTipIndex
                    ? "w-8 bg-white"
                    : "w-1 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Subtle CTA */}
        <div className="mt-8 flex items-center justify-center space-x-2 text-slate-500">
          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <p className="text-sm font-medium">Comienza seleccionando un chat de la lista</p>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
