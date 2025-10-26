export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface EdgeRouteOptions {
  padding?: number;
  avoid?: RectLike | null;
}

const EDGE_HORIZONTAL_OFFSET = 96;

function clampPadding(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 12;
  }
  return Math.max(4, value);
}

export function buildOrthogonalPath(source: Point, target: Point, options: EdgeRouteOptions = {}): string {
  const direction = target.x >= source.x ? 1 : -1;
  const padding = clampPadding(options.padding);
  const minOffset = EDGE_HORIZONTAL_OFFSET;
  let midX = source.x + direction * Math.max(minOffset, Math.abs(target.x - source.x) / 2);
  let midY = source.y;

  const avoid = options.avoid;
  if (avoid) {
    const expandedLeft = avoid.left - padding;
    const expandedRight = avoid.right + padding;
    const expandedTop = avoid.top - padding;
    const expandedBottom = avoid.bottom + padding;
    const horizontalMin = Math.min(source.x, midX);
    const horizontalMax = Math.max(source.x, midX);
    const overlapsHorizontally = horizontalMin <= expandedRight && horizontalMax >= expandedLeft;
    const overlapsVertically = source.y >= expandedTop && source.y <= expandedBottom;
    if (overlapsHorizontally && overlapsVertically) {
      const avoidMidY = (avoid.top + avoid.bottom) / 2;
      if (source.y <= avoidMidY) {
        midY = expandedTop;
      } else {
        midY = expandedBottom;
      }
    }
    if (direction === 1 && midX >= expandedLeft && midX <= expandedRight) {
      midX = expandedLeft;
    } else if (direction === -1 && midX >= expandedLeft && midX <= expandedRight) {
      midX = expandedRight;
    }
  }

  const segments: Point[] = [
    source,
    { x: midX, y: midY },
    { x: midX, y: target.y },
    target,
  ];

  return segments
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}
