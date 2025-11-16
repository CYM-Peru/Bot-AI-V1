import React, { useState, useEffect } from 'react';
import { apiUrl, apiFetch } from '../lib/apiBase';

interface BitrixField {
  code: string;
  title: string;
  type: string;
}

interface BitrixCRMInspectorProps {
  data: any;
  onChange: (newData: any) => void;
}

export function BitrixCRMInspector({ data, onChange }: BitrixCRMInspectorProps) {
  const [availableFields, setAvailableFields] = useState<BitrixField[]>([]);
  const [loading, setLoading] = useState(false);

  const entityType = data?.entityType || 'lead';

  // Load fields when entity type changes
  useEffect(() => {
    loadFields(entityType);
  }, [entityType]);

  const loadFields = async (type: string) => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/bitrix/fields/${type}`);

      if (response.ok) {
        const result = await response.json();
        setAvailableFields(result.fields || []);
      } else {
        console.error('Failed to load Bitrix fields:', response.statusText);
        setAvailableFields([]);
      }
    } catch (error) {
      console.error('Error loading Bitrix fields:', error);
      setAvailableFields([]);
    } finally {
      setLoading(false);
    }
  };

  const createId = (prefix: string) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  const handleAddField = () => {
    const fields = [...(data?.fields || [])];
    fields.push({
      id: createId('field'),
      fieldName: '',
      valueType: 'static',
      staticValue: ''
    });
    onChange({ ...data, fields });
  };

  const handleRemoveField = (idx: number) => {
    const fields = [...(data?.fields || [])];
    fields.splice(idx, 1);
    onChange({ ...data, fields });
  };

  const handleFieldUpdate = (idx: number, updates: any) => {
    const fields = [...(data?.fields || [])];
    fields[idx] = { ...fields[idx], ...updates };
    onChange({ ...data, fields });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-xs font-medium">Operación</label>
        <select
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          value={data?.operation || 'create'}
          onChange={(e) => onChange({ ...data, operation: e.target.value })}
        >
          <option value="create">Crear</option>
          <option value="update">Actualizar</option>
          <option value="search">Buscar</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium">Tipo de entidad</label>
        <select
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          value={entityType}
          onChange={(e) => onChange({ ...data, entityType: e.target.value, fields: [] })}
        >
          <option value="lead">Lead</option>
          <option value="contact">Contacto</option>
          <option value="deal">Negocio</option>
          <option value="company">Empresa</option>
        </select>
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium">Campos</label>
          <button
            className="px-2 py-1 text-xs border rounded bg-white hover:bg-emerald-50 border-emerald-200"
            onClick={handleAddField}
          >
            + Campo
          </button>
        </div>

        {loading && (
          <div className="text-xs text-slate-500 border rounded p-3 text-center">
            Cargando campos...
          </div>
        )}

        {!loading && (data?.fields || []).length === 0 && (
          <div className="text-xs text-slate-500 border rounded p-3 text-center">
            No hay campos configurados
          </div>
        )}

        {!loading && (data?.fields || []).map((field: any, idx: number) => (
          <div key={field.id} className="border rounded p-3 space-y-2 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Campo {idx + 1}</span>
              <button
                className="px-2 py-1 text-xs border rounded hover:bg-red-50 text-red-600"
                onClick={() => handleRemoveField(idx)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500">Campo de Bitrix</label>
              <select
                className="w-full border rounded px-2 py-1 text-xs"
                value={field.fieldName}
                onChange={(e) => handleFieldUpdate(idx, { fieldName: e.target.value })}
              >
                <option value="">-- Selecciona un campo --</option>
                {availableFields.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.title} ({f.code})
                  </option>
                ))}
              </select>
              {field.fieldName && (
                <p className="text-[10px] text-slate-400">
                  {availableFields.find(f => f.code === field.fieldName)?.type || 'string'}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500">Tipo de valor</label>
              <select
                className="w-full border rounded px-2 py-1 text-xs"
                value={field.valueType}
                onChange={(e) => handleFieldUpdate(idx, { valueType: e.target.value })}
              >
                <option value="static">Valor estático</option>
                <option value="variable">Variable del flujo</option>
              </select>
            </div>

            {field.valueType === 'static' && (
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-500">Valor</label>
                <input
                  className="w-full border rounded px-2 py-1 text-xs"
                  placeholder="Valor fijo"
                  value={field.staticValue || ''}
                  onChange={(e) => handleFieldUpdate(idx, { staticValue: e.target.value })}
                />
              </div>
            )}

            {field.valueType === 'variable' && (
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-500">Variable</label>
                <input
                  className="w-full border rounded px-2 py-1 text-xs"
                  placeholder="Ej: nombre_cliente"
                  value={field.variableName || ''}
                  onChange={(e) => handleFieldUpdate(idx, { variableName: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
