import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FlowNode, Flow, NodeType } from './flow/types';

export type ConnectionCreationKind = "menu" | "message" | "buttons" | "ask";

interface ReactFlowCanvasProps {
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
  nodePositions: Record<string, { x: number; y: number }>;
  onPositionsChange: (
    updater:
      | Record<string, { x: number; y: number }>
      | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)
  ) => void;
}

// Convertir FlowNode a React Flow Node
function convertToReactFlowNode(
  flowNode: FlowNode,
  position: { x: number; y: number }
): Node {
  return {
    id: flowNode.id,
    type: 'custom',
    position,
    data: {
      label: flowNode.label,
      flowNode, // Pasamos el nodo completo para acceder a toda su data
    },
  };
}

// Generar edges basados en children y targetIds
function generateEdges(nodes: Record<string, FlowNode>): Edge[] {
  const edges: Edge[] = [];

  Object.values(nodes).forEach((node) => {
    // Edges desde children
    node.children?.forEach((childId) => {
      edges.push({
        id: `${node.id}-${childId}`,
        source: node.id,
        target: childId,
        type: 'smoothstep',
      });
    });

    // Edges desde menuOptions
    node.menuOptions?.forEach((option) => {
      if (option.targetId) {
        edges.push({
          id: `${node.id}-menu-${option.id}-${option.targetId}`,
          source: node.id,
          target: option.targetId,
          sourceHandle: option.id,
          type: 'smoothstep',
        });
      }
    });

    // Edges desde actions con targetIds
    if (node.action) {
      const { kind, data } = node.action;

      // Buttons action
      if (kind === 'buttons' && data?.items) {
        data.items.forEach((button: any) => {
          if (button.targetId) {
            edges.push({
              id: `${node.id}-button-${button.id}-${button.targetId}`,
              source: node.id,
              target: button.targetId,
              sourceHandle: button.id,
              type: 'smoothstep',
            });
          }
        });
        if (data.moreTargetId) {
          edges.push({
            id: `${node.id}-more-${data.moreTargetId}`,
            source: node.id,
            target: data.moreTargetId,
            sourceHandle: 'more',
            type: 'smoothstep',
          });
        }
      }

      // Ask action
      if (kind === 'ask' && data) {
        if (data.answerTargetId) {
          edges.push({
            id: `${node.id}-answer-${data.answerTargetId}`,
            source: node.id,
            target: data.answerTargetId,
            sourceHandle: 'answer',
            type: 'smoothstep',
          });
        }
        if (data.invalidTargetId) {
          edges.push({
            id: `${node.id}-invalid-${data.invalidTargetId}`,
            source: node.id,
            target: data.invalidTargetId,
            sourceHandle: 'invalid',
            type: 'smoothstep',
          });
        }
      }

      // Scheduler action
      if (kind === 'scheduler' && data) {
        if (data.inWindowTargetId) {
          edges.push({
            id: `${node.id}-inwindow-${data.inWindowTargetId}`,
            source: node.id,
            target: data.inWindowTargetId,
            sourceHandle: 'inWindow',
            type: 'smoothstep',
          });
        }
        if (data.outOfWindowTargetId) {
          edges.push({
            id: `${node.id}-outwindow-${data.outOfWindowTargetId}`,
            source: node.id,
            target: data.outOfWindowTargetId,
            sourceHandle: 'outOfWindow',
            type: 'smoothstep',
          });
        }
      }
    }
  });

  return edges;
}

// Custom node component
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  const flowNode: FlowNode = data.flowNode;
  const isInvalid = data.isInvalid || false;

  const borderColor = selected
    ? 'border-blue-500'
    : isInvalid
    ? 'border-red-500'
    : 'border-stone-400';

  return (
    <div
      className={`px-4 py-3 shadow-md rounded-md bg-white border-2 ${borderColor} min-w-[200px] max-w-[300px]`}
    >
      <div className="font-bold text-sm truncate">{flowNode.label}</div>
      {flowNode.description && (
        <div className="text-xs text-gray-500 mt-1 truncate">{flowNode.description}</div>
      )}
      {flowNode.type === 'action' && flowNode.action && (
        <div className="text-xs text-blue-600 mt-1 capitalize">{flowNode.action.kind}</div>
      )}
      {flowNode.type === 'menu' && flowNode.menuOptions && (
        <div className="text-xs text-green-600 mt-1">
          {flowNode.menuOptions.length} opciones
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export function ReactFlowCanvas({
  flow,
  selectedId,
  onSelect,
  onAddChild,
  onDeleteNode,
  onDuplicateNode,
  onInsertBetween,
  onDeleteEdge,
  onConnectHandle,
  onCreateForHandle,
  onInvalidConnection,
  invalidMessageIds,
  soloRoot,
  toggleScope,
  nodePositions,
  onPositionsChange,
}: ReactFlowCanvasProps) {
  // Convertir datos a formato React Flow
  const initialNodes = useMemo(() => {
    return Object.values(flow.nodes).map((flowNode) => {
      const node = convertToReactFlowNode(
        flowNode,
        nodePositions[flowNode.id] || { x: 0, y: 0 }
      );
      // Añadir información adicional a data
      node.data = {
        ...node.data,
        isInvalid: invalidMessageIds.has(flowNode.id),
      };
      node.selected = flowNode.id === selectedId;
      return node;
    });
  }, [flow.nodes, nodePositions, selectedId, invalidMessageIds]);

  const initialEdges = useMemo(() => {
    return generateEdges(flow.nodes);
  }, [flow.nodes]);

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);

  // Manejar cambios de nodos
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeInternal(changes);

      // Actualizar posiciones cuando hay cambios de posición
      const positionChanges = changes.filter((c) => c.type === 'position' && 'position' in c && c.position);
      if (positionChanges.length > 0) {
        const newPositions = { ...nodePositions };
        positionChanges.forEach((change) => {
          if (change.type === 'position' && 'position' in change && change.position) {
            newPositions[change.id] = change.position;
          }
        });
        onPositionsChange(newPositions);
      }
    },
    [onNodesChangeInternal, nodePositions, onPositionsChange]
  );

  // Manejar click en nodo
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelect(node.id);
    },
    [onSelect]
  );

  // Manejar conexiones
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const handleId = connection.sourceHandle || 'default';
        const success = onConnectHandle(connection.source, handleId, connection.target);
        if (success) {
          setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds));
        } else {
          onInvalidConnection('No se pudo conectar el bloque seleccionado');
        }
      }
    },
    [onConnectHandle, onInvalidConnection, setEdges]
  );

  return (
    <div style={{ width: '100%', height: '70vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
