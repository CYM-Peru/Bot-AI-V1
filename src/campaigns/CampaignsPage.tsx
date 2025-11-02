import React, { useState, useCallback, useEffect } from 'react';
import { apiUrl } from '../lib/apiBase';

interface Campaign {
  id: string;
  name: string;
  whatsappNumberId: string;
  templateName: string;
  recipients: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  createdBy: string;
  throttleRate: number;
}

interface WhatsAppNumber {
  id: string;
  phoneNumber: string;
  displayName: string;
  phoneNumberId: string;
}

interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
  components?: any[];
}

export default function CampaignsPage() {
  const [campaignName, setCampaignName] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [selectedWhatsAppNumber, setSelectedWhatsAppNumber] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppNumber[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get selected template object for preview
  const selectedTemplateObj = templates.find(t => t.name === selectedTemplate);

  // Load WhatsApp numbers from connections
  useEffect(() => {
    const loadWhatsAppNumbers = async () => {
      try {
        const response = await fetch(apiUrl('/api/connections/whatsapp/list'), {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const connections = data.connections || [];
          // Map connections to WhatsAppNumber format
          const mappedNumbers = connections
            .filter((conn: any) => conn.isActive)
            .map((conn: any) => ({
              id: conn.id,
              phoneNumber: conn.displayNumber || conn.phoneNumberId,
              displayName: conn.alias,
              phoneNumberId: conn.phoneNumberId,
              wabaId: conn.wabaId,
            }));
          setWhatsappNumbers(mappedNumbers);
        }
      } catch (error) {
        console.error('[Campaigns] Error loading WhatsApp numbers:', error);
      }
    };
    loadWhatsAppNumbers();
  }, []);

  // Load templates when WhatsApp number is selected
  useEffect(() => {
    const loadTemplates = async () => {
      if (!selectedWhatsAppNumber) {
        setTemplates([]);
        return;
      }

      setLoadingTemplates(true);
      try {
        const response = await fetch(apiUrl(`/api/crm/templates?phoneNumberId=${selectedWhatsAppNumber}`), {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const approvedTemplates = (data.templates || []).filter((t: Template) => t.status === 'APPROVED');
          setTemplates(approvedTemplates);
        } else {
          setError('Error al cargar plantillas');
        }
      } catch (error) {
        console.error('[Campaigns] Error loading templates:', error);
        setError('Error al cargar plantillas');
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [selectedWhatsAppNumber]);

  // Parse recipients from textarea
  const parseRecipients = useCallback(() => {
    const lines = recipientsText.split('\n');
    const phones = lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/\D/g, ''));
    return phones.filter(phone => phone.length >= 9 && phone.length <= 15);
  }, [recipientsText]);

  const validRecipients = parseRecipients();
  const isOverLimit = validRecipients.length > 1000;

  const handleSend = async () => {
    if (!campaignName || !selectedWhatsAppNumber || !selectedTemplate || validRecipients.length === 0) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (isOverLimit) {
      setError('Máximo 1000 destinatarios por campaña');
      return;
    }

    try {
      setSending(true);
      setError(null);

      // Create campaign
      const createResponse = await fetch(apiUrl('/api/campaigns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: campaignName,
          whatsappNumberId: selectedWhatsAppNumber,
          templateName: selectedTemplate,
          recipients: validRecipients,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Error al crear campaña');
      }

      const { campaign } = await createResponse.json();

      // Start sending
      const sendResponse = await fetch(apiUrl(`/api/campaigns/${campaign.id}/send`), {
        method: 'POST',
        credentials: 'include',
      });

      if (!sendResponse.ok) {
        throw new Error('Error al iniciar envío');
      }

      setSuccess(`✅ Campaña "${campaignName}" iniciada! Se enviarán ${validRecipients.length} mensajes.`);

      // Reset form
      setCampaignName('');
      setRecipientsText('');
      setSelectedTemplate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">📢 Campañas Masivas</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">⚙️ Configuración</h2>

            {/* Campaign Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre de la Campaña
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: Promoción Black Friday 2024"
              />
            </div>

            {/* Recipients */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Destinatarios ({validRecipients.length}{isOverLimit && ' - ⚠️ LÍMITE EXCEDIDO'})
              </label>
              <textarea
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                className={`w-full px-3 py-2 border ${isOverLimit ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm`}
                placeholder="Pega aquí los números de teléfono (uno por línea)&#10;51987654321&#10;51912345678&#10;...&#10;&#10;O pega desde Excel (máximo 1000)"
                rows={8}
              />
              <p className="mt-1 text-xs text-slate-500">
                Números válidos: {validRecipients.length} / 1000
              </p>
            </div>

            {/* WhatsApp Number Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Número de WhatsApp
              </label>
              <select
                value={selectedWhatsAppNumber}
                onChange={(e) => setSelectedWhatsAppNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecciona un número...</option>
                {whatsappNumbers.map((number) => (
                  <option key={number.id} value={number.phoneNumberId}>
                    {number.phoneNumber} {number.displayName ? `(${number.displayName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Plantilla
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={!selectedWhatsAppNumber || loadingTemplates}
              >
                <option value="">
                  {!selectedWhatsAppNumber
                    ? 'Primero selecciona un número...'
                    : loadingTemplates
                    ? 'Cargando plantillas...'
                    : templates.length === 0
                    ? 'No hay plantillas aprobadas'
                    : 'Selecciona una plantilla...'}
                </option>
                {templates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.name} ({template.language})
                  </option>
                ))}
              </select>
              {templates.length === 0 && selectedWhatsAppNumber && !loadingTemplates && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠️ No hay plantillas aprobadas para este número. Crea plantillas en Meta Business Manager.
                </p>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !campaignName || !selectedWhatsAppNumber || !selectedTemplate || validRecipients.length === 0 || isOverLimit}
              className="w-full px-4 py-3 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {sending ? '📤 Enviando...' : `🚀 Enviar a ${validRecipients.length} destinatarios`}
            </button>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900">
                <strong>ℹ️ Info:</strong> Los mensajes se enviarán a 60 msg/min para evitar bloqueos de WhatsApp.
                Tiempo estimado: ~{Math.ceil(validRecipients.length / 60)} minutos.
              </p>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">👁️ Vista Previa</h2>

            {selectedTemplateObj ? (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="text-sm text-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">Plantilla: {selectedTemplateObj.name}</p>
                    <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                      {selectedTemplateObj.language.toUpperCase()}
                    </span>
                  </div>

                  {/* Phone mockup */}
                  <div className="mt-4 bg-[#E5DDD5] rounded-lg p-4">
                    <div className="bg-white rounded-lg shadow-sm p-3 max-w-xs">
                      {selectedTemplateObj.components?.map((comp: any, idx: number) => {
                        if (comp.type === 'HEADER') {
                          if (comp.format === 'TEXT') {
                            return (
                              <div key={idx} className="font-bold text-sm mb-2 text-slate-900">
                                {comp.text}
                              </div>
                            );
                          } else if (comp.format === 'IMAGE') {
                            // Try to get example image URL from template
                            const imageUrl = comp.example?.header_handle?.[0] || null;
                            return (
                              <div key={idx} className="mb-2 rounded overflow-hidden">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt="Header"
                                    className="w-full h-auto object-cover max-h-48"
                                    onError={(e) => {
                                      // Fallback if image fails to load
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`${imageUrl ? 'hidden' : ''} bg-slate-100 rounded p-4 text-xs text-slate-500 text-center`}>
                                  🖼️ Imagen (no hay preview disponible)
                                </div>
                              </div>
                            );
                          } else if (comp.format === 'VIDEO') {
                            const videoUrl = comp.example?.header_handle?.[0] || null;
                            return (
                              <div key={idx} className="mb-2 rounded overflow-hidden">
                                {videoUrl ? (
                                  <video
                                    src={videoUrl}
                                    controls
                                    className="w-full h-auto max-h-48"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`${videoUrl ? 'hidden' : ''} bg-slate-100 rounded p-4 text-xs text-slate-500 text-center`}>
                                  🎥 Video (no hay preview disponible)
                                </div>
                              </div>
                            );
                          } else if (comp.format === 'DOCUMENT') {
                            return (
                              <div key={idx} className="mb-2 bg-slate-100 rounded p-4 text-xs text-slate-500 text-center">
                                📄 Documento
                              </div>
                            );
                          }
                        } else if (comp.type === 'BODY') {
                          return (
                            <div key={idx} className="text-sm text-slate-800 whitespace-pre-wrap">
                              {comp.text}
                            </div>
                          );
                        } else if (comp.type === 'FOOTER') {
                          return (
                            <div key={idx} className="text-xs text-slate-500 mt-2">
                              {comp.text}
                            </div>
                          );
                        } else if (comp.type === 'BUTTONS') {
                          return (
                            <div key={idx} className="mt-3 space-y-1">
                              {comp.buttons?.map((btn: any, btnIdx: number) => (
                                <div
                                  key={btnIdx}
                                  className="text-center py-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-blue-600"
                                >
                                  {btn.type === 'URL' && '🔗 '}
                                  {btn.type === 'PHONE_NUMBER' && '📞 '}
                                  {btn.type === 'QUICK_REPLY' && '↩️ '}
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })}

                      {/* Show category badge */}
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400">
                          {selectedTemplateObj.category === 'MARKETING' && '📢 Marketing'}
                          {selectedTemplateObj.category === 'UTILITY' && '🔧 Utilidad'}
                          {selectedTemplateObj.category === 'AUTHENTICATION' && '🔐 Autenticación'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-12">
                Selecciona una plantilla para ver la vista previa
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
