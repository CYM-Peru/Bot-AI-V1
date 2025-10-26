export interface NodeGeometry {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export type HandleAnchor = "top" | "right" | "bottom" | "left" | { dx: number; dy: number };

export function computeHandlePosition(node: NodeGeometry, anchor: HandleAnchor): { x: number; y: number } {
  const width = node.size?.width ?? 0;
  const height = node.size?.height ?? 0;
  const baseX = node.position.x;
  const baseY = node.position.y;

  if (anchor === "left") {
    return { x: baseX, y: baseY + height / 2 };
  }
  if (anchor === "right") {
    return { x: baseX + width, y: baseY + height / 2 };
  }
  if (anchor === "top") {
    return { x: baseX + width / 2, y: baseY };
  }
  if (anchor === "bottom") {
    return { x: baseX + width / 2, y: baseY + height };
  }

  return { x: baseX + anchor.dx, y: baseY + anchor.dy };
}
