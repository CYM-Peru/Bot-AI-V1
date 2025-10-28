import React, { useState } from 'react';
import { FLOW_TEMPLATES, type FlowTemplate } from '../templates/flowTemplates';

interface TemplateSelectorProps {
  onSelect: (template: FlowTemplate) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);

  const categories = Array.from(new Set(FLOW_TEMPLATES.map((t) => t.category)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-emerald-50 to-blue-50">
          <h2 className="text-2xl font-bold text-slate-800">📋 Templates de Flujos</h2>
          <p className="text-sm text-slate-600 mt-1">Comienza rápido con un template predefinido</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {categories.map((category) => {
            const templatesInCategory = FLOW_TEMPLATES.filter((t) => t.category === category);

            return (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templatesInCategory.map((template) => {
                    const isSelected = selectedTemplate?.id === template.id;
                    const nodeCount = Object.keys(template.flow.nodes).length;

                    return (
                      <button
                        key={template.id}
                        className={`text-left p-4 rounded-lg border-2 transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-slate-800">{template.name}</h4>
                          {isSelected && (
                            <div className="text-emerald-600">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{template.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                            {nodeCount} nodos
                          </span>
                          <span className="text-[10px] text-slate-400">ID: {template.id}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50 flex justify-between">
          <button
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 transition"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className={`px-6 py-2 text-sm rounded-lg transition font-medium ${
              selectedTemplate
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            onClick={() => {
              if (selectedTemplate) {
                onSelect(selectedTemplate);
                onClose();
              }
            }}
            disabled={!selectedTemplate}
          >
            Usar Template
          </button>
        </div>
      </div>
    </div>
  );
}
