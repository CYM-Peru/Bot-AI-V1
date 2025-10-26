import { describe, expect, it, vi } from "vitest";
import { createHandleScheduler } from "../scheduler";

describe("createHandleScheduler", () => {
  it("coalesces multiple calls within the same frame", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn<[FrameRequestCallback], number>((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    const cancelFrame = vi.fn<[number], void>();
    const recompute = vi.fn();

    const scheduler = createHandleScheduler(recompute, requestFrame, cancelFrame);

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
