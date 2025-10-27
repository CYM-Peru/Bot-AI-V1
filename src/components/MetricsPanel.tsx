import React, { useEffect, useState } from 'react';

interface MetricsStats {
  activeConversations: number;
  totalConversations: number;
  messagesPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
}

interface ConversationMetric {
  sessionId: string;
  flowId: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  messagesReceived: number;
  messagesSent: number;
  nodesExecuted: number;
  webhooksCalled: number;
  errors: number;
  status: 'active' | 'ended' | 'error';
}

const API_BASE_URL = 'http://localhost:3000';

export function MetricsPanel() {
  const [stats, setStats] = useState<MetricsStats | null>(null);
  const [metrics, setMetrics] = useState<ConversationMetric[]>([]);
  const [activeConversations, setActiveConversations] = useState<ConversationMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data.metrics || []);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const fetchActiveConversations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations/active`);
      if (!response.ok) throw new Error('Failed to fetch active conversations');
      const data = await response.json();
      setActiveConversations(data.conversations || []);
    } catch (err) {
      console.error('Error fetching active conversations:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchMetrics(), fetchActiveConversations()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchMetrics();
      fetchActiveConversations();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-600">Cargando métricas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="text-rose-800 font-semibold">Error al cargar métricas</div>
          <div className="text-rose-600 text-sm mt-1">{error}</div>
          <div className="text-slate-600 text-sm mt-2">
            Asegúrate de que el servidor esté corriendo en <code className="bg-rose-100 px-1 rounded">http://localhost:3000</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">📊 Métricas del Bot</h2>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Actualización automática
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Conversaciones Activas</div>
              <div className="text-3xl font-bold text-emerald-600 mt-2">{stats.activeConversations}</div>
              <div className="text-slate-500 text-xs mt-1">En este momento</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Total Conversaciones</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{stats.totalConversations}</div>
              <div className="text-slate-500 text-xs mt-1">Desde inicio</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Mensajes/Minuto</div>
              <div className="text-3xl font-bold text-violet-600 mt-2">{stats.messagesPerMinute}</div>
              <div className="text-slate-500 text-xs mt-1">Promedio actual</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Tiempo de Respuesta</div>
              <div className="text-3xl font-bold text-amber-600 mt-2">{Math.round(stats.averageResponseTime)}ms</div>
              <div className="text-slate-500 text-xs mt-1">Promedio</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Tasa de Error</div>
              <div className="text-3xl font-bold text-rose-600 mt-2">{(stats.errorRate * 100).toFixed(2)}%</div>
              <div className="text-slate-500 text-xs mt-1">Últimos mensajes</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Uptime</div>
              <div className="text-3xl font-bold text-cyan-600 mt-2">{formatUptime(stats.uptime)}</div>
              <div className="text-slate-500 text-xs mt-1">Tiempo activo</div>
            </div>
          </div>
        )}

        {/* Active Conversations */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">💬 Conversaciones Activas ({activeConversations.length})</h3>
          </div>
          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {activeConversations.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No hay conversaciones activas</div>
            ) : (
              activeConversations.map((conv) => (
                <div key={conv.sessionId} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-mono text-sm text-slate-700">{conv.sessionId}</div>
                      <div className="text-xs text-slate-500 mt-1">Flow: {conv.flowId}</div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-slate-600">📨 {conv.messagesReceived} recibidos</span>
                        <span className="text-slate-600">📤 {conv.messagesSent} enviados</span>
                        <span className="text-slate-600">⚙️ {conv.nodesExecuted} nodos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        Activo
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Iniciado: {new Date(conv.startedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">📜 Historial Reciente ({metrics.length})</h3>
          </div>
          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {metrics.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No hay conversaciones registradas</div>
            ) : (
              metrics.slice(0, 20).map((conv) => (
                <div key={conv.sessionId} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-mono text-sm text-slate-700">{conv.sessionId}</div>
                      <div className="text-xs text-slate-500 mt-1">Flow: {conv.flowId}</div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-slate-600">📨 {conv.messagesReceived}</span>
                        <span className="text-slate-600">📤 {conv.messagesSent}</span>
                        <span className="text-slate-600">⚙️ {conv.nodesExecuted}</span>
                        {conv.webhooksCalled > 0 && (
                          <span className="text-slate-600">🔗 {conv.webhooksCalled} webhooks</span>
                        )}
                        {conv.errors > 0 && (
                          <span className="text-rose-600">❌ {conv.errors} errores</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        conv.status === 'active' ? 'bg-green-100 text-green-700' :
                        conv.status === 'error' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {conv.status === 'active' ? '🟢' : conv.status === 'error' ? '🔴' : '⚪'}
                        {conv.status}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Duración: {formatDuration(conv.duration)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
