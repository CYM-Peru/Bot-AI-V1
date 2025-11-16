import { useState, useEffect } from "react";
import { apiUrl, apiFetch } from "../../lib/apiBase";
import { Sparkles, Heart, Zap, MessageCircle, Save } from "lucide-react";

interface PersonalityConfig {
  behaviorType: string;
  tone: string;
  emojiUsage: string;
  formality: string;
  responseLength: string;
  greetingStyle: string;
  region: string;
  presentsAs: string;
  creativity: number;
  directness: string;
  empathy: string;
  customInstructions: string;
}

export function PersonalityConfig() {
  const [personality, setPersonality] = useState<PersonalityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPersonality();
  }, []);

  async function loadPersonality() {
    try {
      const response = await apiFetch("/api/ia-agent-config", {
        credentials: "include",
      });

      if (response.ok) {
        const config = await response.json();
        // Merge with defaults to ensure all fields exist
        const defaults = getDefaultPersonality();
        const merged = {
          ...defaults,
          ...(config.personality || {})
        };
        setPersonality(merged);
      }
    } catch (error) {
      console.error("Failed to load personality:", error);
    } finally {
      setLoading(false);
    }
  }

  function getDefaultPersonality(): PersonalityConfig {
    return {
      behaviorType: "vendedor_consultivo",
      tone: "amigable_profesional",
      emojiUsage: "moderado",
      formality: "informal_profesional",
      responseLength: "conciso",
      greetingStyle: "variado",
      region: "peru",
      presentsAs: "asistente_virtual",
      creativity: 0.7,
      directness: "equilibrado",
      empathy: "alto",
      customInstructions: ""
    };
  }

  async function savePersonality() {
    if (!personality) return;

    setSaving(true);
    try {
      // Load full config
      const configResponse = await apiFetch("/api/ia-agent-config", {
        credentials: "include",
      });

      if (!configResponse.ok) {
        throw new Error("Failed to load config");
      }

      const config = await configResponse.json();

      // Update personality section
      config.personality = personality;

      // Save back
      const saveResponse = await apiFetch("/api/ia-agent-config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save config");
      }

      alert("✅ Personalidad guardada correctamente");
    } catch (error) {
      console.error("Failed to save personality:", error);
      alert("❌ Error al guardar personalidad");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!personality) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 rounded-xl p-6 border border-purple-200/50 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-lg p-3 shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-700 to-fuchsia-700 bg-clip-text text-transparent">
                Personalidad del Agente
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Configura cómo se comporta y comunica el agente con tus clientes
              </p>
            </div>
          </div>

          <button
            onClick={savePersonality}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg hover:from-violet-700 hover:to-fuchsia-700 font-medium transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Behavior Type */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg p-2">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-slate-900">Tipo de Comportamiento</h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Estilo Principal
            </label>
            <select
              value={personality.behaviorType || "vendedor_consultivo"}
              onChange={(e) => setPersonality({ ...personality, behaviorType: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            >
              <option value="vendedor_consultivo">🎯 Vendedor Consultivo - Ayuda a tomar decisiones de compra</option>
              <option value="vendedor_directo">💼 Vendedor Directo - Enfocado en cerrar ventas</option>
              <option value="asistente_servicio">🤝 Asistente de Servicio - Prioriza ayudar y resolver</option>
              <option value="educador">📚 Educador - Enseña sobre productos y procesos</option>
              <option value="analitico">🔍 Analítico - Detallado y basado en datos</option>
              <option value="tecnico">⚙️ Técnico - Preciso y específico</option>
              <option value="creativo">🎨 Creativo - Inspirador y original</option>
              <option value="empatico">❤️ Empático - Cercano y comprensivo</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tono de Comunicación
              </label>
              <select
                value={personality.tone || "amigable_profesional"}
                onChange={(e) => setPersonality({ ...personality, tone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="formal">Formal</option>
                <option value="amigable_profesional">Amigable y Profesional</option>
                <option value="casual">Casual</option>
                <option value="energetico">Energético</option>
                <option value="tranquilo">Tranquilo y Relajado</option>
                <option value="entusiasta">Entusiasta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nivel de Formalidad
              </label>
              <select
                value={personality.formality || "informal_profesional"}
                onChange={(e) => setPersonality({ ...personality, formality: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="muy_formal">Muy Formal (Usted, lenguaje corporativo)</option>
                <option value="formal">Formal (Usted, pero cercano)</option>
                <option value="informal_profesional">Informal Profesional (Tú, pero respetuoso)</option>
                <option value="casual">Casual (Tú, lenguaje relajado)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Communication Style */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-fuchsia-400 to-pink-500 rounded-lg p-2">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-slate-900">Estilo de Comunicación</h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Uso de Emojis
              </label>
              <select
                value={personality.emojiUsage || "moderado"}
                onChange={(e) => setPersonality({ ...personality, emojiUsage: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="ninguno">🚫 Ninguno</option>
                <option value="minimo">😐 Mínimo</option>
                <option value="moderado">😊 Moderado</option>
                <option value="frecuente">😄 Frecuente</option>
                <option value="abundante">🎉 Abundante</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Longitud de Respuestas
              </label>
              <select
                value={personality.responseLength || "conciso"}
                onChange={(e) => setPersonality({ ...personality, responseLength: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="muy_breve">Muy Breve</option>
                <option value="conciso">Conciso</option>
                <option value="moderado">Moderado</option>
                <option value="detallado">Detallado</option>
                <option value="exhaustivo">Exhaustivo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Estilo de Saludo
              </label>
              <select
                value={personality.greetingStyle || "variado"}
                onChange={(e) => setPersonality({ ...personality, greetingStyle: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="consistente">Consistente (siempre igual)</option>
                <option value="variado">Variado (diferentes saludos)</option>
                <option value="contextual">Contextual (según la hora/situación)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nivel de Directness
              </label>
              <select
                value={personality.directness || "equilibrado"}
                onChange={(e) => setPersonality({ ...personality, directness: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="muy_directo">Muy Directo (al grano)</option>
                <option value="directo">Directo</option>
                <option value="equilibrado">Equilibrado</option>
                <option value="conversacional">Conversacional</option>
                <option value="elaborado">Elaborado (con contexto)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nivel de Empatía
              </label>
              <select
                value={personality.empathy || "alto"}
                onChange={(e) => setPersonality({ ...personality, empathy: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="bajo">Bajo (enfocado en hechos)</option>
                <option value="moderado">Moderado</option>
                <option value="alto">Alto (comprensivo)</option>
                <option value="muy_alto">Muy Alto (muy cercano)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Creatividad (0 = Predecible, 1 = Muy Creativo)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={personality.creativity || 0.7}
                onChange={(e) => setPersonality({ ...personality, creativity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-semibold text-purple-700 w-12 text-right">
                {(personality.creativity || 0.7).toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Mayor creatividad = respuestas más variadas y originales
            </p>
          </div>
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-pink-400 to-rose-500 rounded-lg p-2">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-slate-900">Instrucciones Personalizadas</h3>
          </div>
        </div>

        <div className="p-6">
          <textarea
            value={personality.customInstructions || ""}
            onChange={(e) => setPersonality({ ...personality, customInstructions: e.target.value })}
            placeholder="Ej: Varía tus saludos, usa expresiones peruanas naturales, evita sonar robótico..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <p className="text-xs text-slate-500 mt-2">
            Instrucciones adicionales para personalizar aún más el comportamiento del agente
          </p>
        </div>
      </div>

      {/* Save Button (Mobile) */}
      <div className="flex justify-end lg:hidden">
        <button
          onClick={savePersonality}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg hover:from-violet-700 hover:to-fuchsia-700 font-medium transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}
