import { useState, useEffect } from 'react';
import { authFetch } from '../lib/apiBase';

interface ConversationSummary {
  id: string;
  phone: string;
  contactName?: string;
  date: string;
  messageCount: number;
  duration: string;
  summary?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  topics?: string[];
  keywords?: string[];
  analyzing: boolean;
}

interface DayGroup {
  date: string;
  conversations: ConversationSummary[];
  totalConversations: number;
  avgDuration: string;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export default function AIAnalyticsPanel() {
  const [loading, setLoading] = useState(true);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadConversations();
  }, [dateRange]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/api/crm/conversations/analytics?from=${dateRange.from}&to=${dateRange.to}`);

      if (response.ok) {
        const data = await response.json();
        setDayGroups(data.dayGroups || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeConversation = async (conversationId: string) => {
    try {
      // Update UI to show analyzing state
      setDayGroups(prev => prev.map(day => ({
        ...day,
        conversations: day.conversations.map(conv =>
          conv.id === conversationId ? { ...conv, analyzing: true } : conv
        )
      })));

      const response = await authFetch(`/api/crm/conversations/${conversationId}/analyze`, {
        method: 'POST'
      });

      if (response.ok) {
        const analysis = await response.json();

        // Update conversation with analysis
        setDayGroups(prev => prev.map(day => ({
          ...day,
          conversations: day.conversations.map(conv =>
            conv.id === conversationId
              ? {
                  ...conv,
                  analyzing: false,
                  summary: analysis.summary,
                  sentiment: analysis.sentiment,
                  topics: analysis.topics,
                  keywords: analysis.keywords
                }
              : conv
          )
        })));
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
    }
  };

  const analyzeAllInDay = async (date: string) => {
    setAnalyzingAll(true);
    const dayGroup = dayGroups.find(d => d.date === date);
    if (!dayGroup) return;

    for (const conv of dayGroup.conversations) {
      if (!conv.summary) {
        await analyzeConversation(conv.id);
      }
    }
    setAnalyzingAll(false);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50';
      case 'negative': return 'text-red-600 bg-red-50';
      case 'neutral': return 'text-slate-600 bg-slate-50';
      default: return 'text-slate-400 bg-slate-50';
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-slate-600">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  const selectedDayData = dayGroups.find(d => d.date === selectedDay);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header with filters */}
      <div className="bg-white border-b border-slate-200 p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              🤖 Analytics con IA
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Análisis automático de conversaciones con resúmenes inteligentes
            </p>
          </div>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Desde:</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Hasta:</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <button
            onClick={loadConversations}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium rounded-lg hover:shadow-lg transition-all"
          >
            🔍 Buscar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left sidebar - Days list */}
        <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-2">
            {dayGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-sm">No hay conversaciones en este rango</p>
              </div>
            ) : (
              dayGroups.map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day.date)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedDay === day.date
                      ? 'border-orange-500 bg-orange-50 shadow-md'
                      : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800">
                      📅 {new Date(day.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-blue-600 font-bold text-lg">{day.totalConversations}</div>
                      <div className="text-blue-600">Chats</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-green-600 font-bold text-lg">
                        {day.sentimentDistribution.positive}
                      </div>
                      <div className="text-green-600">😊</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-red-600 font-bold text-lg">
                        {day.sentimentDistribution.negative}
                      </div>
                      <div className="text-red-600">😞</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    ⏱️ Duración promedio: {day.avgDuration}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Conversation details */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDayData ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <p className="text-6xl mb-4">📊</p>
                <p className="text-lg font-medium mb-2">Selecciona un día</p>
                <p className="text-sm">Elige un día de la lista para ver el análisis detallado</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Day header with analyze all button */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-800">
                    Conversaciones del {new Date(selectedDayData.date).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </h3>
                  <button
                    onClick={() => analyzeAllInDay(selectedDayData.date)}
                    disabled={analyzingAll}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {analyzingAll ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Analizando...
                      </>
                    ) : (
                      <>
                        🤖 Analizar todas
                      </>
                    )}
                  </button>
                </div>

                {/* Day stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <div className="text-blue-600 text-3xl font-bold">{selectedDayData.totalConversations}</div>
                    <div className="text-blue-700 text-sm font-medium">Total de chats</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <div className="text-green-600 text-3xl font-bold flex items-center gap-2">
                      {selectedDayData.sentimentDistribution.positive} 😊
                    </div>
                    <div className="text-green-700 text-sm font-medium">Positivos</div>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4">
                    <div className="text-slate-600 text-3xl font-bold flex items-center gap-2">
                      {selectedDayData.sentimentDistribution.neutral} 😐
                    </div>
                    <div className="text-slate-700 text-sm font-medium">Neutrales</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4">
                    <div className="text-red-600 text-3xl font-bold flex items-center gap-2">
                      {selectedDayData.sentimentDistribution.negative} 😞
                    </div>
                    <div className="text-red-700 text-sm font-medium">Negativos</div>
                  </div>
                </div>
              </div>

              {/* Conversations list */}
              {selectedDayData.conversations.map((conv) => (
                <div key={conv.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  {/* Conversation header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white font-bold">
                          {conv.contactName?.[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800">{conv.contactName || 'Sin nombre'}</h4>
                            <button
                              onClick={() => {
                                // Save conversation ID in sessionStorage for CRM to open
                                sessionStorage.setItem('crm_open_conversation', conv.id);
                                // Navigate to CRM by reloading with hash
                                window.location.href = '/?tab=crm';
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                              title="Abrir chat completo en CRM"
                            >
                              💬 Ver chat
                            </button>
                          </div>
                          <p className="text-sm text-slate-600">{conv.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>💬 {conv.messageCount} mensajes</span>
                        <span>⏱️ {conv.duration}</span>
                        <span>🕐 {new Date(conv.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Sentiment badge */}
                    {conv.sentiment && (
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getSentimentColor(conv.sentiment)}`}>
                        {getSentimentIcon(conv.sentiment)} {conv.sentiment === 'positive' ? 'Positivo' : conv.sentiment === 'negative' ? 'Negativo' : 'Neutral'}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {conv.analyzing ? (
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent mb-2"></div>
                      <p className="text-sm text-orange-700 font-medium">Analizando conversación con IA...</p>
                    </div>
                  ) : conv.summary ? (
                    <div className="space-y-3">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <h5 className="text-xs font-semibold text-slate-700 uppercase mb-2">📝 Resumen</h5>
                        <p className="text-sm text-slate-700 leading-relaxed">{conv.summary}</p>
                      </div>

                      {/* Topics */}
                      {conv.topics && conv.topics.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-700 uppercase mb-2">🏷️ Temas principales</h5>
                          <div className="flex flex-wrap gap-2">
                            {conv.topics.map((topic, idx) => (
                              <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Keywords */}
                      {conv.keywords && conv.keywords.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-700 uppercase mb-2">🔑 Palabras clave</h5>
                          <div className="flex flex-wrap gap-2">
                            {conv.keywords.map((keyword, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => analyzeConversation(conv.id)}
                      className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50 transition-all text-sm font-medium"
                    >
                      🤖 Analizar con IA
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
