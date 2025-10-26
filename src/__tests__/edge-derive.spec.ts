import { describe, expect, it } from "vitest";
import { computeHandlePosition, type NodeGeometry } from "../utils/handles";

describe("edge derivation", () => {
  const source: NodeGeometry = {
    position: { x: 100, y: 80 },
    size: { width: 260, height: 160 },
  };
  const target: NodeGeometry = {
    position: { x: 520, y: 140 },
    size: { width: 240, height: 180 },
  };

  const edge = {
    from: "a",
    to: "b",
    sourceSpec: { id: "out-1", order: 0, side: "right" as const },
    sourceCount: 2,
  };

  const getPoints = () => {
    const percent = (edge.sourceSpec.order + 1) / (edge.sourceCount + 1);
    const sourcePoint = computeHandlePosition(source, { dx: source.size.width, dy: source.size.height * percent });
    const targetPoint = computeHandlePosition(target, { dx: 0, dy: target.size.height * 0.5 });
    return { sourcePoint, targetPoint };
  };

  it("responds to node position changes without mutating edge", () => {
    const first = getPoints();
    source.position = { x: 180, y: 120 };
    const second = getPoints();
    expect(second.sourcePoint.x - first.sourcePoint.x).toBe(80);
    expect(second.sourcePoint.y - first.sourcePoint.y).toBe(40);
    expect(first.targetPoint).toEqual(second.targetPoint);
  });
});
