import { useMemo, useState } from "react";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}

type FilterType = "all" | "unread" | "attending" | "archived";
type SortType = "recent" | "unread" | "name";

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");

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

    // Apply search
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((item) => {
        const name = item.contactName?.toLowerCase() ?? "";
        return name.includes(term) || item.phone.includes(term);
      });
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
  }, [conversations, search, filter, sort]);

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
        <button
          onClick={exportToCSV}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar ({filtered.length})
        </button>
      </div>

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
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-emerald-50 ${
                      isActive ? "bg-emerald-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                      <span>{conversation.contactName || conversation.phone}</span>
                      <span className="text-xs font-medium text-slate-400">
                        {formatTimestamp(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="line-clamp-2 max-w-[220px]">
                        {conversation.lastMessagePreview || "Sin mensajes"}
                      </span>
                      {conversation.unread > 0 && (
                        <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                          {conversation.unread}
                        </span>
                      )}
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
