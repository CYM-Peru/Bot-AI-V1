import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../lib/apiBase";
import { SendTemplateModal } from "./SendTemplateModal";
import { Search, RefreshCw, Send, Phone, MessageCircle, Eye, ChevronLeft, ChevronRight, Filter, X, Settings2, Check, FileText } from "lucide-react";

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
  [key: string]: any; // Permitir cualquier campo adicional de Bitrix
}

interface BitrixLead {
  ID: string;
  TITLE?: string;
  NAME?: string;
  LAST_NAME?: string;
  PHONE?: Array<{ VALUE: string; VALUE_TYPE?: string }>;
  EMAIL?: Array<{ VALUE: string }>;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  UF_CRM_1662413427?: string; // Departamentos
  ASSIGNED_BY_ID?: string;
  DATE_CREATE?: string;
  [key: string]: any; // Permitir cualquier campo adicional de Bitrix
}

type EntityType = "contact" | "lead";
type BitrixEntity = BitrixContact | BitrixLead;

interface ContactsResponse {
  contacts: BitrixContact[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface LeadsResponse {
  leads: BitrixLead[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Definición de columnas disponibles para cada entidad
interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible: boolean;
  getValue: (entity: BitrixEntity) => string;
}

const CONTACT_COLUMNS: ColumnDefinition[] = [
  { id: "name", label: "Nombre", defaultVisible: true, getValue: (e) => {
    const c = e as BitrixContact;
    return [c.NAME, c.LAST_NAME].filter(Boolean).join(" ") || "Sin nombre";
  }},
  { id: "phone", label: "Teléfono", defaultVisible: true, getValue: (e) => {
    const c = e as BitrixContact;
    if (!c.PHONE || c.PHONE.length === 0) return "—";
    const workPhone = c.PHONE.find(p => p.VALUE_TYPE === "WORK");
    if (workPhone) return workPhone.VALUE;
    const mobilePhone = c.PHONE.find(p => p.VALUE_TYPE === "MOBILE");
    if (mobilePhone) return mobilePhone.VALUE;
    return c.PHONE[0]?.VALUE || "—";
  }},
  { id: "email", label: "Email", defaultVisible: false, getValue: (e) => {
    const c = e as BitrixContact;
    return c.EMAIL?.[0]?.VALUE || "—";
  }},
  { id: "company", label: "Empresa", defaultVisible: false, getValue: (e) => {
    const c = e as BitrixContact;
    return c.COMPANY_TITLE || "—";
  }},
  { id: "document", label: "N° Documento", defaultVisible: false, getValue: (e) => {
    const c = e as BitrixContact;
    return c.UF_CRM_5DEAADAE301BB || "—";
  }},
  { id: "address", label: "Dirección", defaultVisible: false, getValue: (e) => {
    const c = e as BitrixContact;
    return c.UF_CRM_1745466972 || "—";
  }},
  { id: "contactType", label: "Tipo de Contacto", defaultVisible: false, getValue: (e) => {
    const c = e as BitrixContact;
    return c.UF_CRM_67D702957E80A || "—";
  }},
  { id: "department", label: "Departamento", defaultVisible: true, getValue: (e) => {
    const c = e as BitrixContact;
    return c.UF_CRM_68121FB2B841A || "—";
  }},
  { id: "stencil", label: "Stencil", defaultVisible: true, getValue: (e) => {
    const c = e as BitrixContact;
    return c.UF_CRM_1565801603901 || "—";
  }},
];

const LEAD_COLUMNS: ColumnDefinition[] = [
  { id: "title", label: "Título", defaultVisible: true, getValue: (e) => {
    const l = e as BitrixLead;
    return l.TITLE || "Sin título";
  }},
  { id: "name", label: "Nombre", defaultVisible: true, getValue: (e) => {
    const l = e as BitrixLead;
    return [l.NAME, l.LAST_NAME].filter(Boolean).join(" ") || "Sin nombre";
  }},
  { id: "phone", label: "Teléfono", defaultVisible: true, getValue: (e) => {
    const l = e as BitrixLead;
    if (!l.PHONE || l.PHONE.length === 0) return "—";
    const workPhone = l.PHONE.find(p => p.VALUE_TYPE === "WORK");
    if (workPhone) return workPhone.VALUE;
    const mobilePhone = l.PHONE.find(p => p.VALUE_TYPE === "MOBILE");
    if (mobilePhone) return mobilePhone.VALUE;
    return l.PHONE[0]?.VALUE || "—";
  }},
  { id: "email", label: "Email", defaultVisible: false, getValue: (e) => {
    const l = e as BitrixLead;
    return l.EMAIL?.[0]?.VALUE || "—";
  }},
  { id: "status", label: "Estado", defaultVisible: true, getValue: (e) => {
    const l = e as BitrixLead;
    return l.STATUS_ID || "—";
  }},
  { id: "source", label: "Fuente", defaultVisible: false, getValue: (e) => {
    const l = e as BitrixLead;
    return l.SOURCE_ID || "—";
  }},
  { id: "departments", label: "Departamentos", defaultVisible: true, getValue: (e) => {
    const l = e as BitrixLead;
    return l.UF_CRM_1662413427 || "—";
  }},
  { id: "dateCreate", label: "Fecha Creación", defaultVisible: false, getValue: (e) => {
    const l = e as BitrixLead;
    if (!l.DATE_CREATE) return "—";
    return new Date(l.DATE_CREATE).toLocaleDateString("es-PE");
  }},
];

export default function AgendaPage() {
  // Estado de entidad (Contacto o Prospecto)
  const [entityType, setEntityType] = useState<EntityType>(() => {
    return (localStorage.getItem("agenda_entity_type") as EntityType) || "contact";
  });

  // Estado de datos
  const [entities, setEntities] = useState<BitrixEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [contactType, setContactType] = useState("");
  const [company, setCompany] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<BitrixEntity | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPhoneSelector, setShowPhoneSelector] = useState(false);
  const [phoneSelectEntity, setPhoneSelectEntity] = useState<BitrixEntity | null>(null);
  const [phoneSelectConversations, setPhoneSelectConversations] = useState<Array<{
    id: string;
    channelConnectionId: string;
    displayNumber: string | null;
    numberAlias: string | null;
    lastMessageAt: number;
    status: string;
  }>>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Estado del modal de detalles completos
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsEntity, setDetailsEntity] = useState<BitrixEntity | null>(null);

  // Estado de columnas visibles
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(`agenda_visible_columns_${entityType}`);
    if (saved) {
      return JSON.parse(saved);
    }
    const columns = entityType === "contact" ? CONTACT_COLUMNS : LEAD_COLUMNS;
    return columns.filter(col => col.defaultVisible).map(col => col.id);
  });

  const limit = 50;

  // Obtener columnas actuales según el tipo de entidad
  const currentColumns = entityType === "contact" ? CONTACT_COLUMNS : LEAD_COLUMNS;

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

  // Guardar preferencias de columnas
  const saveColumnPreferences = useCallback((columns: string[]) => {
    localStorage.setItem(`agenda_visible_columns_${entityType}`, JSON.stringify(columns));
    setVisibleColumns(columns);
  }, [entityType]);

  // Toggle visibilidad de columna
  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => {
      const newColumns = prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem(`agenda_visible_columns_${entityType}`, JSON.stringify(newColumns));
      return newColumns;
    });
  }, [entityType]);

  // Función para obtener columnas visibles en el orden correcto
  const getVisibleColumnsInOrder = useCallback(() => {
    return currentColumns.filter(col => visibleColumns.includes(col.id));
  }, [currentColumns, visibleColumns]);

  const fetchEntities = useCallback(async (
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

      const endpoint = entityType === "contact"
        ? `/api/bitrix/contacts?${params}`
        : `/api/bitrix/leads?${params}`;

      const response = await fetch(apiUrl(endpoint), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityType}s`);
      }

      if (entityType === "contact") {
        const data: ContactsResponse = await response.json();
        setEntities(data.contacts);
        setTotal(data.total);
        setHasMore(data.hasMore);
      } else {
        const data: LeadsResponse = await response.json();
        setEntities(data.leads);
        setTotal(data.total);
        setHasMore(data.hasMore);
      }

      setLastSync(new Date());
    } catch (error) {
      console.error(`Error fetching ${entityType}s:`, error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [entityType]);

  // Effect para cambio de tipo de entidad
  useEffect(() => {
    localStorage.setItem("agenda_entity_type", entityType);
    // Cargar columnas guardadas para este tipo de entidad
    const saved = localStorage.getItem(`agenda_visible_columns_${entityType}`);
    if (saved) {
      setVisibleColumns(JSON.parse(saved));
    } else {
      const columns = entityType === "contact" ? CONTACT_COLUMNS : LEAD_COLUMNS;
      setVisibleColumns(columns.filter(col => col.defaultVisible).map(col => col.id));
    }
    // Resetear filtros y cargar datos
    setPage(1);
    setSearch("");
    setDepartment("");
    setContactType("");
    setCompany("");
    fetchEntities(1, "", "", "", "");
  }, [entityType, fetchEntities]);

  // Initial load
  useEffect(() => {
    fetchEntities(1, "", "", "", "");
  }, [fetchEntities]);

  // Auto-sync every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEntities(page, search, department, contactType, company, true);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [page, search, department, contactType, company, fetchEntities]);

  // Search and filter handler with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchEntities(1, search, department, contactType, company);
    }, 500);

    return () => clearTimeout(timer);
  }, [search, department, contactType, company, fetchEntities]);

  const handleSendTemplate = (entity: BitrixEntity) => {
    setSelectedEntity(entity);
    setShowTemplateModal(true);
  };

  const handleRefresh = () => {
    fetchEntities(page, search, department, contactType, company, true);
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      fetchEntities(newPage, search, department, contactType, company);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      const newPage = page + 1;
      setPage(newPage);
      fetchEntities(newPage, search, department, contactType, company);
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

  const getFullName = (entity: BitrixEntity) => {
    const parts = [entity.NAME, entity.LAST_NAME].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Sin nombre";
  };

  const getPhone = (entity: BitrixEntity) => {
    if (!entity.PHONE || entity.PHONE.length === 0) return "—";

    // Priorizar teléfono de trabajo (WORK)
    const workPhone = entity.PHONE.find(p => p.VALUE_TYPE === "WORK");
    if (workPhone) return workPhone.VALUE;

    // Si no hay WORK, buscar MOBILE
    const mobilePhone = entity.PHONE.find(p => p.VALUE_TYPE === "MOBILE");
    if (mobilePhone) return mobilePhone.VALUE;

    // Si no hay ninguno, usar el primero disponible
    return entity.PHONE[0]?.VALUE || "—";
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
              📇 Agenda de {entityType === "contact" ? "Contactos" : "Prospectos"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {loading ? "Cargando..." : `${total} ${entityType === "contact" ? "contactos" : "prospectos"} en Bitrix24`}
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

        {/* Toolbar: Entity Selector, Column Config, and Filters */}
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Entity Type Selector */}
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityType)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-blue-300 bg-white text-blue-700 hover:border-blue-400 transition-all text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="contact">👤 Contactos</option>
              <option value="lead">📋 Prospectos</option>
            </select>

            {/* Column Configuration Button */}
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-purple-300 bg-white text-purple-700 hover:border-purple-400 hover:bg-purple-50 transition-all"
              title="Configurar columnas visibles"
            >
              <Settings2 className="w-4 h-4" />
              <span className="text-sm font-medium">Columnas</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-xs font-bold">
                {visibleColumns.length}
              </span>
            </button>

            {/* Filters Button */}
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

          {/* Column Selector (expandable) */}
          {showColumnSelector && (
            <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-purple-900">
                  Seleccionar columnas visibles
                </h3>
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="text-purple-600 hover:text-purple-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {currentColumns.map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-purple-200 hover:border-purple-400 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.id)}
                      onChange={() => toggleColumn(column.id)}
                      className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700">{column.label}</span>
                    {visibleColumns.includes(column.id) && (
                      <Check className="w-3 h-3 text-purple-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

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
        ) : entities.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-lg text-slate-600 mb-2">
                No se encontraron {entityType === "contact" ? "contactos" : "prospectos"}
              </p>
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
                  {/* Columna de ID con avatar siempre visible */}
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">
                    {entityType === "contact" ? "Contacto" : "Prospecto"}
                  </th>
                  {/* Columnas dinámicas basadas en selección del usuario */}
                  {getVisibleColumnsInOrder().map((column) => (
                    <th
                      key={column.id}
                      className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider"
                    >
                      {column.label}
                    </th>
                  ))}
                  {/* Columna de acciones siempre visible */}
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider sticky right-0 bg-slate-50 z-10">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entities.map((entity) => (
                  <tr
                    key={entity.ID}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    {/* Columna de ID con avatar siempre visible */}
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                          {getFullName(entity).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{getFullName(entity)}</p>
                          <p className="text-xs text-slate-500">ID: {entity.ID}</p>
                        </div>
                      </div>
                    </td>
                    {/* Columnas dinámicas */}
                    {getVisibleColumnsInOrder().map((column) => (
                      <td key={column.id} className="px-6 py-4">
                        <p className="text-sm text-slate-700">{column.getValue(entity)}</p>
                      </td>
                    ))}
                    {/* Columna de acciones siempre visible */}
                    <td className="px-6 py-4 sticky right-0 bg-white group-hover:bg-slate-50 z-10">
                      <div className="flex items-center justify-center gap-2">
                        {/* Primary Action: Send Template */}
                        <button
                          onClick={() => handleSendTemplate(entity)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md transform hover:scale-105"
                          title="Enviar plantilla WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Plantilla
                        </button>

                        {/* Secondary Actions */}
                        <button
                          onClick={() => window.open(`tel:${getPhone(entity)}`, "_self")}
                          className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Llamar"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            // Load conversations for this entity's phone
                            setPhoneSelectEntity(entity);
                            setShowPhoneSelector(true);
                            setLoadingConversations(true);
                            try {
                              const phone = getPhone(entity).replace(/[^0-9]/g, "");
                              const response = await fetch(apiUrl(`/api/crm/conversations/search-by-phone?phone=${phone}`), {
                                credentials: "include",
                              });
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
                          onClick={() => {
                            setDetailsEntity(entity);
                            setShowDetailsModal(true);
                          }}
                          className="p-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                          title="Ver todos los detalles"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const type = entityType === "contact" ? "contact" : "lead";
                            window.open(`https://azaleia-peru.bitrix24.es/crm/${type}/details/${entity.ID}/`, "_blank");
                          }}
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
      {!loading && entities.length > 0 && (
        <div className="bg-white border-t border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, total)} de {total} {entityType === "contact" ? "contactos" : "prospectos"}
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
      {showTemplateModal && selectedEntity && (
        <SendTemplateModal
          contact={selectedEntity as BitrixContact}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedEntity(null);
          }}
        />
      )}

      {/* Phone Selector Modal - Shows our numbers this entity has talked to */}
      {showPhoneSelector && phoneSelectEntity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Seleccionar conversación</h3>
                  <p className="text-green-100 text-sm">{getFullName(phoneSelectEntity)}</p>
                </div>
                <button
                  onClick={() => {
                    setShowPhoneSelector(false);
                    setPhoneSelectEntity(null);
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
                        setPhoneSelectEntity(null);
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

      {/* Details Modal - Mostrar TODOS los campos */}
      {showDetailsModal && detailsEntity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Detalles Completos - {entityType === "contact" ? "Contacto" : "Prospecto"}
                  </h3>
                  <p className="text-purple-100 text-sm mt-1">{getFullName(detailsEntity)} (ID: {detailsEntity.ID})</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setDetailsEntity(null);
                  }}
                  className="text-white/80 hover:text-white transition p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(detailsEntity)
                  .sort(([keyA], [keyB]) => {
                    // Priorizar campos importantes
                    const priority: Record<string, number> = {
                      'ID': 1,
                      'NAME': 2,
                      'LAST_NAME': 3,
                      'PHONE': 4,
                      'EMAIL': 5,
                      'COMPANY_TITLE': 6
                    };
                    const prioA = priority[keyA] || 999;
                    const prioB = priority[keyB] || 999;
                    if (prioA !== prioB) return prioA - prioB;
                    return keyA.localeCompare(keyB);
                  })
                  .map(([key, value]) => {
                    // Formatear el valor según el tipo
                    let displayValue = '—';

                    if (value === null || value === undefined || value === '') {
                      displayValue = '—';
                    } else if (Array.isArray(value)) {
                      if (value.length === 0) {
                        displayValue = '—';
                      } else if (key === 'PHONE' || key === 'EMAIL') {
                        // Formateo especial para teléfonos y emails
                        displayValue = value.map((item: any) => {
                          if (typeof item === 'object' && item.VALUE) {
                            const type = item.VALUE_TYPE ? ` (${item.VALUE_TYPE})` : '';
                            return `${item.VALUE}${type}`;
                          }
                          return String(item);
                        }).join(', ');
                      } else {
                        displayValue = JSON.stringify(value, null, 2);
                      }
                    } else if (typeof value === 'object') {
                      displayValue = JSON.stringify(value, null, 2);
                    } else if (typeof value === 'boolean') {
                      displayValue = value ? 'Sí' : 'No';
                    } else {
                      displayValue = String(value);
                    }

                    // Formatear el nombre del campo
                    let fieldName = key;
                    // Mapeo de campos conocidos
                    const fieldLabels: Record<string, string> = {
                      'ID': 'ID',
                      'NAME': 'Nombre',
                      'LAST_NAME': 'Apellido',
                      'PHONE': 'Teléfonos',
                      'EMAIL': 'Emails',
                      'COMPANY_TITLE': 'Empresa',
                      'TITLE': 'Título',
                      'STATUS_ID': 'Estado',
                      'SOURCE_ID': 'Fuente',
                      'ASSIGNED_BY_ID': 'Asignado a',
                      'DATE_CREATE': 'Fecha de Creación',
                      'UF_CRM_5DEAADAE301BB': 'N° Documento',
                      'UF_CRM_1745466972': 'Dirección',
                      'UF_CRM_67D702957E80A': 'Tipo de Contacto',
                      'UF_CRM_68121FB2B841A': 'Departamento',
                      'UF_CRM_1565801603901': 'Stencil',
                      'UF_CRM_1662413427': 'Departamentos'
                    };
                    fieldName = fieldLabels[key] || key;

                    return (
                      <div key={key} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                          {fieldName}
                        </div>
                        <div className="text-sm text-slate-900 break-words whitespace-pre-wrap">
                          {displayValue}
                        </div>
                        {key.startsWith('UF_CRM_') && (
                          <div className="text-xs text-slate-400 mt-1 font-mono">
                            {key}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {Object.keys(detailsEntity).length} campos totales
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const type = entityType === "contact" ? "contact" : "lead";
                    window.open(`https://azaleia-peru.bitrix24.es/crm/${type}/details/${detailsEntity.ID}/`, "_blank");
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Abrir en Bitrix24
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setDetailsEntity(null);
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
