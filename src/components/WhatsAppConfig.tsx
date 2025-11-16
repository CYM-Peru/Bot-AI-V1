import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../lib/apiBase';

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

interface WhatsAppConfigContentProps {
  headingId?: string;
  className?: string;
  whatsappNumbers?: import('../flow/types').WhatsAppNumberAssignment[];
  onUpdateWhatsappNumbers?: (numbers: import('../flow/types').WhatsAppNumberAssignment[]) => void;
}

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

export function WhatsAppConfigContent({ headingId, className, whatsappNumbers = [], onUpdateWhatsappNumbers }: WhatsAppConfigContentProps) {
  const [status, setStatus] = useState<WhatsAppCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [syncedStatus, setSyncedStatus] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/connections/whatsapp/check');
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
      const response = await authFetch('/api/connections/whatsapp/save', {
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

      // Auto-agregar el número a la lista de números disponibles para asignación
      if (onUpdateWhatsappNumbers && payload.phoneNumberId) {
        const existingNumber = whatsappNumbers.find(
          (num) => num.numberId === payload.phoneNumberId
        );

        if (!existingNumber) {
          const newNumber: import('../flow/types').WhatsAppNumberAssignment = {
            numberId: payload.phoneNumberId, // Usar phoneNumberId como numberId para que el routing funcione
            displayName: payload.displayNumber || payload.phoneNumberId,
            phoneNumber: payload.displayNumber || payload.phoneNumberId,
          };
          onUpdateWhatsappNumbers([...whatsappNumbers, newNumber]);

          // También persistir en el backend para que aparezca en "Números & Colas"
          try {
            await authFetch('/api/admin/whatsapp-numbers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                displayName: payload.displayNumber || payload.phoneNumberId,
                phoneNumber: payload.displayNumber || payload.phoneNumberId,
                // No asignar cola por defecto - el usuario debe hacerlo manualmente
              }),
            });
          } catch (error) {
            console.error('Error al guardar el número en la base de datos:', error);
            // No mostrar error al usuario, ya que la conexión se guardó exitosamente
          }
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSaving(false);
    }
  }, [form, loadStatus, whatsappNumbers, onUpdateWhatsappNumbers]);

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
            {saveSuccess && (
              <div className="text-sm text-emerald-600">
                <p className="font-semibold">✓ Credenciales guardadas correctamente.</p>
                <p className="text-xs mt-1">El número ya está disponible para asignar a flujos.</p>
              </div>
            )}
            {saveError && <span className="text-sm text-rose-600">{saveError}</span>}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            El access token no se vuelve a mostrar después de guardarlo. Si lo necesitas, genera uno nuevo desde Meta.
          </p>
        </section>

        {/* Números agregados */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">📋 Números configurados</h3>
          <p className="mt-1 text-xs text-slate-500">
            Números de WhatsApp disponibles para asignar a flujos.
          </p>
          <div className="mt-4 space-y-2">
            {whatsappNumbers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                <p className="text-xs text-slate-500">
                  No hay números agregados aún. Guarda las credenciales arriba para agregar un número automáticamente.
                </p>
              </div>
            ) : (
              whatsappNumbers.map((num) => (
                <div
                  key={num.numberId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{num.displayName}</p>
                    <p className="text-xs text-slate-500">{num.phoneNumber}</p>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1">
                    <span className="text-xs font-semibold text-emerald-700">✓ Activo</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <h3 className="text-sm font-semibold text-slate-700">Ayuda rápida</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Coloca aquí las credenciales de la app en Meta Developers. Solo se almacenan en el backend.</li>
            <li>Usa el Verify Token configurado también en la suscripción del webhook de Meta.</li>
            <li>El botón "Revisar estado" consulta directamente al endpoint oficial de Meta Graph.</li>
            <li>Los números configurados aparecerán automáticamente en la pestaña "Números & Colas".</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
