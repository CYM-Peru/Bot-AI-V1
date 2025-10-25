import { describe, expect, it } from "vitest";
import { computeOffset } from "./dragOffset";

describe("computeOffset", () => {
  const rect = { left: 100, top: 200 } as Pick<DOMRect, "left" | "top">;

  it("calculates offsets without zoom or scroll", () => {
    const result = computeOffset({
      pageX: 150,
      pageY: 260,
      rect,
      scrollX: 0,
      scrollY: 0,
      scale: 1,
    });
    expect(result).toEqual({ x: 50, y: 60 });
  });

  it("handles zoom out", () => {
    const result = computeOffset({
      pageX: 175,
      pageY: 245,
      rect,
      scrollX: 0,
      scrollY: 0,
      scale: 0.75,
    });
    expect(result.x).toBeCloseTo((175 - rect.left) / 0.75);
    expect(result.y).toBeCloseTo((245 - rect.top) / 0.75);
  });

  it("handles zoom in", () => {
    const result = computeOffset({
      pageX: 190,
      pageY: 250,
      rect,
      scrollX: 0,
      scrollY: 0,
      scale: 1.5,
    });
    expect(result.x).toBeCloseTo((190 - rect.left) / 1.5);
    expect(result.y).toBeCloseTo((250 - rect.top) / 1.5);
  });

  it("includes scroll offsets", () => {
    const result = computeOffset({
      pageX: 310,
      pageY: 470,
      rect,
      scrollX: 100,
      scrollY: 200,
      scale: 1,
    });
    expect(result).toEqual({ x: 110, y: 70 });
  });

  it("combines zoom and scroll", () => {
    const result = computeOffset({
      pageX: 400,
      pageY: 580,
      rect,
      scrollX: 120,
      scrollY: 220,
      scale: 1.5,
    });
    expect(result.x).toBeCloseTo((400 - (rect.left + 120)) / 1.5);
    expect(result.y).toBeCloseTo((580 - (rect.top + 220)) / 1.5);
  });
});
