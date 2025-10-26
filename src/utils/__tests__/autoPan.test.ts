import { describe, expect, it } from "vitest";
import { computeAutoPanDelta } from "../autoPan";

describe("computeAutoPanDelta", () => {
  const rect = { left: 0, top: 0, right: 800, bottom: 600 } as const;

  it("returns zero when pointer is inside the safe zone", () => {
    const result = computeAutoPanDelta({ clientX: 200, clientY: 150, rect, margin: 80, maxSpeed: 24 });
    expect(result).toEqual({ dx: 0, dy: 0 });
  });

  it("pans left and up when pointer nears the top-left edge", () => {
    const result = computeAutoPanDelta({ clientX: 30, clientY: 10, rect, margin: 80, maxSpeed: 24 });
    expect(result.dx).toBeLessThan(0);
    expect(result.dy).toBeLessThan(0);
    expect(Math.abs(result.dx)).toBeLessThanOrEqual(24);
    expect(Math.abs(result.dy)).toBeLessThanOrEqual(24);
  });

  it("scales the delta proportionally to how far outside the margin the pointer is", () => {
    const inside = computeAutoPanDelta({ clientX: 70, clientY: 70, rect, margin: 80, maxSpeed: 24 });
    const farther = computeAutoPanDelta({ clientX: -10, clientY: -20, rect, margin: 80, maxSpeed: 24 });
    expect(Math.abs(farther.dx)).toBeGreaterThan(Math.abs(inside.dx));
    expect(Math.abs(farther.dy)).toBeGreaterThan(Math.abs(inside.dy));
    expect(Math.abs(farther.dx)).toBeLessThanOrEqual(24);
    expect(Math.abs(farther.dy)).toBeLessThanOrEqual(24);
  });

  it("caps the delta when margin or maxSpeed are zero", () => {
    const zeroMargin = computeAutoPanDelta({ clientX: -10, clientY: 610, rect, margin: 0, maxSpeed: 24 });
    expect(zeroMargin).toEqual({ dx: 0, dy: 0 });

    const zeroSpeed = computeAutoPanDelta({ clientX: -10, clientY: 610, rect, margin: 40, maxSpeed: 0 });
    expect(zeroSpeed).toEqual({ dx: 0, dy: 0 });
  });
});
