import React, { useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { getConditionData } from '../../utils/flow';
import { GitBranch } from 'lucide-react';

export function ConditionNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const conditionData = useMemo(() => getConditionData(data.flowNode), [data.flowNode]);

  const body = conditionData && conditionData.rules && conditionData.rules.length > 0 ? (
    <div className="space-y-2 text-xs text-slate-600">
      <div className="text-[11px] font-semibold text-slate-500">
        Reglas ({conditionData.rules.length}) · Modo: {conditionData.matchMode === 'all' ? 'Todas' : 'Cualquiera'}
      </div>
      {conditionData.rules.slice(0, 3).map((rule, idx) => (
        <div key={rule.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px]">
          <span className="font-medium">{idx + 1}.</span>{' '}
          <span className="text-slate-500">
            {rule.source === 'user_message' && 'Mensaje del usuario'}
            {rule.source === 'variable' && `Variable: ${rule.sourceValue || '?'}`}
            {rule.source === 'bitrix_field' && `Bitrix: ${rule.sourceValue || '?'}`}
            {rule.source === 'keyword' && 'Palabras clave'}
          </span>{' '}
          <span className="font-medium text-indigo-600">{rule.operator}</span>{' '}
          {rule.source === 'keyword' && rule.keywords ? (
            <span className="text-slate-700">[{rule.keywords.slice(0, 2).join(', ')}{rule.keywords.length > 2 ? '...' : ''}]</span>
          ) : (
            <span className="text-slate-700">"{rule.compareValue || ''}"</span>
          )}
        </div>
      ))}
      {conditionData.rules.length > 3 && (
        <div className="text-[10px] text-slate-400">+ {conditionData.rules.length - 3} reglas más</div>
      )}
    </div>
  ) : (
    <div className="text-xs text-rose-600">Configura las reglas condicionales desde el inspector.</div>
  );

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Condición"
      badgeTone="question"
      icon={<GitBranch className="w-5 h-5" />}
      body={body}
    />
  );
}
