import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/apiBase";
import { IAAgentFiles } from "./IAAgentFiles";
import { RAGAdmin } from "./RAGAdmin";
import { KeywordTracking } from "./KeywordTracking";
import { PersonalityConfig } from "./PersonalityConfig";
import { CampaignMetrics } from "./CampaignMetrics";

interface Queue {
  id: string;
  name: string;
}

interface IAAgentConfig {
  agentName: string;
  model: string;
  temperature: number;
  maxTokens: number;
  personality: {
    tone: string;
    emojiUsage: string;
    region: string;
    presentsAs: string;
  };
  systemPrompt: string;
  catalogs: Record<string, any>;
  catalogBehavior: {
    sendMode: string;
    groupedSending: boolean;
    delayBetweenFiles: number;
  };
  transferRules: {
    sales: {
      queueId: string;
      queueName: string;
      keywords: string[];
      message: string;
      enabled: boolean;
    };
    support: {
      queueId: string;
      queueName: string;
      keywords: string[];
      message: string;
      enabled: boolean;
    };
  };
  leadQualification: {
    enabled: boolean;
    questions: {
      askName: boolean;
      askLocation: boolean;
      askBusinessType: boolean;
      askQuantity: boolean;
      askBudget: boolean;
    };
  };
  businessHours: {
    timezone: string;
    defaultSchedule: {
      days: number[];
      startTime: string;
      endTime: string;
    };
    outOfHoursMessage: string;
    outOfHoursBehavior: string;
  };
  advancedSettings: {
    messageGrouping: {
      enabled: boolean;
      timeoutSeconds: number;
    };
    conversationMemory: {
      enabled: boolean;
      maxMessages: number;
      saveToBitrix: boolean;
      rememberPreviousConversations: boolean;
    };
    sentimentDetection: {
      enabled: boolean;
      onFrustratedAction: string;
    };
    maxInteractionsBeforeSuggestHuman: number;
    fallbackResponse: string;
  };
  integrations: {
    bitrix24: {
      enabled: boolean;
      autoCreateContact: boolean;
      updateContactInfo: boolean;
      logInteractions: boolean;
      fieldsToSave: Record<string, boolean>;
    };
    knowledgeBase: {
      enabled: boolean;
      documents: any[];
    };
  };
  version: string;
  lastUpdated: string;
}

export function IAAgentConfig() {
  const [config, setConfig] = useState<IAAgentConfig | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'personality' | 'files' | 'rag' | 'keywords' | 'campaigns' | 'transfer' | 'advanced'>('general');

  useEffect(() => {
    loadConfig();
    loadQueues();
  }, []);

  async function loadQueues() {
    try {
      const response = await fetch(apiUrl("/api/admin/queues"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setQueues(data.queues || []);
      }
    } catch (error) {
      console.error("Failed to load queues:", error);
    }
  }

  async function loadConfig() {
    try {
      const response = await fetch(apiUrl("/api/ia-agent-config"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to load IA Agent config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(apiUrl("/api/ia-agent-config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });

      if (response.ok) {
        await loadConfig();
        alert("✅ Configuración del agente guardada exitosamente");
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.error || 'Error al guardar'}`);
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("❌ Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6">Cargando configuración...</div>;
  }

  if (!config) {
    return <div className="p-6">No se pudo cargar la configuración</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Configuración del Agente IA</h1>
        <p className="text-gray-600">
          Configura el agente virtual inteligente con herramientas y capacidades avanzadas
        </p>
        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Activación:</strong> El agente se activa cuando asignas el flujo "PROMOTORAS V3" a un número de WhatsApp en <strong>Configuración → WhatsApp → Números & Colas</strong>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'general'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('personality')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'personality'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ✨ Personalidad
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'files'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📁 Archivos
        </button>
        <button
          onClick={() => setActiveTab('rag')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'rag'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🧠 RAG
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'keywords'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Keywords
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'campaigns'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🎯 Campañas
        </button>
        <button
          onClick={() => setActiveTab('transfer')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'transfer'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Transferencias
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'advanced'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Avanzado
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Configuración del Modelo */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Configuración del Modelo</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del Agente</label>
                <input
                  type="text"
                  value={config.agentName}
                  onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Asistente Virtual Azaleia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Modelo</label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Temperatura</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = más preciso, 2 = más creativo</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Máx. Tokens</label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    step="100"
                    value={config.maxTokens}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Longitud máxima de respuesta</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Prompt del Sistema</h2>
            <p className="text-sm text-gray-600 mb-3">
              Define cómo debe comportarse el agente y qué instrucciones seguir
            </p>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
              placeholder="Eres el asistente virtual..."
            />
          </div>

          {/* Horario de Atención */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Horario de Atención</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Hora de Inicio</label>
                  <input
                    type="time"
                    value={config.businessHours.defaultSchedule.startTime}
                    onChange={(e) => setConfig({
                      ...config,
                      businessHours: {
                        ...config.businessHours,
                        defaultSchedule: {
                          ...config.businessHours.defaultSchedule,
                          startTime: e.target.value
                        }
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Hora de Fin</label>
                  <input
                    type="time"
                    value={config.businessHours.defaultSchedule.endTime}
                    onChange={(e) => setConfig({
                      ...config,
                      businessHours: {
                        ...config.businessHours,
                        defaultSchedule: {
                          ...config.businessHours.defaultSchedule,
                          endTime: e.target.value
                        }
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mensaje Fuera de Horario</label>
                <textarea
                  value={config.businessHours.outOfHoursMessage}
                  onChange={(e) => setConfig({
                    ...config,
                    businessHours: {
                      ...config.businessHours,
                      outOfHoursMessage: e.target.value
                    }
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Mensaje cuando no hay agentes disponibles..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Personality Tab */}
      {activeTab === 'personality' && (
        <PersonalityConfig />
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <IAAgentFiles />
      )}

      {/* RAG Tab */}
      {activeTab === 'rag' && (
        <RAGAdmin />
      )}

      {/* Keywords Tab */}
      {activeTab === 'keywords' && (
        <KeywordTracking />
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <CampaignMetrics />
      )}

      {/* Transfer Tab */}
      {activeTab === 'transfer' && (
        <div className="space-y-6">
          {/* Sales Transfer */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Transferencia a Ventas</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.transferRules.sales.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    transferRules: {
                      ...config.transferRules,
                      sales: {
                        ...config.transferRules.sales,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Habilitado</span>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cola de Ventas</label>
                <select
                  value={config.transferRules.sales.queueId}
                  onChange={(e) => {
                    const selectedQueue = queues.find(q => q.id === e.target.value);
                    setConfig({
                      ...config,
                      transferRules: {
                        ...config.transferRules,
                        sales: {
                          ...config.transferRules.sales,
                          queueId: e.target.value,
                          queueName: selectedQueue?.name || ''
                        }
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Seleccionar cola...</option>
                  {queues.map(queue => (
                    <option key={queue.id} value={queue.id}>
                      {queue.name}
                    </option>
                  ))}
                </select>
                {config.transferRules.sales.queueId && (
                  <p className="text-xs text-gray-500 mt-1">ID: {config.transferRules.sales.queueId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Palabras Clave (separadas por coma)</label>
                <textarea
                  value={config.transferRules.sales.keywords.join(', ')}
                  onChange={(e) => setConfig({
                    ...config,
                    transferRules: {
                      ...config.transferRules,
                      sales: {
                        ...config.transferRules.sales,
                        keywords: e.target.value.split(',').map(k => k.trim())
                      }
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="pedido, comprar, precio mayorista..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mensaje de Transferencia</label>
                <textarea
                  value={config.transferRules.sales.message}
                  onChange={(e) => setConfig({
                    ...config,
                    transferRules: {
                      ...config.transferRules,
                      sales: {
                        ...config.transferRules.sales,
                        message: e.target.value
                      }
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Te conecto con un asesor de ventas..."
                />
              </div>
            </div>
          </div>

          {/* Support Transfer */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Transferencia a Soporte</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.transferRules.support.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    transferRules: {
                      ...config.transferRules,
                      support: {
                        ...config.transferRules.support,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Habilitado</span>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cola de Soporte</label>
                <select
                  value={config.transferRules.support.queueId}
                  onChange={(e) => {
                    const selectedQueue = queues.find(q => q.id === e.target.value);
                    setConfig({
                      ...config,
                      transferRules: {
                        ...config.transferRules,
                        support: {
                          ...config.transferRules.support,
                          queueId: e.target.value,
                          queueName: selectedQueue?.name || ''
                        }
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Seleccionar cola...</option>
                  {queues.map(queue => (
                    <option key={queue.id} value={queue.id}>
                      {queue.name}
                    </option>
                  ))}
                </select>
                {config.transferRules.support.queueId && (
                  <p className="text-xs text-gray-500 mt-1">ID: {config.transferRules.support.queueId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Palabras Clave (separadas por coma)</label>
                <textarea
                  value={config.transferRules.support.keywords.join(', ')}
                  onChange={(e) => setConfig({
                    ...config,
                    transferRules: {
                      ...config.transferRules,
                      support: {
                        ...config.transferRules.support,
                        keywords: e.target.value.split(',').map(k => k.trim())
                      }
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="cambio, devolución, garantía, reclamo..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mensaje de Transferencia</label>
                <textarea
                  value={config.transferRules.support.message}
                  onChange={(e) => setConfig({
                    ...config,
                    transferRules: {
                      ...config.transferRules,
                      support: {
                        ...config.transferRules.support,
                        message: e.target.value
                      }
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Te conecto con atención al cliente..."
                />
              </div>
            </div>
          </div>

          {/* Lead Qualification */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Calificación de Leads</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.leadQualification.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    leadQualification: {
                      ...config.leadQualification,
                      enabled: e.target.checked
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Habilitado</span>
              </label>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Cuando está habilitado, el agente recopilará información del cliente antes de transferir
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.leadQualification.questions.askName}
                  onChange={(e) => setConfig({
                    ...config,
                    leadQualification: {
                      ...config.leadQualification,
                      questions: {
                        ...config.leadQualification.questions,
                        askName: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Preguntar nombre</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.leadQualification.questions.askLocation}
                  onChange={(e) => setConfig({
                    ...config,
                    leadQualification: {
                      ...config.leadQualification,
                      questions: {
                        ...config.leadQualification.questions,
                        askLocation: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Preguntar ubicación</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.leadQualification.questions.askBusinessType}
                  onChange={(e) => setConfig({
                    ...config,
                    leadQualification: {
                      ...config.leadQualification,
                      questions: {
                        ...config.leadQualification.questions,
                        askBusinessType: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Preguntar tipo de negocio</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.leadQualification.questions.askQuantity}
                  onChange={(e) => setConfig({
                    ...config,
                    leadQualification: {
                      ...config.leadQualification,
                      questions: {
                        ...config.leadQualification.questions,
                        askQuantity: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Preguntar cantidad aproximada</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.leadQualification.questions.askBudget}
                  onChange={(e) => setConfig({
                    ...config,
                    leadQualification: {
                      ...config.leadQualification,
                      questions: {
                        ...config.leadQualification.questions,
                        askBudget: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Preguntar presupuesto</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          {/* Conversation Memory */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Memoria de Conversación</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.advancedSettings.conversationMemory.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      conversationMemory: {
                        ...config.advancedSettings.conversationMemory,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Habilitar memoria de conversación</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">Máximo de mensajes en memoria</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={config.advancedSettings.conversationMemory.maxMessages}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      conversationMemory: {
                        ...config.advancedSettings.conversationMemory,
                        maxMessages: parseInt(e.target.value)
                      }
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.advancedSettings.conversationMemory.saveToBitrix}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      conversationMemory: {
                        ...config.advancedSettings.conversationMemory,
                        saveToBitrix: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Guardar en Bitrix24</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.advancedSettings.conversationMemory.rememberPreviousConversations}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      conversationMemory: {
                        ...config.advancedSettings.conversationMemory,
                        rememberPreviousConversations: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Recordar conversaciones previas</span>
              </label>
            </div>
          </div>

          {/* Message Grouping */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Agrupación de Mensajes</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.advancedSettings.messageGrouping.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      messageGrouping: {
                        ...config.advancedSettings.messageGrouping,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Agrupar múltiples mensajes del cliente</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">Timeout (segundos)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={config.advancedSettings.messageGrouping.timeoutSeconds}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      messageGrouping: {
                        ...config.advancedSettings.messageGrouping,
                        timeoutSeconds: parseFloat(e.target.value)
                      }
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Espera este tiempo antes de procesar para agrupar mensajes rápidos
                </p>
              </div>
            </div>
          </div>

          {/* Sentiment Detection */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Detección de Sentimiento</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.advancedSettings.sentimentDetection.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      sentimentDetection: {
                        ...config.advancedSettings.sentimentDetection,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Detectar frustración del cliente</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">Acción cuando detecta frustración</label>
                <select
                  value={config.advancedSettings.sentimentDetection.onFrustratedAction}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      sentimentDetection: {
                        ...config.advancedSettings.sentimentDetection,
                        onFrustratedAction: e.target.value
                      }
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="transfer_supervisor">Transferir a supervisor</option>
                  <option value="transfer_queue">Transferir a cola de soporte</option>
                  <option value="empathize">Mostrar empatía y continuar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fallback */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Respuestas de Fallback</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Máximo de interacciones antes de sugerir humano
                </label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={config.advancedSettings.maxInteractionsBeforeSuggestHuman}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      maxInteractionsBeforeSuggestHuman: parseInt(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Respuesta de fallback</label>
                <textarea
                  value={config.advancedSettings.fallbackResponse}
                  onChange={(e) => setConfig({
                    ...config,
                    advancedSettings: {
                      ...config.advancedSettings,
                      fallbackResponse: e.target.value
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Cuando el agente no puede ayudar..."
                />
              </div>
            </div>
          </div>

          {/* Bitrix24 Integration */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Integración con Bitrix24</h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.integrations.bitrix24.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    integrations: {
                      ...config.integrations,
                      bitrix24: {
                        ...config.integrations.bitrix24,
                        enabled: e.target.checked
                      }
                    }
                  })}
                  className="w-5 h-5"
                />
                <span>Habilitado</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.integrations.bitrix24.autoCreateContact}
                  onChange={(e) => setConfig({
                    ...config,
                    integrations: {
                      ...config.integrations,
                      bitrix24: {
                        ...config.integrations.bitrix24,
                        autoCreateContact: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Crear contacto automáticamente</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.integrations.bitrix24.updateContactInfo}
                  onChange={(e) => setConfig({
                    ...config,
                    integrations: {
                      ...config.integrations,
                      bitrix24: {
                        ...config.integrations.bitrix24,
                        updateContactInfo: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Actualizar información del contacto</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.integrations.bitrix24.logInteractions}
                  onChange={(e) => setConfig({
                    ...config,
                    integrations: {
                      ...config.integrations,
                      bitrix24: {
                        ...config.integrations.bitrix24,
                        logInteractions: e.target.checked
                      }
                    }
                  })}
                  className="w-4 h-4"
                />
                <span>Registrar interacciones en timeline</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-6 border-t">
        <button
          onClick={loadConfig}
          disabled={saving}
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Descartar Cambios
        </button>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
