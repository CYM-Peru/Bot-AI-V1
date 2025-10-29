import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../lib/apiBase";

interface AdvisorStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  action: "accept" | "redirect" | "pause";
  redirectToQueue?: string;
  isDefault: boolean;
  order: number;
}

interface AdvisorStatusButtonProps {
  userId: string; // ID del asesor actual
}

export function AdvisorStatusButton({ userId }: AdvisorStatusButtonProps) {
  const [currentStatus, setCurrentStatus] = useState<AdvisorStatus | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<AdvisorStatus[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStatuses();
    loadCurrentStatus();
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const loadStatuses = async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/advisor-statuses"));
      if (response.ok) {
        const data = await response.json();
        setAvailableStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error("Error loading statuses:", error);
    }
  };

  const loadCurrentStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/advisor-status/${userId}`));
      if (response.ok) {
        const data = await response.json();
        if (data.status) {
          setCurrentStatus(data.status);
        } else if (data.defaultStatus) {
          setCurrentStatus(data.defaultStatus);
        }
      }
    } catch (error) {
      console.error("Error loading current status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = async (status: AdvisorStatus) => {
    try {
      const response = await fetch(apiUrl(`/api/admin/advisor-status/${userId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: status.id }),
      });

      if (response.ok) {
        setCurrentStatus(status);
        setShowMenu(false);
      }
    } catch (error) {
      console.error("Error changing status:", error);
    }
  };

  if (loading || !currentStatus) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="h-3 w-3 rounded-full bg-slate-300 animate-pulse" />
        <span className="text-sm text-slate-500">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 shadow-sm"
        title="Cambiar estado"
      >
        <div
          className="h-3 w-3 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: currentStatus.color }}
        />
        <span className="text-sm">{currentStatus.name}</span>
        <svg
          className={`h-4 w-4 transition-transform ${showMenu ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-2xl z-50">
          <div className="bg-gradient-to-r from-emerald-50 to-white px-4 py-3 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cambiar estado</p>
          </div>
          <div className="py-2">
            {availableStatuses.map((status) => {
              const isActive = status.id === currentStatus.id;
              return (
                <button
                  key={status.id}
                  onClick={() => handleChangeStatus(status)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: status.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{status.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{status.description}</p>
                  </div>
                  {isActive && (
                    <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
            <p className="text-xs text-slate-500">
              Tu estado controla si recibes nuevos chats
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
