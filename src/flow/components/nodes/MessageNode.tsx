import React, { useMemo, useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeCard } from './NodeCard';
import type { RuntimeNode } from './types';

export function MessageNode(props: NodeProps<RuntimeNode>) {
  const { id, data } = props;
  const text: string = useMemo(() => {
    const raw = data.flowNode.action?.data?.text;
    return typeof raw === 'string' ? raw : '';
  }, [data.flowNode]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const body = (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold text-slate-500">Mensaje</label>
      <textarea
        readOnly
        value={text}
        onPointerDown={(event) => event.stopPropagation()}
        className="w-full min-h-[110px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
      />
      <p className="text-[11px] text-slate-400">Arrastra desde la esquina para agrandar el cuadro.</p>
    </div>
  );

  const footer = `${text.trim().length} caracteres`;

  return (
    <div className="relative">
      <NodeCard
        {...props}
        title={data.flowNode.label}
        subtitle={data.flowNode.description}
        badgeLabel="Mensaje"
        badgeTone="message"
        icon="💬"
        body={body}
        footer={footer}
        extraActions={
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            adjuntar
          </button>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            data.onAttach(id, files);
          }
          event.target.value = '';
        }}
      />
    </div>
  );
}
