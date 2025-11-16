import { useState, useEffect } from "react";
import { apiUrl, apiFetch } from "../../lib/apiBase";

interface AIConfigState {
  openai: { hasApiKey: boolean; baseUrl: string };
  anthropic: { hasApiKey: boolean; baseUrl: string };
  gemini: { hasApiKey: boolean; baseUrl: string };
  ollama: { baseUrl: string };
}

interface AnalyticsConfig {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  outputFormat: string;
}

export function AIConfig() {
  const [config, setConfig] = useState<AIConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // Analytics config state
  const [analyticsConfig, setAnalyticsConfig] = useState<AnalyticsConfig | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsSaving, setAnalyticsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    loadAnalyticsConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await apiFetch("/api/ai-config", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to load AI config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(provider: string) {
    setSaving(true);
    try {
      const response = await apiFetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
        }),
      });

      if (response.ok) {
        await loadConfig();
        setEditingProvider(null);
        setApiKey("");
        setBaseUrl("");
        alert("✅ Configuración guardada exitosamente");
      } else {
        alert("❌ Error al guardar la configuración");
      }
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("❌ Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(provider: string) {
    if (!confirm(`¿Estás seguro de eliminar la API key de ${provider}?`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/ai-config/${provider}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await loadConfig();
        alert("✅ API key eliminada");
      } else {
        alert("❌ Error al eliminar");
      }
    } catch (error) {
      console.error("Failed to delete config:", error);
      alert("❌ Error al eliminar");
    }
  }

  function startEditing(provider: string, currentBaseUrl: string) {
    setEditingProvider(provider);
    setApiKey("");
    setBaseUrl(currentBaseUrl);
  }

  // Analytics config functions
  async function loadAnalyticsConfig() {
    try {
      const response = await apiFetch("/api/ai-analytics-config", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAnalyticsConfig(data);
      }
    } catch (error) {
      console.error("Failed to load analytics config:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function saveAnalyticsConfig() {
    if (!analyticsConfig) return;

    setAnalyticsSaving(true);
    try {
      const response = await apiFetch("/api/ai-analytics-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(analyticsConfig),
      });

      if (response.ok) {
        alert("✅ Configuración de análisis guardada exitosamente");
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.message || 'Error al guardar'}`);
      }
    } catch (error) {
      console.error("Failed to save analytics config:", error);
      alert("❌ Error al guardar la configuración");
    } finally {
      setAnalyticsSaving(false);
    }
  }

  async function resetAnalyticsConfig() {
    if (!confirm("¿Estás seguro de restaurar la configuración por defecto?")) {
      return;
    }

    try {
      const response = await apiFetch("/api/ai-analytics-config/reset", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        await loadAnalyticsConfig();
        alert("✅ Configuración restaurada a valores por defecto");
      } else {
        alert("❌ Error al restaurar configuración");
      }
    } catch (error) {
      console.error("Failed to reset analytics config:", error);
      alert("❌ Error al restaurar configuración");
    }
  }

  if (loading) {
    return <div className="p-6">Cargando configuración de IA...</div>;
  }

  if (!config) {
    return <div className="p-6">Error al cargar la configuración</div>;
  }

  const providers = [
    {
      id: "openai",
      name: "OpenAI",
      icon: "🤖",
      color: "emerald",
      hasKey: config.openai.hasApiKey,
      baseUrl: config.openai.baseUrl,
      link: "https://platform.openai.com/api-keys",
      models: "GPT-4o, GPT-4, GPT-3.5-turbo",
    },
    {
      id: "anthropic",
      name: "Anthropic (Claude)",
      icon: "🧠",
      color: "violet",
      hasKey: config.anthropic.hasApiKey,
      baseUrl: config.anthropic.baseUrl,
      link: "https://console.anthropic.com/settings/keys",
      models: "Claude 3.5 Sonnet, Opus, Haiku",
    },
    {
      id: "gemini",
      name: "Google Gemini",
      icon: "✨",
      color: "blue",
      hasKey: config.gemini.hasApiKey,
      baseUrl: config.gemini.baseUrl,
      link: "https://aistudio.google.com/app/apikey",
      models: "Gemini 2.0, 1.5 Pro/Flash",
    },
    {
      id: "ollama",
      name: "Ollama (Local)",
      icon: "🦙",
      color: "slate",
      hasKey: true, // Ollama siempre está disponible si la URL es correcta
      baseUrl: config.ollama.baseUrl,
      link: "https://ollama.com",
      models: "Llama 3.3, Mistral, Qwen, etc.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-900">🤖 Configuración de IA</h3>
        <p className="mt-1 text-sm text-slate-600">
          Configura las API keys de los proveedores de IA para usar en tus flujos
        </p>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`rounded-xl border-2 p-5 transition ${
              provider.hasKey
                ? `border-${provider.color}-200 bg-${provider.color}-50`
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{provider.icon}</div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">{provider.name}</h4>
                  <p className="mt-1 text-xs text-slate-600">Modelos: {provider.models}</p>
                  {provider.hasKey && provider.id !== "ollama" && (
                    <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      ✓ Configurado
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {editingProvider === provider.id ? (
                  <>
                    <button
                      onClick={() => saveConfig(provider.id)}
                      disabled={saving}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saving ? "..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditingProvider(null)}
                      className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(provider.id, provider.baseUrl)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-${provider.color}-600 hover:bg-${provider.color}-700`}
                    >
                      {provider.hasKey && provider.id !== "ollama" ? "Actualizar" : "Configurar"}
                    </button>
                    {provider.hasKey && provider.id !== "ollama" && (
                      <button
                        onClick={() => deleteConfig(provider.id)}
                        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
                      >
                        Eliminar
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {editingProvider === provider.id && (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                {provider.id !== "ollama" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider.hasKey ? "Dejar vacío para mantener la actual" : "sk-..."}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Obtén tu API key en:{" "}
                      <a
                        href={provider.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {provider.link}
                      </a>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Base URL {provider.id === "ollama" ? "" : "(Opcional)"}
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={provider.baseUrl}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    {provider.id === "ollama"
                      ? "URL de tu instancia de Ollama (por defecto: http://localhost:11434)"
                      : "Solo cambia si usas un proxy o base URL personalizada"}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Cómo usar
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-blue-800">
            <li>• Configura al menos un proveedor para usar el nodo de IA RAG en tus flujos</li>
            <li>• Las API keys se guardan <strong>encriptadas</strong> en el servidor</li>
            <li>• En el canvas, agrega un nodo "IA RAG" y selecciona el proveedor configurado</li>
            <li>• Puedes usar múltiples proveedores simultáneamente en diferentes nodos</li>
          </ul>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
            📚 Guías de instalación
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <h5 className="text-xs font-bold text-emerald-800">OpenAI</h5>
              <p className="text-xs text-emerald-700 mt-1">
                1. Ve a <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com/api-keys</a><br/>
                2. Haz clic en "Create new secret key"<br/>
                3. Copia la API key y pégala arriba<br/>
                4. <strong>Más de 20 modelos</strong> disponibles (GPT-4o, GPT-4, o1, etc.)
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold text-violet-800">Anthropic (Claude)</h5>
              <p className="text-xs text-violet-700 mt-1">
                1. Ve a <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline">console.anthropic.com/settings/keys</a><br/>
                2. Haz clic en "Create Key"<br/>
                3. Copia la API key y pégala arriba<br/>
                4. <strong>Claude 3.5 Sonnet</strong> es el modelo más reciente y capaz
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold text-blue-800">Google Gemini</h5>
              <p className="text-xs text-blue-700 mt-1">
                1. Ve a <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">aistudio.google.com/app/apikey</a><br/>
                2. Haz clic en "Get API Key" → "Create API key"<br/>
                3. Copia la API key y pégala arriba<br/>
                4. <strong>Gemini 1.5 Pro</strong> tiene contexto de 2M tokens
              </p>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-800">Ollama (Local - Gratis)</h5>
              <p className="text-xs text-slate-700 mt-1">
                1. Descarga Ollama desde <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">ollama.com</a><br/>
                2. Instala y ejecuta: <code className="bg-slate-200 px-1 rounded">ollama serve</code><br/>
                3. Descarga un modelo: <code className="bg-slate-200 px-1 rounded">ollama pull llama3.3</code><br/>
                4. <strong>Más de 40 modelos</strong> locales sin costo (Llama, Mistral, Qwen, etc.)
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            💰 Comparativa de costos
          </h4>
          <div className="mt-2 space-y-1 text-xs text-amber-800">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Más económicos:</strong>
                <ul className="mt-1 ml-4 list-disc">
                  <li>GPT-4o Mini ($0.15/1M tokens)</li>
                  <li>Claude 3.5 Haiku ($0.25/1M tokens)</li>
                  <li>Gemini 1.5 Flash ($0.075/1M tokens)</li>
                  <li>Ollama: <strong>GRATIS</strong> (local)</li>
                </ul>
              </div>
              <div>
                <strong>Mejor calidad:</strong>
                <ul className="mt-1 ml-4 list-disc">
                  <li>GPT-4o ($2.50-$10/1M tokens)</li>
                  <li>Claude 3.5 Sonnet ($3/1M tokens)</li>
                  <li>Gemini 1.5 Pro ($1.25/1M tokens)</li>
                  <li>o1-preview ($15-$60/1M tokens)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* AI Analytics Configuration Section */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 border-2 border-purple-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-purple-900 flex items-center gap-3">
                🧠 Configuración de Análisis con IA
              </h3>
              <p className="text-sm text-purple-700 mt-1">
                Personaliza cómo la IA analiza y califica las conversaciones de tus clientes
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetAnalyticsConfig}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restaurar
              </button>
              <button
                onClick={saveAnalyticsConfig}
                disabled={analyticsSaving || !analyticsConfig}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-md flex items-center gap-2"
              >
                {analyticsSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="text-center py-8 text-purple-600">Cargando configuración...</div>
          ) : analyticsConfig ? (
            <div className="space-y-6">
              {/* System Prompt Editor */}
              <div>
                <label className="block text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Prompt del Sistema (Instrucciones para la IA)
                </label>
                <textarea
                  value={analyticsConfig.systemPrompt}
                  onChange={(e) => setAnalyticsConfig({ ...analyticsConfig, systemPrompt: e.target.value })}
                  className="w-full h-64 px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 font-mono text-sm resize-y"
                  placeholder="Escribe las instrucciones para la IA..."
                />
                <p className="text-xs text-purple-600 mt-2">
                  💡 <strong>Tip:</strong> Define claramente qué debe analizar la IA y en qué formato debe responder (preferiblemente JSON)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Temperature Slider */}
                <div>
                  <label className="block text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Temperatura: <span className="text-purple-600">{analyticsConfig.temperature.toFixed(1)}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={analyticsConfig.temperature}
                    onChange={(e) => setAnalyticsConfig({ ...analyticsConfig, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-purple-600 mt-1">
                    <span>Más preciso (0.0)</span>
                    <span>Más creativo (2.0)</span>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    🎯 <strong>0.0-0.3:</strong> Respuestas consistentes y deterministas<br/>
                    🎨 <strong>0.7-1.0:</strong> Más variadas y creativas<br/>
                    🎲 <strong>1.5-2.0:</strong> Muy creativas (puede ser impredecible)
                  </p>
                </div>

                {/* Max Tokens Slider */}
                <div>
                  <label className="block text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Máximo de Tokens: <span className="text-purple-600">{analyticsConfig.maxTokens}</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={analyticsConfig.maxTokens}
                    onChange={(e) => setAnalyticsConfig({ ...analyticsConfig, maxTokens: parseInt(e.target.value) })}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-purple-600 mt-1">
                    <span>Mínimo (50)</span>
                    <span>Máximo (2000)</span>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    📊 <strong>100-300:</strong> Resúmenes cortos<br/>
                    📝 <strong>500-1000:</strong> Análisis completo (recomendado)<br/>
                    📚 <strong>1000-2000:</strong> Análisis muy detallado
                  </p>
                </div>
              </div>

              {/* Output Format */}
              <div>
                <label className="block text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Formato de Salida Esperado (JSON Schema)
                </label>
                <textarea
                  value={analyticsConfig.outputFormat}
                  onChange={(e) => setAnalyticsConfig({ ...analyticsConfig, outputFormat: e.target.value })}
                  className="w-full h-32 px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 font-mono text-sm resize-y bg-slate-50"
                  placeholder='{"campo": "tipo", ...}'
                />
                <p className="text-xs text-purple-600 mt-2">
                  📋 Este es solo un esquema de referencia. Define la estructura del JSON que esperas recibir de la IA.
                </p>
              </div>

              {/* Info Box */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2 mb-2">
                  💡 Ejemplos de Variables que puedes usar en el prompt
                </h4>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>• El sistema automáticamente incluye el texto completo de la conversación</p>
                  <p>• Puedes pedir análisis de: sentimiento, temas, resumen, categorías, urgencia, etc.</p>
                  <p>• Asegúrate de pedir que responda en formato JSON válido</p>
                  <p>• Los análisis se guardan en cada conversación y se muestran en Analytics</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-red-600">Error al cargar la configuración</div>
          )}
        </div>
      </div>
    </div>
  );
}
