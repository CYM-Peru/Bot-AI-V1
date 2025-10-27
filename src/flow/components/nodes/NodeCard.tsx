import { Handle, Position, type NodeProps } from '@xyflow/react';
import React, { useCallback } from 'react';
import type { RuntimeNode } from './types';
import type { NodeType } from '../../types';

const handleVariantClasses: Record<string, string> = {
  default: 'bg-emerald-400',
  more: 'bg-violet-400',
  invalid: 'bg-rose-400',
  answer: 'bg-sky-400',
};

interface NodeCardProps extends NodeProps<RuntimeNode> {
  title: string;
  subtitle?: string;
  badgeLabel: string;
  badgeTone: 'menu' | 'action' | 'end' | 'condition';
  icon: string;
  body?: React.ReactNode;
  footer?: React.ReactNode;
  extraActions?: React.ReactNode;
  allowAddMenu?: boolean;
  allowAddAction?: boolean;
  allowDelete?: boolean;
}

const badgeStyles: Record<NodeCardProps['badgeTone'], string> = {
  menu: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  action: 'bg-violet-50 border-violet-300 text-violet-700',
  condition: 'bg-sky-50 border-sky-300 text-sky-700',
  end: 'bg-slate-100 border-slate-300 text-slate-700',
};

export function NodeCard(props: NodeCardProps) {
  const {
    id,
    data,
    selected,
    title,
    subtitle,
    badgeLabel,
    badgeTone,
    icon,
    body,
    footer,
    extraActions,
    allowAddMenu = true,
    allowAddAction = true,
    allowDelete = true,
  } = props;
  const handleAddChild = useCallback(
    (type: NodeType) => {
      data.onAddChild(id, type);
    },
    [data, id],
  );

  const handleDuplicate = useCallback(() => {
    data.onDuplicate(id);
  }, [data, id]);

  const handleDelete = useCallback(() => {
    data.onDelete(id);
  }, [data, id]);

  const borderClass = data.invalid
    ? 'border-rose-300 ring-2 ring-rose-400 shadow-rose-100'
    : selected
    ? 'border-emerald-400 ring-2 ring-emerald-300 shadow-emerald-100'
    : 'border-slate-200 hover:border-emerald-300';

  const handleCount = data.handleSpecs.length || 1;

  return (
    <div
      className={`group relative w-[320px] rounded-2xl border bg-white shadow-lg transition ${borderClass}`}
      onClick={(event) => {
        event.stopPropagation();
        data.onSelect(id);
      }}
    >
      <Handle type="target" id="in" position={Position.Left} className="!w-3 !h-3 !bg-slate-400" />
      {data.handleSpecs.map((spec, index) => {
        const variantClass = handleVariantClasses[spec.variant ?? 'default'] ?? handleVariantClasses.default;
        const topPercent = ((index + 1) / (handleCount + 1)) * 100;
        return (
          <Handle
            key={spec.id}
            type="source"
            position={Position.Right}
            id={spec.id}
            className={`!w-3 !h-3 border-2 border-white shadow ${variantClass}`}
            style={{ top: `${topPercent}%` }}
          />
        );
      })}

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-lg">
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 truncate" title={title}>
                {title}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeStyles[badgeTone]}`}>{badgeLabel}</span>
            </div>
            {subtitle && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{subtitle}</p>}
          </div>
        </div>

        {body && <div className="mt-3 space-y-2 text-xs text-slate-600">{body}</div>}
      </div>

      <div className="px-4 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {allowAddMenu && (
            <button
              type="button"
              className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-50"
              onClick={(event) => {
                event.stopPropagation();
                handleAddChild('menu');
              }}
            >
              + menú
            </button>
          )}
          {allowAddAction && (
            <button
              type="button"
              className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-50"
              onClick={(event) => {
                event.stopPropagation();
                handleAddChild('action');
              }}
            >
              + acción
            </button>
          )}
          <button
            type="button"
            className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-50"
            onClick={(event) => {
              event.stopPropagation();
              handleDuplicate();
            }}
          >
            duplicar
          </button>
          {allowDelete && (
            <button
              type="button"
              className="rounded-md border border-rose-200 bg-white px-3 py-1.5 font-medium text-rose-600 transition hover:bg-rose-50"
              onClick={(event) => {
                event.stopPropagation();
                handleDelete();
              }}
            >
              borrar
            </button>
          )}
          {extraActions}
        </div>
        {footer && <div className="mt-3 text-[11px] text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}
