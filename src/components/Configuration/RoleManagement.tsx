import { useState, useEffect } from "react";
import { authFetch } from "../../lib/apiBase";

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

const AVAILABLE_PERMISSIONS: Permission[] = [
  // === CANVAS (Flujos) ===
  { id: "canvas.view", name: "📐 Ver Canvas", description: "Ver el editor de flujos" },
  { id: "canvas.edit", name: "✏️ Editar Flujos", description: "Crear y modificar nodos de flujos" },
  { id: "canvas.save", name: "💾 Guardar Flujos", description: "Guardar cambios en flujos" },
  { id: "canvas.delete", name: "🗑️ Eliminar Flujos", description: "Eliminar flujos existentes" },
  { id: "canvas.export", name: "📤 Exportar Flujos", description: "Exportar flujos a PNG/JSON" },
  { id: "canvas.import", name: "📥 Importar Flujos", description: "Importar flujos desde JSON" },
  { id: "canvas.undo_redo", name: "↩️ Deshacer/Rehacer", description: "Usar deshacer y rehacer en flujos" },

  // === CRM ===
  { id: "crm.view", name: "👁️ Ver CRM", description: "Acceso a la interfaz del CRM" },
  { id: "crm.chat", name: "💬 Chat", description: "Responder conversaciones de clientes" },
  { id: "crm.transfer", name: "➡️ Transferir", description: "Transferir chats a otros asesores o bots" },
  { id: "crm.archive", name: "📦 Archivar", description: "Archivar conversaciones" },
  { id: "crm.close", name: "✅ Cerrar Conversaciones", description: "Cerrar conversaciones completadas" },
  { id: "crm.notes", name: "📝 Notas Internas", description: "Crear notas internas privadas" },
  { id: "crm.bitrix", name: "🔌 Bitrix", description: "Ver y crear contactos en Bitrix24" },
  { id: "crm.view_all", name: "👀 Ver Todas las Conversaciones", description: "Ver conversaciones de todos los asesores" },
  { id: "crm.customer_info", name: "👤 Info de Cliente", description: "Ver información detallada del cliente" },

  // === CAMPAÑAS ===
  { id: "campaigns.view", name: "📢 Ver Campañas", description: "Ver panel de campañas" },
  { id: "campaigns.create", name: "➕ Crear Campañas", description: "Crear nuevas campañas" },
  { id: "campaigns.edit", name: "✏️ Editar Campañas", description: "Modificar campañas existentes" },
  { id: "campaigns.delete", name: "🗑️ Eliminar Campañas", description: "Eliminar campañas" },
  { id: "campaigns.send", name: "📤 Enviar Campañas", description: "Enviar mensajes de campañas" },
  { id: "campaigns.keywords", name: "🔑 Palabras Clave", description: "Gestionar palabras clave de campañas" },

  // === PLANTILLAS (Templates) ===
  { id: "templates.view", name: "📄 Ver Plantillas", description: "Ver plantillas de mensajes" },
  { id: "templates.create", name: "➕ Crear Plantillas", description: "Crear nuevas plantillas" },
  { id: "templates.edit", name: "✏️ Editar Plantillas", description: "Modificar plantillas existentes" },
  { id: "templates.delete", name: "🗑️ Eliminar Plantillas", description: "Eliminar plantillas" },

  // === AGENDA ===
  { id: "agenda.view", name: "📅 Ver Agenda", description: "Ver calendario y eventos" },
  { id: "agenda.create", name: "➕ Crear Eventos", description: "Crear nuevos eventos en agenda" },
  { id: "agenda.edit", name: "✏️ Editar Eventos", description: "Modificar eventos existentes" },
  { id: "agenda.delete", name: "🗑️ Eliminar Eventos", description: "Eliminar eventos de agenda" },

  // === ASESORES (Advisors) ===
  { id: "advisors.view", name: "👥 Ver Panel de Asesores", description: "Ver estado y disponibilidad de asesores" },
  { id: "advisors.manage_status", name: "🔄 Gestionar Estado", description: "Cambiar estado de disponibilidad de asesores" },

  // === MÉTRICAS ===
  { id: "metrics.view", name: "📊 Ver Métricas", description: "Acceso al panel de métricas" },
  { id: "metrics.conversations", name: "💬 Métricas de Conversaciones", description: "Ver métricas de conversaciones" },
  { id: "metrics.campaigns", name: "📢 Métricas de Campañas", description: "Ver métricas de campañas" },
  { id: "metrics.ad_tracking", name: "🎯 Tracking de Ads", description: "Ver tracking de anuncios de Meta" },
  { id: "metrics.export", name: "📥 Exportar Métricas", description: "Exportar datos de métricas" },

  // === CONFIGURACIÓN ===
  { id: "config.view", name: "⚙️ Ver Configuración", description: "Acceso al panel de configuración" },

  // Config: Usuarios
  { id: "config.users.view", name: "👥 Ver Usuarios", description: "Ver lista de usuarios" },
  { id: "config.users.create", name: "➕ Crear Usuarios", description: "Crear nuevos usuarios" },
  { id: "config.users.edit", name: "✏️ Editar Usuarios", description: "Modificar usuarios existentes" },
  { id: "config.users.delete", name: "🗑️ Eliminar Usuarios", description: "Eliminar usuarios" },

  // Config: Roles y Permisos
  { id: "config.roles.view", name: "🛡️ Ver Roles", description: "Ver roles y permisos" },
  { id: "config.roles.create", name: "➕ Crear Roles", description: "Crear nuevos roles" },
  { id: "config.roles.edit", name: "✏️ Editar Roles", description: "Modificar roles y permisos" },
  { id: "config.roles.delete", name: "🗑️ Eliminar Roles", description: "Eliminar roles" },

  // Config: Colas de Atención
  { id: "config.queues.view", name: "📋 Ver Colas", description: "Ver colas de atención" },
  { id: "config.queues.create", name: "➕ Crear Colas", description: "Crear nuevas colas" },
  { id: "config.queues.edit", name: "✏️ Editar Colas", description: "Modificar colas existentes" },
  { id: "config.queues.delete", name: "🗑️ Eliminar Colas", description: "Eliminar colas" },
  { id: "config.queues.assign", name: "👤 Asignar Asesores", description: "Asignar asesores a colas" },

  // Config: Monitoreo de Asesores
  { id: "config.advisor_stats.view", name: "📊 Ver Estadísticas", description: "Ver estadísticas en tiempo real de asesores" },

  // Config: Campos CRM
  { id: "config.crm_fields.view", name: "📝 Ver Campos CRM", description: "Ver configuración de campos CRM" },
  { id: "config.crm_fields.edit", name: "✏️ Editar Campos CRM", description: "Modificar campos personalizados del CRM" },

  // Config: WhatsApp Business
  { id: "config.whatsapp.view", name: "📱 Ver WhatsApp", description: "Ver configuración de WhatsApp" },
  { id: "config.whatsapp.edit_api", name: "🔧 Configurar API", description: "Modificar conexión API de WhatsApp" },
  { id: "config.whatsapp.manage_numbers", name: "📞 Gestionar Números", description: "Gestionar números y asignaciones de colas" },

  // Config: Bitrix24
  { id: "config.bitrix24.view", name: "🔌 Ver Bitrix24", description: "Ver configuración de Bitrix24" },
  { id: "config.bitrix24.edit", name: "🔧 Configurar Bitrix24", description: "Modificar conexión con Bitrix24 CRM" },

  // Config: Inteligencia Artificial
  { id: "config.ai.view", name: "🤖 Ver IA", description: "Ver configuración de IA" },
  { id: "config.ai.edit", name: "🔧 Configurar IA", description: "Modificar configuración de OpenAI/embeddings" },

  // Config: Agente IA (Azaleia)
  { id: "config.ia_agent.view", name: "🧠 Ver Agente IA", description: "Ver configuración del agente Azaleia" },
  { id: "config.ia_agent.edit", name: "🔧 Configurar Agente", description: "Modificar prompts y comportamiento del agente" },
  { id: "config.ia_agent.keywords", name: "🔑 Keywords del Agente", description: "Gestionar palabras clave del agente IA" },

  // Config: Estados de Asesor
  { id: "config.statuses.view", name: "🚦 Ver Estados", description: "Ver estados de asesor" },
  { id: "config.statuses.create", name: "➕ Crear Estados", description: "Crear nuevos estados" },
  { id: "config.statuses.edit", name: "✏️ Editar Estados", description: "Modificar estados existentes" },
  { id: "config.statuses.delete", name: "🗑️ Eliminar Estados", description: "Eliminar estados" },

  // Config: Timeout del Bot
  { id: "config.bot.view", name: "⏱️ Ver Timeout Bot", description: "Ver configuración de timeout" },
  { id: "config.bot.edit", name: "🔧 Configurar Timeout", description: "Modificar tiempo de espera del bot" },

  // Config: General
  { id: "config.general.view", name: "⚙️ Ver Config General", description: "Ver configuración general" },
  { id: "config.general.edit", name: "🔧 Editar Config General", description: "Modificar configuraciones generales del sistema" },
];

const DEFAULT_ROLES: Role[] = [
  {
    id: "admin",
    name: "Administrador",
    description: "Acceso completo al sistema",
    permissions: AVAILABLE_PERMISSIONS.map((p) => p.id),
  },
  {
    id: "supervisor",
    name: "Supervisor",
    description: "Supervisa operaciones de CRM y asesores",
    permissions: [
      // Canvas
      "canvas.view",
      "canvas.edit",
      // CRM
      "crm.view",
      "crm.chat",
      "crm.transfer",
      "crm.archive",
      "crm.close",
      "crm.notes",
      "crm.bitrix",
      "crm.view_all",
      "crm.customer_info",
      // Campañas
      "campaigns.view",
      "campaigns.create",
      "campaigns.edit",
      "campaigns.send",
      // Plantillas
      "templates.view",
      "templates.create",
      "templates.edit",
      // Agenda
      "agenda.view",
      "agenda.create",
      "agenda.edit",
      // Asesores
      "advisors.view",
      "advisors.manage_status",
      // Métricas
      "metrics.view",
      "metrics.conversations",
      "metrics.campaigns",
      "metrics.ad_tracking",
      "metrics.export",
      // Config
      "config.view",
      "config.queues.view",
      "config.queues.edit",
      "config.queues.assign",
      "config.advisor_stats.view",
      "config.statuses.view",
      "config.statuses.edit",
    ],
  },
  {
    id: "asesor",
    name: "Asesor",
    description: "Atiende conversaciones de clientes",
    permissions: [
      "crm.view",
      "crm.chat",
      "crm.notes",
      "crm.bitrix",
      "crm.customer_info",
      "advisors.view",
      "advisors.manage_status",
    ],
  },
];

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/admin/roles");
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Error loading roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedRole(null);
    setFormData({
      name: "",
      description: "",
      permissions: [],
    });
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRole(null);
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = selectedRole
        ? `/api/admin/roles/${selectedRole.id}`
        : "/api/admin/roles";
      const method = selectedRole ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadRoles();
        closeModal();
      }
    } catch (error) {
      console.error("Error saving role:", error);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (["admin", "supervisor", "asesor"].includes(roleId)) {
      alert("No se pueden eliminar roles predeterminados del sistema");
      return;
    }
    if (!confirm("¿Estás seguro de eliminar este rol?")) return;

    try {
      const response = await authFetch(`/api/admin/roles/${roleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadRoles();
      } else {
        alert("No se puede eliminar este rol");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  const getPermissionsByCategory = () => {
    const categories: Record<string, Permission[]> = {
      CRM: [],
      Flujos: [],
      Métricas: [],
      Configuración: [],
    };

    AVAILABLE_PERMISSIONS.forEach((perm) => {
      if (perm.id.startsWith("crm.")) categories.CRM.push(perm);
      else if (perm.id.startsWith("flows.")) categories.Flujos.push(perm);
      else if (perm.id.startsWith("metrics.")) categories.Métricas.push(perm);
      else if (perm.id.startsWith("config.")) categories.Configuración.push(perm);
    });

    return categories;
  };

  const categories = getPermissionsByCategory();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Roles y Permisos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configura roles y define los permisos de cada nivel
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Nuevo Rol
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-slate-500">Cargando roles...</div>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">{role.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{role.description}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditModal(role)}
                  className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition"
                  title="Editar"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                {!["admin", "supervisor", "asesor"].includes(role.id) && (
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition"
                    title="Eliminar"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Permisos asignados:</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {role.permissions.length}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.permissions.slice(0, 6).map((permId) => {
                  const perm = AVAILABLE_PERMISSIONS.find((p) => p.id === permId);
                  return perm ? (
                    <span
                      key={permId}
                      className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {perm.name}
                    </span>
                  ) : null;
                })}
                {role.permissions.length > 6 && (
                  <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    +{role.permissions.length - 6} más
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Modal Create/Edit */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900">
              {selectedRole ? "Editar Rol" : "Nuevo Rol"}
            </h3>

            <form onSubmit={handleSubmit} className="mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Nombre del Rol</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Descripción</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-bold text-slate-900">Permisos</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Selecciona los permisos que tendrá este rol
                </p>

                <div className="mt-4 space-y-6">
                  {Object.entries(categories).map(([categoryName, perms]) => (
                    <div key={categoryName}>
                      <h5 className="text-sm font-bold text-slate-700 mb-3">{categoryName}</h5>
                      <div className="grid grid-cols-2 gap-3">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-slate-900">{perm.name}</div>
                              <div className="text-xs text-slate-500">{perm.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                >
                  {selectedRole ? "Guardar Cambios" : "Crear Rol"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
