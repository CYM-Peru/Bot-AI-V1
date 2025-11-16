import { useEffect, useState } from "react";
import { authFetch } from "../../lib/apiBase";

interface AdvisorStatus {
  id: string;
  name: string;
  color: string;
  action: string;
}

interface AdvisorStat {
  userId: string;
  userName: string;
  email: string;
  role: string;
  isOnline: boolean;
  status: AdvisorStatus | null;
  conversationsByQueue: Record<string, number>;
  totalConversations: number;
}

interface Queue {
  id: string;
  name: string;
  description: string;
}

interface AdvisorStatsResponse {
  advisors: AdvisorStat[];
  queues: Queue[];
}

export function AdvisorStats() {
  const [stats, setStats] = useState<AdvisorStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await authFetch("/api/admin/advisor-stats");

      if (!response.ok) {
        throw new Error("Failed to fetch advisor statistics");
      }

      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching advisor stats:", err);
      setError(err instanceof Error ? err.message : "Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 10 seconds if enabled
    const interval = autoRefresh ? setInterval(fetchStats, 10000) : undefined;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600 mx-auto"></div>
          <p className="text-sm text-slate-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <p className="text-lg font-semibold text-slate-900 mb-2">Error</p>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const { advisors, queues } = stats;

  // Calculate totals
  const totalActiveChats = advisors.reduce((sum, advisor) => sum + advisor.totalConversations, 0);
  const onlineAdvisors = advisors.filter(a => a.isOnline).length;

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">📊 Monitoreo de Asesores</h2>
            <p className="mt-2 text-sm text-slate-600">
              Vista en tiempo real de conversaciones asignadas por asesor y cola
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Auto-actualizar (10s)</span>
            </label>
            <button
              onClick={fetchStats}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Asesores en Línea</p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">{onlineAdvisors}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-200 flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Asesores</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{advisors.length}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Chats Activos</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{totalActiveChats}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-200 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Asesor
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Online
                </th>
                {queues.map(queue => (
                  <th
                    key={queue.id}
                    className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider"
                    title={queue.description}
                  >
                    {queue.name}
                  </th>
                ))}
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Sin Cola
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wider bg-emerald-50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {advisors.map((advisor) => (
                <tr
                  key={advisor.userId}
                  className={`hover:bg-slate-50 transition ${
                    !advisor.isOnline ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {advisor.userName}
                        </div>
                        <div className="text-xs text-slate-500">{advisor.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {advisor.status ? (
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${advisor.status.color}20`,
                          color: advisor.status.color,
                        }}
                      >
                        {advisor.status.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex h-3 w-3 rounded-full ${
                        advisor.isOnline ? "bg-green-500" : "bg-slate-300"
                      }`}
                      title={advisor.isOnline ? "En línea" : "Desconectado"}
                    />
                  </td>
                  {queues.map(queue => {
                    const count = advisor.conversationsByQueue[queue.id] || 0;
                    return (
                      <td
                        key={queue.id}
                        className="px-6 py-4 whitespace-nowrap text-center text-sm"
                      >
                        {count > 0 ? (
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-700 font-semibold">
                            {count}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {(advisor.conversationsByQueue["sin-cola"] || 0) > 0 ? (
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        {advisor.conversationsByQueue["sin-cola"]}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center bg-emerald-50">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-600 text-white font-bold text-sm">
                      {advisor.totalConversations}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                <td className="px-6 py-4 text-sm text-slate-700" colSpan={3}>
                  TOTALES POR COLA
                </td>
                {queues.map(queue => {
                  const total = advisors.reduce(
                    (sum, advisor) => sum + (advisor.conversationsByQueue[queue.id] || 0),
                    0
                  );
                  return (
                    <td key={queue.id} className="px-6 py-4 text-center text-sm text-slate-900">
                      {total > 0 ? (
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold">
                          {total}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-6 py-4 text-center text-sm text-slate-900">
                  {advisors.reduce(
                    (sum, advisor) => sum + (advisor.conversationsByQueue["sin-cola"] || 0),
                    0
                  ) > 0 ? (
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-600 text-white font-bold">
                      {advisors.reduce(
                        (sum, advisor) => sum + (advisor.conversationsByQueue["sin-cola"] || 0),
                        0
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center bg-emerald-100">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-700 text-white font-bold">
                    {totalActiveChats}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 rounded-full bg-green-500"></span>
          <span>En línea</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 rounded-full bg-slate-300"></span>
          <span>Desconectado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 rounded-full bg-blue-100 text-blue-700 items-center justify-center font-semibold">
            N
          </span>
          <span>Cantidad de chats por cola</span>
        </div>
      </div>
    </div>
  );
}
