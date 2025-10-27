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

export function ActionNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
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
    if (kind === 'attachment') {
      const fileName = data.flowNode.action?.data?.fileName ?? data.flowNode.action?.data?.name;
      const fileSize = data.flowNode.action?.data?.fileSize;
      const mimeType = data.flowNode.action?.data?.mimeType;

      // Extraer extensión del nombre de archivo
      const extension = fileName ? fileName.split('.').pop()?.toUpperCase() : null;
      const baseName = fileName || 'Archivo sin nombre';

      return (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="text-[11px] font-semibold text-slate-500">📎 Adjunto</div>
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
      badgeTone="action"
      icon="⚙️"
      body={summary}
    />
  );
}
