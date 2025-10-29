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
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setShowMenu(true);
  };

  const handleDelete = () => {
    if (onDeleteEdge && source && target) {
      onDeleteEdge(source as string, target as string);
    }
    setShowMenu(false);
  };

  const handleCreateNode = () => {
    if (onCreateNode && source && target) {
      const sourceHandleId = (data as any)?.sourceHandleId || 'out:default';
      onCreateNode(source as string, target as string, sourceHandleId);
    }
    setShowMenu(false);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={`flow-edge ${selected ? 'selected' : ''}`}
        style={{
          stroke: selected ? '#3b82f6' : '#94a3b8',
          strokeWidth: selected ? 2.5 : 2,
        }}
      />

      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onContextMenu={handleContextMenu}
        style={{ cursor: 'context-menu' }}
      />

      {/* Context Menu */}
      {showMenu && (
        <EdgeLabelRenderer>
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: menuPosition.x,
              top: menuPosition.y,
              zIndex: 1000,
            }}
            className="bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]"
          >
            <button
              onClick={handleCreateNode}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear nodo aquí
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Eliminar conexión
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
