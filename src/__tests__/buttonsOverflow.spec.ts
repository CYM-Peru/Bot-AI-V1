import { describe, expect, it } from "vitest";
import { convertButtonsOverflowToList, createButtonOption, normalizeFlow } from "../App";
import type { Flow } from "../flow/types";

describe("buttons overflow conversion", () => {
  const buildFlow = (): Flow => {
    const base: Flow = normalizeFlow({
      version: 1,
      id: "flow",
      name: "demo",
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          label: "Botones",
          type: "action",
          children: [],
          action: {
            kind: "buttons",
            data: {
              items: [
                createButtonOption(0, { label: "A", value: "A" }),
                createButtonOption(1, { label: "B", value: "B" }),
                createButtonOption(2, { label: "C", value: "C" }),
                createButtonOption(3, { label: "D", value: "D" }),
              ],
              maxButtons: 3,
              moreTargetId: null,
            },
          },
        },
      },
    });
    return base;
  };

  it("creates a list node with overflow options", () => {
    const flow = buildFlow();
    const { nextFlow, listNodeId } = convertButtonsOverflowToList(flow, "root");
    expect(listNodeId).not.toBeNull();
    const listNode = nextFlow.nodes[listNodeId!];
    expect(listNode).toBeDefined();
    expect(listNode.type).toBe("menu");
    expect(listNode.menuOptions?.length).toBe(1);
    expect(listNode.menuOptions?.[0].label).toBe("D");
    const source = nextFlow.nodes.root;
    expect(source.action?.kind).toBe("buttons");
    const data = source.action?.data as any;
    expect(data.items.length).toBe(3);
    expect(data.moreTargetId).toBe(listNodeId);
  });

  it("returns same flow when under limit", () => {
    const flow = buildFlow();
    flow.nodes.root.action!.data!.items = flow.nodes.root.action!.data!.items.slice(0, 2);
    const { nextFlow, listNodeId } = convertButtonsOverflowToList(flow, "root");
    expect(nextFlow).toBe(flow);
    expect(listNodeId).toBeNull();
  });
});
