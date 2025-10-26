import { describe, expect, it } from "vitest";
import { findNearestHandle, type HandlePointCandidate } from "../hitTest";

describe("handle hit test", () => {
  const handles: HandlePointCandidate[] = [
    { id: "nodeA:in", nodeId: "nodeA", type: "input", x: 100, y: 100 },
    { id: "nodeB:in", nodeId: "nodeB", type: "input", x: 200, y: 200 },
  ];

  it("snaps when pointer is within tolerance", () => {
    const result = findNearestHandle({ x: 106, y: 104 }, handles, 12, (candidate) => candidate.type === "input");
    expect(result).not.toBeNull();
    expect(result?.handle.id).toBe("nodeA:in");
  });

  it("does not snap when pointer is outside tolerance", () => {
    const result = findNearestHandle({ x: 120, y: 120 }, handles, 8, (candidate) => candidate.type === "input");
    expect(result).toBeNull();
  });
});
