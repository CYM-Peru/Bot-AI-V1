export interface ComputeOffsetInput {
  pageX: number;
  pageY: number;
  rect: Pick<DOMRect, "left" | "top">;
  scrollX: number;
  scrollY: number;
  scale: number;
}

export interface OffsetResult {
  x: number;
  y: number;
}

export function computeOffset({
  pageX,
  pageY,
  rect,
  scrollX,
  scrollY,
  scale,
}: ComputeOffsetInput): OffsetResult {
  const safeScale = scale || 1;
  const x = (pageX - (rect.left + scrollX)) / safeScale;
  const y = (pageY - (rect.top + scrollY)) / safeScale;
  return { x, y };
}
