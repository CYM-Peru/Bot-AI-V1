import React, { useEffect, useState } from "react";
import type { Flow } from "../flow/types";
import { X, Trash2, Edit3, Play } from "lucide-react";

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
      const flowsWithMeta: FlowWithMeta[] = (data.flows || []).map((flow: Flow) => ({
        flow,
        nodeCount: Object.keys(flow.nodes || {}).length,
        updatedAt: new Date().toISOString(), // TODO: Add timestamp to flow metadata
      }));

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
    onSelectFlow(flowId);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                  flow.channelAssignments.length > 0;

                return (
                  <div
                    key={flow.id}
                    onClick={() => handleSelectFlow(flow.id)}
                    className={`
                      relative border-2 rounded-lg p-5 cursor-pointer transition-all
                      ${isActive
                        ? "border-blue-600 bg-blue-50 shadow-lg"
                        : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md"
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                          ACTIVO
                        </div>
                      </div>
                    )}

                    {/* Flow info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 pr-16">
                        {flow.name || "Sin nombre"}
                      </h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-semibold">ID:</span> {flow.id}
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
