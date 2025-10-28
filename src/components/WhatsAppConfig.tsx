import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/apiBase';

interface WhatsAppCheckResponse {
  ok: boolean;
  phoneNumberId?: string | null;
  displayNumber?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  reason?: string | null;
  status?: number | null;
  details?: {
    baseUrl: string;
    apiVersion: string;
    hasAccessToken: boolean;
    hasVerifyToken: boolean;
  } | null;
}

interface TestResult {
  ok: boolean;
  status: number;
  id?: string | null;
  reason?: string;
}

interface WhatsAppConfigContentProps {
  headingId?: string;
  className?: string;
}

const DEFAULT_TEST_NUMBER = '51918131082';

interface FormState {
  phoneNumberId: string;
  displayNumber: string;
  accessToken: string;
  verifyToken: string;
}

const INITIAL_FORM: FormState = {
  phoneNumberId: '',
  displayNumber: '',
  accessToken: '',
  verifyToken: '',
};

export function WhatsAppConfigContent({ headingId, className }: WhatsAppConfigContentProps) {
  const [status, setStatus] = useState<WhatsAppCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<TestResult | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [syncedStatus, setSyncedStatus] = useState(false);
  const [testMessage, setTestMessage] = useState('Hola desde Builder');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/connections/whatsapp/check'));
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

  useEffect(() => {
    if (!status || syncedStatus) {
      return;
    }

    setForm((current) => ({
      ...current,
      phoneNumberId: current.phoneNumberId || status.phoneNumberId?.toString() || '',
      displayNumber:
        current.displayNumber || status.displayNumber || status.displayPhoneNumber?.toString() || '',
    }));
    setSyncedStatus(true);
  }, [status, syncedStatus]);

  const handleSave = useCallback(async () => {
    const payload = {
      phoneNumberId: form.phoneNumberId.trim(),
      displayNumber: form.displayNumber.trim() || undefined,
      accessToken: form.accessToken.trim(),
      verifyToken: form.verifyToken.trim() || undefined,
    };

    if (!payload.phoneNumberId || !payload.accessToken) {
      setSaveError('Ingresa Phone Number ID y Access Token.');
      setSaveSuccess(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(apiUrl('/api/connections/whatsapp/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { reason?: string };
        throw new Error(body.reason ?? 'unknown_error');
      }
      setSaveSuccess(true);
      setForm((current) => ({ ...current, accessToken: '', verifyToken: '' }));
      setSyncedStatus(false);
      await loadStatus();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSaving(false);
    }
  }, [form, loadStatus]);

  const handleTestMessage = useCallback(async () => {
    setTesting(true);
    setTestOutcome(null);
    try {
      const response = await fetch(apiUrl('/api/connections/whatsapp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: DEFAULT_TEST_NUMBER, text: testMessage.trim() || 'Hola desde Builder' }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string; reason?: string };
      if (!response.ok || !body.ok) {
        setTestOutcome({ ok: false, status: response.status, reason: body.reason ?? 'provider_error' });
      } else {
        setTestOutcome({ ok: true, status: response.status, id: body.id ?? null });
      }
    } catch (err) {
      setTestOutcome({ ok: false, status: 0, reason: err instanceof Error ? err.message : 'network_error' });
    } finally {
      setTesting(false);
    }
  }, [testMessage]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 4000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const badgeInfo = useMemo(() => {
    if (status?.ok) {
      return { className: 'bg-emerald-100 text-emerald-700', label: 'Conectado' };
    }

    const reason = status?.reason ?? 'not_configured';
    const map: Record<string, string> = {
      not_configured: 'Sin conexión',
      invalid_token: 'Token inválido',
      missing_phone_id: 'Phone ID inválido',
      provider_error: 'Error proveedor',
      network_error: 'Error de red',
      not_authorized: 'No autorizado',
      unknown_error: 'Error desconocido',
    };

    const label = map[reason] ?? `Sin conexión (${reason})`;

    return { className: 'bg-rose-100 text-rose-700', label };
  }, [status]);

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl bg-white shadow ${className ?? ''}`}>
      <header className="border-b border-slate-200 px-6 py-4">
        <h2 id={headingId} className="text-xl font-semibold text-slate-900">
          📱 Configuración WhatsApp Cloud API
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Las credenciales se guardan únicamente en el servidor. Desde aquí solo verificamos contra Meta Graph.
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
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeInfo.className}`}>
              {badgeInfo.label}
            </span>
          </div>

          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Phone Number ID</p>
              <p className="font-mono text-sm">{status?.phoneNumberId ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Número mostrado</p>
              <p className="font-medium">{status?.displayNumber ?? status?.displayPhoneNumber ?? '—'}</p>
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
            <button type="button" onClick={() => void loadStatus()} disabled={loading} className="btn btn--ghost">
              {loading ? 'Verificando…' : 'Revisar estado'}
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Credenciales (se guardan solo en backend)</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number ID</span>
              <input
                type="text"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                value={form.phoneNumberId}
                onChange={(event) => setForm((current) => ({ ...current, phoneNumberId: event.target.value }))}
                placeholder="Ej. 123456789012345"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Número mostrado</span>
              <input
                type="text"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                value={form.displayNumber}
                onChange={(event) => setForm((current) => ({ ...current, displayNumber: event.target.value }))}
                placeholder="+51 1 6193638"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access Token</span>
              <div className="flex gap-2">
                <input
                  type={showAccessToken ? 'text' : 'password'}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={form.accessToken}
                  onChange={(event) => setForm((current) => ({ ...current, accessToken: event.target.value }))}
                  placeholder="EAAG..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowAccessToken((value) => !value)}
                >
                  {showAccessToken ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Webhook Verify Token</span>
              <input
                type="text"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                value={form.verifyToken}
                onChange={(event) => setForm((current) => ({ ...current, verifyToken: event.target.value }))}
                placeholder="Token de verificación"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn--secondary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {saveSuccess && <span className="text-sm text-emerald-600">Credenciales guardadas correctamente.</span>}
            {saveError && <span className="text-sm text-rose-600">{saveError}</span>}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            El access token no se vuelve a mostrar después de guardarlo. Si lo necesitas, genera uno nuevo desde Meta.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Enviar mensaje de prueba</h3>
          <p className="mt-1 text-xs text-slate-500">
            Se envía al número de verificación {DEFAULT_TEST_NUMBER}. Solo funciona si el Phone Number ID y el Access Token son válidos.
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
              onClick={() => void handleTestMessage()}
              disabled={testing}
              className="btn btn--secondary"
            >
              {testing ? 'Enviando…' : 'Probar mensaje'}
            </button>
          </div>
          {testOutcome && (
            <div
              className={`mt-3 rounded-lg border p-3 text-sm ${
                testOutcome.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {testOutcome.ok
                ? `Mensaje aceptado (status ${testOutcome.status})${
                    testOutcome.id ? ` · wamid ${testOutcome.id}` : ''
                  }`
                : `Fallo en proveedor (status ${testOutcome.status})${
                    testOutcome.reason ? ` · ${testOutcome.reason}` : ''
                  }`}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <h3 className="text-sm font-semibold text-slate-700">Ayuda rápida</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Coloca aquí las credenciales de la app en Meta Developers. Solo se almacenan en el backend.</li>
            <li>Usa el Verify Token configurado también en la suscripción del webhook de Meta.</li>
            <li>El botón “Revisar estado” consulta directamente al endpoint oficial de Meta Graph.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
