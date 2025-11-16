import { useState, useEffect } from "react";
import { authFetch } from "../../lib/apiBase";
import { Upload, FileText, Trash2, Edit, Eye, EyeOff, Plus, Download } from "lucide-react";

type FileCategory = 'catalog' | 'flyer' | 'info' | 'other';

interface AgentFile {
  id: string;
  name: string;
  description: string;
  category: FileCategory;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  tags: string[];
  metadata: {
    brand?: string;
    withPrices?: boolean;
    season?: string;
    year?: string;
    [key: string]: any;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<FileCategory, string> = {
  catalog: 'Catálogo',
  flyer: 'Flyer',
  info: 'Información',
  other: 'Otro'
};

const CATEGORY_COLORS: Record<FileCategory, string> = {
  catalog: 'bg-blue-100 text-blue-700',
  flyer: 'bg-green-100 text-green-700',
  info: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-700'
};

export function IAAgentFiles() {
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<AgentFile | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FileCategory | 'all'>('all');

  // Form state for upload/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'catalog' as FileCategory,
    attachmentId: '',
    tags: '',
    brand: '',
    withPrices: false,
    season: '',
    year: ''
  });

  useEffect(() => {
    loadFiles();
  }, [filterCategory]);

  async function loadFiles() {
    try {
      const url = filterCategory === 'all'
        ? "/api/ia-agent-files"
        : `/api/ia-agent-files?category=${filterCategory}`;

      const response = await authFetch(url);

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);

    try {
      // Get attachment details
      const attachmentResponse = await authFetch(`/api/crm/attachments/${formData.attachmentId}`);

      if (!attachmentResponse.ok) {
        alert("❌ Archivo no encontrado. Por favor sube el archivo primero.");
        return;
      }

      const attachment = await attachmentResponse.json();

      const fileData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        url: attachment.url,
        fileName: attachment.filename,
        mimeType: attachment.mime,
        size: attachment.size,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        metadata: {
          brand: formData.brand || undefined,
          withPrices: formData.withPrices,
          season: formData.season || undefined,
          year: formData.year || undefined
        }
      };

      const url = editingFile
        ? `/api/ia-agent-files/${editingFile.id}`
        : "/api/ia-agent-files";

      const response = await authFetch(url, {
        method: editingFile ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fileData),
      });

      if (response.ok) {
        await loadFiles();
        resetForm();
        alert(`✅ Archivo ${editingFile ? 'actualizado' : 'creado'} exitosamente`);
      } else {
        const data = await response.json();
        alert(`❌ Error: ${data.error || 'Error al guardar'}`);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      alert("❌ Error al guardar el archivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: AgentFile) {
    if (!confirm(`¿Estás seguro de eliminar "${file.name}"?`)) {
      return;
    }

    try {
      const response = await authFetch(`/api/ia-agent-files/${file.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadFiles();
        alert("✅ Archivo eliminado");
      } else {
        alert("❌ Error al eliminar");
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      alert("❌ Error al eliminar");
    }
  }

  async function handleToggle(file: AgentFile) {
    try {
      const response = await authFetch(`/api/ia-agent-files/${file.id}/toggle`, {
        method: "POST",
      });

      if (response.ok) {
        await loadFiles();
      } else {
        alert("❌ Error al cambiar estado");
      }
    } catch (error) {
      console.error("Failed to toggle file:", error);
      alert("❌ Error al cambiar estado");
    }
  }

  function startEdit(file: AgentFile) {
    setEditingFile(file);
    setFormData({
      name: file.name,
      description: file.description,
      category: file.category,
      attachmentId: file.url.split('/').pop() || '',
      tags: file.tags.join(', '),
      brand: file.metadata.brand || '',
      withPrices: file.metadata.withPrices || false,
      season: file.metadata.season || '',
      year: file.metadata.year || ''
    });
    setShowUploadForm(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      category: 'catalog',
      attachmentId: '',
      tags: '',
      brand: '',
      withPrices: false,
      season: '',
      year: ''
    });
    setEditingFile(null);
    setShowUploadForm(false);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (loading) {
    return <div className="p-6">Cargando archivos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with filters and add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestión de Archivos</h2>
          <p className="text-sm text-gray-600">Sube y administra catálogos, flyers e información para el agente</p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Agregar Archivo
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 border-b pb-3">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-lg text-sm font-medium ${
            filterCategory === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos ({files.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const count = files.filter(f => f.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setFilterCategory(key as FileCategory)}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                filterCategory === key
                  ? CATEGORY_COLORS[key as FileCategory]
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Upload/Edit form */}
      {showUploadForm && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">
            {editingFile ? 'Editar Archivo' : 'Nuevo Archivo'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Catálogo Azaleia P/V 2025"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Categoría *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as FileCategory })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Catálogo de primavera/verano con todos los modelos..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">ID del Attachment *</label>
              <input
                type="text"
                value={formData.attachmentId}
                onChange={(e) => setFormData({ ...formData, attachmentId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                placeholder="fb92017c-e56b-437d-80a2-79c1fe57dd9a"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Sube el archivo primero en CRM → Adjuntos y copia el ID
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Marca</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Azaleia, Olympikus..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    checked={formData.withPrices}
                    onChange={(e) => setFormData({ ...formData, withPrices: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Incluye precios</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Temporada</label>
                <input
                  type="text"
                  value={formData.season}
                  onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Primavera/Verano"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Año</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="2025"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tags (separados por coma)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="abierto, cerrado, mujer, hombre..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Guardando...' : (editingFile ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Files list */}
      <div className="space-y-3">
        {files.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No hay archivos en esta categoría</p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="mt-3 text-blue-600 hover:text-blue-700 font-medium"
            >
              Agregar tu primer archivo
            </button>
          </div>
        )}

        {files.map(file => (
          <div
            key={file.id}
            className={`bg-white p-4 rounded-lg border ${
              !file.enabled ? 'opacity-60 bg-gray-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{file.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${CATEGORY_COLORS[file.category]}`}>
                    {CATEGORY_LABELS[file.category]}
                  </span>
                  {file.metadata.withPrices && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                      Con Precios
                    </span>
                  )}
                  {!file.enabled && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-600">
                      Desactivado
                    </span>
                  )}
                </div>

                {file.description && (
                  <p className="text-sm text-gray-600 mb-2">{file.description}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>📄 {file.fileName}</span>
                  <span>💾 {formatFileSize(file.size)}</span>
                  {file.metadata.brand && <span>🏷️ {file.metadata.brand}</span>}
                  {file.metadata.season && <span>🌸 {file.metadata.season}</span>}
                  {file.metadata.year && <span>📅 {file.metadata.year}</span>}
                </div>

                {file.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {file.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleToggle(file)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                  title={file.enabled ? "Desactivar" : "Activar"}
                >
                  {file.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                  title="Ver archivo"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => startEdit(file)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {files.length > 0 && (
        <div className="text-sm text-gray-500 text-center pt-4 border-t">
          Mostrando {files.length} archivo{files.length !== 1 ? 's' : ''}
          {filterCategory !== 'all' && ` en categoría ${CATEGORY_LABELS[filterCategory]}`}
        </div>
      )}
    </div>
  );
}
