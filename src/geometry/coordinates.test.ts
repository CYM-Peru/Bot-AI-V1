import { describe, expect, it } from "vitest";
import { canvasToScreen, screenToCanvas } from "./coordinates";

describe("geometry coordinates", () => {
  const viewportEl = {
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 800, height: 600 }),
  } as unknown as HTMLElement;
  const viewport = { x: 30, y: 40, zoom: 2 };

  it("converts screen to canvas and back", () => {
    const canvasPoint = screenToCanvas(260, 420, viewportEl, viewport);
    expect(canvasPoint.x).toBeCloseTo(110, 5);
    expect(canvasPoint.y).toBeCloseTo(150, 5);
    const screenPoint = canvasToScreen(canvasPoint.x, canvasPoint.y, viewportEl, viewport);
    expect(screenPoint.clientX).toBeCloseTo(260, 5);
    expect(screenPoint.clientY).toBeCloseTo(420, 5);
  });

  it("handles zoom changes without drift", () => {
    const zoomViewport = { ...viewport, zoom: 0.5 };
    const canvasPoint = screenToCanvas(300, 340, viewportEl, zoomViewport);
    const screenPoint = canvasToScreen(canvasPoint.x, canvasPoint.y, viewportEl, zoomViewport);
    expect(screenPoint.clientX).toBeCloseTo(300, 5);
    expect(screenPoint.clientY).toBeCloseTo(340, 5);
  });
});
