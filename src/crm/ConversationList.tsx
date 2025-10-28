import { useMemo, useState } from "react";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) => {
      const name = item.contactName?.toLowerCase() ?? "";
      return name.includes(term) || item.phone.includes(term);
    });
  }, [conversations, search]);

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200">
        <input
          type="search"
          placeholder="Buscar contacto o número"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring focus:ring-emerald-100"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">No hay conversaciones activas.</p>
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
