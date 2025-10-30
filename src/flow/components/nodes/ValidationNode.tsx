import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { getConditionData } from '../../utils/flow';
import { Shield } from 'lucide-react';

function formatGroupKeywords(keywords: string[]): string {
  if (keywords.length === 0) {
    return 'Sin palabras clave';
  }
  if (keywords.length === 1) {
    return keywords[0];
  }
  if (keywords.length === 2) {
    return `${keywords[0]} · ${keywords[1]}`;
  }
  return `${keywords[0]}, ${keywords[1]} +${keywords.length - 2}`;
}

export function ValidationNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const validation = getConditionData(data.flowNode);

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Validación"
      badgeTone="validation"
      icon={<Shield className="w-5 h-5" />}
      body={
        validation ? (
          <div className="space-y-3 text-xs text-slate-600">
            {validation.bitrixConfig && (
              <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-[11px] text-slate-600">
                <div className="font-semibold text-slate-700">Bitrix24</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                    Entidad: {validation.bitrixConfig.entityType}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                    Campo: {validation.bitrixConfig.identifierField}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Palabras clave</span>
                <span className="text-[10px] text-slate-400 uppercase">
                  {validation.keywordGroupLogic === 'and' ? 'Grupos AND' : 'Grupos OR'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(validation.keywordGroups ?? []).length === 0 && (
                  <span className="text-[11px] text-slate-500">Sin criterios configurados</span>
                )}
                {(validation.keywordGroups ?? []).map((group) => (
                  <span
                    key={group.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-[11px] text-slate-600"
                  >
                    <span className="text-[10px] uppercase text-slate-400">{group.mode === 'exact' ? 'Exacto' : 'Contiene'}</span>
                    <span className="font-medium text-slate-700">{formatGroupKeywords(group.keywords)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Configura los criterios de validación en el inspector.</div>
        )
      }
    />
  );
}
