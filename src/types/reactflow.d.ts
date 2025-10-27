declare module "reactflow" {
  import type { ComponentType } from "react";

  export type XYPosition = { x: number; y: number };
  export type Node<T = any> = {
    id: string;
    type?: string;
    data?: T;
    position: XYPosition;
    draggable?: boolean;
    selectable?: boolean;
  };
  export type Edge<T = any> = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string;
    data?: T;
  };
  export type NodeChange = {
    id: string;
    type: string;
    position?: XYPosition;
  };
  export type Connection = {
    source?: string | null;
    sourceHandle?: string | null;
    target?: string | null;
    targetHandle?: string | null;
  };
  export type NodeProps<T = any> = {
    id: string;
    data: T;
    selected: boolean;
  };
  export type OnConnectStartParams = {
    nodeId?: string;
    handleId?: string;
  };

  export const MarkerType: { ArrowClosed: string };
  export const Position: {
    Top: string;
    Right: string;
    Bottom: string;
    Left: string;
  };

  export function applyNodeChanges<T = any>(changes: NodeChange[], nodes: Node<T>[]): Node<T>[];

  const ReactFlow: ComponentType<any>;
  export default ReactFlow;

  export const Background: ComponentType<{ gap?: number; color?: string }>;
  export const Controls: ComponentType<{ position?: string }>;
  export const Handle: ComponentType<any>;
}
