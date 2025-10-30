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
  avgFirstResponseTime: number; // ms
  avgResolutionTime: number; // ms
  avgSatisfactionScore: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
}

interface TrendData {
  date: string;
  count: number;
}

type DateFilter = "today" | "week" | "month" | "custom";

export default function MetricsDashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error("[Metrics] Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, getDateRange]);

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

  // Satisfaction distribution (mock data for now - in real scenario would come from backend)
  const satisfactionData = {
    labels: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"],
    datasets: [
      {
        label: "Distribución",
        data: [2, 5, 12, 28, 53], // Mock percentages
        backgroundColor: [
          "rgba(239, 68, 68, 0.8)",
          "rgba(249, 115, 22, 0.8)",
          "rgba(234, 179, 8, 0.8)",
          "rgba(34, 197, 94, 0.8)",
          "rgba(16, 185, 129, 0.8)",
        ],
      },
    ],
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">📊 Dashboard de Métricas</h1>
        <p className="text-slate-600">Análisis de desempeño y KPIs del equipo</p>
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

            {/* Satisfaction Score */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-600">Satisfacción</p>
                <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {kpis?.avgSatisfactionScore ? kpis.avgSatisfactionScore.toFixed(1) : "N/A"}
                <span className="text-lg text-slate-500">/5</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Calificación promedio</p>
            </div>
          </div>

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

            {/* Satisfaction Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">⭐ Distribución de Satisfacción</h3>
              <div className="max-w-xs mx-auto">
                <Doughnut
                  data={satisfactionData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "bottom",
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
