import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { Flow, FlowNode } from '../types';
import {
  getHandleAssignments,
  getOutputHandleSpecs,
  type HandleSpec,
} from '../utils/flow';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizePosition(
  stored: XYPosition | undefined,
  fallback: XYPosition,
): XYPosition {
  if (stored && isFiniteNumber(stored.x) && isFiniteNumber(stored.y)) {
    return { x: stored.x, y: stored.y };
  }
  return fallback;
}

export interface CanvasNodeData extends Record<string, unknown> {
  flowNode: FlowNode;
  handleSpecs: HandleSpec[];
  assignments: Record<string, string | null>;
  invalid: boolean;
  isRoot: boolean;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  sourceHandleId: string;
}

export interface BuildReactFlowGraphParams {
  flow: Flow;
  soloRoot: boolean;
  invalidMessageIds: Set<string>;
  nodePositions: Record<string, XYPosition>;
}

export interface BuildReactFlowGraphResult {
  nodes: Node<CanvasNodeData>[];
  edges: Edge<CanvasEdgeData>[];
  visibleNodeIds: string[];
}

export function buildReactFlowGraph({
  flow,
  soloRoot,
  invalidMessageIds,
  nodePositions,
}: BuildReactFlowGraphParams): BuildReactFlowGraphResult {
  const visibleIds = soloRoot
    ? [flow.rootId, ...(flow.nodes[flow.rootId]?.children ?? [])]
    : Object.keys(flow.nodes);
  const visibleSet = new Set(visibleIds);
  const autoLayout = computeLayout(flow, visibleSet);

  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge<CanvasEdgeData>[] = [];

  for (const id of visibleIds) {
    const flowNode = flow.nodes[id];
    if (!flowNode) continue;
    const handleSpecs = getOutputHandleSpecs(flowNode);
    const assignments = getHandleAssignments(flowNode);
    const invalid = invalidMessageIds.has(id);
    const fallbackPosition = autoLayout[id] ?? { x: 0, y: 0 };
    const position = sanitizePosition(nodePositions[id], fallbackPosition);
    nodes.push({
      id,
      type: resolveNodeType(flowNode),
      data: {
        flowNode,
        handleSpecs,
        assignments,
        invalid,
        isRoot: id === flow.rootId,
      },
      position,
      selectable: true,
    });

    for (const spec of handleSpecs) {
      const targetId = assignments[spec.id];
      if (!targetId || !visibleSet.has(targetId)) continue;
      edges.push({
        id: `${id}:${spec.id}->${targetId}`,
        source: id,
        sourceHandle: spec.id,
        target: targetId,
        targetHandle: 'in',
        type: 'step',
        selectable: true,
        data: {
          sourceHandleId: spec.id,
        },
      });
    }
  }

  return { nodes, edges, visibleNodeIds: visibleIds };
}

function resolveNodeType(node: FlowNode): string {
  if (node.type === 'start' || node.action?.kind === 'start') return 'start';
  if (node.type === 'menu') return 'menu';
  if (node.action?.kind === 'message') return 'message';
  if (node.action?.kind === 'end') return 'end';
  if (node.action?.kind === 'ask') return 'condition';
  return 'action';
}

function computeLayout(flow: Flow, visibleSet: Set<string>): Record<string, XYPosition> {
  const pos: Record<string, XYPosition> = {};
  const levels: Record<number, string[]> = {};
  const seen = new Set<string>();

  const queue: Array<{ id: string; depth: number }> = [{ id: flow.rootId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { id, depth } = current;
    if (!visibleSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    (levels[depth] ||= []).push(id);
    const node = flow.nodes[id];
    if (!node) continue;
    for (const childId of node.children ?? []) {
      if (!visibleSet.has(childId)) continue;
      queue.push({ id: childId, depth: depth + 1 });
    }
  }

  const columnWidth = 400; // Distancia horizontal entre niveles (padre → hijo)
  const rowHeight = 120;   // Distancia vertical entre hermanos
  Object.entries(levels).forEach(([depth, ids]) => {
    ids.forEach((id, index) => {
      pos[id] = { x: Number(depth) * columnWidth, y: index * rowHeight };
    });
  });

  return pos;
}
