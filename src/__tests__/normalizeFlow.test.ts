import { describe, it, expect } from "vitest";
import {
  createButtonOption,
  normalizeButtonsData,
  normalizeFlow,
  getOutputHandleSpecs,
  getHandleAssignments,
  getAskData,
} from "../App";
import type { Flow } from "../flow/types";
import { DEFAULT_BUTTON_LIMIT } from "../flow/channelLimits";

describe("normalizeButtonsData", () => {
  it("fills defaults and preserves targets", () => {
    const normalized = normalizeButtonsData({ items: [] });
    expect(normalized.items).toHaveLength(1);
    expect(normalized.maxButtons).toBe(DEFAULT_BUTTON_LIMIT);
    expect(normalized.moreTargetId).toBeNull();
  });
});

describe("normalizeFlow", () => {
  it("ensures button nodes expose handles for overflow", () => {
    const flow: Flow = {
      version: 1,
      id: "flow",
      name: "Test",
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
                createButtonOption(0, { label: "Uno", value: "1", targetId: "ok" }),
                createButtonOption(1, { label: "Dos", value: "2" }),
                createButtonOption(2, { label: "Tres", value: "3" }),
                createButtonOption(3, { label: "Cuatro", value: "4" }),
              ],
              maxButtons: DEFAULT_BUTTON_LIMIT,
              moreTargetId: "lista",
            },
          },
        },
        ok: { id: "ok", label: "Ok", type: "action", children: [], action: { kind: "message", data: { text: "ok" } } },
        lista: { id: "lista", label: "Lista", type: "action", children: [], action: { kind: "message", data: { text: "más" } } },
      },
    };

    const normalized = normalizeFlow(flow);
    const root = normalized.nodes.root;
    expect(root.children).toEqual(expect.arrayContaining(["ok", "lista"]));

    const specs = getOutputHandleSpecs(root);
    expect(specs.map((spec) => spec.id)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("out:button:"),
        "out:button:more",
      ])
    );

    const assignments = getHandleAssignments(root);
    expect(assignments["out:button:more"]).toBe("lista");
  });

  it("normalizes ask nodes and tracks answer targets", () => {
    const flow: Flow = {
      version: 1,
      id: "ask-flow",
      name: "Ask",
      rootId: "ask",
      nodes: {
        ask: {
          id: "ask",
          label: "Pregunta",
          type: "action",
          children: [],
          action: {
            kind: "ask",
            data: {
              questionText: "¿Tu número?",
              varName: "",
              varType: "number",
              validation: { type: "regex", pattern: "^\\d+$" },
              retryMessage: "",
              answerTargetId: "ok",
              invalidTargetId: "fail",
            },
          },
        },
        ok: { id: "ok", label: "Ok", type: "action", children: [], action: { kind: "message", data: { text: "ok" } } },
        fail: { id: "fail", label: "Fail", type: "action", children: [], action: { kind: "message", data: { text: "fail" } } },
      },
    };

    const normalized = normalizeFlow(flow);
    const askNode = normalized.nodes.ask;
    expect(askNode.children).toEqual(expect.arrayContaining(["ok", "fail"]));

    const askData = getAskData(askNode);
    expect(askData).not.toBeNull();
    expect(askData?.varName).toBe("respuesta");
    expect(askData?.retryMessage).toMatch(/Lo siento/);

    const specs = getOutputHandleSpecs(askNode);
    expect(specs.map((spec) => spec.id)).toEqual([
      "out:answer",
      "out:invalid",
    ]);
  });
});
