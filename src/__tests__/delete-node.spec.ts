import { describe, expect, it } from "vitest";
import { removeNodeKeepingDescendants } from "../App";
import type { Flow } from "../flow/types";

const baseFlow: Flow = {
  version: 1,
  id: "flow-1",
  name: "Demo",
  rootId: "root",
  nodes: {
    root: {
      id: "root",
      label: "Inicio",
      type: "menu",
      children: ["middle"],
      menuOptions: [
        {
          id: "opt-1",
          label: "Siguiente",
          value: "next",
          targetId: "middle",
        },
      ],
    },
    middle: {
      id: "middle",
      label: "Intermedio",
      type: "action",
      children: ["leaf"],
      action: {
        kind: "message",
        data: { text: "Hola" },
      },
    },
    leaf: {
      id: "leaf",
      label: "Final",
      type: "action",
      children: [],
      action: {
        kind: "message",
        data: { text: "Fin" },
      },
    },
  },
};

describe("removeNodeKeepingDescendants", () => {
  it("removes the node but keeps its descendants detached", () => {
    const next = removeNodeKeepingDescendants(baseFlow, "middle");

    expect(next.nodes.middle).toBeUndefined();
    expect(next.nodes.leaf).toBeDefined();
    expect(next.nodes.root.children).toEqual([]);
    expect(next.nodes.root.menuOptions?.[0]?.targetId).toBeNull();
  });

  it("does nothing when removing root", () => {
    const next = removeNodeKeepingDescendants(baseFlow, "root");
    expect(next).toBe(baseFlow);
  });
});
