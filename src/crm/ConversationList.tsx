import { useMemo, useState, useEffect } from "react";
import type { Conversation, ChannelType } from "./types";
import { Avatar } from "./Avatar";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}

type FilterType = "all" | "unread" | "attending" | "archived";
type SortType = "recent" | "unread" | "name";
type DateFilter = "all" | "today" | "week" | "month" | "custom";

interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string | null;
  isActive: boolean;
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  // New multi-channel filters
  const [advisorFilter, setAdvisorFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelType | "all">("all");
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);

  // Load WhatsApp connections for filter dropdown
  useEffect(() => {
    fetch('/api/connections/whatsapp/list')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setWhatsappConnections(data.connections);
        }
      })
      .catch(err => console.error('Error loading WhatsApp connections:', err));
  }, []);

  const filtered = useMemo(() => {
    let result = [...conversations];

    // Apply filter
    if (filter === "unread") {
      result = result.filter((item) => item.unread > 0 && item.status !== "archived");
    } else if (filter === "attending") {
      result = result.filter((item) => item.status === "attending");
    } else if (filter === "archived") {
      result = result.filter((item) => item.status === "archived");
    } else {
      // "all" - active and attending conversations
      result = result.filter((item) => item.status === "active" || item.status === "attending");
    }

    // Apply date filter
    const now = Date.now();
    if (dateFilter === "today") {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      result = result.filter((item) => item.lastMessageAt >= todayStart);
    } else if (dateFilter === "week") {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((item) => item.lastMessageAt >= weekAgo);
    } else if (dateFilter === "month") {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((item) => item.lastMessageAt >= monthAgo);
    } else if (dateFilter === "custom" && customDateStart && customDateEnd) {
      const start = new Date(customDateStart).getTime();
      const end = new Date(customDateEnd).setHours(23, 59, 59, 999);
      result = result.filter((item) => item.lastMessageAt >= start && item.lastMessageAt <= end);
    }

    // Apply search
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((item) => {
        const name = item.contactName?.toLowerCase() ?? "";
        return name.includes(term) || item.phone.includes(term);
      });
    }

    // Apply advisor filter
    if (advisorFilter !== "all") {
      if (advisorFilter === "me") {
        // TODO: Get current user email from auth context
        // For now, filter by conversations with any assignment
        result = result.filter((item) => item.assignedTo);
      } else if (advisorFilter === "unassigned") {
        result = result.filter((item) => !item.assignedTo);
      } else {
        // Filter by specific advisor email
        result = result.filter((item) => item.assignedTo === advisorFilter);
      }
    }

    // Apply channel filter
    if (channelFilter !== "all") {
      result = result.filter((item) => item.channel === channelFilter);
    }

    // Apply WhatsApp connection filter
    if (connectionFilter !== "all") {
      result = result.filter((item) => item.channelConnectionId === connectionFilter);
    }

    // Apply sort
    if (sort === "recent") {
      result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } else if (sort === "unread") {
      result.sort((a, b) => b.unread - a.unread || b.lastMessageAt - a.lastMessageAt);
    } else if (sort === "name") {
      result.sort((a, b) => {
        const nameA = a.contactName || a.phone;
        const nameB = b.contactName || b.phone;
        return nameA.localeCompare(nameB);
      });
    }

    return result;
  }, [conversations, search, filter, sort, dateFilter, customDateStart, customDateEnd, advisorFilter, channelFilter, connectionFilter]);

  const unreadCount = conversations.filter((c) => c.unread > 0 && c.status !== "archived").length;
  const attendingCount = conversations.filter((c) => c.status === "attending").length;
  const archivedCount = conversations.filter((c) => c.status === "archived").length;

  const exportToCSV = () => {
    const headers = ["Teléfono", "Nombre", "Estado", "No leídos", "Último mensaje"];
    const rows = filtered.map((c) => [
      c.phone,
      c.contactName || "-",
      c.status,
      c.unread.toString(),
      new Date(c.lastMessageAt).toLocaleString("es-PE"),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `conversaciones_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-slate-200 space-y-2">
        <div className="relative">
          <input
            type="search"
            placeholder="Buscar contacto o número..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring focus:ring-emerald-100"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold border rounded-lg transition ${
              showAdvancedFilters
                ? "text-blue-700 bg-blue-50 border-blue-200"
                : "text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
          </button>
          <button
            onClick={exportToCSV}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar ({filtered.length})
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-100"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Últimos 30 días</option>
              <option value="custom">Rango personalizado</option>
            </select>
          </div>

          {dateFilter === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => setCustomDateStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => setCustomDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-100"
                />
              </div>
            </div>
          )}

          {/* Advisor Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Asesor</label>
            <select
              value={advisorFilter}
              onChange={(e) => setAdvisorFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-100"
            >
              <option value="all">Todos los asesores</option>
              <option value="me">Mis chats</option>
              <option value="unassigned">Sin asignar</option>
            </select>
          </div>

          {/* Channel Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Canal</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as ChannelType | "all")}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-100"
            >
              <option value="all">Todos los canales</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>

          {/* WhatsApp Connection Filter - Only show when WhatsApp channel is selected */}
          {(channelFilter === "whatsapp" || channelFilter === "all") && whatsappConnections.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Número WhatsApp</label>
              <select
                value={connectionFilter}
                onChange={(e) => setConnectionFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring focus:ring-blue-100"
              >
                <option value="all">Todos los números</option>
                {whatsappConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.alias} - {conn.displayNumber || conn.phoneNumberId}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(dateFilter !== "all" || customDateStart || customDateEnd || advisorFilter !== "all" || channelFilter !== "all" || connectionFilter !== "all") && (
            <button
              onClick={() => {
                setDateFilter("all");
                setCustomDateStart("");
                setCustomDateEnd("");
                setAdvisorFilter("all");
                setChannelFilter("all");
                setConnectionFilter("all");
              }}
              className="w-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition ${
            filter === "all"
              ? "border-b-2 border-emerald-500 bg-white text-emerald-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition ${
            filter === "unread"
              ? "border-b-2 border-emerald-500 bg-white text-emerald-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          No leídas {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setFilter("attending")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition ${
            filter === "attending"
              ? "border-b-2 border-blue-500 bg-white text-blue-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Atendiendo {attendingCount > 0 && `(${attendingCount})`}
        </button>
        <button
          onClick={() => setFilter("archived")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition ${
            filter === "archived"
              ? "border-b-2 border-emerald-500 bg-white text-emerald-700"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Archivadas {archivedCount > 0 && `(${archivedCount})`}
        </button>
      </div>

      {/* Sort options */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-xs text-slate-500">Ordenar:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="flex-1 rounded border border-slate-200 px-2 py-0.5 text-xs focus:border-emerald-400 focus:outline-none"
        >
          <option value="recent">Más recientes</option>
          <option value="unread">No leídos primero</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm font-semibold text-slate-600">No hay conversaciones</p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? "Intenta con otro término de búsqueda" : "Las nuevas conversaciones aparecerán aquí"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((conversation) => {
              const isActive = conversation.id === selectedId;
              // Si tiene bitrixId, mostrar nombre + documento; sino, mostrar teléfono
              const displayName = conversation.bitrixId && conversation.contactName
                ? conversation.contactName
                : conversation.contactName || conversation.phone;
              const displaySubtext = conversation.bitrixId && conversation.bitrixDocument
                ? `Doc: ${conversation.bitrixDocument}`
                : conversation.phone;

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-emerald-50 ${
                      isActive ? "bg-emerald-50" : "bg-white"
                    }`}
                  >
                    {/* Avatar */}
                    <Avatar
                      src={conversation.avatarUrl}
                      alt={displayName}
                      size="md"
                      className="flex-shrink-0"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                        <span className="truncate">{displayName}</span>
                        <span className="text-xs font-medium text-slate-400 ml-2 flex-shrink-0">
                          {formatTimestamp(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-slate-400 text-[10px] truncate">{displaySubtext}</span>
                          <span className="line-clamp-1 truncate">
                            {conversation.lastMessagePreview || "Sin mensajes"}
                          </span>
                        </div>
                        {conversation.unread > 0 && (
                          <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white flex-shrink-0">
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "";
  const formatter = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
  return formatter.format(new Date(timestamp));
}
