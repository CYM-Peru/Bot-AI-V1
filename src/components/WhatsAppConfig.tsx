import React, { useState, useCallback, useEffect } from 'react';

export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
}

interface WhatsAppConfigPanelProps {
  onClose: () => void;
}

const STORAGE_KEY = 'whatsapp_config';

function loadConfig(): WhatsAppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading WhatsApp config:', error);
  }
  return {
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    verifyToken: '',
  };
}

function saveConfig(config: WhatsAppConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving WhatsApp config:', error);
  }
}

export function WhatsAppConfigPanel({ onClose }: WhatsAppConfigPanelProps) {
  const [config, setConfig] = useState<WhatsAppConfig>(loadConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [config]);

  const handleTest = useCallback(async () => {
    if (!config.phoneNumberId || !config.accessToken) {
      setTestResult({
        success: false,
        message: 'Por favor completa Phone Number ID y Access Token',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Probar conectividad con la API de WhatsApp
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `✅ Conectado exitosamente - ${data.display_phone_number || 'Número verificado'}`,
        });
      } else {
        const error = await response.json();
        setTestResult({
          success: false,
          message: `❌ Error: ${error.error?.message || response.statusText}`,
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `❌ Error de conexión: ${error.message}`,
      });
    } finally {
      setTesting(false);
    }
  }, [config]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">📱 Configuración WhatsApp API</h2>
            <p className="text-sm text-gray-500">Integración con Meta Business Platform</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Phone Number ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="123456789012345"
              value={config.phoneNumberId}
              onChange={(e) => setConfig((prev) => ({ ...prev, phoneNumberId: e.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-500">
              Obtenido de Meta Business Manager → WhatsApp → Números de teléfono
            </p>
          </div>

          {/* Business Account ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Account ID
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="987654321098765"
              value={config.businessAccountId}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, businessAccountId: e.target.value }))
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              Obtenido de Meta Business Manager → Configuración de la cuenta empresarial
            </p>
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token (Permanente) <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
              rows={3}
              placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={config.accessToken}
              onChange={(e) => setConfig((prev) => ({ ...prev, accessToken: e.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-500">
              Token permanente de acceso de Meta. Nunca lo compartas.
            </p>
          </div>

          {/* Verify Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Verify Token
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="mi_token_secreto_123"
              value={config.verifyToken}
              onChange={(e) => setConfig((prev) => ({ ...prev, verifyToken: e.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-500">
              Token para verificar webhooks de WhatsApp. Debe coincidir con el configurado en Meta.
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <p
                className={`text-sm ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {testResult.message}
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Cómo obtener tus credenciales</h3>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Ve a Meta Business Manager → Configuración</li>
              <li>Selecciona tu app de WhatsApp Business API</li>
              <li>Copia el Phone Number ID desde la sección de Números</li>
              <li>Genera un Access Token permanente desde Herramientas</li>
              <li>Configura el Webhook Verify Token en la configuración de webhooks</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
          >
            {testing ? '⏳ Probando...' : '🧪 Probar Conexión'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              {saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook para usar la config en otros componentes
export function useWhatsAppConfig(): WhatsAppConfig {
  const [config, setConfig] = useState<WhatsAppConfig>(loadConfig);

  useEffect(() => {
    const handleStorage = () => {
      setConfig(loadConfig());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return config;
}

export { loadConfig, saveConfig };
