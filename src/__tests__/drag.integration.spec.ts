import { describe, expect, it } from "vitest";
import { screenToCanvas, type Viewport } from "../utils/coords";

describe("drag integration", () => {
  const viewportEl = {
    getBoundingClientRect: () => ({ left: 50, top: 100, width: 800, height: 600 }),
  } as unknown as HTMLElement;

  const viewport: Viewport = { x: 0, y: 0, zoom: 1 };

  it("keeps offsets consistent during drag", () => {
    const nodePosition = { x: 200, y: 160 };
    const pointerDown = { clientX: 250, clientY: 220 };
    const startCanvas = screenToCanvas(pointerDown.clientX, pointerDown.clientY, viewportEl, viewport);
    const offset = { x: startCanvas.x - nodePosition.x, y: startCanvas.y - nodePosition.y };

    const pointerMove = { clientX: 400, clientY: 360 };
    const moveCanvas = screenToCanvas(pointerMove.clientX, pointerMove.clientY, viewportEl, viewport);
    const nextPosition = { x: moveCanvas.x - offset.x, y: moveCanvas.y - offset.y };

    expect(nextPosition.x).toBeCloseTo(350, 5);
    expect(nextPosition.y).toBeCloseTo(300, 5);
  });

  it("supports zoomed drags", () => {
    const zoomViewport: Viewport = { x: 80, y: 40, zoom: 2 };
    const nodePosition = { x: 180, y: 120 };
    const pointerDown = { clientX: 300, clientY: 260 };
    const startCanvas = screenToCanvas(pointerDown.clientX, pointerDown.clientY, viewportEl, zoomViewport);
    const offset = { x: startCanvas.x - nodePosition.x, y: startCanvas.y - nodePosition.y };

    const pointerMove = { clientX: 360, clientY: 340 };
    const moveCanvas = screenToCanvas(pointerMove.clientX, pointerMove.clientY, viewportEl, zoomViewport);
    const nextPosition = { x: moveCanvas.x - offset.x, y: moveCanvas.y - offset.y };

    expect(nextPosition.x).toBeCloseTo(210, 5);
    expect(nextPosition.y).toBeCloseTo(160, 5);
  });
});
