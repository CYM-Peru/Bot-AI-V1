import { describe, expect, it, vi } from "vitest";
import { createHandleScheduler } from "../scheduler";

describe("createHandleScheduler", () => {
  it("coalesces multiple calls within the same frame", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length as number;
    });
    const cancelFrame = vi.fn();
    const recompute = vi.fn();

    const scheduler = createHandleScheduler(recompute, requestFrame as any, cancelFrame);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(scheduler.isScheduled()).toBe(true);

    callbacks[0](0);

    expect(recompute).toHaveBeenCalledTimes(1);
    expect(scheduler.isScheduled()).toBe(false);
  });
});
