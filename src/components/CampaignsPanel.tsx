import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../lib/apiBase";

interface CampaignMetric {
  campaignId: string;
  campaignName: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  responded: number;
  clicked: number;
}

interface Campaign {
  id: string;
  name: string;
  createdAt: number;
  status: string;
}

export function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/campaigns'), {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  }, []);

  const fetchCampaignMetrics = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/campaigns/metrics/all'), {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch campaign metrics');
      const data = await response.json();
      setCampaignMetrics(data.metrics || []);
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCampaigns(), fetchCampaignMetrics()]);
      setLoading(false);
    };

    loadData();
  }, [fetchCampaigns, fetchCampaignMetrics]);

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`¿Seguro que quieres eliminar la campaña "${campaignName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/campaigns/${campaignId}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || 'Error al eliminar campaña');
        return;
      }

      alert('Campaña eliminada exitosamente');
      // Refresh data
      await Promise.all([fetchCampaigns(), fetchCampaignMetrics()]);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Error al eliminar campaña');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Cargando métricas de campañas...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">📢 Campañas</h2>
          <p className="text-sm text-slate-600 mt-1">Métricas de campañas de mensajería masiva</p>
        </div>

        {!Array.isArray(campaignMetrics) || campaignMetrics.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📢</div>
            <p className="text-lg text-slate-600 mb-2">No hay campañas aún</p>
            <p className="text-sm text-slate-500">Las campañas enviadas aparecerán aquí con sus métricas</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">📊 Métricas de Campañas</h3>
              <p className="text-sm text-slate-600 mt-1">Performance de campañas de mensajería masiva</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Campaña</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Enviados</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Entregados</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Leídos</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Fallados</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Respondidos</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {campaignMetrics.map((cm) => {
                    const campaign = campaigns.find(c => c.id === cm.campaignId);
                    const sentPct = cm.totalRecipients > 0 ? ((cm.sent / cm.totalRecipients) * 100).toFixed(1) : '0';
                    const deliveredPct = cm.totalRecipients > 0 ? ((cm.delivered / cm.totalRecipients) * 100).toFixed(1) : '0';
                    const readPct = cm.totalRecipients > 0 ? ((cm.read / cm.totalRecipients) * 100).toFixed(1) : '0';
                    const failedPct = cm.totalRecipients > 0 ? ((cm.failed / cm.totalRecipients) * 100).toFixed(1) : '0';
                    const respondedPct = cm.totalRecipients > 0 ? ((cm.responded / cm.totalRecipients) * 100).toFixed(1) : '0';

                    return (
                      <tr key={cm.campaignId} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-4">
                          <div className="text-sm font-bold text-slate-900">{cm.campaignName}</div>
                          {campaign && (
                            <div className="text-xs text-slate-500">Estado: {campaign.status}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm text-slate-700">
                            {campaign ? new Date(campaign.createdAt).toLocaleDateString('es-PE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-lg font-bold text-blue-600">{cm.totalRecipients}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm font-bold text-slate-900">{cm.sent}</div>
                          <div className="text-xs text-slate-500">{sentPct}%</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm font-bold text-green-700">{cm.delivered}</div>
                          <div className="text-xs text-green-600">{deliveredPct}%</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm font-bold text-blue-700">{cm.read}</div>
                          <div className="text-xs text-blue-600">{readPct}%</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm font-bold text-red-700">{cm.failed}</div>
                          <div className="text-xs text-red-600">{failedPct}%</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm font-bold text-purple-700">{cm.responded}</div>
                          <div className="text-xs text-purple-600">{respondedPct}%</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleDeleteCampaign(cm.campaignId, cm.campaignName)}
                            className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar campaña"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
