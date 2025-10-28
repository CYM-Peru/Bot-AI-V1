import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../lib/apiBase';

interface WhatsAppCheckResponse {
  ok: boolean;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  reason?: string;
  status?: number;
  details?: {
    baseUrl: string;
    apiVersion: string;
    hasAccessToken: boolean;
    hasVerifyToken: boolean;
  };
}

interface TestResult {
  ok: boolean;
  providerStatus: number;
  reason?: string;
}

interface WhatsAppConfigContentProps {
  headingId?: string;
  className?: string;
}

const DEFAULT_TEST_NUMBER = '51918131082';

export function WhatsAppConfigContent({ headingId, className }: WhatsAppConfigContentProps) {
  const [status, setStatus] = useState<WhatsAppCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('Hola desde Builder');
  const [testOutcome, setTestOutcome] = useState<TestResult | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/connections/whatsapp/check'));
      if (!response.ok) {
        const body = await response.json().catch(() => ({ reason: 'unknown_error' }));
        throw new Error(body.reason ?? 'unknown_error');
      }
      const data = (await response.json()) as WhatsAppCheckResponse;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleTestMessage = async () => {
    setTesting(true);
    setTestOutcome(null);
    try {
      const response = await fetch(apiUrl('/api/wsp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: DEFAULT_TEST_NUMBER, text: testMessage || 'Hola desde Builder' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTestOutcome({ ok: false, providerStatus: body.providerStatus ?? response.status, reason: body.reason ?? 'unknown' });
      } else {
        setTestOutcome({ ok: true, providerStatus: body.providerStatus ?? response.status });
      }
    } catch (err) {
      setTestOutcome({ ok: false, providerStatus: 0, reason: err instanceof Error ? err.message : 'network_error' });
    } finally {
      setTesting(false);
    }
  };

  const statusBadge = status?.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
  const statusLabel = status?.ok ? 'Conectado' : status?.reason ? `Sin conexión (${status.reason})` : 'Sin conexión';

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl bg-white shadow ${className ?? ''}`}>
      <header className="border-b border-slate-200 px-6 py-4">
        <h2 id={headingId} className="text-xl font-semibold text-slate-900">
          📱 Configuración WhatsApp Cloud API
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Validamos la conexión usando las credenciales configuradas en el backend.
        </p>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Estado del conector</p>
              {status?.details && (
                <p className="text-xs text-slate-500">
                  {status.details.baseUrl} · v{status.details.apiVersion}
                </p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Phone Number ID</p>
              <p className="font-mono text-sm">{status?.phoneNumberId ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Número mostrado</p>
              <p className="font-medium">{status?.displayPhoneNumber ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Nombre verificado</p>
              <p>{status?.verifiedName ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Tokens</p>
              <p>
                {status?.details?.hasAccessToken ? '🔐 Access token cargado' : '⚠️ Falta Access token'} ·{' '}
                {status?.details?.hasVerifyToken ? '🔑 Verify token' : '⚠️ Falta Verify token'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={loading}
              className="btn btn--ghost"
            >
              {loading ? 'Verificando…' : 'Revisar estado'}
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Enviar mensaje de prueba</h3>
          <p className="mt-1 text-xs text-slate-500">
            Se envía al número de verificación {DEFAULT_TEST_NUMBER}. Usa este flujo para validar la salida real por WhatsApp.
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              placeholder="Hola desde Builder"
            />
            <button
              type="button"
              onClick={handleTestMessage}
              disabled={testing}
              className="btn btn--secondary"
            >
              {testing ? 'Enviando…' : 'Probar mensaje'}
            </button>
          </div>
          {testOutcome && (
            <div
              className={`mt-3 rounded-lg border p-3 text-sm ${
                testOutcome.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {testOutcome.ok
                ? `Mensaje aceptado por el proveedor (status ${testOutcome.providerStatus})`
                : `Fallo en proveedor (status ${testOutcome.providerStatus})${
                    testOutcome.reason ? ` · ${testOutcome.reason}` : ''
                  }`}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <h3 className="text-sm font-semibold text-slate-700">Ayuda rápida</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Configura las credenciales en el backend (.env) o gestor de secretos.</li>
            <li>Actualiza el webhook en Meta Developers con el verify token mostrado arriba.</li>
            <li>El panel solo muestra datos leídos del backend; no guardamos tokens desde el navegador.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
