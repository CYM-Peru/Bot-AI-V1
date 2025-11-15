import React, { useState, useEffect } from 'react';

interface KeywordUsageRecord {
  id: number;
  flow_id: string;
  flow_name: string;
  node_id: string;
  keyword_group_id: string;
  keyword_group_label: string;
  matched_keyword: string;
  customer_phone: string;
  customer_name: string | null;
  conversation_id: string;
  matched_at: string;
}

interface KeywordStat {
  matched_keyword: string;
  keyword_group_label: string;
  keyword_group_id: string;
  usage_count: number;
}

interface FlowStat {
  flow_id: string;
  flow_name: string;
  usage_count: number;
}

interface KeywordUsageData {
  records: KeywordUsageRecord[];
  totalCount: number;
  keywordStats: KeywordStat[];
  flowStats: FlowStat[];
}

export default function KeywordUsagePanel() {
  const [data, setData] = useState<KeywordUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFlow, setSelectedFlow] = useState<string>('');
  const [view, setView] = useState<'records' | 'stats'>('stats');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      if (selectedFlow) params.append('flowId', selectedFlow);
      params.append('limit', '100');

      const response = await fetch(`/api/crm/metrics/keyword-usage?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar datos de palabras clave');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching keyword usage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedFlow]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Cargando estadísticas de palabras clave...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {error}
        </div>
      </div>
    );
  }

  // Helper: Determinar si es frase (2+ palabras) o palabra (1 palabra)
  const isPhrase = (keyword: string): boolean => {
    return keyword.trim().split(/\s+/).length >= 2;
  };

  // Separar estadísticas en frases y palabras
  const phraseStats = data?.keywordStats.filter(stat => isPhrase(stat.matched_keyword)) || [];
  const wordStats = data?.keywordStats.filter(stat => !isPhrase(stat.matched_keyword)) || [];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header - Optimizado y compacto */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        {/* Título y botones de vista en la misma línea */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-slate-800">📊 Uso de Palabras y Frases Clave</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setView('stats')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'stats'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              📈 Estadísticas
            </button>
            <button
              onClick={() => setView('records')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'records'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              📋 Registros
            </button>
          </div>
        </div>

        {/* Filtros y estadísticas en una sola fila */}
        <div className="flex items-end gap-4">
          {/* Filtros más angostos */}
          <div className="flex gap-2">
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-[200px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Flujo
              </label>
              <select
                value={selectedFlow}
                onChange={(e) => setSelectedFlow(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los flujos</option>
                {data?.flowStats.map((flow) => (
                  <option key={flow.flow_id} value={flow.flow_id}>
                    {flow.flow_name} ({flow.usage_count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estadísticas más grandes aprovechando el espacio */}
          <div className="flex gap-4 flex-1 justify-end">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 px-8 py-3 rounded-lg border border-blue-200 min-w-[140px]">
              <div className="text-xs font-medium text-blue-700 mb-1">Total Coincidencias</div>
              <div className="text-4xl font-bold text-blue-900">{data?.totalCount || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 px-8 py-3 rounded-lg border border-purple-200 min-w-[140px]">
              <div className="text-xs font-medium text-purple-700 mb-1">🔤 Frases Clave</div>
              <div className="text-4xl font-bold text-purple-900">{phraseStats.length || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 px-8 py-3 rounded-lg border border-orange-200 min-w-[140px]">
              <div className="text-xs font-medium text-orange-700 mb-1">📝 Palabras Únicas</div>
              <div className="text-4xl font-bold text-orange-900">{wordStats.length || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 px-8 py-3 rounded-lg border border-emerald-200 min-w-[140px]">
              <div className="text-xs font-medium text-emerald-700 mb-1">Flujos Activos</div>
              <div className="text-4xl font-bold text-emerald-900">{data?.flowStats.length || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {view === 'stats' ? (
          <div className="space-y-6">
            {/* Frases Clave - PRIORITARIAS */}
            <div className="bg-white rounded-lg shadow-lg border-2 border-purple-300 overflow-hidden">
              <div className="px-6 py-4 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <h3 className="text-lg font-bold text-purple-900">🔤 Frases Clave Más Detectadas</h3>
                <p className="text-xs text-purple-700 mt-1">Frases completas (2+ palabras) - Principales indicadores de intención</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-purple-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider">
                        Frase Clave
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider">
                        Grupo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider">
                        Uso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider">
                        % del Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {phraseStats.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          No hay frases clave detectadas aún
                        </td>
                      </tr>
                    ) : (
                      phraseStats.map((stat, index) => (
                        <tr key={`${stat.keyword_group_id}-${stat.matched_keyword}`} className="hover:bg-purple-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-purple-900">{stat.matched_keyword}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-purple-700">{stat.keyword_group_label}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-purple-600">{stat.usage_count}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-purple-200 rounded-full h-2 max-w-[100px]">
                                <div
                                  className="bg-purple-600 h-2 rounded-full"
                                  style={{
                                    width: `${(stat.usage_count / (data?.totalCount || 1)) * 100}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs text-purple-700 font-semibold">
                                {((stat.usage_count / (data?.totalCount || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Palabras Clave - SECUNDARIAS */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-800">📝 Palabras Clave Individuales</h3>
                <p className="text-xs text-slate-600 mt-1">Palabras individuales (1 palabra)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Palabra Clave
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Grupo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Uso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        % del Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {wordStats.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          No hay palabras clave detectadas aún
                        </td>
                      </tr>
                    ) : (
                      wordStats.map((stat, index) => (
                        <tr key={`${stat.keyword_group_id}-${stat.matched_keyword}`} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-900">{stat.matched_keyword}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-600">{stat.keyword_group_label}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-blue-600">{stat.usage_count}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{
                                    width: `${(stat.usage_count / (data?.totalCount || 1)) * 100}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs text-slate-600">
                                {((stat.usage_count / (data?.totalCount || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Flow Stats */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-800">Uso por Flujo</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Flujo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Coincidencias
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data?.flowStats.map((stat) => (
                      <tr key={stat.flow_id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{stat.flow_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-slate-500 font-mono">{stat.flow_id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-emerald-600">{stat.usage_count}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Records View */
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Registros Detallados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Palabra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Grupo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Flujo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Cliente
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data?.records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-slate-600">{formatDate(record.matched_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{record.matched_keyword}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{record.keyword_group_label}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{record.flow_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-emerald-700">{record.customer_phone}</div>
                        {record.customer_name && (
                          <div className="text-xs text-slate-500">{record.customer_name}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
