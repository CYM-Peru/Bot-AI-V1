import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeProps,
  type XYPosition,
  useReactFlow,
} from '@xyflow/react';
import type { FinalConnectionState } from '@xyflow/system';
import '@xyflow/react/dist/style.css';
import type { Flow, NodeType } from './flow/types';
import { type ConnectionCreationKind } from './flow/utils/flow';
import {
  buildReactFlowGraph,
  type CanvasEdgeData,
  type CanvasNodeData,
} from './flow/adapters/reactFlow';
import { useRightMousePan } from './flow/hooks/useRightMousePan';
import type { RuntimeNode } from './flow/components/nodes/types';
import { MenuNode } from './flow/components/nodes/MenuNode';
import { MessageNode } from './flow/components/nodes/MessageNode';
import { ActionNode } from './flow/components/nodes/ActionNode';
import { ConditionNode } from './flow/components/nodes/ConditionNode';
import { EndFlowNode } from './flow/components/nodes/EndFlowNode';

const NODE_TYPES: Record<string, ComponentType<NodeProps<RuntimeNode>>> = {
  menu: MenuNode,
  message: MessageNode,
  action: ActionNode,
  condition: ConditionNode,
  end: EndFlowNode,
};

type PositionMap = Record<string, { x: number; y: number }>;

type RuntimeEdge = Edge<CanvasEdgeData>;

type ConnectStartParams = {
  nodeId?: string | null;
  handleId?: string | null;
};

type QuickCreateState = {
  sourceId: string;
  handleId: string;
  position: { x: number; y: number };
  screen: { x: number; y: number };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidPosition = (position?: XYPosition | null): position is XYPosition =>
  Boolean(position && isFiniteNumber(position.x) && isFiniteNumber(position.y));

export interface ReactFlowCanvasProps {
  flow: Flow;
  selectedId: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, type: NodeType) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void | Promise<void>;
  onInsertBetween: (parentId: string, childId: string) => void;
  onDeleteEdge: (parentId: string, childId: string) => void;
  onConnectHandle: (sourceId: string, handleId: string, targetId: string | null) => boolean;
  onCreateForHandle: (sourceId: string, handleId: string, kind: ConnectionCreationKind) => string | null;
  onInvalidConnection: (message: string) => void;
  invalidMessageIds: Set<string>;
  soloRoot: boolean;
  toggleScope: () => void;
  nodePositions: PositionMap;
  onPositionsChange: (
    updater:
      | PositionMap
      | ((prev: PositionMap) => PositionMap),
  ) => void;
}

export function ReactFlowCanvas(props: ReactFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ReactFlowCanvasInner(props: ReactFlowCanvasProps) {
  const {
    flow,
    selectedId,
    onSelect,
    onAddChild,
    onDeleteNode,
    onDuplicateNode,
    onDeleteEdge,
    onConnectHandle,
    onCreateForHandle,
    onInvalidConnection,
    invalidMessageIds,
    soloRoot,
    nodePositions,
    onPositionsChange,
  } = props;
  const { screenToFlowPosition, fitView } = useReactFlow<RuntimeNode, RuntimeEdge>();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<RuntimeNode[]>([]);
  const [edges, setEdges] = useState<RuntimeEdge[]>([]);
  const pendingSourceRef = useRef<{ sourceId: string; handleId: string } | null>(null);
  const [quickCreateState, setQuickCreateState] = useState<QuickCreateState | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<string[]>([]);
  const initialFitViewDone = useRef(false); // Track si ya hicimos el fitView inicial
  const lastFlowId = useRef<string>(flow.id); // Track flow ID changes
  const rightMousePan = useRightMousePan();

  const graph = useMemo(() => {
    return buildReactFlowGraph({
      flow,
      soloRoot,
      invalidMessageIds,
      nodePositions,
    });
  }, [flow, soloRoot, invalidMessageIds, nodePositions]);

  const handleAttach = useCallback((nodeId: string, files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    // TODO: integrar con la capa de negocio que persiste adjuntos.
    console.info('Adjuntos listos para procesar', nodeId, fileArray.map((file) => file.name));
  }, []);

  const decoratedNodes = useMemo(() => {
    return graph.nodes.map((node) => ({
      ...node,
      data: {
        ...(node.data as CanvasNodeData),
        isSelected: node.id === selectedId,
        onSelect,
        onAddChild,
        onDuplicate: onDuplicateNode,
        onDelete: onDeleteNode,
        onAttach: handleAttach,
      },
    })) as RuntimeNode[];
  }, [graph.nodes, selectedId, onSelect, onAddChild, onDuplicateNode, onDeleteNode, handleAttach]);

  useEffect(() => {
    setNodes(decoratedNodes);
  }, [decoratedNodes]);

  // Reset auto-fit flag when flow ID changes (new flow loaded)
  useEffect(() => {
    if (flow.id !== lastFlowId.current) {
      initialFitViewDone.current = false;
      lastFlowId.current = flow.id;
    }
  }, [flow.id]);

  // Auto-fit view on initial load or when new flow is loaded
  useEffect(() => {
    if (decoratedNodes.length > 0 && !initialFitViewDone.current) {
      fitView({ padding: 0.2, duration: 200 });
      initialFitViewDone.current = true;
    }
  }, [decoratedNodes, fitView]);

  useEffect(() => {
    setEdges(
      graph.edges.map((edge) => ({
        ...edge,
        selectable: true,
        style: { strokeWidth: 2 },
        className: 'flow-edge',
      })),
    );
    setVisibleNodeIds(graph.visibleNodeIds);
  }, [graph.edges, graph.visibleNodeIds]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<RuntimeNode>[]) => {
      setNodes((nds) => applyNodeChanges<RuntimeNode>(changes, nds));
      const updates: PositionMap = {};
      changes.forEach((change) => {
        if (change.type === 'position' && isValidPosition(change.position)) {
          updates[change.id] = { x: change.position.x, y: change.position.y };
        }
      });
      if (Object.keys(updates).length > 0) {
        onPositionsChange((prev) => ({ ...prev, ...updates }));
      }
    },
    [onPositionsChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<RuntimeEdge>[]) => {
      setEdges((eds) => applyEdgeChanges<RuntimeEdge>(changes, eds));
    },
    [],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.sourceHandle) return;
      const ok = onConnectHandle(connection.source, connection.sourceHandle, connection.target ?? null);
      if (!ok) {
        onInvalidConnection('No se pudo crear la conexión. Verifica los tipos de nodos.');
      }
      pendingSourceRef.current = null;
      setQuickCreateState(null);
    },
    [onConnectHandle, onInvalidConnection],
  );

  const handleEdgesDelete = useCallback(
    (deleted: RuntimeEdge[]) => {
      deleted.forEach((edge) => {
        if (edge.source && edge.target) {
          onDeleteEdge(edge.source, edge.target);
        }
      });
    },
    [onDeleteEdge],
  );

  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
  }, []);

  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: ConnectStartParams) => {
      if (!params?.nodeId || !params.handleId) {
        pendingSourceRef.current = null;
        return;
      }
      pendingSourceRef.current = { sourceId: params.nodeId, handleId: params.handleId };
    },
    [],
  );

  const handleConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState?: FinalConnectionState,
    ) => {
      const pending = pendingSourceRef.current;
      if (!pending) {
        setQuickCreateState(null);
        return;
      }
      const targetNode = connectionState?.toNode;
      if (targetNode) {
        pendingSourceRef.current = null;
        setQuickCreateState(null);
        return;
      }
      const clientPoint = 'clientX' in event
        ? { x: event.clientX, y: event.clientY }
        : {
            x: event.changedTouches[0]?.clientX ?? 0,
            y: event.changedTouches[0]?.clientY ?? 0,
          };
      const flowPoint = connectionState?.to ?? screenToFlowPosition(clientPoint);
      const rect = wrapperRef.current?.getBoundingClientRect();
      const screenPosition = rect
        ? { x: clientPoint.x - rect.left, y: clientPoint.y - rect.top }
        : clientPoint;
      setQuickCreateState({
        sourceId: pending.sourceId,
        handleId: pending.handleId,
        position: flowPoint,
        screen: screenPosition,
      });
    },
    [screenToFlowPosition],
  );

  const quickCreateOptions = useMemo<ConnectionCreationKind[]>(
    () => ['menu', 'message', 'buttons', 'ask', 'scheduler', 'end'],
    [],
  );

  const handleQuickCreate = useCallback(
    (kind: ConnectionCreationKind) => {
      setQuickCreateState((current) => {
        if (!current) return null;
        const createdId = onCreateForHandle(current.sourceId, current.handleId, kind);
        if (createdId) {
          // Calcular posición inteligente cerca del nodo padre
          const parentPosition = nodePositions[current.sourceId];
          let newPosition = current.position;

          if (parentPosition) {
            // Colocar el nuevo nodo a la derecha del padre
            // Offset: 400px derecha, 50px abajo
            newPosition = {
              x: parentPosition.x + 400,
              y: parentPosition.y + 50,
            };
          }

          onPositionsChange((prev) => ({ ...prev, [createdId]: newPosition }));
          onSelect(createdId);
        }
        pendingSourceRef.current = null;
        return null;
      });
    },
    [onCreateForHandle, onPositionsChange, onSelect, nodePositions],
  );

  const handleSelectionChange = useCallback(
    (params: { nodes?: RuntimeNode[]; edges?: RuntimeEdge[] }) => {
      if (!params.nodes || params.nodes.length === 0) return;
      const latest = params.nodes[params.nodes.length - 1];
      onSelect(latest.id);
    },
    [onSelect],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onMouseDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (event.button === 2 && target?.closest('.react-flow__pane')) {
          rightMousePan.onPaneMouseDown(event);
        }
      }}
      onMouseMove={(event) => {
        if ((event.buttons & 2) === 2) {
          rightMousePan.onPaneMouseMove(event);
        }
      }}
      onMouseUp={() => {
        rightMousePan.onPaneMouseUp();
      }}
      onMouseLeave={() => {
        rightMousePan.onPaneMouseUp();
      }}
      onContextMenu={handlePaneContextMenu}
    >
      <ReactFlow<RuntimeNode, RuntimeEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={{ type: 'step', animated: false, className: 'flow-edge' }}
        className="h-full"
        style={{ width: '100%', height: '100%', background: '#f8fafc' }}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionChange={handleSelectionChange}
        panOnDrag
        zoomOnScroll
        selectionOnDrag
        elevateEdgesOnSelect
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#cbd5f5" />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable />
        {quickCreateState && (
          <QuickCreatePopover
            position={quickCreateState.screen}
            options={quickCreateOptions}
            onSelect={handleQuickCreate}
            onDismiss={() => {
              setQuickCreateState(null);
              pendingSourceRef.current = null;
            }}
          />
        )}
      </ReactFlow>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs shadow">
        <span>{visibleNodeIds.length} nodos visibles</span>
        <button
          type="button"
          className="rounded-full border border-emerald-200 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-50"
          onClick={props.toggleScope}
        >
          {props.soloRoot ? 'Mostrar todo' : 'Solo raíz'}
        </button>
        <button
          type="button"
          className="rounded-full border border-blue-200 px-2 py-1 font-medium text-blue-700 hover:bg-blue-50"
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          title="Centrar y ajustar vista"
        >
          🎯 Centrar
        </button>
      </div>
    </div>
  );
}

type QuickCreatePopoverProps = {
  position: { x: number; y: number };
  options: ConnectionCreationKind[];
  onSelect: (kind: ConnectionCreationKind) => void;
  onDismiss: () => void;
};

function QuickCreatePopover({ position, options, onSelect, onDismiss }: QuickCreatePopoverProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div
      className="pointer-events-auto absolute z-20 w-40 rounded-lg border border-slate-200 bg-white shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Crear nuevo nodo</div>
      <ul className="divide-y divide-slate-100 text-sm">
        {options.map((option) => (
          <li key={option}>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-slate-600 hover:bg-emerald-50"
              onClick={() => onSelect(option)}
            >
              {renderOptionLabel(option)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderOptionLabel(option: ConnectionCreationKind): string {
  switch (option) {
    case 'menu':
      return 'Menú';
    case 'message':
      return 'Mensaje';
    case 'buttons':
      return 'Botones';
    case 'ask':
      return 'Pregunta';
    case 'scheduler':
      return 'Scheduler';
    case 'end':
      return 'Fin del flujo';
    default:
      return option;
  }
}
