import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/apiBase";

interface CRMField {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

const DEFAULT_FIELDS: CRMField[] = [
  {
    id: "name",
    name: "Nombre",
    description: "Nombre del contacto",
    category: "Básico",
    enabled: true,
  },
  {
    id: "lastname",
    name: "Apellido",
    description: "Apellido del contacto",
    category: "Básico",
    enabled: true,
  },
  {
    id: "phone",
    name: "Teléfono",
    description: "Número de teléfono principal",
    category: "Básico",
    enabled: true,
  },
  {
    id: "email",
    name: "Email",
    description: "Correo electrónico del contacto",
    category: "Básico",
    enabled: true,
  },
  {
    id: "document_number",
    name: "N° Documento",
    description: "Número de documento de identidad",
    category: "Identificación",
    enabled: true,
  },
  {
    id: "document_type",
    name: "Tipo de Documento",
    description: "DNI, RUC, Pasaporte, etc.",
    category: "Identificación",
    enabled: true,
  },
  {
    id: "contact_type",
    name: "Tipo de Contacto",
    description: "Cliente, Proveedor, Partner, etc.",
    category: "Clasificación",
    enabled: true,
  },
  {
    id: "source",
    name: "Stencil / Origen",
    description: "Canal de donde proviene el contacto",
    category: "Clasificación",
    enabled: true,
  },
  {
    id: "assigned_to",
    name: "Líder / Asignado",
    description: "Usuario responsable del contacto",
    category: "Gestión",
    enabled: true,
  },
  {
    id: "company",
    name: "Empresa",
    description: "Empresa asociada al contacto",
    category: "Empresa",
    enabled: true,
  },
  {
    id: "position",
    name: "Cargo",
    description: "Cargo del contacto en la empresa",
    category: "Empresa",
    enabled: false,
  },
  {
    id: "address",
    name: "Dirección",
    description: "Dirección física del contacto",
    category: "Ubicación",
    enabled: false,
  },
  {
    id: "city",
    name: "Ciudad",
    description: "Ciudad de residencia",
    category: "Ubicación",
    enabled: false,
  },
  {
    id: "country",
    name: "País",
    description: "País de residencia",
    category: "Ubicación",
    enabled: false,
  },
  {
    id: "birthday",
    name: "Fecha de Nacimiento",
    description: "Fecha de cumpleaños del contacto",
    category: "Personal",
    enabled: false,
  },
  {
    id: "comments",
    name: "Comentarios",
    description: "Notas adicionales sobre el contacto",
    category: "Otros",
    enabled: false,
  },
  {
    id: "created_at",
    name: "Fecha de Creación",
    description: "Cuándo se creó el contacto",
    category: "Metadatos",
    enabled: false,
  },
  {
    id: "modified_at",
    name: "Última Modificación",
    description: "Última vez que se modificó",
    category: "Metadatos",
    enabled: true,
  },
];

export function CRMFieldConfig() {
  const [fields, setFields] = useState<CRMField[]>(DEFAULT_FIELDS);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/admin/crm-fields"));
      if (response.ok) {
        const data = await response.json();
        const enabledFieldIds = data.config?.enabledFields || [];
        // Update enabled state based on backend config
        setFields(DEFAULT_FIELDS.map(f => ({
          ...f,
          enabled: enabledFieldIds.includes(f.id)
        })));
      }
    } catch (error) {
      console.error("Error loading CRM field config:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      const enabledFields = fields.filter(f => f.enabled).map(f => f.id);
      const response = await fetch(apiUrl("/api/admin/crm-fields"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledFields }),
      });

      if (response.ok) {
        alert("Configuración guardada exitosamente");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Error al guardar la configuración");
    }
  };

  const categories = Array.from(new Set(fields.map((f) => f.category)));

  const toggleField = (fieldId: string) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, enabled: !f.enabled } : f)));
  };

  const toggleAll = (enable: boolean) => {
    setFields(fields.map((f) => ({ ...f, enabled: enable })));
  };

  const filteredFields = fields.filter((field) => {
    const matchesSearch =
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || field.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedFields = categories.reduce((acc, category) => {
    acc[category] = filteredFields.filter((f) => f.category === category);
    return acc;
  }, {} as Record<string, CRMField[]>);

  const enabledCount = fields.filter((f) => f.enabled).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Configuración de Campos CRM</h2>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona qué campos de Bitrix24 se mostrarán en la información del cliente
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Campos Habilitados</p>
            <p className="mt-1 text-xs text-slate-500">
              {enabledCount} de {fields.length} campos visibles
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
            >
              Habilitar Todos
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Deshabilitar Todos
            </button>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${(enabledCount / fields.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar campos..."
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">Todas las Categorías</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedFields).map(([category, categoryFields]) =>
          categoryFields.length > 0 ? (
            <div key={category}>
              <h3 className="mb-3 text-sm font-bold text-slate-700 uppercase tracking-wide">
                {category}
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {categoryFields.map((field) => (
                  <label
                    key={field.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                      field.enabled
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={() => toggleField(field.id)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{field.name}</p>
                        {field.enabled && (
                          <svg
                            className="h-4 w-4 text-emerald-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{field.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>

      {filteredFields.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No se encontraron campos</h3>
          <p className="mt-2 text-sm text-slate-500">
            Intenta con otros términos de búsqueda o cambia el filtro de categoría
          </p>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-900">
              💡 Acerca de la configuración de campos
            </p>
            <p className="mt-1 text-xs text-blue-700">
              Los campos habilitados se mostrarán en el modal "Info Cliente" cuando los asesores
              hagan clic en el botón de información. Los campos deshabilitados no serán visibles
              pero seguirán almacenados en Bitrix24.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={saveConfig}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Guardar Configuración
        </button>
      </div>
    </div>
  );
}
