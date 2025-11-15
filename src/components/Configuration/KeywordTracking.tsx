import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/apiBase";
import { Plus, Trash2, Edit2, Check, X, TrendingUp, Tag, BarChart3 } from "lucide-react";

interface KeywordGroup {
  id: string;
  name: string;
  enabled: boolean;
  keywords: string[];
}

interface KeywordStats {
  keyword: string;
  groupName: string;
  count: number;
}

export function KeywordTracking() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [stats, setStats] = useState<KeywordStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<KeywordGroup | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    enabled: true,
    keywords: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load current configuration
      const configResponse = await fetch(apiUrl("/api/ia-agent-config"), {
        credentials: "include",
      });

      if (configResponse.ok) {
        const config = await configResponse.json();
        setGroups(config.keywordTracking?.groups || []);
      }

      // Load usage statistics
      const statsResponse = await fetch(apiUrl("/api/crm/metrics/keyword-usage?flowId=ia-agent&limit=50"), {
        credentials: "include",
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.keywordStats || []);
      }
    } catch (error) {
      console.error("Failed to load keyword data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveGroups(updatedGroups: KeywordGroup[]) {
    setSaving(true);
    try {
      // Load full config
      const configResponse = await fetch(apiUrl("/api/ia-agent-config"), {
        credentials: "include",
      });

      if (!configResponse.ok) {
        throw new Error("Failed to load config");
      }

      const config = await configResponse.json();

      // Update keyword tracking section
      config.keywordTracking = {
        enabled: true,
        groups: updatedGroups
      };

      // Save back
      const saveResponse = await fetch(apiUrl("/api/ia-agent-config"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save config");
      }

      setGroups(updatedGroups);
      alert("✅ Keywords guardadas correctamente");
      loadData(); // Reload to get fresh stats
    } catch (error) {
      console.error("Failed to save keywords:", error);
      alert("❌ Error al guardar keywords");
    } finally {
      setSaving(false);
    }
  }

  function handleAddGroup() {
    if (!formData.name.trim()) {
      alert("Por favor ingresa un nombre para el grupo");
      return;
    }

    const keywords = formData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) {
      alert("Por favor agrega al menos una keyword");
      return;
    }

    const newGroup: KeywordGroup = {
      id: formData.id || `group_${Date.now()}`,
      name: formData.name,
      enabled: formData.enabled,
      keywords
    };

    if (editingGroup) {
      // Update existing group
      const updatedGroups = groups.map(g => g.id === editingGroup.id ? newGroup : g);
      saveGroups(updatedGroups);
    } else {
      // Add new group
      saveGroups([...groups, newGroup]);
    }

    // Reset form
    setFormData({ id: '', name: '', enabled: true, keywords: '' });
    setShowAddGroup(false);
    setEditingGroup(null);
  }

  function handleEditGroup(group: KeywordGroup) {
    setFormData({
      id: group.id,
      name: group.name,
      enabled: group.enabled,
      keywords: group.keywords.join(', ')
    });
    setEditingGroup(group);
    setShowAddGroup(true);
  }

  function handleDeleteGroup(groupId: string) {
    if (!confirm("¿Eliminar este grupo de keywords?")) {
      return;
    }

    const updatedGroups = groups.filter(g => g.id !== groupId);
    saveGroups(updatedGroups);
  }

  function handleToggleGroup(groupId: string) {
    const updatedGroups = groups.map(g =>
      g.id === groupId ? { ...g, enabled: !g.enabled } : g
    );
    saveGroups(updatedGroups);
  }

  function getGroupStats(groupId: string): number {
    const group = groups.find(g => g.id === groupId);
    if (!group || !Array.isArray(group.keywords)) return 0;

    return stats
      .filter(s => s && s.keyword && group.keywords.some(k => k && k.toLowerCase() === s.keyword.toLowerCase()))
      .reduce((sum, s) => sum + (s.count || 0), 0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-indigo-200/50 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-3 shadow-lg">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                Keywords & Métricas
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Rastrea automáticamente palabras clave en las conversaciones del agente
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setFormData({ id: '', name: '', enabled: true, keywords: '' });
              setEditingGroup(null);
              setShowAddGroup(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Grupo
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddGroup && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-semibold text-slate-900">
              {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo de Keywords'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre del Grupo
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Consultas de Precio"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Keywords (separadas por comas)
              </label>
              <textarea
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="precio, costo, cuánto, valor, cotización"
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-slate-500 mt-2">
                Separa cada keyword con una coma. Ej: precio, costo, cuánto cuesta
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-slate-700">
                Grupo habilitado
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddGroup}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingGroup ? 'Guardar Cambios' : 'Crear Grupo'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddGroup(false);
                  setEditingGroup(null);
                  setFormData({ id: '', name: '', enabled: true, keywords: '' });
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg p-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Grupos Configurados</h3>
              <p className="text-xs text-slate-600">
                {groups.filter(g => g.enabled).length} de {groups.length} grupos activos
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {groups.length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <Tag className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No hay grupos configurados</p>
              <p className="text-sm text-slate-500 mt-1">
                Crea tu primer grupo de keywords para empezar a trackear
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const usage = getGroupStats(group.id);

              return (
                <div key={group.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${group.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                          <h4 className="font-semibold text-slate-900">{group.name}</h4>
                        </div>

                        {usage > 0 && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            <TrendingUp className="w-3 h-3" />
                            {usage} detecciones
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {Array.isArray(group.keywords) && group.keywords.map((keyword, idx) => {
                          if (!keyword) return null;
                          const keywordStat = stats.find(s => s && s.keyword && keyword && s.keyword.toLowerCase() === keyword.toLowerCase());

                          return (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                            >
                              {keyword}
                              {keywordStat && keywordStat.count > 0 && (
                                <span className="text-purple-600 font-semibold">
                                  ({keywordStat.count})
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      <div className="text-xs text-slate-500">
                        ID: {group.id}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleGroup(group.id)}
                        className={`p-2 rounded-lg font-medium text-sm transition-all ${
                          group.enabled
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={group.enabled ? 'Deshabilitar' : 'Habilitar'}
                      >
                        {group.enabled ? 'ON' : 'OFF'}
                      </button>

                      <button
                        onClick={() => handleEditGroup(group)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Top Keywords Stats */}
      {stats.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200/50">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500 rounded-lg p-2 mt-0.5">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-3">Keywords Más Detectadas</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.slice(0, 8).filter(stat => stat && stat.keyword).map((stat, idx) => (
                  <div
                    key={idx}
                    className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-blue-200"
                  >
                    <div className="text-xs text-blue-600 font-medium mb-0.5">{stat.groupName || 'Sin grupo'}</div>
                    <div className="font-semibold text-slate-900">{stat.keyword}</div>
                    <div className="text-sm text-blue-700 font-semibold">{stat.count || 0} veces</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
