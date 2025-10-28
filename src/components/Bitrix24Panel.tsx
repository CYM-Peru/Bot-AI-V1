import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../lib/apiBase';

interface BitrixStatus {
  ok: boolean;
  portal?: string;
  user?: { id: string; name?: string; lastName?: string } | null;
  reason?: string;
}

export function Bitrix24Panel() {
  const [status, setStatus] = useState<BitrixStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/connections/bitrix/check'));
      if (!response.ok) {
        const body = await response.json().catch(() => ({ reason: 'unknown_error' }));
        throw new Error(body.reason ?? 'unknown_error');
      }
      const payload = (await response.json()) as BitrixStatus;
      setStatus(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const badgeClass = status?.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
  const label = status?.ok ? 'Conectado' : status?.reason ? `Sin conexión (${status.reason})` : 'Sin conexión';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-2xl font-bold text-slate-800">🔗 Integración Bitrix24</h2>
        <p className="text-sm text-slate-600">Validamos tokens y portal desde el backend.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Estado actual</p>
              <p className="text-xs text-slate-500">
                {status?.portal ? `Portal: ${status.portal}` : 'Portal no detectado'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{label}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Usuario vinculado</p>
              {status?.user ? (
                <p>
                  {status.user.name} {status.user.lastName} · ID {status.user.id}
                </p>
              ) : (
                <p>No hay sesión activa</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Autorización</p>
              <p>
                {status?.ok
                  ? 'Tokens válidos cargados en el backend.'
                  : 'Autoriza Bitrix24 desde el backend para continuar.'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void refreshStatus()} disabled={loading} className="btn btn--ghost">
              {loading ? 'Verificando…' : 'Revisar estado'}
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Cómo conectar Bitrix24</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>Genera tokens OAuth o webhook desde Bitrix24 y configúralos en el backend.</li>
            <li>Repite la verificación desde este panel hasta ver el estado en verde.</li>
            <li>Una vez conectado, los contactos se sincronizarán automáticamente desde el CRM.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
