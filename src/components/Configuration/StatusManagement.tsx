import { useEffect, useState } from "react";
import { apiUrl, apiFetch } from "../../lib/apiBase";

interface AdvisorStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  action: "accept" | "redirect" | "pause";
  redirectToQueue?: string;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface Queue {
  id: string;
  name: string;
}

export function StatusManagement() {
  const [statuses, setStatuses] = useState<AdvisorStatus[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<AdvisorStatus | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    color: string;
    action: "accept" | "redirect" | "pause";
    redirectToQueue: string;
    isDefault: boolean;
  }>({
    name: "",
    description: "",
    color: "#10b981",
    action: "accept",
    redirectToQueue: "",
    isDefault: false,
  });

  useEffect(() => {
    loadStatuses();
    loadQueues();
  }, []);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/admin/advisor-statuses");
      if (response.ok) {
        const data = await response.json();
        setStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error("Error loading statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadQueues = async () => {
    try {
      const response = await apiFetch("/api/admin/queues");
      if (response.ok) {
        const data = await response.json();
        setQueues(data.queues || []);
      }
    } catch (error) {
      console.error("Error loading queues:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingStatus
        ? apiUrl(`/api/admin/advisor-statuses/${editingStatus.id}`)
        : apiUrl("/api/admin/advisor-statuses");
      const method = editingStatus ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadStatuses();
        closeModal();
      }
    } catch (error) {
      console.error("Error saving status:", error);
    }
  };

  const handleDelete = async (statusId: string) => {
    if (!confirm("¿Estás seguro de eliminar este estado?")) return;

    try {
      const response = await apiFetch(`/api/admin/advisor-statuses/${statusId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await loadStatuses();
      } else {
        const data = await response.json();
        alert(data.error || "No se pudo eliminar el estado");
      }
    } catch (error) {
      console.error("Error deleting status:", error);
    }
  };

  const openCreateModal = () => {
    setEditingStatus(null);
    setFormData({
      name: "",
      description: "",
      color: "#10b981",
      action: "accept",
      redirectToQueue: "",
      isDefault: false,
    });
    setShowModal(true);
  };

  const openEditModal = (status: AdvisorStatus) => {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      description: status.description,
      color: status.color,
      action: status.action,
      redirectToQueue: status.redirectToQueue || "",
      isDefault: status.isDefault,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStatus(null);
  };

  const getActionLabel = (action: string) => {
    const labels = {
      accept: "Acepta chats",
      redirect: "Deriva a cola",
      pause: "No acepta chats",
    };
    return labels[action as keyof typeof labels] || action;
  };

  const getActionColor = (action: string) => {
    const colors = {
      accept: "bg-emerald-100 text-emerald-700 border-emerald-300",
      redirect: "bg-amber-100 text-amber-700 border-amber-300",
      pause: "bg-gray-100 text-gray-700 border-gray-300",
    };
    return colors[action as keyof typeof colors] || "bg-gray-100 text-gray-700 border-gray-300";
  };

  if (loading && statuses.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-slate-500">Cargando estados...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Estados de Asesor</h2>
          <p className="mt-2 text-sm text-slate-600">
            Configura los estados que los asesores pueden usar (Disponible, En refrigerio, etc.)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear Estado
        </button>
      </div>

      <div className="grid gap-4">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: status.color }}
                  />
                  <h3 className="text-lg font-bold text-slate-900">{status.name}</h3>
                  {status.isDefault && (
                    <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      Por defecto
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getActionColor(status.action)}`}>
                    {getActionLabel(status.action)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{status.description}</p>
                {status.action === "redirect" && status.redirectToQueue && (
                  <p className="mt-1 text-xs text-slate-500">
                    → Deriva a cola: {queues.find(q => q.id === status.redirectToQueue)?.name || status.redirectToQueue}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(status)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Editar
                </button>
                {!status.isDefault && (
                  <button
                    onClick={() => handleDelete(status.id)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {statuses.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <p className="text-slate-500">No hay estados configurados</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Crear el primer estado
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingStatus ? "Editar Estado" : "Crear Nuevo Estado"}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="#10b981"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Acción</label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="accept">Acepta chats nuevos</option>
                  <option value="redirect">Deriva chats a cola</option>
                  <option value="pause">No acepta chats (pausa)</option>
                </select>
              </div>

              {formData.action === "redirect" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Cola de destino
                  </label>
                  <select
                    value={formData.redirectToQueue}
                    onChange={(e) => setFormData({ ...formData, redirectToQueue: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Seleccionar cola...</option>
                    {queues.map((queue) => (
                      <option key={queue.id} value={queue.id}>
                        {queue.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    Estado por defecto al iniciar sesión
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  {editingStatus ? "Guardar Cambios" : "Crear Estado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
