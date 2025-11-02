import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../lib/apiBase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface KPIs {
  totalConversations: number;
  received: number;
  active: number;
  transferred_out: number;
  transferred_in: number;
  rejected: number;
  completed: number;
  abandoned: number;
  avgFirstResponseTime: number; // ms
  avgResolutionTime: number; // ms
  avgSessionDuration: number; // ms
  avgSatisfactionScore: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  satisfactionDistribution: Array<{ score: number; count: number }>;
  channelDistribution: Array<{ channel: string; count: number }>;
}

interface TrendData {
  date: string;
  count: number;
}

interface AdvisorRanking {
  rank: number;
  advisorId: string;
  advisorName: string;
  advisorEmail: string | null;
  advisorRole: string | null;
  totalConversations: number;
  received: number;
  active: number;
  transferred_out: number;
  transferred_in: number;
  rejected: number;
  completed: number;
  abandoned: number;
  avgFirstResponseTime: number;
  avgResolutionTime: number;
  avgSessionDuration: number;
  avgSatisfactionScore: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  responded: number;
  clicked: number;
}

interface Campaign {
  id: string;
  name: string;
  createdAt: number;
  status: string;
}

type DateFilter = "today" | "week" | "month" | "custom";
type MetricsTab = "conversations" | "campaigns";

export default function MetricsDashboard() {
  const [metricsTab, setMetricsTab] = useState<MetricsTab>("conversations");
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [advisorRanking, setAdvisorRanking] = useState<AdvisorRanking[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const getDateRange = useCallback((): { startDate?: number; endDate?: number } => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    switch (dateFilter) {
      case "today":
        return {
          startDate: now - oneDayMs,
          endDate: now,
        };
      case "week":
        return {
          startDate: now - 7 * oneDayMs,
          endDate: now,
        };
      case "month":
        return {
          startDate: now - 30 * oneDayMs,
          endDate: now,
        };
      case "custom":
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate).getTime(),
            endDate: new Date(customEndDate).getTime(),
          };
        }
        return {};
      default:
        return {};
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Build query params
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate.toString());
      if (endDate) params.set("endDate", endDate.toString());

      if (metricsTab === "conversations") {
        // Load KPIs
        const kpisResponse = await fetch(apiUrl(`/api/crm/metrics/kpis?${params.toString()}`), {
          credentials: "include",
        });

        if (kpisResponse.ok) {
          const data = await kpisResponse.json();
          setKpis(data.kpis);
        }

        // Load trend data
        const days = dateFilter === "today" ? 1 : dateFilter === "week" ? 7 : dateFilter === "month" ? 30 : 7;
        const trendResponse = await fetch(apiUrl(`/api/crm/metrics/trend?days=${days}`), {
          credentials: "include",
        });

        if (trendResponse.ok) {
          const data = await trendResponse.json();
          setTrendData(data.trend || []);
        }

        // Load advisor ranking
        const rankingResponse = await fetch(apiUrl(`/api/crm/metrics/advisors/ranking?${params.toString()}`), {
          credentials: "include",
        });

        if (rankingResponse.ok) {
          const data = await rankingResponse.json();
          setAdvisorRanking(data.ranking || []);
        }
      } else if (metricsTab === "campaigns") {
        // Load campaigns
        const campaignsResponse = await fetch(apiUrl('/api/campaigns'), {
          credentials: "include",
        });

        if (campaignsResponse.ok) {
          const data = await campaignsResponse.json();
          setCampaigns(data.campaigns || []);
        }

        // Load campaign metrics
        const metricsResponse = await fetch(apiUrl('/api/campaigns/metrics/all'), {
          credentials: "include",
        });

        if (metricsResponse.ok) {
          const data = await metricsResponse.json();
          setCampaignMetrics(data.metrics || []);
        }
      }
    } catch (error) {
      console.error("[Metrics] Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, getDateRange, metricsTab]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET_ALL_METRICS') {
      alert('Por favor escribe exactamente: RESET_ALL_METRICS');
      return;
    }

    try {
      setResetting(true);
      const response = await fetch(apiUrl('/api/crm/metrics/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmText }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ Métricas reseteadas correctamente. Se creó un backup.');
        setShowResetModal(false);
        setConfirmText('');
        loadMetrics();
      } else {
        alert(`❌ Error: ${result.message || 'No tienes permisos de administrador'}`);
      }
    } catch (error) {
      console.error('Error resetting metrics:', error);
      alert('❌ Error al resetear métricas');
    } finally {
      setResetting(false);
    }
  };

  // Trend chart data
  const trendChartData = {
    labels: trendData.map((d) => new Date(d.date).toLocaleDateString("es-PE", { month: "short", day: "numeric" })),
    datasets: [
      {
        label: "Conversaciones",
        data: trendData.map((d) => d.count),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };


  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">📊 Dashboard de Métricas</h1>
          <p className="text-slate-600">Análisis de desempeño y KPIs del equipo</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadMetrics}
            className="px-4 py-2 text-sm font-medium text-emerald-600 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition"
          >
            🔄 Actualizar
          </button>
          {metricsTab === "conversations" && (
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition"
            >
              🗑️ Resetear (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-6 inline-flex gap-2">
        <button
          onClick={() => setMetricsTab("conversations")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            metricsTab === "conversations"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          💬 Conversaciones
        </button>
        <button
          onClick={() => setMetricsTab("campaigns")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            metricsTab === "campaigns"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          📢 Campañas
        </button>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Período:</label>
          <button
            onClick={() => setDateFilter("today")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              dateFilter === "today"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setDateFilter("week")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              dateFilter === "week"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Última Semana
          </button>
          <button
            onClick={() => setDateFilter("month")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              dateFilter === "month"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Último Mes
          </button>
          <button
            onClick={() => setDateFilter("custom")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              dateFilter === "custom"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Personalizado
          </button>

          {dateFilter === "custom" && (
            <div className="flex items-center gap-2 ml-4">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-400 focus:ring focus:ring-emerald-100"
              />
              <span className="text-slate-600">a</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-400 focus:ring focus:ring-emerald-100"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Cargando métricas...</p>
          </div>
        </div>
      ) : (
        <>
          {metricsTab === "conversations" && (
            <>
              {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Conversations */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-600">Conversaciones</p>
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold text-slate-900">{kpis?.totalConversations || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Total atendidas</p>
            </div>

            {/* First Response Time */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-600">Primera Respuesta</p>
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {kpis?.avgFirstResponseTime ? formatTime(kpis.avgFirstResponseTime) : "N/A"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Tiempo promedio</p>
            </div>

            {/* Resolution Time */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-600">Tiempo de Resolución</p>
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {kpis?.avgResolutionTime ? formatTime(kpis.avgResolutionTime) : "N/A"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Tiempo promedio</p>
            </div>

          </div>

          {/* Status Metrics */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">📊 Distribución por Estado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-2xl font-bold text-blue-600">{kpis?.received || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Recibidos</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-2xl font-bold text-green-600">{kpis?.active || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Activos</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-2xl font-bold text-orange-600">{kpis?.transferred_out || 0}</p>
                <p className="text-xs text-slate-600 mt-1">⬅️ Transfer OUT</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-2xl font-bold text-purple-600">{kpis?.transferred_in || 0}</p>
                <p className="text-xs text-slate-600 mt-1">➡️ Transfer IN</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-2xl font-bold text-red-600">{kpis?.rejected || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Rechazados</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-2xl font-bold text-emerald-600">{kpis?.completed || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Completados</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-2xl font-bold text-amber-600">{kpis?.abandoned || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Abandonados</p>
              </div>
            </div>
          </div>

          {/* Channel Distribution */}
          {kpis?.channelDistribution && kpis.channelDistribution.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">📱 Distribución por Canal</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {kpis.channelDistribution.map((ch) => (
                  <div key={ch.channel} className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-2xl font-bold text-slate-900">{ch.count}</p>
                    <p className="text-xs text-slate-600 mt-1 capitalize">{ch.channel}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">📈 Conversaciones por Día</h3>
              <Line
                data={trendChartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        precision: 0,
                      },
                    },
                  },
                }}
              />
            </div>

          </div>

          {/* Advisors Ranking Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">🏆 Ranking de Asesores</h3>
              <p className="text-sm text-slate-600 mt-1">Comparativa de performance por asesor</p>
            </div>
            {advisorRanking.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-lg text-slate-600 mb-2">No hay datos de asesores aún</p>
                <p className="text-sm text-slate-500">Los asesores aparecerán aquí cuando atiendan conversaciones</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Pos</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Asesor</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Completadas</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">⬅️ Trans OUT</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">➡️ Trans IN</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Rechazadas</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">1ra Respuesta</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Duración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {advisorRanking.map((advisor) => {
                      const isBest = advisor.rank === 1;
                      return (
                        <tr key={advisor.advisorId} className={`hover:bg-slate-50 transition ${isBest ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center">
                              {advisor.rank === 1 && <span className="text-2xl">🥇</span>}
                              {advisor.rank === 2 && <span className="text-2xl">🥈</span>}
                              {advisor.rank === 3 && <span className="text-2xl">🥉</span>}
                              {advisor.rank > 3 && <span className="text-sm font-semibold text-slate-600">#{advisor.rank}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <div className="text-sm font-bold text-slate-900">{advisor.advisorName}</div>
                              {advisor.advisorEmail && (
                                <div className="text-xs text-slate-500">{advisor.advisorEmail}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-lg font-bold text-blue-600">{advisor.totalConversations}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {advisor.completed}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {advisor.transferred_out}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {advisor.transferred_in}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {advisor.rejected}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-sm font-medium text-slate-700">
                              {advisor.avgFirstResponseTime > 0 ? formatTime(advisor.avgFirstResponseTime) : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-sm font-medium text-slate-700">
                              {advisor.avgSessionDuration > 0 ? formatTime(advisor.avgSessionDuration) : 'N/A'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}

          {/* Campaigns Tab */}
          {metricsTab === "campaigns" && (
            <>
              {campaignMetrics.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📢</div>
                  <p className="text-lg text-slate-600 mb-2">No hay campañas aún</p>
                  <p className="text-sm text-slate-500">Las campañas enviadas aparecerán aquí con sus métricas</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">📊 Métricas de Campañas</h3>
                    <p className="text-sm text-slate-600 mt-1">Performance de campañas de mensajería masiva</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Campaña</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Enviados</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Entregados</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Leídos</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Fallados</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Respondidos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {campaignMetrics.map((cm) => {
                          const campaign = campaigns.find(c => c.id === cm.campaignId);
                          const sentPct = cm.totalRecipients > 0 ? ((cm.sent / cm.totalRecipients) * 100).toFixed(1) : '0';
                          const deliveredPct = cm.totalRecipients > 0 ? ((cm.delivered / cm.totalRecipients) * 100).toFixed(1) : '0';
                          const readPct = cm.totalRecipients > 0 ? ((cm.read / cm.totalRecipients) * 100).toFixed(1) : '0';
                          const failedPct = cm.totalRecipients > 0 ? ((cm.failed / cm.totalRecipients) * 100).toFixed(1) : '0';
                          const respondedPct = cm.totalRecipients > 0 ? ((cm.responded / cm.totalRecipients) * 100).toFixed(1) : '0';

                          return (
                            <tr key={cm.campaignId} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-4">
                                <div className="text-sm font-bold text-slate-900">{cm.campaignName}</div>
                                {campaign && (
                                  <div className="text-xs text-slate-500">Estado: {campaign.status}</div>
                                )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm text-slate-700">
                                  {campaign ? new Date(campaign.createdAt).toLocaleDateString('es-PE', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  }) : 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-lg font-bold text-blue-600">{cm.totalRecipients}</div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm font-bold text-slate-900">{cm.sent}</div>
                                <div className="text-xs text-slate-500">{sentPct}%</div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm font-bold text-green-700">{cm.delivered}</div>
                                <div className="text-xs text-green-600">{deliveredPct}%</div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm font-bold text-blue-700">{cm.read}</div>
                                <div className="text-xs text-blue-600">{readPct}%</div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm font-bold text-red-700">{cm.failed}</div>
                                <div className="text-xs text-red-600">{failedPct}%</div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-sm font-bold text-purple-700">{cm.responded}</div>
                                <div className="text-xs text-purple-600">{respondedPct}%</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowResetModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-red-600 mb-4">
                ⚠️ Resetear Todas las Métricas
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Esta acción eliminará TODAS las métricas guardadas.
                Se creará un backup automático antes de resetear.
              </p>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Para confirmar, escribe: <code className="bg-slate-100 px-2 py-1 rounded font-mono">RESET_ALL_METRICS</code>
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                placeholder="RESET_ALL_METRICS"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    setConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting || confirmText !== 'RESET_ALL_METRICS'}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetting ? 'Reseteando...' : 'Resetear Métricas'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
