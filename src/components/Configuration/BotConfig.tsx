import { useState, useEffect } from "react";
import { apiUrl, apiFetch } from "../../lib/apiBase";

interface BotConfig {
  perFlowConfig: Record<string, { botTimeout: number; fallbackQueue: string }>;
}

interface Queue {
  id: string;
  name: string;
}

interface Flow {
  id: string;
  name: string;
}

export function BotConfig() {
  const [config, setConfig] = useState<BotConfig>({
    perFlowConfig: {},
  });
  const [queues, setQueues] = useState<Queue[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load bot config
      const configRes = await apiFetch("/api/admin/bot-config", {
        credentials: "include",
      });
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig({ perFlowConfig: data.perFlowConfig || {} });
      }

      // Load queues
      const queuesRes = await apiFetch("/api/admin/queues", {
        credentials: "include",
      });
      if (queuesRes.ok) {
        const queuesData = await queuesRes.json();
        // Handle both formats: array directly or { queues: [...] }
        const queuesArray = Array.isArray(queuesData) ? queuesData : (queuesData.queues || []);
        setQueues(queuesArray);
      }

      // Load flows
      const flowsRes = await apiFetch("/api/flows", {
        credentials: "include",
      });
      if (flowsRes.ok) {
        const flowsData = await flowsRes.json();
        // Handle both formats: { flows: [...] } or direct array
        const flowsArray = Array.isArray(flowsData) ? flowsData : (flowsData.flows || []);
        setFlows(flowsArray.map((f: any) => ({ id: f.id, name: f.name })));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      showMessage('error', 'Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/api/admin/bot-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });

      if (response.ok) {
        showMessage('success', 'Configuración guardada exitosamente');
      } else {
        showMessage('error', 'Error al guardar la configuración');
      }
    } catch (error) {
      console.error("Error saving config:", error);
      showMessage('error', 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const addFlowConfig = (flowId: string) => {
    setConfig((prev) => ({
      ...prev,
      perFlowConfig: {
        ...prev.perFlowConfig,
        [flowId]: {
          botTimeout: 30,
          fallbackQueue: queues.length > 0 ? queues[0].id : "",
        },
      },
    }));
  };

  const removeFlowConfig = (flowId: string) => {
    setConfig((prev) => {
      const { [flowId]: removed, ...rest } = prev.perFlowConfig;
      return { ...prev, perFlowConfig: rest };
    });
  };

  const updateFlowConfig = (flowId: string, field: 'botTimeout' | 'fallbackQueue', value: number | string) => {
    setConfig((prev) => ({
      ...prev,
      perFlowConfig: {
        ...prev.perFlowConfig,
        [flowId]: {
          ...prev.perFlowConfig[flowId],
          [field]: value,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const availableFlows = flows.filter((f) => !config.perFlowConfig[f.id]);
  const configuredFlows = Object.keys(config.perFlowConfig);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">🤖 Configuración del Bot</h2>
        <p className="mt-2 text-sm text-slate-600">
          Configura el tiempo máximo que el bot puede atender una conversación antes de transferir a un humano.
        </p>
      </div>

      {message && (
        <div className={`mb-6 rounded-lg p-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Flow Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Configuración por Flujo</h3>
            <p className="text-sm text-slate-600 mt-1">
              Configura el timeout del bot para cada flujo de WhatsApp.
            </p>
          </div>

          {availableFlows.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addFlowConfig(e.target.value);
                  e.target.value = "";
                }
              }}
              className="rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            >
              <option value="">+ Agregar flujo</option>
              {availableFlows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {configuredFlows.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-slate-600 font-medium mb-2">No hay flujos configurados</p>
            <p className="text-sm text-slate-500">
              Agrega un flujo arriba para configurar su timeout
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {configuredFlows.map((flowId) => {
              const flow = flows.find((f) => f.id === flowId);
              const flowConfig = config.perFlowConfig[flowId];
              return (
                <div key={flowId} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:border-slate-300 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900">{flow?.name || flowId}</h4>
                      <p className="text-xs text-slate-500 mt-1">{flowId}</p>
                    </div>
                    <button
                      onClick={() => removeFlowConfig(flowId)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded transition"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Timeout (minutos)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={flowConfig.botTimeout}
                        onChange={(e) => updateFlowConfig(flowId, 'botTimeout', parseInt(e.target.value) || 30)}
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        De 5 a 120 minutos
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Cola de derivación
                      </label>
                      <select
                        value={flowConfig.fallbackQueue}
                        onChange={(e) => updateFlowConfig(flowId, 'fallbackQueue', e.target.value)}
                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                      >
                        <option value="">Selecciona una cola</option>
                        {queues.map((queue) => (
                          <option key={queue.id} value={queue.id}>
                            {queue.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        A dónde se deriva al exceder el tiempo
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={loadData}
          disabled={saving}
          className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || configuredFlows.length === 0}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      {/* Help Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Cómo funciona</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• El bot atiende al cliente hasta que se exceda el tiempo configurado</li>
          <li>• Cuando se excede el tiempo, el chat se transfiere automáticamente a la cola seleccionada</li>
          <li>• Si hay un asesor disponible en esa cola, se le asigna automáticamente</li>
          <li>• Debes configurar TODOS los flujos que uses para que el timeout funcione</li>
        </ul>
      </div>
    </div>
  );
}
