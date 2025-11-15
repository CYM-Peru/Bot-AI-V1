import React, { useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import {
  getAskData,
  getButtonsData,
  getSchedulerData,
  STRICTEST_LIMIT,
} from '../../utils/flow';
import { Settings, Timer, Paperclip } from 'lucide-react';

export function ActionNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const badgeTone = useMemo(() => {
    const kind = data.flowNode.action?.kind;
    switch (kind) {
      case 'webhook_out':
      case 'webhook_in':
      case 'handoff':
      case 'transfer':
      case 'ia_rag':
      case 'ia_agent':
      case 'tool':
        return 'integration' as const;
      case 'scheduler':
      case 'condition':
      case 'delay':
        return 'validation' as const;
      default:
        return 'message' as const;
    }
  }, [data.flowNode.action?.kind]);
  const summary = useMemo(() => {
    const kind = data.flowNode.action?.kind ?? 'acción';
    if (kind === 'buttons') {
      const buttonData = getButtonsData(data.flowNode);
      if (!buttonData) return null;
      const visible = buttonData.items.slice(0, buttonData.maxButtons);
      const overflow = buttonData.items.length - visible.length;
      return (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500">Botones ({visible.length})</div>
          <div className="flex flex-wrap gap-1">
            {visible.map((item) => (
              <span key={item.id} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                {item.label}
              </span>
            ))}
            {overflow > 0 && (
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] text-violet-700">+{overflow} en lista</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Límite estricto sugerido: {STRICTEST_LIMIT.max} botones ({STRICTEST_LIMIT.channel}).
          </p>
        </div>
      );
    }
    if (kind === 'ask') {
      const ask = getAskData(data.flowNode);
      if (!ask) return null;
      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500">Pregunta</div>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 leading-snug">{ask.questionText}</p>
          <p className="text-[10px] text-slate-400">Variable: {ask.varName} · Tipo: {ask.varType}</p>
        </div>
      );
    }
    if (kind === 'scheduler') {
      const scheduler = getSchedulerData(data.flowNode);
      if (!scheduler) return null;
      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500">Horario</div>
          <p>Modo: {scheduler.mode === 'bitrix' ? 'Bitrix24' : 'Personalizado'}</p>
          <p className="text-[10px] text-slate-400">Configura los destinos dentro/fuera de horario desde el inspector.</p>
        </div>
      );
    }
    if (kind === 'delay') {
      const delaySeconds = data.flowNode.action?.data?.delaySeconds;
      const formatted = delaySeconds
        ? delaySeconds < 60
          ? `${delaySeconds} segundo${delaySeconds !== 1 ? 's' : ''}`
          : delaySeconds < 3600
          ? `${Math.floor(delaySeconds / 60)} minuto${Math.floor(delaySeconds / 60) !== 1 ? 's' : ''}`
          : delaySeconds < 86400
          ? `${Math.floor(delaySeconds / 3600)} hora${Math.floor(delaySeconds / 3600) !== 1 ? 's' : ''}`
          : `${Math.floor(delaySeconds / 86400)} día${Math.floor(delaySeconds / 86400) !== 1 ? 's' : ''}`
        : 'No configurado';
      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" /> Timer/Espera
          </div>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 leading-snug text-amber-700">
            Esperar: <span className="font-semibold">{formatted}</span>
          </p>
          <p className="text-[10px] text-slate-400">Rango: 1 segundo - 4 días (345,600 segundos)</p>
        </div>
      );
    }
    if (kind === 'attachment') {
      const fileName = data.flowNode.action?.data?.fileName ?? data.flowNode.action?.data?.name;
      const fileSize = data.flowNode.action?.data?.fileSize;
      const mimeType = data.flowNode.action?.data?.mimeType;

      // Extraer extensión del nombre de archivo
      const extension = fileName ? fileName.split('.').pop()?.toUpperCase() : null;
      const baseName = fileName || 'Archivo sin nombre';

      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Adjunto
          </div>
          <p className="font-medium truncate">{baseName}</p>
          {(extension || fileSize) && (
            <div className="flex gap-2 text-[10px] text-slate-400">
              {extension && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">{extension}</span>}
              {fileSize && <span>{Math.round(fileSize / 1024)} KB</span>}
            </div>
          )}
          {mimeType && !extension && (
            <p className="text-[10px] text-slate-400">{mimeType}</p>
          )}
        </div>
      );
    }
    if (kind === 'ia_agent') {
      return (
        <div className="space-y-2 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500">🤖 Agente IA con Herramientas</div>
          <div className="space-y-1">
            <p className="text-[11px]">Este nodo activa el agente IA inteligente que puede:</p>
            <ul className="text-[10px] text-slate-500 space-y-0.5 pl-3">
              <li>• Enviar catálogos automáticamente</li>
              <li>• Transferir a colas según keywords</li>
              <li>• Verificar horarios de atención</li>
              <li>• Calificar leads antes de transferir</li>
            </ul>
          </div>
          <p className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
            💡 Configura el agente en: Configuración → Agente IA
          </p>
        </div>
      );
    }
    if (kind === 'bitrix_create' || kind === 'bitrix_crm') {
      const actionData = data.flowNode.action?.data;
      const operation = actionData?.operation || 'create';
      const entityType = actionData?.entityType || 'lead';
      const fields = actionData?.fields || [];

      const operationLabels: Record<string, string> = {
        create: 'Crear',
        update: 'Actualizar',
        delete: 'Eliminar',
        search: 'Buscar'
      };

      const entityLabels: Record<string, string> = {
        lead: 'Lead',
        contact: 'Contacto',
        deal: 'Negocio',
        company: 'Empresa'
      };

      return (
        <div className="space-y-2 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500">CRM Bitrix24</div>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[11px] font-medium">
              {operationLabels[operation] || operation}
            </span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-[11px] font-medium">
              {entityLabels[entityType] || entityType}
            </span>
          </div>
          {fields.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400">Campos configurados: {fields.length}</p>
              <div className="flex flex-wrap gap-1">
                {fields.slice(0, 3).map((field: any) => (
                  <span key={field.id} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                    {field.fieldName}
                  </span>
                ))}
                {fields.length > 3 && (
                  <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px]">
                    +{fields.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="text-xs text-slate-600">
        {data.flowNode.action?.kind ? `Acción · ${data.flowNode.action?.kind}` : 'Acción sin tipo definido.'}
      </div>
    );
  }, [data.flowNode]);

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Acción"
      badgeTone={badgeTone}
      icon={<Settings className="w-5 h-5" />}
      body={summary}
    />
  );
}
