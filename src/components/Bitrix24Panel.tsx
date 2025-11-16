import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../lib/apiBase';

interface BitrixStatus {
  ok: boolean;
  portal?: string | null;
  user?: { id: string; name?: string | null; lastName?: string | null } | null;
  scopes?: string[];
  reason?: string | null;
  status?: number | null;
}

export function Bitrix24Panel() {
  const [status, setStatus] = useState<BitrixStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/bitrix/validate');
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

  const badgeInfo = useMemo(() => {
    if (status?.ok) {
      return { className: 'bg-emerald-100 text-emerald-700', label: 'Conectado' };
    }

    const reason = status?.reason ?? 'not_authorized';
    const labels: Record<string, string> = {
      not_authorized: 'No autorizado',
      provider_error: 'Error proveedor',
      network_error: 'Error de red',
      unknown_error: 'Error desconocido',
    };

    return { className: 'bg-rose-100 text-rose-700', label: labels[reason] ?? `Sin conexión (${reason})` };
  }, [status]);

  const handleFetchAuthUrl = useCallback(async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/bitrix/oauth/url');
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? 'No se pudo generar URL de autorización');
      }
      setAuthUrl(payload.url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando URL de autorización');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-2xl font-bold text-slate-800">🔗 Integración Bitrix24</h2>
        <p className="text-sm text-slate-600">Validamos tokens y portal contra la API oficial de Bitrix.</p>
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
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeInfo.className}`}>
              {badgeInfo.label}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Usuario vinculado</p>
              {status?.user ? (
                <p>
                  {status.user.name ?? ''} {status.user.lastName ?? ''} · ID {status.user.id}
                </p>
              ) : (
                <p>No hay sesión activa</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Scopes</p>
              {status?.scopes && status.scopes.length > 0 ? (
                <p>{status.scopes.join(', ')}</p>
              ) : (
                <p>Scopes no disponibles</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void refreshStatus()} disabled={loading} className="btn btn--ghost">
              {loading ? 'Verificando…' : 'Revisar estado'}
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </section>

        {!status?.ok && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Autorizar Bitrix24</h3>
            <p>
              Necesitas completar el flujo OAuth de Bitrix24 para obtener tokens válidos. Presiona el botón para generar la URL
              de autorización.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn--secondary" onClick={() => void handleFetchAuthUrl()} disabled={authLoading}>
                {authLoading ? 'Generando…' : 'Obtener URL OAuth'}
              </button>
              {authUrl && (
                <a href={authUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-600">
                  Abrir autorización Bitrix24
                </a>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Cómo conectar Bitrix24</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>Configura la aplicación Bitrix24 con permisos para CRM y generará la URL OAuth arriba.</li>
            <li>Una vez completado el flujo, vuelve a “Revisar estado” hasta ver el estado en verde.</li>
            <li>Los contactos sincronizados aparecerán en el CRM automáticamente.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
