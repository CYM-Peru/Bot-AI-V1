import { useState } from "react";

interface Queue {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  distributionMode: "round-robin" | "least-busy" | "manual";
  maxConcurrent: number;
  assignedAdvisors: string[];
  createdAt: string;
}

const MOCK_ADVISORS = [
  { id: "user1", name: "María García", avatar: "MG" },
  { id: "user2", name: "Juan Pérez", avatar: "JP" },
  { id: "user3", name: "Ana Torres", avatar: "AT" },
  { id: "user4", name: "Carlos López", avatar: "CL" },
  { id: "user5", name: "Laura Mendoza", avatar: "LM" },
];

const MOCK_QUEUES: Queue[] = [
  {
    id: "queue1",
    name: "Soporte General",
    description: "Cola principal para consultas generales",
    status: "active",
    distributionMode: "round-robin",
    maxConcurrent: 5,
    assignedAdvisors: ["user1", "user2", "user3"],
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "queue2",
    name: "Ventas",
    description: "Atención a consultas de ventas y cotizaciones",
    status: "active",
    distributionMode: "least-busy",
    maxConcurrent: 3,
    assignedAdvisors: ["user4", "user5"],
    createdAt: "2025-01-15T00:00:00Z",
  },
];

export function QueueManagement() {
  const [queues, setQueues] = useState<Queue[]>(MOCK_QUEUES);
  const [showModal, setShowModal] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: "active" | "inactive";
    distributionMode: "round-robin" | "least-busy" | "manual";
    maxConcurrent: number;
    assignedAdvisors: string[];
  }>({
    name: "",
    description: "",
    status: "active",
    distributionMode: "round-robin",
    maxConcurrent: 5,
    assignedAdvisors: [],
  });

  const openCreateModal = () => {
    setEditingQueue(null);
    setFormData({
      name: "",
      description: "",
      status: "active",
      distributionMode: "round-robin",
      maxConcurrent: 5,
      assignedAdvisors: [],
    });
    setShowModal(true);
  };

  const openEditModal = (queue: Queue) => {
    setEditingQueue(queue);
    setFormData({
      name: queue.name,
      description: queue.description,
      status: queue.status,
      distributionMode: queue.distributionMode,
      maxConcurrent: queue.maxConcurrent,
      assignedAdvisors: [...queue.assignedAdvisors],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingQueue(null);
  };

  const toggleAdvisor = (advisorId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedAdvisors: prev.assignedAdvisors.includes(advisorId)
        ? prev.assignedAdvisors.filter((id) => id !== advisorId)
        : [...prev.assignedAdvisors, advisorId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingQueue) {
      setQueues(
        queues.map((q) =>
          q.id === editingQueue.id
            ? { ...q, ...formData }
            : q
        )
      );
    } else {
      const newQueue: Queue = {
        id: `queue-${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString(),
      };
      setQueues([...queues, newQueue]);
    }
    closeModal();
  };

  const handleDelete = (queueId: string) => {
    if (confirm("¿Estás seguro de eliminar esta cola?")) {
      setQueues(queues.filter((q) => q.id !== queueId));
    }
  };

  const getDistributionLabel = (mode: string) => {
    const labels = {
      "round-robin": "Round Robin",
      "least-busy": "Menos Ocupado",
      manual: "Manual",
    };
    return labels[mode as keyof typeof labels];
  };

  const getDistributionBadge = (mode: string) => {
    const colors = {
      "round-robin": "bg-blue-100 text-blue-700",
      "least-busy": "bg-purple-100 text-purple-700",
      manual: "bg-amber-100 text-amber-700",
    };
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[mode as keyof typeof colors]}`}>
        {getDistributionLabel(mode)}
      </span>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Colas de Atención</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configura colas de atención y asigna asesores
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
          Nueva Cola
        </button>
      </div>

      {queues.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No hay colas creadas</h3>
          <p className="mt-2 text-sm text-slate-500">
            Comienza creando tu primera cola de atención
          </p>
          <button
            onClick={openCreateModal}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Crear Primera Cola
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {queues.map((queue) => (
            <div
              key={queue.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{queue.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        queue.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          queue.status === "active" ? "bg-green-500" : "bg-slate-400"
                        }`}
                      />
                      {queue.status === "active" ? "Activa" : "Inactiva"}
                    </span>
                    {getDistributionBadge(queue.distributionMode)}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{queue.description}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(queue)}
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
                  <button
                    onClick={() => handleDelete(queue.id)}
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
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Modo de Distribución</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {getDistributionLabel(queue.distributionMode)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Chats Simultáneos</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{queue.maxConcurrent}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Asesores Asignados</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {queue.assignedAdvisors.length}
                  </p>
                </div>
              </div>

              {queue.assignedAdvisors.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Asesores:</p>
                  <div className="flex flex-wrap gap-2">
                    {queue.assignedAdvisors.map((advisorId) => {
                      const advisor = MOCK_ADVISORS.find((a) => a.id === advisorId);
                      return advisor ? (
                        <div
                          key={advisorId}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            {advisor.avatar}
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            {advisor.name}
                          </span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
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
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900">
              {editingQueue ? "Editar Cola" : "Nueva Cola"}
            </h3>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Nombre de la Cola</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Ej: Soporte Técnico"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Describe el propósito de esta cola"
                  rows={2}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Estado</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as "active" | "inactive" })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Distribución</label>
                  <select
                    value={formData.distributionMode}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        distributionMode: e.target.value as "round-robin" | "least-busy" | "manual",
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="round-robin">Round Robin</option>
                    <option value="least-busy">Menos Ocupado</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Máx. Chats</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.maxConcurrent}
                    onChange={(e) =>
                      setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) || 5 })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Asesores Asignados ({formData.assignedAdvisors.length})
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {MOCK_ADVISORS.map((advisor) => (
                    <label
                      key={advisor.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignedAdvisors.includes(advisor.id)}
                        onChange={() => toggleAdvisor(advisor.id)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        {advisor.avatar}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{advisor.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-200 pt-4">
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
                  {editingQueue ? "Guardar Cambios" : "Crear Cola"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
