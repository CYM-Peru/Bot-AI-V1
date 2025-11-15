/**
 * Componente de alerta de mantenimiento
 * Muestra iconos de advertencia o refresh al lado del logo
 * según el estado del mantenimiento
 */

import React, { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import axios from "axios";

interface MaintenanceStatus {
  id?: number;
  status: "idle" | "working" | "completed";
  message: string;
  startedAt?: string;
  completedAt?: string;
  active: boolean;
}

export function MaintenanceAlert() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkMaintenanceStatus();

    // Polling cada 30 segundos para actualizar el estado
    const interval = setInterval(checkMaintenanceStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkMaintenanceStatus = async () => {
    try {
      const response = await axios.get("/api/maintenance/status");
      setStatus(response.data);

      // Si el estado cambió de working a completed, mostrar nuevamente
      if (response.data.status === "completed") {
        setDismissed(false);
      }
    } catch (error) {
      console.error("Error checking maintenance status:", error);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // No mostrar si está en idle o si fue cerrado manualmente
  if (!status || status.status === "idle" || dismissed) {
    return null;
  }

  return (
    <>
      {/* Badge al lado del logo */}
      <div className="relative">
        {status.status === "working" && (
          <div
            className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-yellow-200 transition-colors"
            title="Sistema en mantenimiento"
          >
            <AlertTriangle size={18} className="text-yellow-600 animate-pulse" />
            <span className="text-xs font-medium text-yellow-800">
              En Mantenimiento
            </span>
          </div>
        )}

        {status.status === "completed" && (
          <div
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-green-100 border border-green-300 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-green-200 transition-colors group"
            title="Click para actualizar y ver cambios"
          >
            <RefreshCw size={18} className="text-green-600 group-hover:animate-spin" />
            <span className="text-xs font-medium text-green-800">
              Actualización Disponible
            </span>
            <button
              onClick={e => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="ml-1 text-green-600 hover:text-green-800"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Modal informativo (solo para estado working) */}
      {status.status === "working" && (
        <div className="fixed top-4 right-4 z-40 max-w-md bg-white rounded-lg shadow-xl border-2 border-yellow-400 p-4 animate-slide-in-right">
          <div className="flex items-start gap-3">
            <div className="bg-yellow-100 rounded-full p-2 flex-shrink-0">
              <AlertTriangle size={20} className="text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-1">
                Mantenimiento en Progreso
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {status.message}
              </p>
              <p className="text-xs text-gray-500">
                Estamos trabajando en mejoras. Algunas funcionalidades podrían verse afectadas temporalmente.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Panel de control de mantenimiento (solo para admins)
 */
interface MaintenanceControlPanelProps {
  isAdmin: boolean;
}

export function MaintenanceControlPanel({ isAdmin }: MaintenanceControlPanelProps) {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchStatus();
    }
  }, [isAdmin]);

  const fetchStatus = async () => {
    try {
      const response = await axios.get("/api/maintenance/status");
      setStatus(response.data);
      setMessage(response.data.message || "");
    } catch (error) {
      console.error("Error fetching maintenance status:", error);
    }
  };

  const startMaintenance = async () => {
    if (!message.trim()) {
      alert("Por favor ingresa un mensaje descriptivo");
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post("/api/maintenance/start", { message });
      await fetchStatus();
      alert("Alerta de mantenimiento activada");
    } catch (error) {
      console.error("Error starting maintenance:", error);
      alert("Error al activar mantenimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeMaintenance = async () => {
    try {
      setIsSubmitting(true);
      await axios.post("/api/maintenance/complete");
      await fetchStatus();
      alert("Mantenimiento marcado como completado. Los usuarios verán el ícono de refresh.");
    } catch (error) {
      console.error("Error completing maintenance:", error);
      alert("Error al completar mantenimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissMaintenance = async () => {
    try {
      setIsSubmitting(true);
      await axios.post("/api/maintenance/dismiss");
      await fetchStatus();
      setMessage("");
    } catch (error) {
      console.error("Error dismissing maintenance:", error);
      alert("Error al cerrar alerta");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-gray-800 mb-4">
        Control de Alertas de Mantenimiento
      </h3>

      {/* Current Status */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-600 mb-1">Estado actual:</p>
        <div className="flex items-center gap-2">
          {status?.status === "idle" && (
            <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
              Sin alerta activa
            </span>
          )}
          {status?.status === "working" && (
            <>
              <AlertTriangle size={18} className="text-yellow-600" />
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                En Mantenimiento
              </span>
            </>
          )}
          {status?.status === "completed" && (
            <>
              <RefreshCw size={18} className="text-green-600" />
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Completado - Esperando refresh
              </span>
            </>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mensaje de mantenimiento:
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Ej: Estamos implementando el sistema de tickets. Tiempo estimado: 10 minutos"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={status?.status === "working"}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {status?.status !== "working" && (
          <button
            onClick={startMaintenance}
            disabled={isSubmitting || !message.trim()}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Iniciando..." : "Iniciar Mantenimiento"}
          </button>
        )}

        {status?.status === "working" && (
          <button
            onClick={completeMaintenance}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Marcando..." : "Marcar como Completado"}
          </button>
        )}

        {status?.status !== "idle" && (
          <button
            onClick={dismissMaintenance}
            disabled={isSubmitting}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Cerrando..." : "Cerrar Alerta"}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 text-sm">
          Cómo funciona:
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Iniciar:</strong> Muestra triángulo ⚠️ a todos los usuarios</li>
          <li>• <strong>Completar:</strong> Cambia a ícono de refresh 🔄</li>
          <li>• <strong>Cerrar:</strong> Oculta la alerta completamente</li>
        </ul>
      </div>
    </div>
  );
}
