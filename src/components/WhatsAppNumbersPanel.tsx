import { useState } from 'react';
import type { WhatsAppNumberAssignment } from '../flow/types';

interface WhatsAppNumbersPanelProps {
  numbers: WhatsAppNumberAssignment[];
  onUpdate: (numbers: WhatsAppNumberAssignment[]) => void;
}

export function WhatsAppNumbersPanel({ numbers, onUpdate }: WhatsAppNumbersPanelProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newNumber, setNewNumber] = useState({
    displayName: '',
    phoneNumber: '',
  });

  const handleAdd = () => {
    if (!newNumber.displayName || !newNumber.phoneNumber) {
      alert('Por favor completa todos los campos');
      return;
    }
    const number: WhatsAppNumberAssignment = {
      numberId: `wsp-${Date.now()}`,
      displayName: newNumber.displayName,
      phoneNumber: newNumber.phoneNumber,
    };
    onUpdate([...numbers, number]);
    setNewNumber({ displayName: '', phoneNumber: '' });
    setShowAdd(false);
  };

  const handleDelete = (numberId: string) => {
    if (confirm('¿Estás seguro de eliminar este número?')) {
      onUpdate(numbers.filter((n) => n.numberId !== numberId));
    }
  };

  const handleEdit = (number: WhatsAppNumberAssignment) => {
    onUpdate(numbers.map((n) => (n.numberId === number.numberId ? number : n)));
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Números de WhatsApp</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
        >
          + Agregar número
        </button>
      </div>

      {/* Add new number form */}
      {showAdd && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={newNumber.displayName}
              onChange={(e) => setNewNumber({ ...newNumber, displayName: e.target.value })}
              placeholder="Ej: Ventas, Soporte"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Número de WhatsApp
            </label>
            <input
              type="tel"
              value={newNumber.phoneNumber}
              onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
              placeholder="+51987654321"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewNumber({ displayName: '', phoneNumber: '' });
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Numbers list */}
      <div className="space-y-2">
        {numbers.length === 0 && !showAdd && (
          <p className="text-xs text-slate-500 text-center py-8">
            No hay números configurados. Agrega uno para empezar.
          </p>
        )}
        {numbers.map((number) => (
          <div
            key={number.numberId}
            className="p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition"
          >
            {editing === number.numberId ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={number.displayName}
                  onChange={(e) =>
                    handleEdit({ ...number, displayName: e.target.value })
                  }
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  value={number.phoneNumber}
                  onChange={(e) =>
                    handleEdit({ ...number, phoneNumber: e.target.value })
                  }
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {number.displayName}
                  </p>
                  <p className="text-xs text-slate-500">{number.phoneNumber}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(number.numberId)}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(number.numberId)}
                    className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
