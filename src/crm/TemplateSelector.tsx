import { useEffect, useState } from "react";
import { apiUrl } from "../lib/apiBase";
import type { WhatsAppTemplate } from "../api/whatsapp-sender";

interface TemplateSelectorProps {
  phone: string;
  onSend: (templateName: string, language: string, components?: any[]) => Promise<void>;
  onClose: () => void;
}

export default function TemplateSelector({ phone, onSend, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/crm/templates"));
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        console.error("[Templates] Failed to load templates");
      }
    } catch (error) {
      console.error("[Templates] Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setParameterValues({});

    // Extract parameters from template body
    const bodyComponent = template.components?.find((c) => c.type === "BODY");
    if (bodyComponent?.text) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        const params: Record<string, string> = {};
        matches.forEach((match) => {
          const num = match.replace(/[{}]/g, "");
          params[num] = "";
        });
        setParameterValues(params);
      }
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate || sending) return;

    setSending(true);
    try {
      // Build components with parameters
      const components: any[] = [];

      const bodyComponent = selectedTemplate.components?.find((c) => c.type === "BODY");
      if (bodyComponent && Object.keys(parameterValues).length > 0) {
        components.push({
          type: "body",
          parameters: Object.keys(parameterValues)
            .sort()
            .map((key) => ({
              type: "text",
              text: parameterValues[key],
            })),
        });
      }

      await onSend(selectedTemplate.name, selectedTemplate.language, components.length > 0 ? components : undefined);
      onClose();
    } catch (error) {
      console.error("[Templates] Error sending template:", error);
      alert("Error al enviar la plantilla");
    } finally {
      setSending(false);
    }
  };

  const getTemplatePreview = (template: WhatsAppTemplate): string => {
    const bodyComponent = template.components?.find((c) => c.type === "BODY");
    if (!bodyComponent?.text) return template.name;

    let preview = bodyComponent.text;

    // Replace parameters with values or placeholders
    const matches = preview.match(/\{\{(\d+)\}\}/g);
    if (matches) {
      matches.forEach((match) => {
        const num = match.replace(/[{}]/g, "");
        const value = parameterValues[num] || `[Parámetro ${num}]`;
        preview = preview.replace(match, value);
      });
    }

    return preview;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Plantillas de WhatsApp</h2>
            <p className="text-sm text-slate-600">Enviar a: {phone}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Cargando plantillas...</p>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg font-semibold text-slate-700 mb-2">No hay plantillas disponibles</p>
              <p className="text-sm text-slate-500">
                Configure plantillas en su cuenta de WhatsApp Business
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {!selectedTemplate ? (
                // Template list
                <div className="grid gap-3">
                  {templates.map((template) => (
                    <button
                      key={`${template.name}-${template.language}`}
                      onClick={() => handleSelectTemplate(template)}
                      className="text-left p-4 border border-slate-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition"
                      type="button"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 mb-1">{template.name}</h3>
                          <p className="text-sm text-slate-600 mb-2">
                            {template.components?.find((c) => c.type === "BODY")?.text || "Sin contenido"}
                          </p>
                          <div className="flex gap-2">
                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                              {template.language}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {template.category}
                            </span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                // Template detail with parameters
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver a la lista
                  </button>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-bold text-slate-900 mb-2">{selectedTemplate.name}</h3>
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{getTemplatePreview(selectedTemplate)}</p>
                    </div>
                  </div>

                  {Object.keys(parameterValues).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-slate-900">Parámetros de la plantilla:</h4>
                      {Object.keys(parameterValues)
                        .sort()
                        .map((key) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Parámetro {key}
                            </label>
                            <input
                              type="text"
                              value={parameterValues[key]}
                              onChange={(e) =>
                                setParameterValues((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-emerald-400 focus:ring focus:ring-emerald-100"
                              placeholder={`Ingrese el valor para {{${key}}}`}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedTemplate && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              type="button"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (Object.keys(parameterValues).length > 0 && Object.values(parameterValues).some((v) => !v))}
              className={`px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition ${
                sending || (Object.keys(parameterValues).length > 0 && Object.values(parameterValues).some((v) => !v))
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              type="button"
            >
              {sending ? "Enviando..." : "Enviar plantilla"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
