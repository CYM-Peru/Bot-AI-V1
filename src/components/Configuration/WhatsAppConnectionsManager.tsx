import { useState, useEffect } from 'react';

interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string | null;
  accessToken: string;
  verifyToken: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export function WhatsAppConnectionsManager() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    alias: '',
    phoneNumberId: '',
    displayNumber: '',
    accessToken: '',
    verifyToken: '',
    isActive: true,
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/connections/whatsapp/list');
      const data = await response.json();

      if (data.ok) {
        setConnections(data.connections);
      } else {
        setError('Error al cargar conexiones');
      }
    } catch (err) {
      setError('Error de red al cargar conexiones');
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.alias || !formData.phoneNumberId || !formData.accessToken) {
      alert('Por favor completa los campos requeridos: Alias, Phone Number ID y Access Token');
      return;
    }

    try {
      const response = await fetch('/api/connections/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: formData.alias,
          phoneNumberId: formData.phoneNumberId,
          displayNumber: formData.displayNumber || null,
          accessToken: formData.accessToken,
          verifyToken: formData.verifyToken || null,
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        await loadConnections();
        resetForm();
        setShowAdd(false);
      } else {
        alert(`Error: ${data.reason || 'No se pudo crear la conexión'}`);
      }
    } catch (err) {
      alert('Error de red al crear la conexión');
      console.error('Error creating connection:', err);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.alias || !formData.phoneNumberId || !formData.accessToken) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    try {
      const response = await fetch(`/api/connections/whatsapp/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: formData.alias,
          phoneNumberId: formData.phoneNumberId,
          displayNumber: formData.displayNumber || null,
          accessToken: formData.accessToken,
          verifyToken: formData.verifyToken || null,
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        await loadConnections();
        setEditing(null);
        resetForm();
      } else {
        alert(`Error: ${data.reason || 'No se pudo actualizar la conexión'}`);
      }
    } catch (err) {
      alert('Error de red al actualizar la conexión');
      console.error('Error updating connection:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta conexión? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`/api/connections/whatsapp/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        await loadConnections();
      } else {
        alert('Error al eliminar la conexión');
      }
    } catch (err) {
      alert('Error de red al eliminar la conexión');
      console.error('Error deleting connection:', err);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      const response = await fetch(`/api/connections/whatsapp/${id}/verify`);
      const data = await response.json();

      if (data.ok) {
        alert(`✅ Conexión verificada exitosamente\n\nNúmero: ${data.connection.displayNumber || data.connection.phoneNumberId}\nNombre verificado: ${data.connection.verifiedName || 'N/A'}`);
      } else {
        alert(`❌ Error al verificar conexión\n\nMotivo: ${data.reason === 'invalid_token' ? 'Token de acceso inválido' : 'Error del proveedor'}\nEstatus: ${data.status || 'N/A'}`);
      }
    } catch (err) {
      alert('Error de red al verificar la conexión');
      console.error('Error verifying connection:', err);
    } finally {
      setVerifying(null);
    }
  };

  const startEditing = (connection: WhatsAppConnection) => {
    setEditing(connection.id);
    setFormData({
      alias: connection.alias,
      phoneNumberId: connection.phoneNumberId,
      displayNumber: connection.displayNumber || '',
      accessToken: connection.accessToken,
      verifyToken: connection.verifyToken || '',
      isActive: connection.isActive,
    });
  };

  const resetForm = () => {
    setFormData({
      alias: '',
      phoneNumberId: '',
      displayNumber: '',
      accessToken: '',
      verifyToken: '',
      isActive: true,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-slate-600">Cargando conexiones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
        <p className="text-sm text-rose-800">❌ {error}</p>
        <button
          onClick={loadConnections}
          className="mt-2 text-xs text-rose-600 hover:text-rose-700 font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Conexiones WhatsApp Business API</h3>
          <p className="mt-1 text-sm text-slate-600">
            Gestiona múltiples números de WhatsApp con credenciales de Meta
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Conexión
        </button>
      </div>

      {/* Info notice */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900">Credenciales de Meta</h4>
            <p className="mt-1 text-xs text-blue-800">
              Obtén el <strong>Phone Number ID</strong> y <strong>Access Token</strong> desde tu{' '}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">
                Meta App Dashboard
              </a>
              . El número real se obtiene automáticamente al verificar.
            </p>
          </div>
        </div>
      </div>

      {/* Add new connection form */}
      {showAdd && (
        <div className="rounded-lg bg-white border-2 border-emerald-200 p-6 shadow-sm space-y-4">
          <h4 className="text-base font-semibold text-slate-900">Nueva Conexión WhatsApp</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Alias <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                placeholder="Ej: Ventas, Soporte"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Número Real (Opcional)
              </label>
              <input
                type="tel"
                value={formData.displayNumber}
                onChange={(e) => setFormData({ ...formData, displayNumber: e.target.value })}
                placeholder="+51 918 131 082"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-slate-500">Se obtiene auto al verificar</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number ID <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={formData.phoneNumberId}
              onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
              placeholder="741220429081783"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">
              Desde Meta: Configuración → Números de teléfono WhatsApp
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Access Token <span className="text-rose-600">*</span>
            </label>
            <textarea
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
              placeholder="EAA..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">
              Token permanente desde tu Meta App
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Verify Token (Webhook)
            </label>
            <input
              type="text"
              value={formData.verifyToken}
              onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
              placeholder="my_secret_token"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">
              Conexión activa
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
            >
              Crear Conexión
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Connections list */}
      <div className="space-y-3">
        {connections.length === 0 && !showAdd && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="mt-3 text-sm text-slate-600">No hay conexiones configuradas</p>
            <p className="text-xs text-slate-500">Agrega una para empezar</p>
          </div>
        )}

        {connections.map((connection) => (
          <div
            key={connection.id}
            className="rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition overflow-hidden"
          >
            {editing === connection.id ? (
              <div className="p-6 space-y-4 bg-slate-50">
                <h4 className="text-base font-semibold text-slate-900">Editar Conexión</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Alias</label>
                    <input
                      type="text"
                      value={formData.alias}
                      onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número Real</label>
                    <input
                      type="tel"
                      value={formData.displayNumber}
                      onChange={(e) => setFormData({ ...formData, displayNumber: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    value={formData.phoneNumberId}
                    onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Access Token</label>
                  <textarea
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`isActive-${connection.id}`}
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor={`isActive-${connection.id}`} className="text-sm text-slate-700">
                    Conexión activa
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleUpdate(connection.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-base font-semibold text-slate-900">{connection.alias}</h4>
                      {connection.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Número:</span> {connection.displayNumber || 'No configurado'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        Phone ID: {connection.phoneNumberId}
                      </p>
                      <p className="text-xs text-slate-500">
                        Creado: {new Date(connection.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(connection.id)}
                      disabled={verifying === connection.id}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      {verifying === connection.id ? 'Verificando...' : 'Verificar'}
                    </button>
                    <button
                      onClick={() => startEditing(connection)}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(connection.id)}
                      className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
