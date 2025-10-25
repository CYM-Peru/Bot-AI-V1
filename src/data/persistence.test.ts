import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalStorageStrategy,
  loadFlow,
  saveFlow,
  setPersistenceStrategy,
} from "./persistence";

type SampleFlow = { id: string; value: number };

describe("persistence", () => {
  const workspaceId = "ws-123";
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const mockStorage: Storage = {
      get length() {
        return Object.keys(store).length;
      },
      clear: () => {
        store = {};
      },
      getItem: (key: string) => (key in store ? store[key] : null),
      key: (index: number) => Object.keys(store)[index] ?? null,
      removeItem: (key: string) => {
        delete store[key];
      },
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    };
    setPersistenceStrategy(createLocalStorageStrategy<SampleFlow>(mockStorage));
  });

  it("saves and loads from localStorage", async () => {
    const flow: SampleFlow = { id: "flow", value: 42 };
    await saveFlow(workspaceId, flow);
    const loaded = await loadFlow<SampleFlow>(workspaceId);
    expect(loaded).toEqual(flow);
  });

  it("returns null when storage is empty", async () => {
    const loaded = await loadFlow<SampleFlow>(workspaceId);
    expect(loaded).toBeNull();
  });

  it("handles malformed JSON gracefully", async () => {
    store["flow-builder/" + workspaceId] = "{ invalid json";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const loaded = await loadFlow<SampleFlow>(workspaceId);
    expect(loaded).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("propagates storage errors", async () => {
    setPersistenceStrategy({
      save: () => {
        throw new Error("fail");
      },
      load: async () => ({ id: "x", value: 1 }),
    });
    await expect(saveFlow(workspaceId, { id: "x", value: 1 })).rejects.toThrow("fail");
  });
});
