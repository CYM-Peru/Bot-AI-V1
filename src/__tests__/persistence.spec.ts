import { beforeEach, describe, expect, it } from "vitest";
import { createLocalStorageStrategy, loadFlow, saveFlow, setPersistenceStrategy } from "../data/persistence";
import type { Flow } from "../flow/types";
import { normalizeFlow, normalizeSchedulerData } from "../App";

describe("builder persistence", () => {
  const workspaceId = "ws-test";
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const storage: Storage = {
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
    setPersistenceStrategy(createLocalStorageStrategy(storage));
  });

  it("round-trips a flow with scheduler data", async () => {
    const flow: Flow = normalizeFlow({
      version: 1,
      id: "flow-1",
      name: "Test",
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          label: "Inicio",
          type: "action",
          children: ["schedule"],
          action: { kind: "message", data: { text: "hola" } },
        },
        schedule: {
          id: "schedule",
          label: "Horario",
          type: "action",
          children: [],
          action: { kind: "scheduler", data: normalizeSchedulerData(undefined) },
        },
      },
    });
    const positions = { root: { x: 10, y: 20 }, schedule: { x: 120, y: 220 } };
    type PersistedState = { flow: Flow; positions: typeof positions };

    await saveFlow(workspaceId, { flow, positions });
    const loaded = await loadFlow<PersistedState>(workspaceId);

    expect(loaded).not.toBeNull();
    expect(loaded?.flow).toEqual(flow);
    expect(loaded?.positions).toEqual(positions);
  });
});
