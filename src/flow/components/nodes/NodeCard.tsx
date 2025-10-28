import { Handle, Position, type NodeProps } from '@xyflow/react';
import React, { useCallback } from 'react';
import type { RuntimeNode } from './types';
import type { NodeType } from '../../types';

const handleVariantClasses: Record<string, string> = {
  default: 'bg-[rgba(30,41,59,0.6)]',
  more: 'bg-[var(--pastel-lilac)]',
  invalid: 'bg-rose-400',
  answer: 'bg-sky-400',
};

type BadgeTone =
  | 'start'
  | 'menu'
  | 'message'
  | 'question'
  | 'validation'
  | 'integration'
  | 'end';

interface NodeCardProps extends NodeProps<RuntimeNode> {
  title: string;
  subtitle?: string;
  badgeLabel: string;
  badgeTone: BadgeTone;
  icon: string;
  body?: React.ReactNode;
  footer?: React.ReactNode;
  extraActions?: React.ReactNode;
  allowAddMenu?: boolean;
  allowAddAction?: boolean;
  allowDelete?: boolean;
  allowDuplicate?: boolean;
  showInputHandle?: boolean;
}

const toneTokens: Record<BadgeTone, { surface: string; badge: string; icon: string }> = {
  start: {
    surface: 'var(--pastel-mint)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
  menu: {
    surface: 'var(--pastel-blue)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
  message: {
    surface: 'var(--pastel-blue)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
  question: {
    surface: 'var(--pastel-yellow)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
  validation: {
    surface: 'var(--pastel-lilac)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
  integration: {
    surface: 'var(--pastel-teal)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
  end: {
    surface: 'var(--pastel-peach)',
    badge: 'bg-white/80 border border-[rgba(30,41,59,0.16)] text-[color:var(--ink)]',
    icon: 'bg-white/70',
  },
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
    allowDuplicate = true,
    showInputHandle = true,
  } = props;
  const tone = toneTokens[badgeTone] ?? toneTokens.menu;
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
    ? 'border-rose-300 ring-2 ring-rose-200 shadow-[0_12px_28px_rgba(244,63,94,0.18)]'
    : selected
    ? 'border-[color:var(--ink)]/30 ring-2 ring-[color:var(--ink)]/20 shadow-[0_14px_32px_rgba(15,23,42,0.16)]'
    : 'border-[rgba(30,41,59,0.08)] hover:border-[color:var(--ink)]/30 shadow-[0_10px_26px_rgba(15,23,42,0.10)]';

  const handleCount = data.handleSpecs.length || 1;

  return (
    <div
      className={`group relative w-[320px] rounded-2xl border backdrop-blur transition-shadow ${borderClass}`}
      style={{ backgroundColor: tone.surface }}
      onClick={(event) => {
        event.stopPropagation();
        data.onSelect(id);
      }}
    >
      {showInputHandle && (
        <Handle
          type="target"
          id="in"
          position={Position.Left}
          className="!w-3 !h-3 !bg-[rgba(30,41,59,0.35)] border border-white/70 shadow"
        />
      )}
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

      {/* Delay indicator badge in top-right corner */}
      {data.flowNode.delay && data.flowNode.delay > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[10px] font-medium text-blue-700">
          <span>⏱️</span>
          <span>{data.flowNode.delay}s</span>
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: tone.icon }}
          >
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 truncate" title={title}>
                {title}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${tone.badge}`}>{badgeLabel}</span>
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
          {allowDuplicate && (
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
          )}
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
