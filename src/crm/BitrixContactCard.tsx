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
  [key: string]: unknown;
}

export default function BitrixContactCard({ conversation }: BitrixContactCardProps) {
  const [contact, setContact] = useState<BitrixContact | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No se encontró un contacto en Bitrix24 para {conversation.phone}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <p className="text-sm font-semibold text-emerald-900">Contacto Bitrix</p>
      <p className="text-sm text-emerald-800">{buildName(contact) || "Sin nombre"}</p>
      <div className="mt-2 space-y-1 text-xs text-emerald-700">
        {contact.PHONE?.[0]?.VALUE && <p>📞 {contact.PHONE[0].VALUE}</p>}
        {contact.EMAIL?.[0]?.VALUE && <p>✉️ {contact.EMAIL[0].VALUE}</p>}
      </div>
      {conversation.bitrixId && (
        <a
          href={`https://www.bitrix24.net/company/personal/user/${conversation.bitrixId}/`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 underline"
        >
          Abrir en Bitrix24
        </a>
      )}
    </div>
  );
}

function buildName(contact: BitrixContact): string {
  const parts = [contact.NAME, contact.LAST_NAME].filter(Boolean);
  return parts.join(" ");
}
