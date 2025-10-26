import { describe, expect, it } from "vitest";
import { canvasToScreen, screenToCanvas, type Viewport } from "../utils/coords";

describe("coords utils", () => {
  const viewportEl = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
  } as unknown as HTMLElement;

  it("maps screen to canvas with pan and zoom", () => {
    const viewport: Viewport = { x: 120, y: 80, zoom: 2 };
    const point = screenToCanvas(640, 480, viewportEl, viewport);
    expect(point.x).toBeCloseTo(440, 5);
    expect(point.y).toBeCloseTo(320, 5);
  });

  it("inverts canvas to screen", () => {
    const viewport: Viewport = { x: -50, y: 25, zoom: 1.5 };
    const screenPoint = canvasToScreen(200, 140, viewportEl, viewport);
    const roundTrip = screenToCanvas(screenPoint.clientX, screenPoint.clientY, viewportEl, viewport);
    expect(roundTrip.x).toBeCloseTo(200, 5);
    expect(roundTrip.y).toBeCloseTo(140, 5);
  });
});
