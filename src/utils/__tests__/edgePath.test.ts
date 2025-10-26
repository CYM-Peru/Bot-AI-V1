import { describe, expect, it } from "vitest";
import { buildOrthogonalPath } from "../edgePath";

describe("edge routing", () => {
  const parsePath = (path: string): Array<{ x: number; y: number }> => {
    return path.split(" ")
      .reduce<Array<{ cmd: string; x: number; y: number }>>((acc, token, index, arr) => {
        if (token === "M" || token === "L") {
          acc.push({ cmd: token, x: Number(arr[index + 1]), y: Number(arr[index + 2]) });
        }
        return acc;
      }, [])
      .map((segment) => ({ x: segment.x, y: segment.y }));
  };

  it("routes around overlay padding", () => {
    const path = buildOrthogonalPath(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { avoid: { left: 80, top: -10, right: 120, bottom: 10 }, padding: 12 }
    );
    const segments = parsePath(path);
    expect(segments.length).toBeGreaterThan(2);
    // Ensure the horizontal detour moves outside the overlay band.
    const detour = segments[1];
    expect(Math.abs(detour.y)).toBeGreaterThanOrEqual(22); // 10 + padding + small buffer
  });

  it("builds straight orthogonal path when no obstacles", () => {
    const path = buildOrthogonalPath({ x: 0, y: 0 }, { x: 100, y: 100 });
    const segments = parsePath(path);
    expect(segments[0]).toEqual({ x: 0, y: 0 });
    expect(segments[segments.length - 1]).toEqual({ x: 100, y: 100 });
  });
});
