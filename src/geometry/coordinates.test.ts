import { describe, expect, it } from "vitest";
import { computeOffset, toWorldCoords } from "./coordinates";

describe("geometry coordinates", () => {
  const rect = { left: 100, top: 200 } as DOMRectReadOnly;
  const pointer = { clientX: 250, clientY: 420 };

  it("computes offsets without pan", () => {
    const offset = computeOffset(pointer, {
      rect,
      scrollLeft: 0,
      scrollTop: 0,
      scale: 1,
    });
    expect(offset).toEqual({ x: 150, y: 220 });
  });

  it("computes offsets with scroll and scale", () => {
    const offset = computeOffset(pointer, {
      rect,
      scrollLeft: 50,
      scrollTop: 30,
      scale: 0.5,
    });
    expect(offset.x).toBeCloseTo((pointer.clientX - rect.left - 50) / 0.5, 5);
    expect(offset.y).toBeCloseTo((pointer.clientY - rect.top - 30) / 0.5, 5);
  });

  it("quantizes coordinates when devicePixelRatio is provided", () => {
    const offset = computeOffset({ clientX: 125.25, clientY: 225.75 }, {
      rect,
      scrollLeft: 0,
      scrollTop: 0,
      scale: 1,
      devicePixelRatio: 2,
    });
    expect(offset.x).toBeCloseTo(25.5, 5);
    expect(offset.y).toBeCloseTo(25.75, 5);
  });

  it("returns world coordinates adding pan", () => {
    const world = toWorldCoords(pointer, {
      rect,
      scrollLeft: 10,
      scrollTop: 20,
      scale: 2,
      pan: { x: 30, y: 40 },
    });
    const expectedX = ((pointer.clientX - rect.left - 10) / 2) + 30;
    const expectedY = ((pointer.clientY - rect.top - 20) / 2) + 40;
    expect(world.x).toBeCloseTo(expectedX, 5);
    expect(world.y).toBeCloseTo(expectedY, 5);
  });

  it("keeps error under one pixel across combinations", () => {
    const scales = [0.5, 1, 2];
    const scrolls = [0, 120];
    const pans = [0, 80];
    const ratios = [1, 2];
    for (const scale of scales) {
      for (const scrollLeft of scrolls) {
        for (const scrollTop of scrolls) {
          for (const pan of pans) {
            for (const ratio of ratios) {
              const evt = { clientX: 400.4, clientY: 512.6 };
              const world = toWorldCoords(evt, {
                rect,
                scrollLeft,
                scrollTop,
                scale,
                pan: { x: pan, y: pan },
                devicePixelRatio: ratio,
              });
              const expectedX = ((evt.clientX - rect.left - scrollLeft) / scale) + pan;
              const expectedY = ((evt.clientY - rect.top - scrollTop) / scale) + pan;
              expect(Math.abs(world.x - expectedX)).toBeLessThanOrEqual(1);
              expect(Math.abs(world.y - expectedY)).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });
});
