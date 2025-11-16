import { useState, useEffect } from "react";
import { authFetch } from "../../lib/apiBase";
import { ChangePassword } from "./ChangePassword";

interface BounceConfig {
  enabled: boolean;
  bounceTimeMinutes: number;
  maxBounces: number;
  strategy: 'round-robin' | 'least-busy' | 'random';
}

interface Settings {
  companyName: string;
  timezone: string;
  language: string;
  dateFormat: string;
  sessionTimeout: number;
  enableNotifications: boolean;
  autoArchiveDays: number;
  maxFileSize: number;
  allowedFileTypes: string;
  defaultStatus: string;
  requireApprovalForTransfers: boolean;
  bounceConfig: BounceConfig;
}

const DEFAULT_SETTINGS: Settings = {
  companyName: "Mi Empresa",
  timezone: "America/Lima",
  language: "es-PE",
  dateFormat: "DD/MM/YYYY",
  sessionTimeout: 30,
  enableNotifications: true,
  autoArchiveDays: 30,
  maxFileSize: 10,
  allowedFileTypes: "jpg,jpeg,png,pdf,doc,docx,xls,xlsx",
  defaultStatus: "active",
  requireApprovalForTransfers: false,
  bounceConfig: {
    enabled: true,
    bounceTimeMinutes: 10,
    maxBounces: 5,
    strategy: 'round-robin'
  },
};

interface GeneralSettingsProps {
  user?: { id: string; role: string; name?: string; username?: string } | null;
}

export function GeneralSettings({ user }: GeneralSettingsProps = {}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  const isSupervisor = user?.role === 'supervisor';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        // Merge with defaults to ensure all properties exist
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          bounceConfig: {
            ...DEFAULT_SETTINGS.bounceConfig,
            ...(data.settings.bounceConfig || {})
          }
        };
        setSettings(mergedSettings);
        setOriginalSettings(mergedSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof Settings, value: string | number | boolean | BounceConfig) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const response = await authFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setOriginalSettings(data.settings);
        setHasChanges(false);
        alert("Configuración guardada exitosamente");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error al guardar la configuración");
    }
  };

  const handleReset = () => {
    if (confirm("¿Estás seguro de cancelar los cambios?")) {
      setSettings(originalSettings);
      setHasChanges(false);
    }
  };

  // Si es supervisor, solo mostrar cambio de contraseña
  if (isSupervisor) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Configuración General</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona tu cuenta
          </p>
        </div>
        <div className="space-y-6">
          <ChangePassword />
        </div>
      </div>
    );
  }

  // Vista completa para admins
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Configuración General</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configura las opciones generales del sistema
        </p>
      </div>

      <div className="space-y-6">
        {/* Cambiar Contraseña */}
        <ChangePassword />

        {/* Empresa */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            Empresa
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Nombre de la Empresa</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        {/* Regional */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Configuración Regional
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Zona Horaria</label>
              <select
                value={settings.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="America/Lima">Lima (GMT-5)</option>
                <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                <option value="America/Bogota">Bogotá (GMT-5)</option>
                <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                <option value="America/Santiago">Santiago (GMT-3)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Idioma</label>
              <select
                value={settings.language}
                onChange={(e) => handleChange("language", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="es-PE">Español (Perú)</option>
                <option value="es-MX">Español (México)</option>
                <option value="es-CO">Español (Colombia)</option>
                <option value="es-AR">Español (Argentina)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Formato de Fecha</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => handleChange("dateFormat", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seguridad */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Seguridad
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Tiempo de Inactividad (minutos)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.sessionTimeout}
                onChange={(e) => handleChange("sessionTimeout", parseInt(e.target.value) || 30)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                Cerrar sesión automáticamente después de este tiempo de inactividad
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.requireApprovalForTransfers}
                  onChange={(e) => handleChange("requireApprovalForTransfers", e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Aprobar Transferencias
                  </p>
                  <p className="text-xs text-slate-500">
                    Requerir aprobación de supervisor para transferir chats
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* CRM */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <svg className="h-5 w-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            CRM y Conversaciones
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Archivar Automáticamente (días)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.autoArchiveDays}
                onChange={(e) => handleChange("autoArchiveDays", parseInt(e.target.value) || 30)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                Conversaciones inactivas se archivarán automáticamente
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Estado por Defecto</label>
              <select
                value={settings.defaultStatus}
                onChange={(e) => handleChange("defaultStatus", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="active">Activa</option>
                <option value="attending">Atendiendo</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Estado inicial de nuevas conversaciones
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) => handleChange("enableNotifications", e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  Habilitar Notificaciones
                </p>
                <p className="text-xs text-slate-500">
                  Mostrar notificaciones para nuevos mensajes y eventos
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Archivos */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Archivos y Adjuntos
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Tamaño Máximo (MB)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.maxFileSize}
                onChange={(e) => handleChange("maxFileSize", parseInt(e.target.value) || 10)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                Tamaño máximo permitido para archivos adjuntos
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Tipos de Archivo Permitidos
              </label>
              <input
                type="text"
                value={settings.allowedFileTypes}
                onChange={(e) => handleChange("allowedFileTypes", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="jpg,png,pdf,doc"
              />
              <p className="mt-1 text-xs text-slate-500">
                Extensiones separadas por comas
              </p>
            </div>
          </div>
        </div>

        {/* Sistema de Rebote */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            Sistema de Rebote Automático
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Rebotar mensajes no aceptados automáticamente a otros asesores de la misma cola
          </p>

          <div className="mt-4">
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={settings.bounceConfig.enabled}
                onChange={(e) => handleChange("bounceConfig", { ...settings.bounceConfig, enabled: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  Habilitar Rebote Automático
                </p>
                <p className="text-xs text-slate-500">
                  Los mensajes sin aceptar se reasignarán automáticamente
                </p>
              </div>
            </label>
          </div>

          {settings.bounceConfig.enabled && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Tiempo de Espera (minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.bounceConfig.bounceTimeMinutes}
                  onChange={(e) => handleChange("bounceConfig", { ...settings.bounceConfig, bounceTimeMinutes: parseInt(e.target.value) || 10 })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Tiempo antes de rebotar a otro asesor
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Máximo de Rebotes
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.bounceConfig.maxBounces}
                  onChange={(e) => handleChange("bounceConfig", { ...settings.bounceConfig, maxBounces: parseInt(e.target.value) || 5 })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Número máximo de rebotes por mensaje
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Estrategia de Rebote
                </label>
                <select
                  value={settings.bounceConfig.strategy}
                  onChange={(e) => handleChange("bounceConfig", { ...settings.bounceConfig, strategy: e.target.value as any })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="round-robin">Round Robin</option>
                  <option value="least-busy">Menos Ocupado</option>
                  <option value="random">Aleatorio</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Cómo seleccionar el próximo asesor
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700">Cambios sin guardar</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
