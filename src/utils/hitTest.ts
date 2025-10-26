export interface HandlePointCandidate {
  id: string;
  nodeId: string;
  type: "input" | "output";
  x: number;
  y: number;
}

export interface HitTestResult {
  handle: HandlePointCandidate;
  distance: number;
}

export function findNearestHandle(
  point: { x: number; y: number },
  handles: Iterable<HandlePointCandidate>,
  tolerance: number,
  predicate: (candidate: HandlePointCandidate) => boolean = () => true
): HitTestResult | null {
  let closest: HitTestResult | null = null;
  const maxDistance = Math.max(0, tolerance);
  for (const handle of handles) {
    if (!predicate(handle)) {
      continue;
    }
    const dx = handle.x - point.x;
    const dy = handle.y - point.y;
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistance) {
      continue;
    }
    if (!closest || distance < closest.distance) {
      closest = { handle, distance };
    }
  }
  return closest;
}
