import { CampaignMetrics } from "./Configuration/CampaignMetrics";

export function AdTrackingPanel() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">🎯 Tracking de Ads</h2>
          <p className="text-sm text-slate-600 mt-1">Métricas de campañas publicitarias</p>
        </div>

        <CampaignMetrics />
      </div>
    </div>
  );
}
