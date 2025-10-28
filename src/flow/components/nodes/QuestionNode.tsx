import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { getAskData } from '../../utils/flow';

export function QuestionNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const ask = getAskData(data.flowNode);

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Pregunta"
      badgeTone="question"
      icon="❓"
      body={
        ask ? (
          <div className="space-y-2 text-xs text-slate-600">
            <div>
              <span className="text-[11px] font-semibold text-slate-500">Pregunta</span>
              <p className="mt-1 rounded-lg border border-slate-200 bg-white/60 px-3 py-2 leading-snug text-[13px] text-slate-700">
                {ask.questionText}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-white/60 px-2 py-1 font-medium text-slate-600">
                Variable: {ask.varName}
              </span>
              <span className="rounded-full bg-white/60 px-2 py-1 font-medium text-slate-600">Tipo: {ask.varType}</span>
            </div>
            {ask.validation?.type && ask.validation.type !== 'none' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Validación: {ask.validation.type === 'regex' ? 'Expresión regular' : 'Opciones predefinidas'}
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">On invalid:</span> {ask.retryMessage}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Configura la pregunta desde el inspector.</div>
        )
      }
    />
  );
}
