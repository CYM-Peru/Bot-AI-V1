import { useMemo, useState, useEffect, useRef } from "react";
import type { Conversation, ChannelType } from "./types";
import { getChannelColor, getNumberLabel } from "./channelColors";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  currentUserEmail?: string;
}

// Generate consistent color for advisor based on their ID
function getAdvisorColor(advisorId: string): string {
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#06B6D4', // cyan
    '#6366F1', // indigo
    '#EF4444', // red
    '#14B8A6', // teal
    '#F97316', // orange
  ];

  // Use hash of ID to select color
  let hash = 0;
  for (let i = 0; i < advisorId.length; i++) {
    hash = advisorId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Get initials from advisor ID (use advisor name if available)
function getAdvisorInitials(advisorId: string, advisors?: Array<{ id: string; name: string }>): string {
  if (advisors) {
    const advisor = advisors.find((a) => a.id === advisorId);
    if (advisor?.name) {
      // Get initials from name (e.g., "Christian Palomino" -> "CP")
      return advisor.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
  }
  // Fallback: first 2 chars of ID
  return advisorId.substring(0, 2).toUpperCase();
}

// Get status color based on conversation state (for the small dot)
function getStatusColor(conversation: Conversation, currentUserEmail?: string): string {
  // Purple for my chats (assigned to me)
  if (currentUserEmail && conversation.attendedBy?.includes(currentUserEmail) && conversation.status !== "archived") {
    return '#8B5CF6'; // purple
  }

  // Status-based colors
  if (conversation.status === "archived") {
    return '#10B981'; // green check
  }
  if (conversation.status === "attending") {
    return '#10B981'; // green
  }
  if (conversation.unread > 0) {
    return '#3B82F6'; // blue
  }

  return '#94A3B8'; // gray (read/no pending)
}

type FilterType = "all" | "unread" | "attending" | "archived" | "assigned_to_me";
type SortType = "recent" | "unread" | "name";
type DateFilter = "all" | "today" | "week" | "month" | "custom";

interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string | null;
  isActive: boolean;
}

// Channel colors for left border
const CHANNEL_COLORS: Record<ChannelType, string> = {
  whatsapp: '#25D366',
  facebook: '#1877F2',
  instagram: '#E4405F',
  tiktok: '#000000',
};

export default function ConversationList({ conversations, selectedId, onSelect, currentUserEmail }: ConversationListProps) {
  // Force cache bust v2025-11-01-00-45
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Multi-channel filters
  const [channelFilter, setChannelFilter] = useState<ChannelType | "all">("all");
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);

  // Advisors list for showing real names/initials
  const [advisors, setAdvisors] = useState<Array<{ id: string; name: string }>>([]);

  // Queues list for transfer dropdown
  const [queues, setQueues] = useState<Array<{ id: string; name: string }>>([]);

  // Pulse animation state for "Todas" tab when new chats arrive
  const [shouldPulseAll, setShouldPulseAll] = useState(false);
  const prevAllCountRef = useRef<number>(0);

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

  // Load advisors for showing real names/initials
  useEffect(() => {
    fetch('/api/admin/advisors', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.advisors) {
          setAdvisors(data.advisors);
        }
      })
      .catch(err => console.error('Error loading advisors:', err));
  }, []);

  // Load queues for transfer dropdown
  useEffect(() => {
    fetch('/api/admin/queues', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.queues) {
          setQueues(data.queues);
        }
      })
      .catch(err => console.error('Error loading queues:', err));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    let result = [...conversations];

    // Apply filter
    if (filter === "assigned_to_me") {
      // "Mis Chats" = conversations I have attended (not archived)
      result = result.filter((item) =>
        currentUserEmail && item.attendedBy && item.attendedBy.includes(currentUserEmail) && item.status !== "archived"
      );
    } else if (filter === "unread") {
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

    // Apply channel filter
    if (channelFilter !== "all") {
      result = result.filter((item) => item.channel === channelFilter);
    }

    // Apply WhatsApp connection filter
    if (connectionFilter !== "all") {
      result = result.filter((item) => item.channelConnectionId === connectionFilter);
    }

    // Apply sort - IMPORTANT: Create new array to avoid mutation
    if (sort === "recent") {
      result = [...result].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } else if (sort === "unread") {
      result = [...result].sort((a, b) => b.unread - a.unread || b.lastMessageAt - a.lastMessageAt);
    } else if (sort === "name") {
      result = [...result].sort((a, b) => {
        const nameA = a.contactName || a.phone;
        const nameB = b.contactName || b.phone;
        return nameA.localeCompare(nameB);
      });
    }

    return result;
  }, [conversations, search, filter, sort, dateFilter, customDateStart, customDateEnd, channelFilter, connectionFilter, currentUserEmail]);

  const unreadCount = conversations.filter((c) => c.unread > 0 && c.status !== "archived").length;
  const attendingCount = conversations.filter((c) => c.status === "attending").length;
  const archivedCount = conversations.filter((c) => c.status === "archived").length;
  const assignedToMeCount = currentUserEmail
    ? conversations.filter((c) => c.attendedBy && c.attendedBy.includes(currentUserEmail) && c.status !== "archived").length
    : 0;

  // Count of all active/attending conversations (for detecting new chats)
  const allActiveCount = conversations.filter((c) => c.status === "active" || c.status === "attending").length;

  // Trigger pulse animation on "Todas" tab when a new conversation arrives
  useEffect(() => {
    if (allActiveCount > prevAllCountRef.current && prevAllCountRef.current > 0) {
      setShouldPulseAll(true);
      // Remove pulse after 3 seconds
      const timer = setTimeout(() => setShouldPulseAll(false), 3000);
      return () => clearTimeout(timer);
    }
    prevAllCountRef.current = allActiveCount;
  }, [allActiveCount]);

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

          {(dateFilter !== "all" || customDateStart || customDateEnd || channelFilter !== "all" || connectionFilter !== "all") && (
            <button
              onClick={() => {
                setDateFilter("all");
                setCustomDateStart("");
                setCustomDateEnd("");
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

      {/* Filter tabs - PASTEL GRADIENTS */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {currentUserEmail && (
          <button
            onClick={() => setFilter("assigned_to_me")}
            className={`flex-1 px-2 py-2 text-xs font-semibold transition rounded-t-lg ${
              filter === "assigned_to_me"
                ? "border-b-2 border-purple-500 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📌 Mis Chats {assignedToMeCount > 0 && `(${assignedToMeCount})`}
          </button>
        )}
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition rounded-t-lg ${
            filter === "all"
              ? "border-b-2 border-emerald-500 bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          } ${shouldPulseAll ? "animate-pulse-scale" : ""}`}
        >
          Todas {allActiveCount > 0 && `(${allActiveCount})`}
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition rounded-t-lg ${
            filter === "unread"
              ? "border-b-2 border-blue-500 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          No leídas {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setFilter("attending")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition rounded-t-lg ${
            filter === "attending"
              ? "border-b-2 border-green-500 bg-gradient-to-br from-green-100 to-green-200 text-green-700 shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Atendiendo {attendingCount > 0 && `(${attendingCount})`}
        </button>
        <button
          onClick={() => setFilter("archived")}
          className={`flex-1 px-2 py-2 text-xs font-semibold transition rounded-t-lg ${
            filter === "archived"
              ? "border-b-2 border-emerald-500 bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ✅ Finalizadas {archivedCount > 0 && `(${archivedCount})`}
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

              // Get channel color for left border
              const channelColor = CHANNEL_COLORS[conversation.channel] || CHANNEL_COLORS.whatsapp;

              // Get color scheme for this channel/number
              const colorScheme = getChannelColor(conversation.channelConnectionId);
              const numberLabel = getNumberLabel(conversation.displayNumber, conversation.channelConnectionId);

              // Get status color (for dot indicator)
              const statusColor = getStatusColor(conversation, currentUserEmail);

              // Get advisor info if assigned
              const assignedAdvisor = conversation.assignedTo || (conversation.attendedBy && conversation.attendedBy.length > 0 ? conversation.attendedBy[0] : null);

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    style={{ borderLeftColor: channelColor }}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-emerald-50 border-l-4 ${
                      isActive ? "bg-emerald-50" : "bg-white"
                    }`}
                  >
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="truncate text-sm font-semibold text-slate-800">{displayName}</span>
                          {/* Advisor badge - PROFESSIONAL */}
                          {assignedAdvisor && (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white flex-shrink-0 shadow-md ring-2 ring-white"
                              style={{ backgroundColor: getAdvisorColor(assignedAdvisor) }}
                              title={`Atendido por: ${advisors.find(a => a.id === assignedAdvisor)?.name || assignedAdvisor}`}
                            >
                              {getAdvisorInitials(assignedAdvisor, advisors)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                          {formatTimestamp(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Number badge */}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorScheme.bg} ${colorScheme.text} ${colorScheme.border} border flex-shrink-0`}>
                          📱 {numberLabel}
                        </span>
                        {/* Status badge - PASTEL WITH GRADIENT */}
                        {/* Mis Chats */}
                        {currentUserEmail && conversation.attendedBy?.includes(currentUserEmail) && conversation.status !== "archived" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 shadow-sm">
                            Mis chats
                          </span>
                        )}
                        {/* Finalizada */}
                        {conversation.status === "archived" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 shadow-sm">
                            Finalizada
                          </span>
                        )}
                        {/* Atendiendo */}
                        {conversation.status === "attending" && !(currentUserEmail && conversation.attendedBy?.includes(currentUserEmail)) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 bg-gradient-to-br from-green-100 to-green-200 text-green-700 shadow-sm">
                            Atendiendo
                          </span>
                        )}
                        {/* No leído */}
                        {conversation.unread > 0 && conversation.status !== "archived" && conversation.status !== "attending" && !(currentUserEmail && conversation.attendedBy?.includes(currentUserEmail)) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 shadow-sm">
                            No leído
                          </span>
                        )}
                        {/* Leído */}
                        {conversation.unread === 0 && conversation.status !== "archived" && conversation.status !== "attending" && !(currentUserEmail && conversation.attendedBy?.includes(currentUserEmail)) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 shadow-sm">
                            Leído
                          </span>
                        )}
                        <span className="text-slate-400 text-[10px] truncate flex-shrink-0">{displaySubtext}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Quick action buttons - LEFT SIDE */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Transfer dropdown */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === conversation.id ? null : conversation.id);
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                            >
                              Transferir
                            </button>
                            {/* Dropdown menu */}
                            {openDropdownId === conversation.id && (
                              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                {/* Transfer to Bot */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(null);
                                    fetch(`/api/crm/conversations/${conversation.id}/transfer-to-bot`, {
                                      method: 'POST',
                                      credentials: 'include',
                                    }).then(() => window.location.reload());
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 rounded-t-lg transition"
                                >
                                  🤖 A Bot
                                </button>

                                {/* Transfer to Advisor - with submenu */}
                                <div className="border-t border-slate-100">
                                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 bg-slate-50">
                                    👤 A Asesor
                                  </div>
                                  <div className="max-h-40 overflow-y-auto">
                                    {advisors.length === 0 ? (
                                      <div className="px-3 py-2 text-xs text-slate-400 italic">
                                        No hay asesores
                                      </div>
                                    ) : (
                                      advisors.map((advisor) => (
                                        <button
                                          key={advisor.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdownId(null);
                                            fetch(`/api/crm/conversations/${conversation.id}/assign`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({ advisorId: advisor.id }),
                                            }).then(() => window.location.reload());
                                          }}
                                          className="w-full px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-purple-50 transition"
                                        >
                                          {advisor.name}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>

                                {/* Transfer to Queue - with submenu */}
                                <div className="border-t border-slate-100">
                                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 bg-slate-50">
                                    📋 A Cola
                                  </div>
                                  <div className="max-h-40 overflow-y-auto">
                                    {queues.length === 0 ? (
                                      <div className="px-3 py-2 text-xs text-slate-400 italic">
                                        No hay colas
                                      </div>
                                    ) : (
                                      queues.map((queue) => (
                                        <button
                                          key={queue.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdownId(null);
                                            fetch(`/api/crm/conversations/${conversation.id}/transfer-to-queue`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({ queueId: queue.id }),
                                            }).then(() => window.location.reload());
                                          }}
                                          className="w-full px-4 py-1.5 text-left text-xs text-slate-700 hover:bg-emerald-50 rounded-b-lg transition"
                                        >
                                          {queue.name}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Last message preview - RIGHT SIDE */}
                        <span className="line-clamp-1 truncate flex-1 min-w-0 text-xs text-slate-500">
                          {conversation.lastMessagePreview || "Sin mensajes"}
                        </span>

                        {/* Unread count badge */}
                        {conversation.unread > 0 && (
                          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white flex-shrink-0">
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

      {/* Pulse animation for Mis Chats tab */}
      <style>{`
        @keyframes pulse-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        .animate-pulse-scale {
          animation: pulse-scale 0.6s ease-in-out 3;
        }
      `}</style>
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
