import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { useState, useRef, useEffect } from 'react';

interface CustomEdgeProps extends EdgeProps {
  onDeleteEdge?: (sourceId: string, targetId: string) => void;
  onCreateNode?: (sourceId: string, targetId: string, handleId: string) => void;
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  data,
  selected,
  onDeleteEdge,
  onCreateNode,
}: CustomEdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteEdge && source && target) {
      onDeleteEdge(source as string, target as string);
    }
    setIsHovered(false);
  };

  const handleCreateNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateNode && source && target) {
      const sourceHandleId = (data as any)?.sourceHandleId || 'out:default';
      onCreateNode(source as string, target as string, sourceHandleId);
    }
    setIsHovered(false);
  };

  return (
    <>
      {/* Visible edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isHovered || selected ? '#10b981' : '#94a3b8',
          strokeWidth: isHovered || selected ? 3 : 2,
        }}
      />

      {/* EdgeLabelRenderer for interactive overlay and menu */}
      <EdgeLabelRenderer>
        {/* Wide invisible SVG path overlay for easier hover */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={30}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              cursor: 'pointer',
              pointerEvents: 'stroke',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          />
        </svg>

        {/* Hover Menu - appears at center of edge */}
        {isHovered && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              transform: 'translate(-50%, -50%)',
              left: labelX,
              top: labelY,
              zIndex: 1000,
              pointerEvents: 'all',
            }}
            className="flex gap-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <button
              onClick={handleCreateNode}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
              title="Crear nodo intermedio"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-px bg-slate-200" />
            <button
              onClick={handleDelete}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              title="Eliminar conexión"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
