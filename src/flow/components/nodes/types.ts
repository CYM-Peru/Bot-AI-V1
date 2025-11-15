import type { Node } from '@xyflow/react';
import type { CanvasNodeData } from '../../adapters/reactFlow';
import type { NodeType } from '../../types';

export interface NodeCallbacks {
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, type: NodeType) => void;
  onShowNodeTypeSelector?: (parentId: string, handleId: string, buttonElement: HTMLElement) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAttach: (id: string, files: FileList) => void;
}

export type RuntimeNodeData = CanvasNodeData &
  NodeCallbacks & {
    isSelected: boolean;
    [key: string]: unknown;
  };

export type RuntimeNode = Node<RuntimeNodeData>;
