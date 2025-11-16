import React, { useState, useCallback, useEffect } from 'react';
import { authFetch } from '../lib/apiBase';

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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [mediaId, setMediaId] = useState('');

  // Post-response configuration
  const [postResponseAction, setPostResponseAction] = useState<'none' | 'activate_bot'>('none');
  const [responseBotFlowId, setResponseBotFlowId] = useState('');
  const [postBotAction, setPostBotAction] = useState<'close' | 'assign_to_queue'>('close');
  const [postBotQueueId, setPostBotQueueId] = useState('');
  const [flows, setFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [queues, setQueues] = useState<Array<{ id: string; name: string }>>([]);

  // Get selected template object for preview
  const selectedTemplateObj = templates.find(t => t.name === selectedTemplate);

  // Load WhatsApp numbers from connections
  useEffect(() => {
    const loadWhatsAppNumbers = async () => {
      try {
        const response = await authFetch('/api/connections/whatsapp/list');
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
    loadCampaigns();
    loadFlows();
    loadQueues();
  }, []);

  // Load campaigns list
  const loadCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      const response = await authFetch('/api/campaigns');
      if (response.ok) {
        const data = await response.json();
        // Ensure campaigns is always an array
        const campaignsList = Array.isArray(data.campaigns) ? data.campaigns : [];
        setCampaigns(campaignsList);
      } else {
        console.error('[Campaigns] Failed to load campaigns, status:', response.status);
        setCampaigns([]);
      }
    } catch (error) {
      console.error('[Campaigns] Error loading campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Load flows list
  const loadFlows = async () => {
    try {
      const response = await authFetch('/api/flows');
      if (response.ok) {
        const data = await response.json();
        setFlows(data.flows || []);
      }
    } catch (error) {
      console.error('[Campaigns] Error loading flows:', error);
    }
  };

  // Load queues list
  const loadQueues = async () => {
    try {
      const response = await authFetch('/api/admin/queues');
      if (response.ok) {
        const data = await response.json();
        setQueues(data.queues || []);
      }
    } catch (error) {
      console.error('[Campaigns] Error loading queues:', error);
    }
  };

  // Load templates when WhatsApp number is selected
  useEffect(() => {
    const loadTemplates = async () => {
      if (!selectedWhatsAppNumber) {
        setTemplates([]);
        return;
      }

      setLoadingTemplates(true);
      try {
        const response = await authFetch(`/api/crm/templates?phoneNumberId=${selectedWhatsAppNumber}`);
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

      // Build variables if media_id or URL is provided
      let variables = undefined;
      let finalMediaId = mediaId.trim();

      if (finalMediaId) {
        // Check if it's a URL (starts with http)
        if (finalMediaId.startsWith('http://') || finalMediaId.startsWith('https://')) {
          // It's a URL - need to download and upload to WhatsApp
          setError(null);
          setSuccess('⏳ Descargando y subiendo imagen a WhatsApp...');

          try {
            const uploadResponse = await authFetch('/api/campaigns/media/upload-from-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageUrl: finalMediaId,
                whatsappNumberId: selectedWhatsAppNumber,
              }),
            });

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(errorData.message || 'Error al subir imagen desde URL');
            }

            const uploadData = await uploadResponse.json();
            finalMediaId = uploadData.mediaId;
            setSuccess(`✅ Imagen subida! Media ID: ${finalMediaId}`);
          } catch (err) {
            setError('❌ Error al descargar/subir imagen: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            setSending(false);
            return;
          }
        }

        // Build variables with media_id
        variables = [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  id: finalMediaId,
                },
              },
            ],
          },
        ];
      }

      // Create campaign
      const createResponse = await authFetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          whatsappNumberId: selectedWhatsAppNumber,
          templateName: selectedTemplate,
          recipients: validRecipients,
          variables: variables,
          postResponseAction: postResponseAction,
          responseBotFlowId: postResponseAction === 'activate_bot' ? responseBotFlowId : undefined,
          postBotAction: postResponseAction === 'activate_bot' ? postBotAction : undefined,
          postBotQueueId: postResponseAction === 'activate_bot' && postBotAction === 'assign_to_queue' ? postBotQueueId : undefined,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Error al crear campaña');
      }

      const { campaign } = await createResponse.json();

      // Start sending
      const sendResponse = await authFetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST',
      });

      if (!sendResponse.ok) {
        throw new Error('Error al iniciar envío');
      }

      setSuccess(`✅ Campaña "${campaignName}" iniciada! Se enviarán ${validRecipients.length} mensajes.`);

      // Reset form
      setCampaignName('');
      setRecipientsText('');
      setSelectedTemplate('');
      setMediaId('');
      setPostResponseAction('none');
      setResponseBotFlowId('');
      setPostBotAction('close');
      setPostBotQueueId('');

      // Reload campaigns list
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (campaignId: string, campaignName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la campaña "${campaignName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await authFetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar campaña');
      }

      setSuccess(`✅ Campaña "${campaignName}" eliminada correctamente`);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar campaña');
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-emerald-50/30 to-purple-50/20 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Modern Header with Gradient */}
        <div className="mb-8 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl shadow-lg p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">Campañas Masivas</h1>
              <p className="text-emerald-50 text-sm">Envía mensajes masivos personalizados a tus contactos con plantillas aprobadas</p>
            </div>
            <div className="hidden lg:flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
                <div className="text-2xl font-bold">{campaigns.length}</div>
                <div className="text-xs text-emerald-100">Campañas</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 text-center">
                <div className="text-2xl font-bold">{validRecipients.length}</div>
                <div className="text-xs text-emerald-100">Destinatarios</div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl shadow-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 text-red-800 font-medium">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl shadow-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 text-emerald-800 font-medium">{success}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center gap-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h2 className="text-xl font-bold text-white">Configuración de Campaña</h2>
            </div>
            <div className="p-6">

            {/* Campaign Name */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Nombre de la Campaña
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-slate-300"
                placeholder="Ej: Promoción Black Friday 2024"
              />
            </div>

            {/* Recipients */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Destinatarios
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  isOverLimit ? 'bg-red-100 text-red-700' :
                  validRecipients.length > 0 ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {validRecipients.length} / 1000
                </span>
              </label>
              <textarea
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                className={`w-full px-4 py-3 border-2 ${isOverLimit ? 'border-red-400' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 ${isOverLimit ? 'focus:ring-red-500' : 'focus:ring-emerald-500'} focus:border-transparent transition-all hover:border-slate-300 font-mono text-sm`}
                placeholder="Pega aquí los números de teléfono (uno por línea)&#10;51987654321&#10;51912345678&#10;...&#10;&#10;O pega desde Excel (máximo 1000)"
                rows={8}
              />
              {isOverLimit && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Límite excedido. Máximo 1000 destinatarios por campaña.
                </p>
              )}
            </div>

            {/* WhatsApp Number Selector */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Número de WhatsApp
              </label>
              <select
                value={selectedWhatsAppNumber}
                onChange={(e) => setSelectedWhatsAppNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all hover:border-slate-300 appearance-none bg-white cursor-pointer"
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
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Plantilla de Mensaje
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-slate-300 appearance-none bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {template.name} ({template.language.toUpperCase()})
                  </option>
                ))}
              </select>
              {templates.length === 0 && selectedWhatsAppNumber && !loadingTemplates && (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>No hay plantillas aprobadas para este número. Crea plantillas en Meta Business Manager.</span>
                </p>
              )}
            </div>

            {/* Image URL for templates */}
            {selectedTemplate && (
              <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl">
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Link de la Imagen (Opcional)
                </label>
                <input
                  type="text"
                  value={mediaId}
                  onChange={(e) => setMediaId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-blue-300 text-sm bg-white"
                  placeholder="https://drive.google.com/... o cualquier URL pública"
                />
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-blue-700 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>El sistema descargará y subirá la imagen a WhatsApp automáticamente</span>
                  </p>
                  <p className="text-xs text-amber-700 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Importante:</strong> Asegúrate que el link sea público (sin restricciones de acceso)</span>
                  </p>
                </div>
              </div>
            )}

            {/* Post-Response Configuration */}
            <div className="mb-6 p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl">
              <h3 className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Configuración POST-RESPUESTA
              </h3>
              <p className="text-xs text-purple-700 mb-4 pl-7">
                ¿Qué hacer cuando un cliente responda a esta campaña?
              </p>

              {/* Response Action */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Acción al Responder
                </label>
                <select
                  value={postResponseAction}
                  onChange={(e) => setPostResponseAction(e.target.value as 'none' | 'activate_bot')}
                  className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-purple-300 text-sm bg-white"
                >
                  <option value="none">❌ No hacer nada (mantener cerrado)</option>
                  <option value="activate_bot">🤖 Activar Bot</option>
                </select>
              </div>

              {/* Bot Configuration (only if activate_bot is selected) */}
              {postResponseAction === 'activate_bot' && (
                <>
                  {/* Bot Flow Selection */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Bot a Activar
                    </label>
                    <select
                      value={responseBotFlowId}
                      onChange={(e) => setResponseBotFlowId(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-purple-300 text-sm bg-white"
                    >
                      <option value="">Selecciona un bot...</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Post-Bot Action */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Después del Bot
                    </label>
                    <select
                      value={postBotAction}
                      onChange={(e) => setPostBotAction(e.target.value as 'close' | 'assign_to_queue')}
                      className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-purple-300 text-sm bg-white"
                    >
                      <option value="close">🔒 Cerrar Conversación</option>
                      <option value="assign_to_queue">👥 Asignar a Cola</option>
                    </select>
                  </div>

                  {/* Queue Selection (only if assign_to_queue is selected) */}
                  {postBotAction === 'assign_to_queue' && (
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-2">
                        Cola de Asignación
                      </label>
                      <select
                        value={postBotQueueId}
                        onChange={(e) => setPostBotQueueId(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-purple-300 text-sm bg-white"
                      >
                        <option value="">Selecciona una cola...</option>
                        {queues.map((queue) => (
                          <option key={queue.id} value={queue.id}>
                            {queue.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !campaignName || !selectedWhatsAppNumber || !selectedTemplate || validRecipients.length === 0 || isOverLimit}
              className="w-full px-6 py-4 text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl font-bold text-lg flex items-center justify-center gap-3 group"
            >
              {sending ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Enviar a {validRecipients.length} destinatarios
                </>
              )}
            </button>

            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-400 rounded-r-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-xs text-blue-900">
                  <p className="font-semibold mb-1">Información de Envío</p>
                  <p>Los mensajes se enviarán a <strong>2000 msg/min</strong> (~33 msg/seg).</p>
                  <p>Tiempo estimado: <strong>~{Math.ceil(validRecipients.length / 2000)} {Math.ceil(validRecipients.length / 2000) === 1 ? 'minuto' : 'minutos'}</strong></p>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4 flex items-center gap-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h2 className="text-xl font-bold text-white">Vista Previa</h2>
            </div>
            <div className="p-6">

            {selectedTemplateObj ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div>
                    <p className="text-xs text-purple-600 font-semibold">PLANTILLA</p>
                    <p className="font-bold text-slate-900">{selectedTemplateObj.name}</p>
                  </div>
                  <span className="text-xs px-3 py-1.5 bg-emerald-500 text-white rounded-full font-bold">
                    {selectedTemplateObj.language.toUpperCase()}
                  </span>
                </div>

                  {/* Phone mockup - More realistic */}
                  <div className="flex justify-center">
                    <div className="relative w-full max-w-sm">
                      {/* Phone Frame */}
                      <div className="bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
                        {/* Phone Screen */}
                        <div className="bg-[#E5DDD5] rounded-[2.5rem] overflow-hidden">
                          {/* WhatsApp Header */}
                          <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-white font-semibold text-sm">Cliente</p>
                              <p className="text-emerald-200 text-xs">En línea</p>
                            </div>
                          </div>

                          {/* Message Area */}
                          <div className="p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
                            <div className="bg-white rounded-2xl shadow-md p-3 max-w-[85%] mb-2">
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
                              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {selectedTemplateObj.category === 'MARKETING' && '📢 Marketing'}
                                  {selectedTemplateObj.category === 'UTILITY' && '🔧 Utilidad'}
                                  {selectedTemplateObj.category === 'AUTHENTICATION' && '🔐 Autenticación'}
                                </span>
                                <span className="text-[9px] text-slate-300">12:30 PM</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <svg className="w-20 h-20 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-slate-400 font-medium">Selecciona una plantilla</p>
                <p className="text-slate-300 text-sm">para ver la vista previa</p>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Campaigns History Section */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Historial de Campañas</h2>
                    <p className="text-purple-100 text-sm">Seguimiento y gestión de envíos</p>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-2xl font-bold text-white">{campaigns.length}</p>
                  <p className="text-xs text-purple-100">Total</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loadingCampaigns ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-slate-500 font-medium">Cargando campañas...</p>
                </div>
              ) : !Array.isArray(campaigns) || campaigns.length === 0 ? (
                <div className="p-16 text-center">
                  <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-400 font-medium text-lg mb-1">No hay campañas registradas</p>
                  <p className="text-slate-300 text-sm">Crea tu primera campaña para empezar</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Campaña</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Destinatarios</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Plantilla</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(campaigns) && campaigns.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-purple-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg p-2">
                              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{campaign.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{campaign.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                            campaign.status === 'completed' ? 'bg-emerald-500 text-white' :
                            campaign.status === 'sending' ? 'bg-blue-500 text-white' :
                            campaign.status === 'failed' ? 'bg-red-500 text-white' :
                            campaign.status === 'cancelled' ? 'bg-gray-400 text-white' :
                            campaign.status === 'scheduled' ? 'bg-amber-500 text-white' :
                            'bg-slate-400 text-white'
                          }`}>
                            {campaign.status === 'completed' && '✓ Completada'}
                            {campaign.status === 'sending' && '⟳ Enviando'}
                            {campaign.status === 'failed' && '✕ Fallida'}
                            {campaign.status === 'cancelled' && '⊘ Cancelada'}
                            {campaign.status === 'draft' && '◐ Borrador'}
                            {campaign.status === 'scheduled' && '⏰ Programada'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-sm font-bold text-slate-700">{campaign.recipients.length}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-lg font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {campaign.templateName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-500">
                            {new Date(campaign.createdAt).toLocaleDateString('es-PE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">
                            {new Date(campaign.createdAt).toLocaleTimeString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDelete(campaign.id, campaign.name)}
                            className="inline-flex items-center justify-center w-9 h-9 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all hover:shadow-md group"
                            title="Eliminar campaña"
                          >
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
