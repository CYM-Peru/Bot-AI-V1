import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SaveFlowModalProps {
  currentFlowName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export function SaveFlowModal({ currentFlowName, onSave, onCancel }: SaveFlowModalProps) {
  const [flowName, setFlowName] = useState(currentFlowName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFlowName(currentFlowName);
  }, [currentFlowName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = flowName.trim();

    if (!trimmedName) {
      setError('El nombre no puede estar vacío');
      return;
    }

    if (trimmedName.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }

    if (trimmedName.length > 100) {
      setError('El nombre no puede exceder 100 caracteres');
      return;
    }

    onSave(trimmedName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Save className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Guardar Flujo</h2>
              <p className="text-sm text-gray-500 mt-0.5">Dale un nombre descriptivo a tu flujo</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="flow-name"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Nombre del flujo *
              </label>
              <input
                id="flow-name"
                type="text"
                value={flowName}
                onChange={(e) => {
                  setFlowName(e.target.value);
                  setError(null);
                }}
                placeholder="Ej: Atención al cliente - Horario laboral"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                autoFocus
                maxLength={100}
              />
              <div className="flex items-center justify-between mt-2">
                {error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : (
                  <p className="text-xs text-gray-500">Mínimo 3 caracteres, máximo 100</p>
                )}
                <p className="text-xs text-gray-400">{flowName.length}/100</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">💡 Tip:</span> Usa nombres descriptivos que te ayuden a identificar
                fácilmente el propósito del flujo.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!flowName.trim()}
            >
              <Save size={18} />
              Guardar Flujo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
