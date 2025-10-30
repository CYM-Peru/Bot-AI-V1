import React, { useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { getAskData } from '../../utils/flow';
import { GitBranch } from 'lucide-react';

export function ConditionNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const ask = useMemo(() => getAskData(data.flowNode), [data.flowNode]);
  const body = ask ? (
    <div className="space-y-2 text-xs text-slate-600">
      <div className="text-[11px] font-semibold text-slate-500">Pregunta</div>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 leading-snug">{ask.questionText}</p>
      <p className="text-[10px] text-slate-400">Variable: {ask.varName} · Tipo: {ask.varType}</p>
    </div>
  ) : (
    <div className="text-xs text-rose-600">Configura la acción de pregunta desde el inspector.</div>
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
