import { describe, expect, it, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  it("delays execution until timeout", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 300);
    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("flush executes immediately", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 200);
    debounced();
    debounced.flush();
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
