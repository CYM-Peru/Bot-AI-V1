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
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm text-blue-800">
          No se encontró un contacto en Bitrix24 para <strong>{conversation.phone}</strong>
        </p>
        <button
          onClick={() => handleCreateContact()}
          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          ➕ Crear contacto en Bitrix24
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-emerald-600">CONTACTO BITRIX24</p>
          <p className="mt-1 text-base font-semibold text-emerald-900">{buildName(contact) || "Sin nombre"}</p>
          {contact.COMPANY_TITLE && (
            <p className="text-sm text-emerald-700">🏢 {contact.COMPANY_TITLE}</p>
          )}
          {contact.POST && (
            <p className="text-xs text-emerald-600">{contact.POST}</p>
          )}
        </div>
        {contact.ID && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
            ID: {contact.ID}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-emerald-800">
        {contact.PHONE?.[0]?.VALUE && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-600">📞</span>
            <span>{contact.PHONE[0].VALUE}</span>
          </div>
        )}
        {contact.EMAIL?.[0]?.VALUE && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-600">✉️</span>
            <span className="text-xs">{contact.EMAIL[0].VALUE}</span>
          </div>
        )}
      </div>

      {contact.DATE_MODIFY && (
        <p className="mt-2 text-xs text-emerald-600">
          Última modificación: {new Date(contact.DATE_MODIFY).toLocaleDateString("es-PE")}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {conversation.bitrixId && (
          <a
            href={`https://www.bitrix24.net/crm/contact/details/${conversation.bitrixId}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            🔗 Abrir en Bitrix24
          </a>
        )}
        <button
          onClick={() => window.open(`tel:${conversation.phone}`, "_self")}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          📞 Llamar
        </button>
      </div>
    </div>
  );
}

function buildName(contact: BitrixContact): string {
  const parts = [contact.NAME, contact.LAST_NAME].filter(Boolean);
  return parts.join(" ");
}
