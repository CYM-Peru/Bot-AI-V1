import type { PropsWithChildren, ReactElement } from "react";

export type XYPosition = { x: number; y: number };
export type Node<T = any> = {
  id: string;
  type?: string;
  data?: T;
  position: XYPosition;
  width?: number;
  height?: number;
  parentNode?: string;
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
  selected?: boolean;
  position: XYPosition;
  type?: string;
};
export type OnConnectStartParams = {
  nodeId?: string;
  handleId?: string | null;
  handleType?: "source" | "target";
};

export const MarkerType = { ArrowClosed: "arrowclosed" } as const;
export const Position = {
  Top: "top",
  Right: "right",
  Bottom: "bottom",
  Left: "left",
} as const;

export function applyNodeChanges<T>(_: NodeChange[], nodes: Node<T>[]): Node<T>[] {
  return nodes;
}

type ElementProps = PropsWithChildren<Record<string, unknown>>;

function createStub(name: string) {
  return function Stub({ children, ...rest }: ElementProps): ReactElement {
    return (
      <div data-reactflow-mock={name} {...rest}>
        {children}
      </div>
    );
  };
}

const ReactFlow = createStub("ReactFlow");
export default ReactFlow;

export const Background = createStub("Background");
export const Controls = createStub("Controls");
export const Handle = createStub("Handle");
