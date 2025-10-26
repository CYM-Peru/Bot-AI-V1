export interface Point {
  x: number;
  y: number;
}

export interface StageMetrics {
  rect: Pick<DOMRectReadOnly, "left" | "top">;
  scrollLeft: number;
  scrollTop: number;
  scale: number;
  devicePixelRatio?: number;
}

export interface StageContext extends StageMetrics {
  pan: Point;
}

interface PointerLike {
  clientX: number;
  clientY: number;
}

const EPSILON = 1e-6;

function resolveDevicePixelRatio(explicit?: number): number {
  if (typeof explicit === "number" && !Number.isNaN(explicit) && explicit > 0) {
    return explicit;
  }
  if (typeof window !== "undefined" && typeof window.devicePixelRatio === "number") {
    return window.devicePixelRatio || 1;
  }
  return 1;
}

function quantize(value: number, ratio: number): number {
  if (!Number.isFinite(value)) return 0;
  if (ratio <= 1 + EPSILON) return value;
  const scaled = value * ratio;
  return Math.round(scaled) / ratio;
}

export function computeOffset(event: PointerLike, metrics: StageMetrics): Point {
  const ratio = resolveDevicePixelRatio(metrics.devicePixelRatio);
  const safeScale = metrics.scale || 1;
  const relativeX = event.clientX - metrics.rect.left - metrics.scrollLeft;
  const relativeY = event.clientY - metrics.rect.top - metrics.scrollTop;
  const x = relativeX / safeScale;
  const y = relativeY / safeScale;
  return {
    x: quantize(x, ratio),
    y: quantize(y, ratio),
  };
}

export function toWorldCoords(event: PointerLike, context: StageContext): Point {
  const offset = computeOffset(event, context);
  const ratio = resolveDevicePixelRatio(context.devicePixelRatio);
  return {
    x: quantize(offset.x + context.pan.x, ratio),
    y: quantize(offset.y + context.pan.y, ratio),
  };
}
