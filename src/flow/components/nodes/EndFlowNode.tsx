import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { Flag } from 'lucide-react';

export function EndFlowNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const note = typeof data.flowNode.action?.data?.note === 'string' ? data.flowNode.action?.data?.note : '';

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label || 'Fin del flujo'}
      subtitle={note}
      badgeLabel="Fin"
      badgeTone="end"
      icon={<Flag className="w-5 h-5" />}
      body={<p className="text-xs text-slate-600">Este bloque termina la conversación.</p>}
      allowAddMenu={false}
      allowAddAction={false}
    />
  );
}
