import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Flow, FlowNode } from '../flow/types';

interface NodeSearchModalProps {
  flow: Flow;
  selectedId: string;
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeSearchModal({ flow, selectedId, onSelect, onClose }: NodeSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return Object.values(flow.nodes);
    }

    const query = searchQuery.toLowerCase();
    return Object.values(flow.nodes).filter((node) => {
      const labelMatch = node.label.toLowerCase().includes(query);
      const idMatch = node.id.toLowerCase().includes(query);
      const typeMatch = node.type.toLowerCase().includes(query);
      const actionKindMatch = node.action?.kind?.toLowerCase().includes(query);

      return labelMatch || idMatch || typeMatch || actionKindMatch;
    });
  }, [flow.nodes, searchQuery]);

  useEffect(() => {
    // Reset selected index when filtered results change
    setSelectedIndex(0);
  }, [filteredNodes.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredNodes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredNodes[selectedIndex]) {
      e.preventDefault();
      onSelect(filteredNodes[selectedIndex].id);
      onClose();
    }
  };

  const getNodeTypeLabel = (node: FlowNode): string => {
    if (node.type === 'start') return 'Inicio';
    if (node.type === 'menu') return 'Menú';
    if (node.action?.kind === 'message') return 'Mensaje';
    if (node.action?.kind === 'buttons') return 'Botones';
    if (node.action?.kind === 'ask') return 'Pregunta (Legacy)';
    if (node.action?.kind === 'question') return 'Pregunta';
    if (node.action?.kind === 'attachment') return 'Adjunto';
    if (node.action?.kind === 'webhook_out') return 'Webhook OUT';
    if (node.action?.kind === 'webhook_in') return 'Webhook IN';
    if (node.action?.kind === 'transfer') return 'Transferir';
    if (node.action?.kind === 'scheduler') return 'Scheduler';
    if (node.action?.kind === 'condition') return 'Condición';
    if (node.action?.kind === 'validation') return 'Validación';
    if (node.action?.kind === 'end') return 'Fin';
    return node.type;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[500px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar nodos por nombre, tipo o ID..."
            className="w-full px-4 py-3 text-lg border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 transition"
          />
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>{filteredNodes.length} nodo{filteredNodes.length !== 1 ? 's' : ''} encontrado{filteredNodes.length !== 1 ? 's' : ''}</span>
            <span className="flex gap-3">
              <kbd className="px-2 py-1 bg-slate-100 rounded text-[10px] font-mono">↑↓</kbd> Navegar
              <kbd className="px-2 py-1 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> Seleccionar
              <kbd className="px-2 py-1 bg-slate-100 rounded text-[10px] font-mono">Esc</kbd> Cerrar
            </span>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNodes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="text-4xl mb-2">🔍</div>
              <div className="text-sm">No se encontraron nodos</div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredNodes.map((node, index) => {
                const isSelected = index === selectedIndex;
                const isCurrent = node.id === selectedId;

                return (
                  <li
                    key={node.id}
                    className={`px-4 py-3 cursor-pointer transition ${
                      isSelected ? 'bg-emerald-50 border-l-4 border-emerald-500' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      onSelect(node.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-800">{node.label}</h3>
                          {isCurrent && (
                            <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full font-medium">
                              Actual
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{getNodeTypeLabel(node)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">#{node.id}</span>
                        </div>
                        {node.description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1">{node.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="text-emerald-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
