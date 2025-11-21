import React, { useState, useEffect } from 'react';
import { apiUrl } from '../lib/apiBase';

interface TemplateUsageRecord {
  id: number;
  template_name: string;
  template_category: string;
  cost_usd: number;
  advisor_id: string;
  advisor_name: string;
  conversation_id: string;
  customer_phone: string;
  customer_name: string | null;
  sending_phone_number_id: string | null;
  sending_display_number: string | null;
  sent_at: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_total_sent: number | null;
  campaign_total_cost: number | null;
}

interface TemplateUsageStats {
  totalCount: number;
  totalCost: number;
  sentCount: number;
  failedCount: number;
  sentCost: number;
}

interface TemplateUsageResponse {
  records: TemplateUsageRecord[];
  stats: TemplateUsageStats;
}

interface RagUsageRecord {
  id: number;
  query: string;
  category: string;
  chunks_used: number;
  found: boolean;
  embedding_cost_usd: number;
  completion_cost_usd: number;
  total_cost_usd: number;
  advisor_id: string;
  advisor_name: string;
  conversation_id: string;
  customer_phone: string;
  customer_name: string | null;
  created_at: string;
}

interface RagUsageStats {
  totalCount: number;
  totalCost: number;
  totalEmbeddingCost: number;
  totalCompletionCost: number;
  totalChunksUsed: number;
  foundCount: number;
  notFoundCount: number;
  avgChunksUsed: number;
}

interface RagUsageResponse {
  records: RagUsageRecord[];
  stats: RagUsageStats;
}

export default function InvestmentControlPanel() {
  const [activeTab, setActiveTab] = useState<'templates' | 'rag'>('templates');
  const [data, setData] = useState<TemplateUsageResponse | null>(null);
  const [ragData, setRagData] = useState<RagUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAdvisor, setSelectedAdvisor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplateUsage();
    } else {
      fetchRagUsage();
    }
  }, [startDate, endDate, selectedAdvisor, selectedStatus, currentPage, activeTab]);

  const fetchTemplateUsage = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      if (selectedAdvisor) params.append('advisorId', selectedAdvisor);
      if (selectedStatus) params.append('status', selectedStatus);

      params.append('limit', recordsPerPage.toString());
      params.append('offset', ((currentPage - 1) * recordsPerPage).toString());

      const response = await fetch(apiUrl(`/api/crm/metrics/template-usage?${params.toString()}`), {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar datos de inversión');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching template usage:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const fetchRagUsage = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      if (selectedAdvisor) params.append('advisorId', selectedAdvisor);

      params.append('limit', recordsPerPage.toString());
      params.append('offset', ((currentPage - 1) * recordsPerPage).toString());

      const response = await fetch(apiUrl(`/api/crm/metrics/rag-usage?${params.toString()}`), {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar datos de RAG');
      }

      const result = await response.json();
      setRagData(result);
    } catch (err) {
      console.error('Error fetching RAG usage:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAdvisor('');
    setSelectedStatus('');
    setCurrentPage(1);
  };

  const openConversation = (conversationId: string) => {
    // Open conversation in new window
    const baseUrl = window.location.origin;
    window.open(`${baseUrl}/crm?conversation=${conversationId}`, '_blank');
  };

  const formatDate = (dateStr: string | number) => {
    // Handle both timestamp numbers and ISO strings
    let date: Date;
    if (typeof dateStr === 'number') {
      date = new Date(dateStr);
    } else {
      // If it's a string without 'Z', assume it's UTC and add 'Z'
      const cleanStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
      date = new Date(cleanStr);
    }

    return new Intl.DateTimeFormat('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Lima'
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return 'N/A';

    // Normalizar: remover espacios, guiones, paréntesis
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Si no empieza con +, agregarlo
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    // Remover el + temporalmente para contar dígitos
    const digits = cleaned.replace('+', '');

    // Caso 1: Número con código país +51 (12 dígitos totales = 2 + 9)
    if (cleaned.startsWith('+51') && digits.length === 11) {
      // +51 961 842 916
      return `+51 ${digits.substring(2, 5)} ${digits.substring(5, 8)} ${digits.substring(8)}`;
    }

    // Caso 2: Número sin código país (10 dígitos = solo 51 + 9)
    if (digits.length === 10 && digits.startsWith('51')) {
      // 5116193636 -> +51 161 936 36
      return `+51 ${digits.substring(2, 5)} ${digits.substring(5, 8)} ${digits.substring(8)}`;
    }

    // Caso 3: Número sin código país (9 dígitos)
    if (digits.length === 9) {
      // 961842916 -> +51 961 842 916
      return `+51 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
    }

    // Formato genérico para otros casos
    return cleaned;
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      MARKETING: 'bg-purple-100 text-purple-700 border-purple-300',
      UTILITY: 'bg-blue-100 text-blue-700 border-blue-300',
      AUTHENTICATION: 'bg-green-100 text-green-700 border-green-300'
    };

    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getStatusBadge = (status: string) => {
    return status === 'sent'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : 'bg-red-100 text-red-700 border-red-300';
  };

  // Get unique advisors from data
  const uniqueAdvisors = React.useMemo(() => {
    if (!data) return [];
    const advisors = new Set(data.records.map(r => JSON.stringify({ id: r.advisor_id, name: r.advisor_name })));
    return Array.from(advisors).map(a => JSON.parse(a));
  }, [data]);

  const totalPages = activeTab === 'templates'
    ? (data ? Math.ceil(data.stats.totalCount / recordsPerPage) : 1)
    : (ragData ? Math.ceil(ragData.stats.totalCount / recordsPerPage) : 1);

  const totalCount = activeTab === 'templates'
    ? (data ? data.stats.totalCount : 0)
    : (ragData ? ragData.stats.totalCount : 0);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header - Everything in ONE LINE */}
      <div className="bg-white border-b border-slate-200 shadow-sm px-8 py-5">
        <div className="flex items-center gap-4">
          {/* Title with icon - Fixed width */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-2 shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent whitespace-nowrap">
                Control de Inversión
              </h1>
            </div>
          </div>

          {/* Filters - Compact in center */}
          <div className="flex items-end gap-2 flex-1">
            <div className="w-32">
              <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="w-32">
              <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="w-40">
              <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Asesor</label>
              <select
                value={selectedAdvisor}
                onChange={(e) => { setSelectedAdvisor(e.target.value); setCurrentPage(1); }}
                className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {uniqueAdvisors.map(advisor => (
                  <option key={advisor.id} value={advisor.id}>{advisor.name}</option>
                ))}
              </select>
            </div>
            {activeTab === 'templates' && (
              <div className="w-28">
                <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Estado</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="sent">Enviadas</option>
                  <option value="failed">Fallidas</option>
                </select>
              </div>
            )}
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedAdvisor('');
                setSelectedStatus('');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition-colors border border-slate-300"
            >
              Limpiar
            </button>
          </div>

          {/* Stats cards - Compact on the right */}
          {activeTab === 'templates' && data && (
            <div className="flex gap-2 flex-shrink-0">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg px-3 py-2 border border-emerald-200">
                <div className="text-[10px] font-semibold text-emerald-700 uppercase">Enviadas</div>
                <div className="text-lg font-bold text-emerald-900">{data.stats.sentCount}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg px-3 py-2 border border-purple-200">
                <div className="text-[10px] font-semibold text-purple-700 uppercase">Inversión</div>
                <div className="text-lg font-bold text-purple-900">{formatCurrency(data.stats.sentCost)}</div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg px-3 py-2 border border-red-200">
                <div className="text-[10px] font-semibold text-red-700 uppercase">Fallidas</div>
                <div className="text-lg font-bold text-red-900">{data.stats.failedCount}</div>
              </div>
            </div>
          )}
          {activeTab === 'rag' && ragData && (
            <div className="flex gap-2 flex-shrink-0">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg px-3 py-2 border border-blue-200">
                <div className="text-[10px] font-semibold text-blue-700 uppercase">Búsquedas</div>
                <div className="text-lg font-bold text-blue-900">{ragData.stats.totalCount}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg px-3 py-2 border border-emerald-200">
                <div className="text-[10px] font-semibold text-emerald-700 uppercase">Encontradas</div>
                <div className="text-lg font-bold text-emerald-900">{ragData.stats.foundCount}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg px-3 py-2 border border-purple-200">
                <div className="text-[10px] font-semibold text-purple-700 uppercase">Costo</div>
                <div className="text-lg font-bold text-purple-900">{formatCurrency(ragData.stats.totalCost)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-8">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('templates'); setCurrentPage(1); }}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Plantillas WhatsApp
          </button>
          <button
            onClick={() => { setActiveTab('rag'); setCurrentPage(1); }}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'rag'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            RAG / Inteligencia Artificial
          </button>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-red-700 font-semibold mb-2">Error al cargar datos</div>
            <div className="text-red-600 text-sm">{error}</div>
          </div>
        ) : activeTab === 'templates' && data && data.records.length > 0 ? (
          <>
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Asesor</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Plantilla</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Número Envío</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Campaña</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Costo</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Chat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{record.advisor_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900 font-medium">{record.template_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getCategoryBadge(record.template_category)}`}>
                            {record.template_category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900">{record.customer_name || record.customer_phone}</div>
                          {record.customer_name && (
                            <div className="text-xs text-slate-500">{record.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.sending_display_number ? (
                            <div className="text-sm font-medium text-emerald-700">
                              {formatPhoneNumber(record.sending_display_number)}
                            </div>
                          ) : record.sending_phone_number_id ? (
                            <div className="text-xs text-slate-500 italic">
                              ID: {record.sending_phone_number_id}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">Sin número</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {record.campaign_id ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-blue-600 text-lg">📢</span>
                                <div className="text-sm font-semibold text-blue-700">{record.campaign_name}</div>
                              </div>
                              <div className="text-xs text-slate-600">
                                {record.campaign_total_sent} enviados • {formatCurrency(record.campaign_total_cost || 0)} total
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">Manual</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-purple-700">{formatCurrency(record.cost_usd)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(record.status)}`}>
                            {record.status === 'sent' ? 'Enviada' : 'Fallida'}
                          </span>
                          {record.error_message && (
                            <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={record.error_message}>
                              {record.error_message}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {formatDate(record.sent_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openConversation(record.conversation_id)}
                            className="text-purple-600 hover:text-purple-900 font-medium text-sm underline"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4">
                <div className="text-sm text-slate-600">
                  Página {currentPage} de {totalPages} ({totalCount} registros totales)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'rag' && ragData && ragData.records.length > 0 ? (
          <>
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Consulta</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Resultados</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Chunks</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Costo Embedding</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Costo LLM</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Costo Total</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Chat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ragData.records.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900 font-medium max-w-xs truncate" title={record.query}>
                            {record.query}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900">{record.customer_name || record.customer_phone}</div>
                          {record.customer_name && (
                            <div className="text-xs text-slate-500">{record.customer_phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-300">
                            {record.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                            record.found
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-amber-100 text-amber-700 border-amber-300'
                          }`}>
                            {record.found ? 'Encontrado' : 'No encontrado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-slate-700">{record.chunks_used}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-700">{formatCurrency(record.embedding_cost_usd)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-indigo-700">{formatCurrency(record.completion_cost_usd)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-purple-700">{formatCurrency(record.total_cost_usd)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {formatDate(record.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.conversation_id ? (
                            <button
                              onClick={() => openConversation(record.conversation_id)}
                              className="text-purple-600 hover:text-purple-900 font-medium text-sm underline"
                            >
                              Abrir
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4">
                <div className="text-sm text-slate-600">
                  Página {currentPage} de {totalPages} ({totalCount} registros totales)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
            <div className="text-slate-400 text-6xl mb-4">📊</div>
            <div className="text-slate-600 font-semibold text-lg mb-2">No hay datos disponibles</div>
            <div className="text-slate-500 text-sm">Aún no se han registrado plantillas enviadas o prueba ajustando los filtros</div>
          </div>
        )}
      </div>
    </div>
  );
}
