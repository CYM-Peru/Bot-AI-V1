import { describe, expect, it } from "vitest";
import { computeHandlePosition, type NodeGeometry } from "../utils/handles";

describe("handle geometry", () => {
  const node: NodeGeometry = {
    position: { x: 100, y: 200 },
    size: { width: 300, height: 180 },
  };

  it("computes cardinal anchors", () => {
    expect(computeHandlePosition(node, "left")).toEqual({ x: 100, y: 290 });
    expect(computeHandlePosition(node, "right")).toEqual({ x: 400, y: 290 });
    expect(computeHandlePosition(node, "top")).toEqual({ x: 250, y: 200 });
    expect(computeHandlePosition(node, "bottom")).toEqual({ x: 250, y: 380 });
  });

  it("applies offset anchors", () => {
    const point = computeHandlePosition(node, { dx: 300, dy: 90 });
    expect(point.x).toBeCloseTo(400, 5);
    expect(point.y).toBeCloseTo(290, 5);
  });
});
