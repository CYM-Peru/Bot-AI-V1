import { useEffect, useState, useMemo } from "react";
import { apiUrl } from "../lib/apiBase";
import type { WhatsAppTemplate } from "../api/whatsapp-sender";

interface TemplatesSidebarProps {
  phone: string;
  phoneNumberId: string | null; // To filter templates by WhatsApp Business Account
  onSend: (templateName: string, language: string, components?: any[]) => Promise<void>;
  onClose: () => void;
}

export default function TemplatesSidebar({ phone, phoneNumberId, onSend, onClose }: TemplatesSidebarProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadTemplates();
  }, [phoneNumberId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Pass phoneNumberId to get templates for specific WhatsApp account
      const url = phoneNumberId
        ? apiUrl(`/api/crm/templates?phoneNumberId=${phoneNumberId}`)
        : apiUrl("/api/crm/templates");

      const response = await fetch(url);
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

  // Group templates by category
  const categories = useMemo(() => {
    const cats = new Set<string>();
    templates.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [templates]);

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Filter by category
    if (selectedCategory !== "all") {
      result = result.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.components?.some(c => c.text?.toLowerCase().includes(query))
      );
    }

    return result;
  }, [templates, selectedCategory, searchQuery]);

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

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case "marketing":
        return "📢";
      case "utility":
        return "🔧";
      case "authentication":
        return "🔐";
      default:
        return "📄";
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900">📋 Plantillas WhatsApp</h2>
            <p className="text-sm text-slate-600">Enviar a: {phone}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-2 hover:bg-slate-100 rounded-lg"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Category Filter */}
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 bg-slate-50">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar plantillas..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-emerald-400 focus:ring focus:ring-emerald-100 text-sm"
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${
                selectedCategory === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 border border-slate-300 hover:border-emerald-400"
              }`}
            >
              📚 Todas ({templates.length})
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition ${
                  selectedCategory === category
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 border border-slate-300 hover:border-emerald-400"
                }`}
              >
                {getCategoryIcon(category)} {category} ({templates.filter(t => t.category === category).length})
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Cargando plantillas...</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 px-6">
              <p className="text-lg font-semibold text-slate-700 mb-2">
                {searchQuery || selectedCategory !== "all" ? "No se encontraron plantillas" : "No hay plantillas disponibles"}
              </p>
              <p className="text-sm text-slate-500">
                {searchQuery || selectedCategory !== "all"
                  ? "Intenta con otros filtros o búsqueda"
                  : "Configure plantillas en su cuenta de WhatsApp Business"
                }
              </p>
            </div>
          ) : !selectedTemplate ? (
            // Template list
            <div className="p-6 space-y-3">
              {filteredTemplates.map((template) => (
                <button
                  key={`${template.name}-${template.language}`}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full text-left p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/50 transition group"
                  type="button"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{getCategoryIcon(template.category || "")}</span>
                        <h3 className="font-bold text-slate-900 truncate">{template.name}</h3>
                      </div>

                      {/* Preview */}
                      <div className="bg-white rounded-lg p-3 mb-3 border border-slate-200 group-hover:border-emerald-300">
                        <p className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
                          {template.components?.find((c) => c.type === "BODY")?.text || "Sin contenido"}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
                          🌐 {template.language}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                          template.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {template.status === "APPROVED" ? "✅ Aprobada" : "⏳ " + template.status}
                        </span>
                      </div>
                    </div>

                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0 ml-4 group-hover:text-emerald-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Template detail with parameters
            <div className="p-6 space-y-4">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition font-semibold"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver a la lista
              </button>

              {/* Template Preview */}
              <div className="bg-gradient-to-br from-slate-50 to-emerald-50 rounded-xl p-6 border-2 border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{getCategoryIcon(selectedTemplate.category || "")}</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{selectedTemplate.name}</h3>
                    <p className="text-sm text-slate-600">{selectedTemplate.category}</p>
                  </div>
                </div>

                {/* WhatsApp-style preview */}
                <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-300">
                  <div className="bg-emerald-500 text-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {getTemplatePreview(selectedTemplate)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-right">Vista previa</p>
                </div>
              </div>

              {/* Parameters */}
              {Object.keys(parameterValues).length > 0 && (
                <div className="space-y-3 bg-white rounded-xl p-4 border-2 border-slate-200">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Personalizar mensaje
                  </h4>
                  {Object.keys(parameterValues)
                    .sort()
                    .map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          📝 Parámetro {key}
                        </label>
                        <input
                          type="text"
                          value={parameterValues[key]}
                          onChange={(e) =>
                            setParameterValues((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
                          placeholder={`Ingrese el valor para {{${key}}}`}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedTemplate && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-slate-200 bg-slate-50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border-2 border-slate-300 rounded-lg hover:bg-slate-100 transition"
              type="button"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (Object.keys(parameterValues).length > 0 && Object.values(parameterValues).some((v) => !v))}
              className={`px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition shadow-lg ${
                sending || (Object.keys(parameterValues).length > 0 && Object.values(parameterValues).some((v) => !v))
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              type="button"
            >
              {sending ? "Enviando..." : "✉️ Enviar plantilla"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
