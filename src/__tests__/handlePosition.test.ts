import { describe, it, expect } from "vitest";
import { computeHandlePosition, quantizeForDPR } from "../utils/handlePosition";

describe("computeHandlePosition", () => {
  it("returns stage-relative coordinates without transforms", () => {
    const nodeRect = { left: 100, top: 200, width: 300, height: 120 } as DOMRect;
    const viewport = {
      stageRect: { left: 0, top: 0, width: 800, height: 600 } as DOMRect,
      scale: 1,
      pan: { x: 0, y: 0 },
    };
    const anchor = { x: 1, y: 0.5 };
    const position = computeHandlePosition(nodeRect, anchor, viewport);
    expect(position.x).toBeCloseTo(100 + 300);
    expect(position.y).toBeCloseTo(200 + 60);
  });

  it("accounts for scale and pan offsets", () => {
    const nodeRect = { left: 400, top: 300, width: 200, height: 100 } as DOMRect;
    const viewport = {
      stageRect: { left: 50, top: 80, width: 1024, height: 768 } as DOMRect,
      scale: 2,
      pan: { x: 20, y: -15 },
    };
    const anchor = { x: 0, y: 1 };
    const position = computeHandlePosition(nodeRect, anchor, viewport);
    // After translating stage origin and scaling, the node origin is ((400-50)/2 + 20, (300-80)/2 - 15)
    expect(position.x).toBeCloseTo(((400 - 50) / 2) + 20);
    expect(position.y).toBeCloseTo(((300 - 80) / 2) - 15 + (100 / 2));
  });
});

describe("quantizeForDPR", () => {
  it("rounds coordinates to the device pixel ratio", () => {
    const raw = { x: 10.3333, y: 20.6667 };
    const quantized = quantizeForDPR(raw, 2);
    expect(quantized.x).toBeCloseTo(10.5);
    expect(quantized.y).toBeCloseTo(20.5);
  });
});
