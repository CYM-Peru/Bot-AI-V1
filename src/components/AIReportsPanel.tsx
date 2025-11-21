/**
 * AI Reports Panel
 * Panel de informes con IA - Solo para Admin
 */

import React, { useState } from 'react';
import { BarChart, TrendingUp, AlertTriangle, FileText, Copy, CheckCircle, ExternalLink } from 'lucide-react';
import { apiUrl } from '../lib/apiBase';

interface AIReport {
  type: 'daily' | 'weekly' | 'performance' | 'problems';
  generatedAt: string;
  toonFormat: string;
  metadata: {
    period: string;
    totalChats: number;
    totalAdvisors: number;
  };
}

interface ReportType {
  type: string;
  name: string;
  description: string;
  icon: string;
}

export const AIReportsPanel: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availableReports, setAvailableReports] = useState<ReportType[]>([]);
  const [metabaseUrl, setMetabaseUrl] = useState<string>('');

  // Cargar lista de reportes disponibles
  React.useEffect(() => {
    fetch(apiUrl('/api/admin/ai-reports'), {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        setAvailableReports(data.reports || []);
        setMetabaseUrl(data.metabaseUrl || '');
      })
      .catch(err => console.error('Error loading reports:', err));
  }, []);

  const handleGenerateReport = async (type: string) => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/ai-reports/${type}`), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const report: AIReport = await response.json();
      setSelectedReport(report);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte. Verifica que tienes permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (selectedReport) {
      navigator.clipboard.writeText(selectedReport.toonFormat);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      '📊': <BarChart className="w-6 h-6" />,
      '📈': <TrendingUp className="w-6 h-6" />,
      '⚡': <FileText className="w-6 h-6" />,
      '🚨': <AlertTriangle className="w-6 h-6" />,
    };
    return icons[iconName] || <FileText className="w-6 h-6" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          🤖 Informes con IA
        </h1>
        <p className="text-slate-600">
          Genera reportes en formato TOON optimizado para análisis con ChatGPT/Claude
        </p>
      </div>

      {/* Metabase Link */}
      {metabaseUrl && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">📊 Dashboards Visuales</h3>
              <p className="text-sm text-blue-700">Ver gráficos y métricas en Metabase</p>
            </div>
            <a
              href={metabaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              Abrir Metabase
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {availableReports.map((report) => (
          <button
            key={report.type}
            onClick={() => handleGenerateReport(report.type)}
            disabled={loading}
            className="p-6 bg-white border-2 border-slate-200 rounded-lg hover:border-emerald-500 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-emerald-600">
                {getIconComponent(report.icon)}
              </div>
              <h3 className="font-semibold text-slate-900">{report.name}</h3>
            </div>
            <p className="text-sm text-slate-600">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-600">Generando reporte...</p>
        </div>
      )}

      {/* Report Display */}
      {selectedReport && !loading && (
        <div className="bg-white border-2 border-slate-200 rounded-lg p-6">
          {/* Report Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {selectedReport.type === 'daily' && '📊 Reporte Diario'}
                {selectedReport.type === 'weekly' && '📈 Reporte Semanal'}
                {selectedReport.type === 'performance' && '⚡ Reporte de Performance'}
                {selectedReport.type === 'problems' && '🚨 Problemas Actuales'}
              </h2>
              <div className="flex gap-4 text-sm text-slate-600">
                <span>Período: {selectedReport.metadata.period}</span>
                <span>Chats: {selectedReport.metadata.totalChats}</span>
                <span>Asesores: {selectedReport.metadata.totalAdvisors}</span>
              </div>
            </div>
            <button
              onClick={handleCopyReport}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Reporte
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-semibold text-amber-900 mb-2">📋 Cómo usar este reporte:</h3>
            <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
              <li>Haz clic en "Copiar Reporte" arriba</li>
              <li>Abre ChatGPT (GPT-4) o Claude</li>
              <li>Pega el reporte completo</li>
              <li>La IA te dará análisis detallado y sugerencias</li>
            </ol>
          </div>

          {/* Report Content */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-slate-800 whitespace-pre-wrap font-mono">
              {selectedReport.toonFormat}
            </pre>
          </div>

          {/* Footer Info */}
          <div className="mt-4 text-xs text-slate-500 text-center">
            Generado: {new Date(selectedReport.generatedAt).toLocaleString('es-PE')}
            {' • '}
            Formato TOON (optimizado para IA - ahorra ~50% tokens)
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedReport && !loading && (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg">Selecciona un tipo de reporte arriba para empezar</p>
        </div>
      )}
    </div>
  );
};
