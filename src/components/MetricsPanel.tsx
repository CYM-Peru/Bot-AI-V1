import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE, apiUrl } from '../lib/apiBase';
import type { WhatsAppNumberAssignment, ChannelType } from '../flow/types';

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
  channelType?: ChannelType;
  whatsappNumberId?: string;
}

interface MenuStat {
  nodeId: string;
  optionId: string;
  label: string;
  count: number;
}

interface MetricsPanelProps {
  whatsappNumbers?: WhatsAppNumberAssignment[];
}

export function MetricsPanel({ whatsappNumbers = [] }: MetricsPanelProps) {
  const [stats, setStats] = useState<MetricsStats | null>(null);
  const [metrics, setMetrics] = useState<ConversationMetric[]>([]);
  const [activeConversations, setActiveConversations] = useState<ConversationMetric[]>([]);
  const [menuStats, setMenuStats] = useState<MenuStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [channelFilter, setChannelFilter] = useState<ChannelType | 'all'>('all');
  const [numberFilter, setNumberFilter] = useState<string>('all');

  const fetchStats = async () => {
    try {
      const response = await fetch(apiUrl('/api/stats'));
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
      const response = await fetch(apiUrl('/api/metrics'));
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data.metrics || []);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const fetchActiveConversations = async () => {
    try {
      const response = await fetch(apiUrl('/api/conversations/active'));
      if (!response.ok) throw new Error('Failed to fetch active conversations');
      const data = await response.json();
      setActiveConversations(data.conversations || []);
    } catch (err) {
      console.error('Error fetching active conversations:', err);
    }
  };

  const fetchMenuStats = async () => {
    try {
      const response = await fetch(apiUrl('/api/metrics/menu-stats'));
      if (!response.ok) throw new Error('Failed to fetch menu stats');
      const data = await response.json();
      setMenuStats(data.stats || []);
    } catch (err) {
      console.error('Error fetching menu stats:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchMetrics(), fetchActiveConversations(), fetchMenuStats()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchMetrics();
      fetchActiveConversations();
      fetchMenuStats();
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

  // Filter metrics based on selected channel and number
  const filteredMetrics = useMemo(() => {
    let filtered = metrics;

    if (channelFilter !== 'all') {
      filtered = filtered.filter((m) => m.channelType === channelFilter);
    }

    if (numberFilter !== 'all') {
      filtered = filtered.filter((m) => m.whatsappNumberId === numberFilter);
    }

    return filtered;
  }, [metrics, channelFilter, numberFilter]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    if (!stats) return null;

    const active = filteredMetrics.filter((m) => m.status === 'active').length;
    const total = filteredMetrics.length;

    return {
      ...stats,
      activeConversations: active,
      totalConversations: total,
    };
  }, [stats, filteredMetrics]);

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
            Asegúrate de que el servidor esté disponible en{' '}
            <code className="bg-rose-100 px-1 rounded">{API_BASE}</code>
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

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Filtrar por:</span>
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">Canal:</label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as ChannelType | 'all')}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los canales</option>
                <option value="whatsapp">📱 WhatsApp</option>
                <option value="facebook">💬 Facebook</option>
                <option value="instagram">📷 Instagram</option>
                <option value="telegram">✈️ Telegram</option>
              </select>
            </div>

            {/* Number Filter (only for WhatsApp) */}
            {channelFilter === 'whatsapp' && whatsappNumbers.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Número:</label>
                <select
                  value={numberFilter}
                  onChange={(e) => setNumberFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos los números</option>
                  {whatsappNumbers.map((number) => (
                    <option key={number.numberId} value={number.numberId}>
                      {number.displayName} ({number.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filter */}
            {(channelFilter !== 'all' || numberFilter !== 'all') && (
              <button
                onClick={() => {
                  setChannelFilter('all');
                  setNumberFilter('all');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Limpiar filtros
              </button>
            )}

            {/* Filter info */}
            {(channelFilter !== 'all' || numberFilter !== 'all') && (
              <div className="text-xs text-slate-500 italic">
                Mostrando métricas filtradas
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {filteredStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Conversaciones Activas</div>
              <div className="text-3xl font-bold text-emerald-600 mt-2">{filteredStats.activeConversations}</div>
              <div className="text-slate-500 text-xs mt-1">En este momento</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Total Conversaciones</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{filteredStats.totalConversations}</div>
              <div className="text-slate-500 text-xs mt-1">Desde inicio</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Mensajes/Minuto</div>
              <div className="text-3xl font-bold text-violet-600 mt-2">{filteredStats.messagesPerMinute}</div>
              <div className="text-slate-500 text-xs mt-1">Promedio actual</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Tiempo de Respuesta</div>
              <div className="text-3xl font-bold text-amber-600 mt-2">{Math.round(filteredStats.averageResponseTime)}ms</div>
              <div className="text-slate-500 text-xs mt-1">Promedio</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Tasa de Error</div>
              <div className="text-3xl font-bold text-rose-600 mt-2">{(filteredStats.errorRate * 100).toFixed(2)}%</div>
              <div className="text-slate-500 text-xs mt-1">Últimos mensajes</div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
              <div className="text-slate-600 text-sm font-medium">Uptime</div>
              <div className="text-3xl font-bold text-cyan-600 mt-2">{formatUptime(filteredStats.uptime)}</div>
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

        {/* Menu Analytics */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white p-4">
            <h3 className="text-lg font-bold text-slate-900">📊 Análisis de Opciones de Menú</h3>
            <p className="text-sm text-slate-600 mt-1">
              Estadísticas de selecciones de menús y botones por los usuarios
            </p>
          </div>
          <div className="p-6">
            {menuStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-slate-600 font-medium">No hay datos de menús aún</p>
                <p className="text-sm text-slate-500 mt-2">
                  Las estadísticas aparecerán cuando los usuarios interactúen con los menús del flujo
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {menuStats.slice(0, 20).map((stat, index) => {
                  const maxCount = Math.max(...menuStats.map(s => s.count));
                  const percentage = (stat.count / maxCount) * 100;
                  return (
                    <div key={`${stat.nodeId}-${stat.optionId}`} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{stat.label}</p>
                            <p className="text-xs text-slate-500">Node: {stat.nodeId.slice(0, 8)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-violet-600">{stat.count}</p>
                          <p className="text-xs text-slate-500">clicks</p>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {menuStats.length > 20 && (
                  <p className="text-center text-sm text-slate-500 mt-4">
                    Mostrando top 20 de {menuStats.length} opciones
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
