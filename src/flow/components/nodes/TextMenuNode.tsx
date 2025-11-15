import React, { useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';
import { getMenuOptions } from '../../utils/flow';
import { FileText } from 'lucide-react';

export function TextMenuNode(props: NodeProps<RuntimeNode>) {
  const { data } = props;
  const options = useMemo(() => getMenuOptions(data.flowNode), [data.flowNode]);
  const body = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>Opciones (Texto plano)</span>
        <span className="font-semibold text-slate-600">{options.length}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-600">
        <span>✏️</span>
        <span>El cliente digita el número</span>
      </div>
      <ol className="space-y-1 text-xs text-slate-700">
        {options.map((option, index) => (
          <li key={option.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
            <span className="truncate">
              {index + 1}. {option.label || 'Sin etiqueta'}
            </span>
            <span className="text-[10px] text-slate-400">{option.targetId ? 'con destino' : 'sin destino'}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <NodeCard
      {...props}
      title={data.flowNode.label}
      subtitle={data.flowNode.description}
      badgeLabel="Menú de texto"
      badgeTone="menu"
      icon={<FileText className="w-5 h-5" />}
      body={body}
      footer="Envía un mensaje de texto con opciones numeradas."
    />
  );
}
