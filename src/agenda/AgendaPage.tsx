import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../lib/apiBase";
import { SendTemplateModal } from "./SendTemplateModal";
import { Search, RefreshCw, Send, Phone, MessageCircle, Eye, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";

interface BitrixContact {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  PHONE?: Array<{ VALUE: string; VALUE_TYPE?: string }>;
  EMAIL?: Array<{ VALUE: string }>;
  COMPANY_TITLE?: string;
  UF_CRM_5DEAADAE301BB?: string; // N° Documento
  UF_CRM_1745466972?: string; // Dirección
  UF_CRM_67D702957E80A?: string; // Tipo de Contacto
  UF_CRM_68121FB2B841A?: string; // Departamento
  UF_CRM_1565801603901?: string; // Stencil
}

interface ContactsResponse {
  contacts: BitrixContact[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function AgendaPage() {
  const [contacts, setContacts] = useState<BitrixContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [contactType, setContactType] = useState("");
  const [company, setCompany] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedContact, setSelectedContact] = useState<BitrixContact | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPhoneSelector, setShowPhoneSelector] = useState(false);
  const [phoneSelectContact, setPhoneSelectContact] = useState<BitrixContact | null>(null);
  const [phoneSelectConversations, setPhoneSelectConversations] = useState<Array<{
    id: string;
    channelConnectionId: string;
    displayNumber: string | null;
    numberAlias: string | null;
    lastMessageAt: number;
    status: string;
  }>>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const limit = 50;

  // Available filter options (extracted from your contacts)
  const departments = [
    "AYACUCHO",
    "LIMA",
    "CUSCO",
    "AREQUIPA",
    "JUNIN",
    "PUNO",
    "PIURA",
    "LA LIBERTAD",
    "LAMBAYEQUE",
    "ICA",
    "HUANUCO",
    "ANCASH",
  ];

  const contactTypes = [
    "Emprendedor",
    "Distribuidor",
    "Colaborador",
    "Cliente",
    "Proveedor",
  ];

  const fetchContacts = useCallback(async (
    pageNum: number,
    searchTerm: string,
    dept: string,
    type: string,
    comp: string,
    isSync = false
  ) => {
    try {
      if (isSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(limit),
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(dept ? { department: dept } : {}),
        ...(type ? { contactType: type } : {}),
        ...(comp ? { company: comp } : {}),
      });

      const response = await authFetch(`/api/bitrix/contacts?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }

      const data: ContactsResponse = await response.json();
      setContacts(data.contacts);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setLastSync(new Date());
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchContacts(1, "", "", "", "");
  }, [fetchContacts]);

  // Auto-sync every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchContacts(page, search, department, contactType, company, true);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [page, search, department, contactType, company, fetchContacts]);

  // Search and filter handler with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchContacts(1, search, department, contactType, company);
    }, 500);

    return () => clearTimeout(timer);
  }, [search, department, contactType, company, fetchContacts]);

  const handleSendTemplate = (contact: BitrixContact) => {
    setSelectedContact(contact);
    setShowTemplateModal(true);
  };

  const handleRefresh = () => {
    fetchContacts(page, search, department, contactType, company, true);
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      fetchContacts(newPage, search, department, contactType, company);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      const newPage = page + 1;
      setPage(newPage);
      fetchContacts(newPage, search, department, contactType, company);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setDepartment("");
    setContactType("");
    setCompany("");
    setPage(1);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (search) count++;
    if (department) count++;
    if (contactType) count++;
    if (company) count++;
    return count;
  };

  const getFullName = (contact: BitrixContact) => {
    const parts = [contact.NAME, contact.LAST_NAME].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Sin nombre";
  };

  const getPhone = (contact: BitrixContact) => {
    if (!contact.PHONE || contact.PHONE.length === 0) return "—";

    // Priorizar teléfono de trabajo (WORK)
    const workPhone = contact.PHONE.find(p => p.VALUE_TYPE === "WORK");
    if (workPhone) return workPhone.VALUE;

    // Si no hay WORK, buscar MOBILE
    const mobilePhone = contact.PHONE.find(p => p.VALUE_TYPE === "MOBILE");
    if (mobilePhone) return mobilePhone.VALUE;

    // Si no hay ninguno, usar el primero disponible
    return contact.PHONE[0]?.VALUE || "—";
  };

  const formatLastSync = () => {
    if (!lastSync) return "Nunca";
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSync.getTime()) / 1000);

    if (diff < 60) return "Hace un momento";
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    return lastSync.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              📇 Agenda de Contactos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {loading ? "Cargando..." : `${total} contactos en Bitrix24`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-500">Última sincronización</p>
              <p className="text-sm font-medium text-slate-700">{formatLastSync()}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className={`p-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all shadow-sm hover:shadow-md ${
                syncing ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Sincronizar ahora"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Filter Bar */}
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 transition-all ${
                showFilters
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-teal-400"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros</span>
              {getActiveFiltersCount() > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-500 text-white text-xs font-bold">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>

            {/* Clear Filters Button (only show when filters are active) */}
            {getActiveFiltersCount() > 0 && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-red-300 bg-white text-red-700 hover:bg-red-50 transition-all"
              >
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">Limpiar</span>
              </button>
            )}

            {/* Active Filters Display */}
            {department && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                Dpto: {department}
                <button onClick={() => setDepartment("")} className="hover:bg-purple-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {contactType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                Tipo: {contactType}
                <button onClick={() => setContactType("")} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {company && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                Empresa: {company}
                <button onClick={() => setCompany("")} className="hover:bg-orange-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Filter Dropdowns (expandable) */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              {/* Department Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Departamento
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-800 text-sm"
                >
                  <option value="">Todos los departamentos</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tipo de Contacto
                </label>
                <select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-800 text-sm"
                >
                  <option value="">Todos los tipos</option>
                  {contactTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Empresa
                </label>
                <input
                  type="text"
                  placeholder="Filtrar por empresa..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-800 text-sm placeholder-slate-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Cargando contactos...</p>
            </div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-lg text-slate-600 mb-2">No se encontraron contactos</p>
              <p className="text-sm text-slate-500">
                {search ? "Intenta con otro término de búsqueda" : "Conecta tu cuenta de Bitrix24"}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Teléfono de Trabajo
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Departamento
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Stencil
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((contact) => (
                  <tr
                    key={contact.ID}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                          {getFullName(contact).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{getFullName(contact)}</p>
                          <p className="text-xs text-slate-500">ID: {contact.ID}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono text-slate-700">{getPhone(contact)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{contact.UF_CRM_68121FB2B841A || "—"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">{contact.UF_CRM_1565801603901 || "—"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Primary Action: Send Template */}
                        <button
                          onClick={() => handleSendTemplate(contact)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md transform hover:scale-105"
                          title="Enviar plantilla WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Plantilla
                        </button>

                        {/* Secondary Actions */}
                        <button
                          onClick={() => window.open(`tel:${getPhone(contact)}`, "_self")}
                          className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Llamar"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            // Load conversations for this contact's phone
                            setPhoneSelectContact(contact);
                            setShowPhoneSelector(true);
                            setLoadingConversations(true);
                            try {
                              const phone = getPhone(contact).replace(/[^0-9]/g, "");
                              const response = await authFetch(`/api/crm/conversations/search-by-phone?phone=${phone}`);
                              if (response.ok) {
                                const data = await response.json();
                                setPhoneSelectConversations(data.conversations || []);
                              }
                            } catch (error) {
                              console.error("Error loading conversations:", error);
                            } finally {
                              setLoadingConversations(false);
                            }
                          }}
                          className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="Ver conversaciones"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`https://azaleia-peru.bitrix24.es/crm/contact/details/${contact.ID}/`, "_blank")}
                          className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          title="Ver en Bitrix24"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && contacts.length > 0 && (
        <div className="bg-white border-t border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, total)} de {total} contactos
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="px-4 py-2 text-sm font-medium text-slate-700">
                Página {page}
              </span>
              <button
                onClick={handleNextPage}
                disabled={!hasMore}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Template Modal */}
      {showTemplateModal && selectedContact && (
        <SendTemplateModal
          contact={selectedContact}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedContact(null);
          }}
        />
      )}

      {/* Phone Selector Modal - Shows our numbers this contact has talked to */}
      {showPhoneSelector && phoneSelectContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Seleccionar conversación</h3>
                  <p className="text-green-100 text-sm">{getFullName(phoneSelectContact)}</p>
                </div>
                <button
                  onClick={() => {
                    setShowPhoneSelector(false);
                    setPhoneSelectContact(null);
                    setPhoneSelectConversations([]);
                  }}
                  className="text-white/80 hover:text-white transition p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div className="p-6 space-y-2">
              {loadingConversations ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Buscando conversaciones...</p>
                </div>
              ) : phoneSelectConversations.length > 0 ? (
                phoneSelectConversations.map((conv) => {
                  const displayName = conv.numberAlias || conv.displayNumber || conv.channelConnectionId || "Sin nombre";
                  const lastMessageDate = new Date(conv.lastMessageAt);
                  const timeAgo = Math.floor((Date.now() - conv.lastMessageAt) / 1000 / 60 / 60 / 24);
                  const timeText = timeAgo === 0 ? "Hoy" : timeAgo === 1 ? "Ayer" : `Hace ${timeAgo}d`;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        // Navigate to CRM with conversation ID
                        sessionStorage.setItem('crm_open_conversation', conv.id);
                        window.dispatchEvent(new CustomEvent('navigate-to-crm', {
                          detail: { conversationId: conv.id }
                        }));
                        setShowPhoneSelector(false);
                        setPhoneSelectContact(null);
                        setPhoneSelectConversations([]);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center transition-colors flex-shrink-0">
                          <Phone className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{displayName}</p>
                          <p className="text-xs text-slate-500">{timeText}</p>
                        </div>
                      </div>
                      <MessageCircle className="w-5 h-5 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay conversaciones con este contacto</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
