import { useState, useEffect } from "react";
import { apiUrl, apiFetch } from "../lib/apiBase";
import { X, UserPlus, Search, Check } from "lucide-react";

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string; // Número de teléfono del cliente
  onSuccess?: (leadId: string) => void;
}

interface BitrixUser {
  id: string;
  name: string;
  lastName: string;
  fullName: string;
  email: string;
  position: string;
}

interface BitrixStatus {
  id: string;
  name: string;
}

interface BitrixSource {
  id: string;
  name: string;
}

export default function CreateLeadModal({ isOpen, onClose, phone, onSuccess }: CreateLeadModalProps) {
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [users, setUsers] = useState<BitrixUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<BitrixUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Estados para etapas y orígenes
  const [statuses, setStatuses] = useState<BitrixStatus[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("NEW"); // Por defecto "NEW"
  const [sources, setSources] = useState<BitrixSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadStatuses();
      loadSources();
    }
  }, [isOpen]);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const response = await apiFetch("/api/bitrix/users", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error("Failed to load users");
      }
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadStatuses() {
    setLoadingStatuses(true);
    try {
      const response = await apiFetch("/api/bitrix/lead-statuses", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStatuses(data.statuses || []);
      } else {
        console.error("Failed to load statuses");
      }
    } catch (error) {
      console.error("Error loading statuses:", error);
    } finally {
      setLoadingStatuses(false);
    }
  }

  async function loadSources() {
    setLoadingSources(true);
    try {
      const response = await apiFetch("/api/bitrix/lead-sources", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const loadedSources = data.sources || [];
        setSources(loadedSources);

        // Buscar "Pauta Facebook - WhatsApp" o similar y establecerlo por defecto
        const facebookWhatsAppSource = loadedSources.find(
          (s: BitrixSource) =>
            s.name.toLowerCase().includes("pauta") &&
            s.name.toLowerCase().includes("facebook") &&
            s.name.toLowerCase().includes("whatsapp")
        );

        if (facebookWhatsAppSource) {
          setSelectedSource(facebookWhatsAppSource.id);
        }
      } else {
        console.error("Failed to load sources");
      }
    } catch (error) {
      console.error("Error loading sources:", error);
    } finally {
      setLoadingSources(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !phone) {
      alert("Por favor completa los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch("/api/bitrix/create-lead", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone,
          responsibleId: selectedUser?.id || undefined,
          statusId: selectedStatus || undefined,
          sourceId: selectedSource || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Prospecto creado exitosamente (ID: ${data.leadId})`);
        if (onSuccess) onSuccess(data.leadId);
        handleClose();
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.message || "No se pudo crear el prospecto"}`);
      }
    } catch (error) {
      console.error("Error creating lead:", error);
      alert("❌ Error al crear el prospecto");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setTitle("");
    setFirstName("");
    setLastName("");
    setSelectedUser(null);
    setSearchTerm("");
    setShowUserDropdown(false);
    onClose();
  }

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Crear Prospecto en Bitrix24</h2>
            </div>
            <button
              onClick={handleClose}
              className="hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Título del Prospecto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Prospecto interesado en productos"
                required
              />
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del prospecto"
              />
            </div>

            {/* Apellidos */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Apellidos
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Apellidos del prospecto"
              />
            </div>

            {/* Teléfono (readonly) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={phone}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600"
              />
            </div>

            {/* Etapa */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Etapa
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loadingStatuses}
              >
                {loadingStatuses ? (
                  <option>Cargando etapas...</option>
                ) : (
                  statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Origen */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Origen
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loadingSources}
              >
                <option value="">Seleccionar origen...</option>
                {loadingSources ? (
                  <option>Cargando orígenes...</option>
                ) : (
                  sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Responsable */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Responsable
              </label>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={selectedUser ? selectedUser.fullName : searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSelectedUser(null);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={loadingUsers ? "Cargando usuarios..." : "Buscar empleado..."}
                    disabled={loadingUsers}
                  />
                  {selectedUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchTerm("");
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown de usuarios */}
                {showUserDropdown && !selectedUser && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        No se encontraron usuarios
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setSearchTerm("");
                            setShowUserDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <div className="font-medium text-slate-900">{user.fullName}</div>
                          {user.position && (
                            <div className="text-xs text-slate-500">{user.position}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedUser && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Seleccionado: {selectedUser.fullName}</span>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Crear Prospecto
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
