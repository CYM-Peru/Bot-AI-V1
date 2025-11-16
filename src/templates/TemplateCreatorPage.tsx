import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, Send, AlertCircle, CheckCircle, Clock, X, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { apiUrl, apiFetch } from '../lib/apiBase';

interface SavedImage {
  filename: string;
  url: string;
  fullUrl?: string;
  size: number;
  uploadedAt: number;
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  imageUrl?: string; // URL de la imagen seleccionada
  example?: {
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
    text: string;
    phone_number?: string;
    url?: string;
    example?: string[];
  }>;
}

interface Template {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: TemplateComponent[];
}

interface SubmittedTemplate {
  id: string;
  name: string;
  status: string;
  submittedAt: string;
}

export default function TemplateCreatorPage() {
  const [template, setTemplate] = useState<Template>({
    name: '',
    language: 'es',
    category: 'MARKETING',
    components: []
  });

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [wabaIds, setWabaIds] = useState<string[]>([]);
  const [selectedWabaId, setSelectedWabaId] = useState<string>('');
  const [submittedTemplates, setSubmittedTemplates] = useState<SubmittedTemplate[]>([]);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const removingImageRef = React.useRef(false);
  const removeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadWabaIds();
    loadSubmittedTemplates();
    loadSavedImages();
  }, []);

  const loadWabaIds = async () => {
    try {
      const response = await apiFetch('/api/template-creator/waba-ids');
      if (response.ok) {
        const data = await response.json();
        console.log('[TemplateCreator] WABA IDs loaded:', data);
        setWabaIds(data.wabaIds || []);
        setSelectedWabaId(data.default || '');
      } else {
        const errorData = await response.json();
        console.error('[TemplateCreator] Error loading WABA IDs:', errorData);
        setError(`Error al cargar configuración de WhatsApp: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('[TemplateCreator] Error loading WABA IDs:', error);
      setError('Error al conectar con el servidor para obtener configuración de WhatsApp');
    }
  };

  const loadSubmittedTemplates = async () => {
    try {
      // Cargar plantillas desde Meta (estado real y actualizado)
      const response = await apiFetch('/api/crm/templates');
      if (response.ok) {
        const data = await response.json();
        // Convertir formato de Meta al formato del frontend y ordenar por ID (más reciente primero)
        const templates = (data.templates || [])
          .map((tpl: any) => ({
            id: tpl.id,
            name: tpl.name,
            status: tpl.status,
            category: tpl.category,
            language: tpl.language,
            submittedAt: new Date().toISOString() // Meta no devuelve fecha de creación
          }))
          .sort((a: any, b: any) => {
            // Ordenar por ID descendente (más alto = más reciente)
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idB - idA;
          });
        setSubmittedTemplates(templates);
      }
    } catch (error) {
      console.error('Error loading templates from Meta:', error);
      // Fallback a localStorage si falla
      const saved = localStorage.getItem('submitted_templates');
      if (saved) {
        setSubmittedTemplates(JSON.parse(saved));
      }
    }
  };

  const loadSavedImages = async () => {
    try {
      const response = await apiFetch('/api/template-images');
      if (response.ok) {
        const data = await response.json();
        setSavedImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading saved images:', error);
    }
  };

  const handleImageUpload = async (file: File, componentIndex: number) => {
    setUploadingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await apiFetch('/api/template-images/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al subir imagen');
      }

      const data = await response.json();
      const imageUrl = data.fullUrl || `${window.location.origin}${data.url}`;

      // Actualizar el componente con la URL de la imagen
      updateComponent(componentIndex, {
        imageUrl,
        example: { header_handle: [imageUrl] }
      });

      // Recargar lista de imágenes
      await loadSavedImages();

    } catch (error: any) {
      setError(error.message || 'Error al subir imagen');
      console.error('Error uploading image:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const saveSubmittedTemplate = async (templateData: SubmittedTemplate) => {
    // Ya no guardamos en localStorage, recargamos desde Meta
    await loadSubmittedTemplates();
  };

  const addComponent = (type: TemplateComponent['type']) => {
    const newComponent: TemplateComponent = { type };

    if (type === 'HEADER') {
      newComponent.format = 'TEXT';
      newComponent.text = '';
    } else if (type === 'BODY') {
      newComponent.text = '';
    } else if (type === 'FOOTER') {
      newComponent.text = '';
    } else if (type === 'BUTTONS') {
      newComponent.buttons = [];
    }

    setTemplate(prev => ({
      ...prev,
      components: [...prev.components, newComponent]
    }));
  };

  const removeComponent = (index: number) => {
    setTemplate(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  const updateComponent = (index: number, updates: Partial<TemplateComponent>) => {
    const stack = new Error().stack;
    console.log('[TemplateCreator] updateComponent called from:', stack);
    console.log('[TemplateCreator] updateComponent params:', { index, updates });

    // Si estamos removiendo imagen, NO permitir agregar imageUrl o example
    if ((removingImageRef.current || removingImage) && (updates.imageUrl || updates.example)) {
      console.log('[TemplateCreator] BLOCKED: Trying to add image while removing (ref or state), ignoring');
      return;
    }

    setTemplate(prev => {
      const newComponents = [...prev.components];
      const comp = newComponents[index];

      // Crear nuevo objeto sin las propiedades a eliminar
      const updated: TemplateComponent = { ...comp };

      // Aplicar actualizaciones
      Object.keys(updates).forEach(key => {
        const value = updates[key as keyof TemplateComponent];
        if (value === undefined) {
          // Eliminar la propiedad
          delete updated[key as keyof TemplateComponent];
        } else {
          // Actualizar la propiedad
          (updated as any)[key] = value;
        }
      });

      console.log('[TemplateCreator] Component updated:', { before: comp, after: updated });
      newComponents[index] = updated;

      return {
        ...prev,
        components: newComponents
      };
    });
  };

  const removeImage = (componentIndex: number) => {
    console.log('[TemplateCreator] removeImage called for component:', componentIndex);

    // Verificar si hay imagen
    const comp = template.components[componentIndex];
    if (!comp.imageUrl) {
      console.log('[TemplateCreator] No image to remove');
      // Limpiar flags si no hay imagen
      removingImageRef.current = false;
      setRemovingImage(false);
      return;
    }

    // El flag ya debería estar seteado por onMouseEnter, pero lo aseguramos
    removingImageRef.current = true;
    setRemovingImage(true);

    setTemplate(prev => {
      const comp = prev.components[componentIndex];

      // Crear un componente COMPLETAMENTE NUEVO sin imageUrl ni example
      const cleanComponent: TemplateComponent = {
        type: comp.type,
        ...(comp.format && { format: comp.format }),
        ...(comp.text && { text: comp.text }),
        ...(comp.buttons && { buttons: comp.buttons })
      };

      const newComponents = [...prev.components];
      newComponents[componentIndex] = cleanComponent;

      console.log('[TemplateCreator] Image removed:', {
        before: comp,
        after: cleanComponent,
        hasImageUrl: !!cleanComponent.imageUrl,
        hasExample: !!cleanComponent.example
      });

      return {
        ...prev,
        components: newComponents
      };
    });

    // Cancelar timeout anterior si existe
    if (removeTimeoutRef.current) {
      console.log('[TemplateCreator] Clearing previous timeout');
      clearTimeout(removeTimeoutRef.current);
    }

    // Esperar 3 segundos antes de permitir clicks en la galería
    console.log('[TemplateCreator] Setting 3-second timeout to re-enable gallery');
    removeTimeoutRef.current = setTimeout(() => {
      console.log('[TemplateCreator] ✅ Re-enabling image selection after 3 seconds');
      removingImageRef.current = false;
      setRemovingImage(false);
      removeTimeoutRef.current = null;
    }, 3000);
  };

  const addButton = (componentIndex: number) => {
    const component = template.components[componentIndex];
    if (component.type !== 'BUTTONS') return;

    const newButton = {
      type: 'QUICK_REPLY' as const,
      text: ''
    };

    updateComponent(componentIndex, {
      buttons: [...(component.buttons || []), newButton]
    });
  };

  const updateButton = (componentIndex: number, buttonIndex: number, updates: any) => {
    const component = template.components[componentIndex];
    if (component.type !== 'BUTTONS' || !component.buttons) return;

    const updatedButtons = component.buttons.map((btn, i) =>
      i === buttonIndex ? { ...btn, ...updates } : btn
    );

    updateComponent(componentIndex, { buttons: updatedButtons });
  };

  const removeButton = (componentIndex: number, buttonIndex: number) => {
    const component = template.components[componentIndex];
    if (component.type !== 'BUTTONS' || !component.buttons) return;

    updateComponent(componentIndex, {
      buttons: component.buttons.filter((_, i) => i !== buttonIndex)
    });
  };

  const handleDeleteTemplate = async (templateName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la plantilla "${templateName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/crm/templates/${templateName}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setSuccess(`Plantilla "${templateName}" eliminada exitosamente`);
        await loadSubmittedTemplates();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar plantilla');
      }
    } catch (error: any) {
      setError(error.message || 'Error al eliminar plantilla');
      console.error('Error deleting template:', error);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validaciones
      if (!template.name.trim()) {
        throw new Error('El nombre de la plantilla es requerido');
      }

      if (!/^[a-z0-9_]+$/.test(template.name)) {
        throw new Error('El nombre solo puede contener minúsculas, números y guiones bajos');
      }

      if (template.components.length === 0) {
        throw new Error('Debes agregar al menos un componente');
      }

      // Validar que si hay un header IMAGE, tenga una imagen seleccionada
      const headerComp = template.components.find(c => c.type === 'HEADER');
      if (headerComp && headerComp.format === 'IMAGE' && !headerComp.imageUrl) {
        throw new Error('El encabezado de tipo Imagen requiere que selecciones una imagen');
      }

      console.log('[TemplateCreator] Validation - selectedWabaId:', selectedWabaId);
      console.log('[TemplateCreator] Validation - wabaIds:', wabaIds);

      if (!selectedWabaId) {
        throw new Error('No se encontró un WABA ID. Configura un número de WhatsApp primero.');
      }

      const response = await apiFetch('/api/template-creator/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          ...template,
          wabaId: selectedWabaId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details?.message || 'Error al crear plantilla');
      }

      // Guardar plantilla enviada
      saveSubmittedTemplate({
        id: data.template.id,
        name: template.name,
        status: data.template.status,
        submittedAt: new Date().toISOString()
      });

      setSuccess(`✅ Plantilla "${template.name}" enviada a Meta para aprobación. ${data.template.message}`);

      // Limpiar formulario
      setTemplate({
        name: '',
        language: 'es',
        category: 'MARKETING',
        components: []
      });

    } catch (error: any) {
      setError(error.message || 'Error al enviar plantilla');
      console.error('Error creating template:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para renderizar texto con formato WhatsApp (negritas, cursivas, etc.)
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Convertir formato WhatsApp a HTML
    let formatted = text;

    // Negrita: *texto* -> <strong>texto</strong>
    formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

    // Cursiva: _texto_ -> <em>texto</em>
    formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Tachado: ~texto~ -> <del>texto</del>
    formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');

    // Monospace: ```texto``` -> <code>texto</code>
    formatted = formatted.replace(/```([^`]+)```/g, '<code class="bg-gray-100 px-1 rounded">$1</code>');

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const renderPreview = () => {
    const headerComp = template.components.find(c => c.type === 'HEADER');
    const bodyComp = template.components.find(c => c.type === 'BODY');
    const footerComp = template.components.find(c => c.type === 'FOOTER');
    const buttonsComp = template.components.find(c => c.type === 'BUTTONS');

    return (
      <div className="bg-[#e5ddd5] p-4 rounded-lg">
        <div className="bg-white rounded-lg shadow-md max-w-sm p-3 space-y-2">
          {headerComp && (
            <div className="font-bold text-gray-900">
              {headerComp.format === 'IMAGE' && (
                headerComp.imageUrl ? (
                  <img
                    src={headerComp.imageUrl}
                    alt="Header"
                    className="w-full h-40 object-cover rounded mb-2"
                  />
                ) : (
                  <div className="bg-gray-200 rounded h-32 flex items-center justify-center mb-2 text-gray-500 text-sm">
                    [Selecciona una imagen]
                  </div>
                )
              )}
              {headerComp.text && <div>{renderFormattedText(headerComp.text)}</div>}
            </div>
          )}

          {bodyComp && bodyComp.text && (
            <div className="text-gray-800 whitespace-pre-wrap">
              {renderFormattedText(bodyComp.text)}
            </div>
          )}

          {footerComp && footerComp.text && (
            <div className="text-xs text-gray-500 mt-2">
              {renderFormattedText(footerComp.text)}
            </div>
          )}

          {buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0 && (
            <div className="border-t pt-2 mt-2 space-y-1">
              {buttonsComp.buttons.map((btn, i) => (
                <div
                  key={i}
                  className="text-center text-blue-600 font-medium py-2 border rounded hover:bg-blue-50 cursor-pointer"
                >
                  {btn.text || '[Botón]'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Send className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Creador de Plantillas WhatsApp
            </h1>
          </div>
          <p className="text-sm text-gray-600 ml-14">
            Diseña plantillas personalizadas y envíalas a Meta Business para aprobación
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800">{success}</p>
            </div>
            <button type="button" onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Plantilla*
                </label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ejemplo_plantilla"
                />
                <p className="text-xs text-gray-500 mt-1">Solo minúsculas, números y guiones bajos</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idioma*
                  </label>
                  <select
                    value={template.language}
                    onChange={(e) => setTemplate(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="es">Español</option>
                    <option value="es_ES">Español (España)</option>
                    <option value="es_MX">Español (México)</option>
                    <option value="es_PE">Español (Perú)</option>
                    <option value="en">Inglés</option>
                    <option value="pt_BR">Portugués (Brasil)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría*
                  </label>
                  <select
                    value={template.category}
                    onChange={(e) => setTemplate(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utilidad</option>
                    <option value="AUTHENTICATION">Autenticación</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Componentes de la Plantilla</h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => addComponent('HEADER')}
                    disabled={template.components.some(c => c.type === 'HEADER')}
                    className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    + Encabezado
                  </button>
                  <button
                    type="button"
                    onClick={() => addComponent('BODY')}
                    disabled={template.components.some(c => c.type === 'BODY')}
                    className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    + Cuerpo
                  </button>
                  <button
                    type="button"
                    onClick={() => addComponent('FOOTER')}
                    disabled={template.components.some(c => c.type === 'FOOTER')}
                    className="px-3 py-1.5 text-sm bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    + Pie
                  </button>
                  <button
                    type="button"
                    onClick={() => addComponent('BUTTONS')}
                    disabled={template.components.some(c => c.type === 'BUTTONS')}
                    className="px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    + Botones
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {template.components.map((component, index) => {
                  const typeColors = {
                    HEADER: 'bg-blue-50 border-blue-200 text-blue-700',
                    BODY: 'bg-purple-50 border-purple-200 text-purple-700',
                    FOOTER: 'bg-teal-50 border-teal-200 text-teal-700',
                    BUTTONS: 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  };

                  return (
                  <div key={index} className={`border-2 rounded-xl p-4 transition-all hover:shadow-md ${typeColors[component.type]}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm uppercase tracking-wide">{component.type}</span>
                      <button
                        type="button"
                        onClick={() => removeComponent(index)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {component.type === 'HEADER' && (
                      <>
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Formato
                          </label>
                          <select
                            value={component.format}
                            onChange={(e) => updateComponent(index, { format: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="TEXT">Texto</option>
                            <option value="IMAGE">Imagen</option>
                            <option value="VIDEO">Video</option>
                            <option value="DOCUMENT">Documento</option>
                          </select>
                        </div>
                        {component.format === 'TEXT' && (
                          <textarea
                            value={component.text || ''}
                            onChange={(e) => updateComponent(index, { text: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Texto del encabezado"
                            rows={2}
                            maxLength={60}
                          />
                        )}
                        {component.format === 'IMAGE' && (
                          <div className="space-y-3">
                            {component.imageUrl ? (
                              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    Imagen seleccionada
                                  </span>
                                  <button
                                    type="button"
                                    onMouseEnter={() => {
                                      // Establecer flag ANTES de cualquier click
                                      console.log('[TemplateCreator] Mouse entered X button - setting protection flag');
                                      removingImageRef.current = true;
                                      setRemovingImage(true);
                                    }}
                                    onMouseLeave={() => {
                                      // Si el mouse sale sin hacer click, limpiar flag
                                      if (component.imageUrl) {
                                        console.log('[TemplateCreator] Mouse left X button without clicking - clearing flag');
                                        removingImageRef.current = false;
                                        setRemovingImage(false);
                                        // Cancelar timeout si existe
                                        if (removeTimeoutRef.current) {
                                          clearTimeout(removeTimeoutRef.current);
                                          removeTimeoutRef.current = null;
                                        }
                                      }
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      e.nativeEvent.stopImmediatePropagation();
                                      console.log('[TemplateCreator] X button clicked - removing image');
                                      removeImage(index);
                                      return false;
                                    }}
                                    className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50"
                                    title="Eliminar imagen"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                <div className="relative">
                                  <img
                                    src={component.imageUrl}
                                    alt="Preview"
                                    className="w-full h-32 object-cover rounded"
                                    onError={(e) => {
                                      console.error('[TemplateCreator] Error loading image:', component.imageUrl);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const errorDiv = document.createElement('div');
                                      errorDiv.className = 'bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600';
                                      errorDiv.textContent = 'Error al cargar imagen. URL: ' + component.imageUrl?.substring(0, 50);
                                      (e.target as HTMLImageElement).parentElement?.appendChild(errorDiv);
                                    }}
                                  />
                                  <div className="text-xs text-gray-500 mt-1 truncate" title={component.imageUrl}>
                                    {component.imageUrl}
                                  </div>
                                </div>
                              </div>
                            ) : !removingImage ? (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Subir Imagen
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(file, index);
                                    }
                                  }}
                                  disabled={uploadingImage}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                                {uploadingImage && (
                                  <p className="text-sm text-blue-600 mt-1">Subiendo imagen...</p>
                                )}
                              </div>
                            ) : (
                              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-center">
                                <p className="text-sm text-gray-500">Eliminando imagen...</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {component.type === 'BODY' && (
                      <textarea
                        value={component.text || ''}
                        onChange={(e) => updateComponent(index, { text: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Texto del cuerpo (usa {{1}}, {{2}} para variables)"
                        rows={4}
                        maxLength={1024}
                      />
                    )}

                    {component.type === 'FOOTER' && (
                      <textarea
                        value={component.text || ''}
                        onChange={(e) => updateComponent(index, { text: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Texto del pie de página"
                        rows={2}
                        maxLength={60}
                      />
                    )}

                    {component.type === 'BUTTONS' && (
                      <div className="space-y-3">
                        {component.buttons?.map((button, btnIndex) => (
                          <div key={btnIndex} className="border border-gray-200 rounded p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <select
                                value={button.type}
                                onChange={(e) => updateButton(index, btnIndex, { type: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="QUICK_REPLY">Respuesta Rápida</option>
                                <option value="PHONE_NUMBER">Teléfono</option>
                                <option value="URL">URL</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => removeButton(index, btnIndex)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={button.text}
                              onChange={(e) => updateButton(index, btnIndex, { text: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Texto del botón"
                              maxLength={25}
                            />
                            {button.type === 'PHONE_NUMBER' && (
                              <input
                                type="text"
                                value={button.phone_number || ''}
                                onChange={(e) => updateButton(index, btnIndex, { phone_number: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Número de teléfono"
                              />
                            )}
                            {button.type === 'URL' && (
                              <input
                                type="text"
                                value={button.url || ''}
                                onChange={(e) => updateButton(index, btnIndex, { url: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="URL (usa {{1}} para variable)"
                              />
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addButton(index)}
                          disabled={(component.buttons?.length || 0) >= 3}
                          className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4 inline mr-1" />
                          Agregar Botón (máx 3)
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}

                {template.components.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Agrega componentes usando los botones de arriba
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 font-semibold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
              >
                <Eye className="w-5 h-5" />
                {showPreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !template.name || template.components.length === 0}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 font-semibold disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Send className="w-5 h-5" />
                {loading ? 'Enviando...' : 'Enviar a Meta'}
              </button>
            </div>
          </div>

          {/* Vista previa y plantillas enviadas */}
          <div className="space-y-4">
            {showPreview && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Vista Previa</h3>
                </div>
                {renderPreview()}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Plantillas en Meta</h3>
                <button
                  onClick={loadSubmittedTemplates}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Recargar plantillas"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {submittedTemplates.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No hay plantillas creadas aún</p>
                  <p className="text-gray-400 text-xs mt-1">Crea tu primera plantilla usando el formulario</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submittedTemplates.map((tpl: any, i) => {
                    const statusConfig = {
                      APPROVED: {
                        bg: 'bg-emerald-50',
                        border: 'border-emerald-200',
                        text: 'text-emerald-700',
                        icon: <CheckCircle className="w-4 h-4" />,
                        label: 'Aprobada'
                      },
                      PENDING: {
                        bg: 'bg-amber-50',
                        border: 'border-amber-200',
                        text: 'text-amber-700',
                        icon: <Clock className="w-4 h-4" />,
                        label: 'Pendiente'
                      },
                      REJECTED: {
                        bg: 'bg-red-50',
                        border: 'border-red-200',
                        text: 'text-red-700',
                        icon: <AlertCircle className="w-4 h-4" />,
                        label: 'Rechazada'
                      }
                    };

                    const status = statusConfig[tpl.status as keyof typeof statusConfig] || statusConfig.PENDING;

                    const categoryColors = {
                      MARKETING: 'bg-purple-100 text-purple-700',
                      UTILITY: 'bg-blue-100 text-blue-700',
                      AUTHENTICATION: 'bg-indigo-100 text-indigo-700'
                    };

                    return (
                      <div
                        key={i}
                        className={`border ${status.border} rounded-lg p-4 ${status.bg} transition-all hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900 truncate">{tpl.name}</h4>
                              {tpl.category && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[tpl.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700'}`}>
                                  {tpl.category}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <div className={`flex items-center gap-1.5 font-medium ${status.text}`}>
                                {status.icon}
                                <span>{status.label}</span>
                              </div>
                              {tpl.language && (
                                <span className="text-gray-500">
                                  {tpl.language === 'es' ? '🇪🇸 Español' : tpl.language}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteTemplate(tpl.name)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0"
                            title="Eliminar plantilla"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
