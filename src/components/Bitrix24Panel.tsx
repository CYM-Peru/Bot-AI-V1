import React, { useState } from 'react';

const API_BASE_URL = 'http://localhost:3000';

interface Bitrix24Contact {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  PHONE?: Array<{ VALUE: string }>;
  EMAIL?: Array<{ VALUE: string }>;
  UF_CRM_VIP?: string;
  [key: string]: any;
}

export function Bitrix24Panel() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<Bitrix24Contact | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const testConnection = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({ success: false, message: 'Ingresa una URL de webhook' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test by trying to list contacts (simplest API call)
      const response = await fetch(`${API_BASE_URL}/api/bitrix/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          entityType: 'contact',
          filter: {},
          select: ['ID', 'NAME']
        })
      });

      if (response.ok) {
        setTestResult({
          success: true,
          message: '✅ Conexión exitosa! Bitrix24 está funcionando correctamente.'
        });
      } else {
        const error = await response.json();
        setTestResult({
          success: false,
          message: `❌ Error: ${error.error || 'No se pudo conectar'}`
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `❌ Error de red: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const searchContact = async () => {
    if (!webhookUrl.trim()) {
      setSearchError('Primero configura la URL del webhook');
      return;
    }

    if (!searchPhone.trim()) {
      setSearchError('Ingresa un número de teléfono');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/bitrix/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          entityType: 'contact',
          filter: { PHONE: searchPhone },
          select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL', 'UF_CRM_VIP']
        })
      });

      if (response.ok) {
        const contact = await response.json();
        setSearchResult(contact);
      } else if (response.status === 404) {
        setSearchError('No se encontró ningún contacto con ese número');
      } else {
        const error = await response.json();
        setSearchError(error.error || 'Error al buscar');
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🔗 Integración Bitrix24</h2>
          <p className="text-slate-600 text-sm mt-1">
            Conecta y valida tu integración con Bitrix24 CRM
          </p>
        </div>

        {/* Configuration Section */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">⚙️ Configuración</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Webhook URL de Bitrix24
              </label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://tu-dominio.bitrix24.com/rest/1/abc123xyz/"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Obtén tu webhook en: Bitrix24 → Configuración → Integraciones → Incoming webhook
              </p>
            </div>

            <button
              onClick={testConnection}
              disabled={testing || !webhookUrl.trim()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
            >
              {testing ? 'Probando...' : '🔍 Probar Conexión'}
            </button>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-rose-50 border border-rose-200'}`}>
                <div className={testResult.success ? 'text-green-800' : 'text-rose-800'}>
                  {testResult.message}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">🔎 Buscar Contacto</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Número de Teléfono
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchContact()}
                  placeholder="+51999999999"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  onClick={searchContact}
                  disabled={searching || !webhookUrl.trim() || !searchPhone.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>

            {searchError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="text-rose-800">{searchError}</div>
              </div>
            )}

            {searchResult && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-slate-800">
                    {searchResult.NAME} {searchResult.LAST_NAME}
                  </div>
                  {searchResult.UF_CRM_VIP === '1' && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                      ⭐ VIP
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 font-medium">ID</div>
                    <div className="text-slate-800">{searchResult.ID}</div>
                  </div>

                  {searchResult.PHONE && searchResult.PHONE.length > 0 && (
                    <div>
                      <div className="text-slate-500 font-medium">Teléfono</div>
                      <div className="text-slate-800">{searchResult.PHONE[0].VALUE}</div>
                    </div>
                  )}

                  {searchResult.EMAIL && searchResult.EMAIL.length > 0 && (
                    <div className="col-span-2">
                      <div className="text-slate-500 font-medium">Email</div>
                      <div className="text-slate-800">{searchResult.EMAIL[0].VALUE}</div>
                    </div>
                  )}
                </div>

                <details className="mt-4">
                  <summary className="text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                    Ver datos completos (JSON)
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(searchResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* Documentation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📚 Cómo usar en tus flujos</h3>

          <div className="space-y-3 text-sm text-blue-800">
            <div>
              <div className="font-semibold">1. Nodo de Condición con Bitrix24:</div>
              <div className="text-blue-700 mt-1">
                Usa el nodo de condición para validar si un contacto es VIP o verificar su estado en el CRM.
              </div>
            </div>

            <div>
              <div className="font-semibold">2. Ejemplo de configuración:</div>
              <pre className="bg-white border border-blue-200 rounded p-3 mt-2 text-xs overflow-x-auto">
{`{
  "source": "bitrix_field",
  "sourceValue": "contact.UF_CRM_VIP",
  "operator": "equals",
  "compareValue": "1",
  "targetId": "nodo_vip"
}`}
              </pre>
            </div>

            <div>
              <div className="font-semibold">3. Campos disponibles:</div>
              <ul className="list-disc list-inside text-blue-700 mt-1 space-y-1">
                <li><code className="bg-white px-1 rounded">contact.UF_CRM_VIP</code> - Cliente VIP</li>
                <li><code className="bg-white px-1 rounded">lead.STATUS_ID</code> - Estado del lead</li>
                <li><code className="bg-white px-1 rounded">deal.STAGE_ID</code> - Etapa del negocio</li>
                <li><code className="bg-white px-1 rounded">contact.ASSIGNED_BY_ID</code> - Responsable</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-blue-200">
              <a
                href="https://dev.1c-bitrix.ru/rest_help/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium underline"
              >
                📖 Ver documentación completa de Bitrix24 REST API →
              </a>
            </div>
          </div>
        </div>

        {/* Environment Variable Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <div className="font-semibold text-amber-900">Tip: Configuración en producción</div>
              <div className="text-sm text-amber-800 mt-1">
                Para usar Bitrix24 en producción, agrega la URL del webhook en tu archivo <code className="bg-amber-100 px-1 rounded">.env</code>:
              </div>
              <pre className="mt-2 bg-white border border-amber-200 rounded p-2 text-xs">
                BITRIX24_WEBHOOK_URL=https://tu-dominio.bitrix24.com/rest/1/abc123xyz/
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
