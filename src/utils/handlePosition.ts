export type RelativeAnchor = {
  x: number;
  y: number;
  offsetX?: number;
  offsetY?: number;
};

export type ViewportTransform = {
  stageRect: DOMRect;
  scale: number;
  pan: { x: number; y: number };
};

export type HandlePosition = { x: number; y: number };

export function computeHandlePosition(
  nodeRect: DOMRect,
  anchor: RelativeAnchor,
  viewport: ViewportTransform
): HandlePosition {
  const width = nodeRect.width / viewport.scale;
  const height = nodeRect.height / viewport.scale;
  const originX = (nodeRect.left - viewport.stageRect.left) / viewport.scale + viewport.pan.x;
  const originY = (nodeRect.top - viewport.stageRect.top) / viewport.scale + viewport.pan.y;
  const offsetX = anchor.offsetX ?? 0;
  const offsetY = anchor.offsetY ?? 0;
  const x = originX + anchor.x * width + offsetX;
  const y = originY + anchor.y * height + offsetY;
  return { x, y };
}

export function quantizeForDPR(position: HandlePosition, devicePixelRatio: number): HandlePosition {
  const factor = devicePixelRatio || 1;
  return {
    x: Math.round(position.x * factor) / factor,
    y: Math.round(position.y * factor) / factor,
  };
}
