import React, { useEffect, useState, useRef } from "react";
import type { Flow } from "../flow/types";
import { X, Trash2, Edit3, MoreVertical, Download, Upload } from "lucide-react";

interface FlowsGalleryProps {
  currentFlowId: string;
  onSelectFlow: (flowId: string) => void;
  onClose: () => void;
}

interface FlowWithMeta {
  flow: Flow;
  nodeCount: number;
  updatedAt?: string;
}

export function FlowsGallery({ currentFlowId, onSelectFlow, onClose }: FlowsGalleryProps) {
  const [flows, setFlows] = useState<FlowWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importingFlowId, setImportingFlowId] = useState<string | null>(null);

  useEffect(() => {
    loadFlows();
  }, []);

  async function loadFlows() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/flows");

      if (!response.ok) {
        throw new Error(`Failed to load flows: ${response.status}`);
      }

      const data = await response.json();

      // Validar que todos los flujos tengan ID válido
      const rawFlows = data.flows || [];
      console.log('[FlowsGallery] Flujos recibidos del servidor:', rawFlows);

      const flowsWithMeta: FlowWithMeta[] = rawFlows.map((flow: Flow) => {
        if (!flow.id) {
          console.error('[FlowsGallery] ⚠️ Flujo sin ID detectado:', flow);
        }
        return {
          flow,
          nodeCount: Object.keys(flow.nodes || {}).length,
          updatedAt: new Date().toISOString(), // TODO: Add timestamp to flow metadata
        };
      });

      setFlows(flowsWithMeta);
    } catch (err) {
      console.error("Error loading flows:", err);
      setError(err instanceof Error ? err.message : "Failed to load flows");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteFlow(flowId: string, event: React.MouseEvent) {
    event.stopPropagation();

    // Validación: Evitar llamadas con flowId undefined o vacío
    if (!flowId || flowId === 'undefined' || flowId.trim() === '') {
      console.error('Error: Attempted to delete flow with invalid ID:', flowId);
      alert("Error: ID de flujo inválido");
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar el flujo "${flows.find(f => f.flow.id === flowId)?.flow.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete flow");
      }

      // Reload flows after deletion
      await loadFlows();
    } catch (err) {
      console.error("Error deleting flow:", err);
      alert("Error al eliminar el flujo");
    }
  }

  function handleSelectFlow(flowId: string) {
    // Validación: Evitar llamadas con flowId undefined o vacío
    if (!flowId || flowId === 'undefined' || flowId.trim() === '') {
      console.error('Error: Attempted to select flow with invalid ID:', flowId);
      alert("Error: ID de flujo inválido");
      return;
    }

    onSelectFlow(flowId);
    onClose();
  }

  async function handleExportFlow(flowId: string, event: React.MouseEvent) {
    event.stopPropagation();
    setOpenMenuId(null);

    const flowData = flows.find(f => f.flow.id === flowId);
    if (!flowData) return;

    try {
      // Cargar el flujo completo desde el servidor para obtener las posiciones
      const response = await fetch(`/api/flows/${flowId}`);
      if (!response.ok) throw new Error("Failed to load flow");

      const data = await response.json();
      const state = { flow: data.flow, positions: data.positions || {} };

      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${flowData.flow.name || flowId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("✅ Flujo exportado correctamente");
    } catch (error) {
      console.error("Error exporting flow:", error);
      alert("❌ Error al exportar el flujo");
    }
  }

  function handleImportClick(flowId: string, event: React.MouseEvent) {
    event.stopPropagation();
    setOpenMenuId(null);
    setImportingFlowId(flowId);
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !importingFlowId) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || !parsed.flow) {
        throw new Error("Invalid file format");
      }

      // Actualizar el flujo existente con el contenido importado
      const response = await fetch(`/api/flows/${importingFlowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.flow.name,
          flow: parsed.flow,
          positions: parsed.positions || {},
        }),
      });

      if (!response.ok) throw new Error("Failed to update flow");

      alert("✅ Flujo importado correctamente");
      await loadFlows();
    } catch (error) {
      console.error("Error importing flow:", error);
      alert("❌ Error al importar el flujo");
    } finally {
      event.target.value = "";
      setImportingFlowId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* Input oculto para importar archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Flujos Guardados</h2>
            <p className="text-sm text-gray-600 mt-1">
              {flows.length} {flows.length === 1 ? "flujo" : "flujos"} disponibles
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando flujos...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600">
                <p className="font-semibold mb-2">Error al cargar flujos</p>
                <p className="text-sm">{error}</p>
                <button
                  onClick={loadFlows}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {!loading && !error && flows.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <p className="text-lg font-semibold mb-2">No hay flujos guardados</p>
                <p className="text-sm">Crea un flujo para comenzar</p>
              </div>
            </div>
          )}

          {!loading && !error && flows.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flows.map(({ flow, nodeCount }) => {
                const isActive = flow.id === currentFlowId;
                const hasChannelAssignment = flow.channelAssignments &&
                  Array.isArray(flow.channelAssignments) &&
                  flow.channelAssignments.some(assignment =>
                    assignment.whatsappNumbers &&
                    assignment.whatsappNumbers.length > 0
                  );

                return (
                  <div
                    key={flow.id || `flow-${Math.random()}`}
                    onClick={() => {
                      if (!flow.id) {
                        console.error('Flow sin ID detectado:', flow);
                        alert('Error: Este flujo no tiene un ID válido');
                        return;
                      }
                      handleSelectFlow(flow.id);
                    }}
                    className={`
                      relative border-2 rounded-lg p-5 cursor-pointer transition-all
                      ${isActive
                        ? "border-blue-600 bg-blue-50 shadow-lg"
                        : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md"
                      }
                    `}
                  >
                    {/* Menu desplegable Material Design */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {isActive && (
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                          ACTIVO
                        </div>
                      )}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === flow.id ? null : flow.id);
                          }}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Más opciones"
                        >
                          <MoreVertical size={18} className="text-slate-600" />
                        </button>

                        {openMenuId === flow.id && (
                          <>
                            {/* Overlay para cerrar el menú */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                              }}
                            />
                            {/* Menú desplegable */}
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999]">
                              <div className="py-2">
                                <button
                                  onClick={(e) => handleExportFlow(flow.id, e)}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 flex items-center gap-3 transition-all group"
                                >
                                  <Download size={16} className="text-purple-600 group-hover:scale-110 transition-transform" />
                                  <span className="font-medium text-slate-700 group-hover:text-purple-600">Exportar JSON</span>
                                </button>
                                <button
                                  onClick={(e) => handleImportClick(flow.id, e)}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 flex items-center gap-3 transition-all group"
                                >
                                  <Upload size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                                  <span className="font-medium text-slate-700 group-hover:text-indigo-600">Importar JSON</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Flow info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 pr-16">
                        {flow.name || "Sin nombre"}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-semibold">ID:</span> {flow.id || <span className="text-red-600">⚠️ ID INVÁLIDO</span>}
                        </p>
                        <p>
                          <span className="font-semibold">Nodos:</span> {nodeCount}
                        </p>
                        <p>
                          <span className="font-semibold">Nodo inicial:</span> {flow.rootId}
                        </p>
                        {hasChannelAssignment && (
                          <p className="text-green-600 font-semibold">
                            ✓ Asignado a WhatsApp
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!flow.id) {
                            console.error('Flow sin ID detectado en botón Editar:', flow);
                            alert('Error: Este flujo no tiene un ID válido');
                            return;
                          }
                          handleSelectFlow(flow.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        title="Editar flujo"
                      >
                        <Edit3 size={16} />
                        Editar
                      </button>
                      <button
                        onClick={(e) => handleDeleteFlow(flow.id, e)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        title="Eliminar flujo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Los flujos se guardan automáticamente mientras trabajas
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
