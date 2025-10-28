import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';

export function StartNode(props: NodeProps<RuntimeNode>) {
  return (
    <NodeCard
      {...props}
      title={props.data.flowNode.label || 'Inicio del flujo'}
      badgeLabel="Inicio"
      badgeTone="start"
      icon="🚀"
      footer="Conecta el primer paso del flujo"
      allowDelete={false}
      allowDuplicate={false}
      showInputHandle={false}
    />
  );
}
