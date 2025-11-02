import React, { useState } from 'react';
import { MetricsPanel } from './MetricsPanel';
import MetricsDashboard from '../crm/MetricsDashboard';
import type { WhatsAppNumberAssignment } from '../flow/types';

interface UnifiedMetricsPanelProps {
  whatsappNumbers?: WhatsAppNumberAssignment[];
}

export function UnifiedMetricsPanel({ whatsappNumbers = [] }: UnifiedMetricsPanelProps) {
  const [activeTab, setActiveTab] = useState<'bot' | 'advisors'>('bot');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('bot')}
              className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-all ${
                activeTab === 'bot'
                  ? 'bg-gradient-to-r from-emerald-50 to-blue-50 text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              🤖 Métricas del Bot
            </button>
            <button
              onClick={() => setActiveTab('advisors')}
              className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-all ${
                activeTab === 'advisors'
                  ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              👥 Métricas de Asesores
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'bot' ? (
          <MetricsPanel whatsappNumbers={whatsappNumbers} />
        ) : (
          <div className="h-full overflow-auto">
            <div className="p-6">
              <MetricsDashboard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
