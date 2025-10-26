import { describe, expect, it } from "vitest";
import { computeOffset, toWorldCoords } from "../utils/computeOffset";

describe("computeOffset", () => {
  const rect = { left: 100, top: 200 } as DOMRectReadOnly;

  it("translates pointer coordinates with unit scale", () => {
    const offset = computeOffset({ clientX: 220, clientY: 260 }, {
      rect,
      scrollLeft: 0,
      scrollTop: 0,
      scale: 1,
    });
    expect(offset).toEqual({ x: 120, y: 60 });
  });

  it("applies zoom and scroll corrections", () => {
    const offset = computeOffset({ clientX: 320, clientY: 380 }, {
      rect,
      scrollLeft: 50,
      scrollTop: 30,
      scale: 2,
    });
    expect(offset.x).toBeCloseTo((320 - 100 - 50) / 2, 6);
    expect(offset.y).toBeCloseTo((380 - 200 - 30) / 2, 6);
  });

  it("keeps jitter under a pixel after quantization", () => {
    const world = toWorldCoords({ clientX: 401.2, clientY: 515.4 }, {
      rect,
      scrollLeft: 80,
      scrollTop: 40,
      scale: 1.6,
      pan: { x: 25, y: 30 },
      devicePixelRatio: 2,
    });
    const expectedX = ((401.2 - 100 - 80) / 1.6) + 25;
    const expectedY = ((515.4 - 200 - 40) / 1.6) + 30;
    expect(Math.abs(world.x - expectedX)).toBeLessThanOrEqual(1);
    expect(Math.abs(world.y - expectedY)).toBeLessThanOrEqual(1);
  });
});
