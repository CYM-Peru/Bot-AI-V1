import { useEffect, useState } from "react";
import { apiUrl } from "../lib/apiBase";
import type { Conversation } from "./types";

interface BitrixContactCardProps {
  conversation: Conversation | null;
}

interface BitrixContact {
  ID?: string;
  NAME?: string;
  LAST_NAME?: string;
  PHONE?: Array<{ VALUE: string }>;
  EMAIL?: Array<{ VALUE: string }>;
  COMPANY_TITLE?: string;
  POST?: string;
  ASSIGNED_BY_ID?: string;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  [key: string]: unknown;
}

export default function BitrixContactCard({ conversation }: BitrixContactCardProps) {
  const [contact, setContact] = useState<BitrixContact | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleCreateContact = async () => {
    if (!conversation) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/bitrix/create`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: conversation.phone,
          name: conversation.contactName || "Cliente WhatsApp",
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setContact(data.contact);
        setStatus("created");
      }
    } catch (error) {
      console.error("Error creating contact:", error);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!conversation) {
        setContact(null);
        setStatus(null);
        return;
      }
      setLoading(true);
      setStatus(null);
      try {
        const response = await fetch(apiUrl(`/api/crm/conversations/${conversation.id}/bitrix`));
        if (!response.ok) {
          throw new Error("failed");
        }
        const data = (await response.json()) as { contact: BitrixContact | null; bitrixId: string | null; status?: string };
        if (ignore) return;
        setContact(data.contact);
        setStatus(data.status ?? null);
      } catch (error) {
        if (!ignore) {
          setStatus("error");
          setContact(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Selecciona una conversación para ver detalles de Bitrix.
      </div>
    );
  }

  if (status === "bitrix_not_configured") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Bitrix24 no está configurado. Puedes vincularlo desde el panel de Conexiones.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Buscando contacto…</div>
    );
  }

  if (!contact) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Información de Contacto</p>
            <p className="text-xs text-slate-500 mt-1">Teléfono: {conversation.phone}</p>
            {conversation.contactName && (
              <p className="text-xs text-slate-500">Nombre: {conversation.contactName}</p>
            )}
          </div>
          <button
            onClick={() => handleCreateContact()}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            title="Crear contacto en Bitrix24"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Bitrix
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">No registrado en Bitrix24</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Bitrix24 Registrado</p>
          </div>
          {contact.ID && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-mono text-white">
              #{contact.ID}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-base font-bold text-slate-900">{buildName(contact) || "Sin nombre"}</p>
            {contact.COMPANY_TITLE && (
              <p className="text-sm text-slate-600 mt-0.5">🏢 {contact.COMPANY_TITLE}</p>
            )}
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-3 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
          >
            <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showDetails ? "Ocultar" : "Ver más"}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="border-t border-emerald-200 px-4 py-3 bg-white/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500 font-medium mb-1">Nombre</p>
              <p className="text-slate-900 font-semibold">{contact.NAME || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Apellido</p>
              <p className="text-slate-900 font-semibold">{contact.LAST_NAME || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">N° Documento</p>
              <p className="text-slate-900 font-mono">{(contact.UF_CRM_1234567890 as string) || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Tipo de Contacto</p>
              <p className="text-slate-900">{(contact.TYPE_ID as string) || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Stencil</p>
              <p className="text-slate-900">{(contact.SOURCE_ID as string) || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Líder/Asignado</p>
              <p className="text-slate-900">{contact.ASSIGNED_BY_ID || "—"}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {contact.PHONE?.[0]?.VALUE && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-600">📞</span>
                <span className="text-slate-700 font-mono">{contact.PHONE[0].VALUE}</span>
              </div>
            )}
            {contact.EMAIL?.[0]?.VALUE && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-600">✉️</span>
                <span className="text-slate-700">{contact.EMAIL[0].VALUE}</span>
              </div>
            )}
          </div>

          {contact.DATE_MODIFY && (
            <p className="mt-3 text-xs text-slate-500">
              Última modificación: {new Date(contact.DATE_MODIFY).toLocaleDateString("es-PE", { dateStyle: "medium" })}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {conversation.bitrixId && (
              <a
                href={`https://www.bitrix24.net/crm/contact/details/${conversation.bitrixId}/`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir en Bitrix24
              </a>
            )}
            <button
              onClick={() => window.open(`tel:${conversation.phone}`, "_self")}
              className="inline-flex items-center gap-1 rounded-lg border-2 border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Llamar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildName(contact: BitrixContact): string {
  const parts = [contact.NAME, contact.LAST_NAME].filter(Boolean);
  return parts.join(" ");
}
