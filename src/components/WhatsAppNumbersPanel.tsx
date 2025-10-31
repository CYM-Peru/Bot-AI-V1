import { useState, useEffect } from 'react';

interface Queue {
  id: string;
  name: string;
  status: string;
}

interface WhatsAppNumber {
  numberId: string;
  displayName: string;
  phoneNumber: string;
  queueId?: string;
}

export function WhatsAppNumbersPanel() {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<WhatsAppNumber | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState({
    displayName: '',
    phoneNumber: '',
    queueId: '',
  });

  // Load WhatsApp numbers and queues
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load queues
      const queuesRes = await fetch('/api/admin/queues');
      const queuesData = await queuesRes.json();
      setQueues(queuesData.queues || []);

      // Load WhatsApp numbers
      const numbersRes = await fetch('/api/admin/whatsapp-numbers');
      const numbersData = await numbersRes.json();
      setNumbers(numbersData.numbers || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newNumber.displayName || !newNumber.phoneNumber) {
      alert('Por favor completa todos los campos');
      return;
    }
    if (!newNumber.queueId) {
      if (!confirm('⚠️ ADVERTENCIA: Este número NO tiene cola asignada.\n\nSi usas un bot con este número, las conversaciones irán al LIMBO cuando el bot termine.\n\n¿Continuar sin cola?')) {
        return;
      }
    }

    try {
      const response = await fetch('/api/admin/whatsapp-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newNumber.displayName,
          phoneNumber: newNumber.phoneNumber,
          queueId: newNumber.queueId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create number');
      }

      await loadData();
      setNewNumber({ displayName: '', phoneNumber: '', queueId: '' });
      setShowAdd(false);
    } catch (err) {
      console.error('Error creating number:', err);
      alert('Error al crear el número');
    }
  };

  const handleDelete = async (numberId: string) => {
    if (!confirm('¿Estás seguro de eliminar este número?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/whatsapp-numbers/${numberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete number');
      }

      await loadData();
    } catch (err) {
      console.error('Error deleting number:', err);
      alert('Error al eliminar el número');
    }
  };

  const startEditing = (number: WhatsAppNumber) => {
    setEditing(number.numberId);
    setEditingData({ ...number });
  };

  const saveEdit = async () => {
    if (!editingData) return;

    try {
      const response = await fetch(`/api/admin/whatsapp-numbers/${editingData.numberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editingData.displayName,
          phoneNumber: editingData.phoneNumber,
          queueId: editingData.queueId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update number');
      }

      await loadData();
      setEditing(null);
      setEditingData(null);
    } catch (err) {
      console.error('Error updating number:', err);
      alert('Error al actualizar el número');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditingData(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando números...</p>
        </div>
      </div>
    );
  }

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

      {/* Info notice */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Los números configurados en "Conexiones → WhatsApp" se agregan automáticamente aquí.
          También puedes agregar números manualmente para organización.
        </p>
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cola asignada <span className="text-red-600">*</span>
            </label>
            <select
              value={newNumber.queueId}
              onChange={(e) => setNewNumber({ ...newNumber, queueId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">⚠️ Sin cola (bot NO funcionará)</option>
              {queues.filter(q => q.status === 'active').map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ CRÍTICO: Sin cola, conversaciones del bot irán al limbo
            </p>
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
                setNewNumber({ displayName: '', phoneNumber: '', queueId: '' });
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
            {editing === number.numberId && editingData ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editingData.displayName}
                    onChange={(e) =>
                      setEditingData({ ...editingData, displayName: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Número
                  </label>
                  <input
                    type="tel"
                    value={editingData.phoneNumber}
                    onChange={(e) =>
                      setEditingData({ ...editingData, phoneNumber: e.target.value })
                    }
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cola asignada <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={editingData.queueId || ''}
                    onChange={(e) =>
                      setEditingData({ ...editingData, queueId: e.target.value || undefined })
                    }
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">⚠️ Sin cola (bot NO funcionará)</option>
                    {queues.filter(q => q.status === 'active').map(q => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ CRÍTICO: Sin cola, conversaciones del bot irán al limbo
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
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
                    onClick={() => startEditing(number)}
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
