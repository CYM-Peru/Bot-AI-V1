export interface AutoPanConfig {
  clientX: number;
  clientY: number;
  rect: Pick<DOMRectReadOnly, "left" | "right" | "top" | "bottom">;
  margin: number;
  maxSpeed: number;
}

function computeAxisDelta(
  position: number,
  min: number,
  max: number,
  margin: number,
  maxSpeed: number
): number {
  if (margin <= 0 || maxSpeed <= 0) {
    return 0;
  }

  const innerMin = min + margin;
  const innerMax = max - margin;

  if (position < innerMin) {
    const distance = Math.min(innerMin - position, margin);
    const ratio = distance / margin;
    return -maxSpeed * ratio;
  }

  if (position > innerMax) {
    const distance = Math.min(position - innerMax, margin);
    const ratio = distance / margin;
    return maxSpeed * ratio;
  }

  return 0;
}

export function computeAutoPanDelta(config: AutoPanConfig): { dx: number; dy: number } {
  const { clientX, clientY, rect, margin, maxSpeed } = config;
  const dx = computeAxisDelta(clientX, rect.left, rect.right, margin, maxSpeed);
  const dy = computeAxisDelta(clientY, rect.top, rect.bottom, margin, maxSpeed);
  return { dx, dy };
}
