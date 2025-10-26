export type FrameHandle = number | ReturnType<typeof setTimeout>;

export interface HandleScheduler {
  schedule: () => void;
  cancel: () => void;
  isScheduled: () => boolean;
  setCallback: (cb: () => void) => void;
}

const defaultRequestFrame = (cb: FrameRequestCallback): FrameHandle => {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(cb);
  }
  return setTimeout(() => cb(Date.now()), 16);
};

const defaultCancelFrame = (handle: FrameHandle): void => {
  if (typeof globalThis.cancelAnimationFrame === "function" && typeof handle === "number") {
    globalThis.cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
};

export function createHandleScheduler(
  callback: () => void,
  requestFrame: (cb: FrameRequestCallback) => FrameHandle = defaultRequestFrame,
  cancelFrame: (handle: FrameHandle) => void = defaultCancelFrame
): HandleScheduler {
  let frame: FrameHandle | null = null;
  let currentCallback = callback;

  const run: FrameRequestCallback = () => {
    frame = null;
    currentCallback();
  };

  return {
    schedule() {
      if (frame != null) {
        return;
      }
      frame = requestFrame(run);
    },
    cancel() {
      if (frame == null) {
        return;
      }
      cancelFrame(frame);
      frame = null;
    },
    isScheduled() {
      return frame != null;
    },
    setCallback(cb: () => void) {
      currentCallback = cb;
    },
  };
}
