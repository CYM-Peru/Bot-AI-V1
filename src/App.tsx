import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toWorldCoords } from "./geometry/coordinates";
import { loadFlow, saveFlow } from "./data/persistence";
import { debounce } from "./utils/debounce";
import { CHANNEL_BUTTON_LIMITS, DEFAULT_BUTTON_LIMIT } from "./flow/channelLimits";
import type {
  ActionKind,
  ButtonOption,
  ButtonsActionData,
  Flow,
  FlowNode,
  MenuOption,
  NodeType,
  AskActionData,
} from "./flow/types";
import { computeHandlePosition, quantizeForDPR } from "./utils/handlePosition";

const NODE_W = 300;
const NODE_H = 128;
const SURFACE_W = 4000;
const SURFACE_H = 3000;
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMenuOption(index: number, overrides: Partial<MenuOption> = {}): MenuOption {
  return {
    id: overrides.id ?? createId(`menu-${index + 1}`),
    label: overrides.label ?? `Opción ${index + 1}`,
    value: overrides.value,
    targetId: overrides.targetId ?? null,
  };
}

export function createButtonOption(index: number, overrides: Partial<ButtonOption> = {}): ButtonOption {
  const baseValue = `BTN_${index + 1}`;
  return {
    id: overrides.id ?? createId(`btn-${index + 1}`),
    label: overrides.label ?? `Botón ${index + 1}`,
    value: overrides.value ?? baseValue,
    targetId: overrides.targetId ?? null,
  };
}

export function normalizeButtonsData(data?: Partial<ButtonsActionData> | null): ButtonsActionData {
  const items = (data?.items ?? []).map((item, idx) => ({
    ...createButtonOption(idx, item),
  }));
  const ensuredItems = items.length > 0 ? items : [createButtonOption(0)];
  const maxButtons = data?.maxButtons ?? DEFAULT_BUTTON_LIMIT;
  const moreTargetId = data?.moreTargetId ?? null;
  return { items: ensuredItems, maxButtons, moreTargetId };
}

export function normalizeNode(node: FlowNode): FlowNode {
  let changed = false;
  let next: FlowNode = node;

  if (node.type === "menu") {
    const rawOptions = node.menuOptions ?? [];
    const options = rawOptions.length > 0 ? rawOptions : [createMenuOption(0)];
    const normalizedOptions = options.map((option, idx) => ({
      ...createMenuOption(idx, option),
    }));
    const optionsChanged =
      normalizedOptions.length !== rawOptions.length ||
      normalizedOptions.some((opt, idx) => {
        const prev = rawOptions[idx];
        if (!prev) return true;
        return (
          opt.id !== prev.id ||
          opt.label !== prev.label ||
          opt.value !== prev.value ||
          (opt.targetId ?? null) !== (prev.targetId ?? null)
        );
      });
    const targets = normalizedOptions
      .map((opt) => opt.targetId)
      .filter((id): id is string => Boolean(id));
    const uniqueChildren = Array.from(new Set([...(node.children ?? []), ...targets]));
    const childrenChanged =
      uniqueChildren.length !== node.children.length ||
      uniqueChildren.some((id, idx) => node.children[idx] !== id);
    if (optionsChanged || childrenChanged) {
      next = { ...next, menuOptions: normalizedOptions, children: uniqueChildren };
      changed = true;
    }
  }

  if (node.action?.kind === "buttons") {
    const prevData = (node.action.data as Partial<ButtonsActionData> | undefined) ?? { items: [] };
    const normalized = normalizeButtonsData(prevData);
    const dataChanged =
      normalized.maxButtons !== (prevData.maxButtons ?? DEFAULT_BUTTON_LIMIT) ||
      normalized.items.length !== (prevData.items?.length ?? 0) ||
      normalized.items.some((item, idx) => {
        const prev = prevData.items?.[idx];
        if (!prev) return true;
        return (
          item.id !== prev.id ||
          item.label !== prev.label ||
          item.value !== prev.value ||
          (item.targetId ?? null) !== (prev.targetId ?? null)
        );
      }) ||
      (normalized.moreTargetId ?? null) !== (prevData.moreTargetId ?? null);
    const targets = normalized.items
      .map((item) => item.targetId)
      .filter((id): id is string => Boolean(id));
    const childSet = new Set([...(node.children ?? []), ...targets]);
    if (normalized.moreTargetId) childSet.add(normalized.moreTargetId);
    const childList = Array.from(childSet);
    const childrenChanged =
      childList.length !== node.children.length ||
      childList.some((id, idx) => node.children[idx] !== id);
    if (dataChanged || childrenChanged) {
      next = {
        ...next,
        action: { ...node.action, data: normalized },
        children: childList,
      };
      changed = true;
    }
  }

  if (node.action?.kind === "ask") {
    const data = node.action.data as Partial<AskActionData> | undefined;
    const questionText = typeof data?.questionText === "string" ? data.questionText : "¿Cuál es tu respuesta?";
    const varName = typeof data?.varName === "string" && data.varName.trim() ? data.varName : "respuesta";
    const varType = data?.varType === "number" || data?.varType === "option" ? data.varType : "text";
    const validation: AskActionData["validation"] = data?.validation ?? { type: "none" };
    const retryMessage =
      typeof data?.retryMessage === "string" && data.retryMessage.trim()
        ? data.retryMessage
        : "Lo siento, ¿puedes intentarlo de nuevo?";
    const answerTargetId = typeof data?.answerTargetId === "string" ? data.answerTargetId : null;
    const invalidTargetId = typeof data?.invalidTargetId === "string" ? data.invalidTargetId : null;
    const childSet = new Set([...(node.children ?? [])]);
    if (answerTargetId) childSet.add(answerTargetId);
    if (invalidTargetId) childSet.add(invalidTargetId);
    const childList = Array.from(childSet);
    const normalizedAsk: AskActionData = {
      questionText,
      varName,
      varType,
      validation,
      retryMessage,
      answerTargetId,
      invalidTargetId,
    };
    const prevData = data ?? {};
    const dataChanged =
      prevData.questionText !== normalizedAsk.questionText ||
      prevData.varName !== normalizedAsk.varName ||
      prevData.varType !== normalizedAsk.varType ||
      JSON.stringify(prevData.validation ?? { type: "none" }) !== JSON.stringify(normalizedAsk.validation) ||
      prevData.retryMessage !== normalizedAsk.retryMessage ||
      (prevData.answerTargetId ?? null) !== (normalizedAsk.answerTargetId ?? null) ||
      (prevData.invalidTargetId ?? null) !== (normalizedAsk.invalidTargetId ?? null);
    const childrenChanged =
      childList.length !== node.children.length ||
      childList.some((id, idx) => node.children[idx] !== id);
    if (dataChanged || childrenChanged) {
      next = {
        ...next,
        action: { ...node.action, data: normalizedAsk },
        children: childList,
      };
      changed = true;
    }
  }

  return changed ? next : node;
}

export function normalizeFlow(flow: Flow): Flow {
  let mutated = false;
  const nodes: Record<string, FlowNode> = {};
  for (const [id, node] of Object.entries(flow.nodes)) {
    const normalized = normalizeNode(node);
    nodes[id] = normalized;
    if (normalized !== node) mutated = true;
  }
  if (!mutated) return flow;
  return { ...flow, nodes };
}

export function getMenuOptions(node: FlowNode): MenuOption[] {
  if (node.type !== "menu") return [];
  const options = node.menuOptions && node.menuOptions.length > 0 ? node.menuOptions : [createMenuOption(0)];
  return options.map((option, idx) => ({
    ...createMenuOption(idx, option),
  }));
}

export function getButtonsData(node: FlowNode): ButtonsActionData | null {
  if (node.action?.kind !== "buttons") return null;
  return normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
}

export function getAskData(node: FlowNode): AskActionData | null {
  if (node.action?.kind !== "ask") return null;
  const data = node.action.data ?? {};
  const questionText = typeof data.questionText === "string" ? data.questionText : "¿Cuál es tu respuesta?";
  const varName = typeof data.varName === "string" && data.varName.trim() ? data.varName : "respuesta";
  const varType = data.varType === "number" || data.varType === "option" ? data.varType : "text";
  const validation: AskActionData["validation"] = data.validation ?? { type: "none" };
  const retryMessage =
    typeof data.retryMessage === "string" && data.retryMessage.trim()
      ? data.retryMessage
      : "Lo siento, ¿puedes intentarlo de nuevo?";
  const answerTargetId = typeof data.answerTargetId === "string" ? data.answerTargetId : null;
  const invalidTargetId = typeof data.invalidTargetId === "string" ? data.invalidTargetId : null;
  return {
    questionText,
    varName,
    varType,
    validation,
    retryMessage,
    answerTargetId,
    invalidTargetId,
  };
}

type HandleSpec = {
  id: string;
  label: string;
  side: "left" | "right";
  type: "input" | "output";
  order: number;
  variant?: "default" | "more" | "invalid" | "answer";
};

const STRICTEST_LIMIT = CHANNEL_BUTTON_LIMITS.reduce((best, entry) => (entry.max < best.max ? entry : best), CHANNEL_BUTTON_LIMITS[0]);

type NodePreviewProps = {
  node: FlowNode;
  flow: Flow;
  channel: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';
};

function NodePreview({ node, flow, channel }: NodePreviewProps) {
  if (node.type === "menu") {
    const options = getMenuOptions(node);
    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-700">Menú · {node.label}</div>
        <ol className="text-[11px] space-y-1 list-decimal list-inside">
          {options.map((option) => {
            const target = option.targetId ? flow.nodes[option.targetId] : null;
            return (
              <li key={option.id} className="flex justify-between gap-2">
                <span className="truncate">{option.label}</span>
                <span className="text-slate-400">{target ? target.label : "sin destino"}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (node.action?.kind === "buttons") {
    const data = normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
    const visible = data.items.slice(0, data.maxButtons);
    const overflow = data.items.slice(data.maxButtons);
    return (
      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-700">Botones interactivos</div>
        <div className="flex flex-wrap gap-1">
          {visible.map((item) => (
            <span key={item.id} className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700">
              {item.label}
            </span>
          ))}
          {overflow.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-violet-50 text-violet-700">Lista (+{overflow.length})</span>
          )}
        </div>
        <div className="text-[10px] text-slate-400">
          Límite base: {STRICTEST_LIMIT.max} (WhatsApp / Messenger). Canal actual: {channel}.
        </div>
      </div>
    );
  }

  if (node.action?.kind === "ask") {
    const ask = getAskData(node);
    return ask ? (
      <div className="space-y-1 text-[11px]">
        <div className="text-xs font-semibold text-slate-700">Pregunta al cliente</div>
        <div className="text-slate-600">{ask.questionText}</div>
        <div className="flex gap-2 text-slate-500">
          <span>Variable: <strong>{ask.varName}</strong></span>
          <span>Tipo: {ask.varType}</span>
        </div>
        <div className="text-slate-400">
          Validación: {ask.validation?.type === "regex" ? `regex (${ask.validation.pattern})` : ask.validation?.type === "options" ? `opciones (${ask.validation.options.join(", ")})` : "ninguna"}
        </div>
      </div>
    ) : null;
  }

  if (node.action?.kind === "message") {
    return (
      <div className="text-[11px] space-y-1">
        <div className="text-xs font-semibold text-slate-700">Mensaje</div>
        <div className="text-slate-600">{node.action?.data?.text ?? "Mensaje sin contenido"}</div>
      </div>
    );
  }

  return (
    <div className="text-[11px] text-slate-500">
      Vista previa no disponible para {node.action?.kind ?? node.type}.
    </div>
  );
}

export function getOutputHandleSpecs(node: FlowNode): HandleSpec[] {
  if (node.type === "menu") {
    return getMenuOptions(node).map((option, idx) => ({
      id: `out:menu:${option.id}`,
      label: option.label,
      side: "right",
      type: "output",
      order: idx,
      variant: "default",
    }));
  }
  const buttons = getButtonsData(node);
  if (buttons) {
    const visible = buttons.items.slice(0, buttons.maxButtons);
    const handles: HandleSpec[] = visible.map((item, idx) => ({
      id: `out:button:${item.id}`,
      label: item.label,
      side: "right",
      type: "output",
      order: idx,
      variant: "default",
    }));
    if (buttons.items.length > visible.length) {
      handles.push({
        id: "out:button:more",
        label: "Lista",
        side: "right",
        type: "output",
        order: handles.length,
        variant: "more",
      });
    }
    return handles;
  }
  const ask = getAskData(node);
  if (ask) {
    return [
      { id: "out:answer", label: "Respuesta", side: "right", type: "output", order: 0, variant: "answer" },
      { id: "out:invalid", label: "On invalid", side: "right", type: "output", order: 1, variant: "invalid" },
    ];
  }
  return [
    { id: "out:default", label: "Siguiente", side: "right", type: "output", order: 0, variant: "default" },
  ];
}

export function getHandleAssignments(node: FlowNode): Record<string, string | null> {
  if (node.type === "menu") {
    const assignments: Record<string, string | null> = {};
    getMenuOptions(node).forEach((option) => {
      assignments[`out:menu:${option.id}`] = option.targetId ?? null;
    });
    return assignments;
  }
  const buttons = getButtonsData(node);
  if (buttons) {
    const assignments: Record<string, string | null> = {};
    const visible = buttons.items.slice(0, buttons.maxButtons);
    visible.forEach((item) => {
      assignments[`out:button:${item.id}`] = item.targetId ?? null;
    });
    if (buttons.items.length > visible.length) {
      assignments["out:button:more"] = buttons.moreTargetId ?? null;
    }
    return assignments;
  }
  const ask = getAskData(node);
  if (ask) {
    return {
      "out:answer": ask.answerTargetId ?? null,
      "out:invalid": ask.invalidTargetId ?? null,
    };
  }
  return { "out:default": node.children[0] ?? null };
}

const demoFlow: Flow = normalizeFlow({
  id: "flow-demo",
  name: "Azaleia · Menú principal",
  rootId: "root",
  nodes: { root: { id: "root", label: "Menú principal", type: "menu", children: [], menuOptions: [] } },
});

function computeLayout(flow: Flow) {
  const pos: Record<string, { x: number; y: number }> = {};
  const levels: Record<number, string[]> = {};
  const seen = new Set<string>();
  function dfs(id: string, d: number) {
    if (seen.has(id)) return;
    seen.add(id);
    (levels[d] ||= []).push(id);
    const n = flow.nodes[id];
    if (!n) return;
    for (const cid of n.children) dfs(cid, d + 1);
  }
  dfs(flow.rootId, 0);
  const colW = 340, rowH = 170;
  Object.entries(levels).forEach(([depth, ids]) => {
    (ids as string[]).forEach((id, i) => { pos[id] = { x: Number(depth) * colW, y: i * rowH }; });
  });
  return pos;
}

function clearSelection(){ try{ (window as any).getSelection?.()?.removeAllRanges?.(); }catch{} }
function isFromNode(target: EventTarget | null){ const el = target as Element | null; return !!(el && (el as any).closest?.('[data-node="true"]')); }

function nextChildId(flow: Flow, parentId: string): string {
  const siblings = flow.nodes[parentId].children;
  let maxIdx = 0;
  for (const sid of siblings) {
    const tail = sid.split(".").pop();
    const n = Number(tail);
    if (!Number.isNaN(n)) maxIdx = Math.max(maxIdx, n);
  }
  const next = maxIdx + 1;
  return parentId === flow.rootId ? String(next) : `${parentId}.${next}`;
}
function deleteSubtree(flow: Flow, id: string){
  const node = flow.nodes[id]; if (!node) return;
  for (const cid of node.children) deleteSubtree(flow, cid);
  delete flow.nodes[id];
}
function cubicMid(x1:number,y1:number,c1x:number,c1y:number,c2x:number,c2y:number,x2:number,y2:number,t:number){
  const mt = 1 - t;
  const X = mt*mt*mt*x1 + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*x2;
  const Y = mt*mt*mt*y1 + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*y2;
  return { X, Y };
}

type HandleRegistryValue = {
  registerHandle: (handleId: string, nodeElement: HTMLElement, handleElement: HTMLElement) => void;
  unregisterHandle: (handleId: string) => void;
};

const HandleRegistryContext = React.createContext<HandleRegistryValue | null>(null);

type EdgeSpec = {
  key: string;
  from: string;
  to: string;
  sourceHandleId: string;
  targetHandleId: string;
  sourceSpec: HandleSpec;
};

type HandlePointProps = {
  nodeId: string;
  spec: HandleSpec;
  nodeRef: React.RefObject<HTMLDivElement>;
  positionPercent: number;
  isConnected: boolean;
};

const HandlePoint: React.FC<HandlePointProps> = ({ nodeId, spec, nodeRef, positionPercent, isConnected }) => {
  const registry = React.useContext(HandleRegistryContext);
  const spanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const handleElement = spanRef.current;
    const nodeElement = nodeRef.current;
    if (!registry || !handleElement || !nodeElement) return;
    const handleKey = `${nodeId}:${spec.id}`;
    registry.registerHandle(handleKey, nodeElement, handleElement);
    return () => registry.unregisterHandle(handleKey);
  }, [registry, nodeRef, nodeId, spec.id]);

  const sideClass = spec.side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2";
  const variantClass =
    spec.variant === "more"
      ? "bg-violet-50 border-violet-300"
      : spec.variant === "invalid"
      ? "bg-amber-50 border-amber-300"
      : spec.variant === "answer"
      ? "bg-emerald-50 border-emerald-300"
      : "bg-white border-slate-300";
  const connectedClass = isConnected ? "shadow-[0_0_0_3px_rgba(16,185,129,0.25)] border-emerald-400" : "shadow-sm";

  return (
    <span
      ref={spanRef}
      data-handle={spec.id}
      className={`absolute ${sideClass} -translate-y-1/2 w-4 h-4 rounded-full border ${variantClass} ${connectedClass}`}
      style={{ top: `${positionPercent * 100}%` }}
      title={spec.label}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
};

type CanvasNodeProps = {
  node: FlowNode;
  position: { x: number; y: number };
  selected: boolean;
  onSelect: (id: string) => void;
  onNodePointerDown: (id: string) => (event: React.PointerEvent<HTMLDivElement>) => void;
  onAddChild: (parentId: string, type: NodeType) => void;
  onDuplicateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  stopNodeButtonPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  outputSpecs: HandleSpec[];
  handleAssignments: Record<string, string | null>;
  rootId: string;
};

const CanvasNode = React.memo((props: CanvasNodeProps) => {
  const {
    node,
    position,
    selected,
    onSelect,
    onNodePointerDown,
    onAddChild,
    onDuplicateNode,
    onDeleteNode,
    stopNodeButtonPointerDown,
    outputSpecs,
    handleAssignments,
    rootId,
  } = props;
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const badge = node.type === "menu" ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-violet-50 border-violet-300 text-violet-600";
  const icon = node.type === "menu" ? "🟢" : "🔗";
  const outputCount = outputSpecs.length || 1;

  return (
    <div
      ref={nodeRef}
      key={node.id}
      data-node="true"
      className={`absolute w-[300px] rounded-2xl border-2 bg-white shadow-lg transition border-slate-300 ${selected ? "ring-2 ring-emerald-500 shadow-emerald-200" : "hover:ring-1 hover:ring-emerald-200"} relative`}
      style={{ left: position.x, top: position.y, cursor: "move" }}
      onPointerDown={onNodePointerDown(node.id)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <HandlePoint
        nodeId={node.id}
        spec={{ id: "in", label: "Entrada", side: "left", type: "input", order: 0, variant: "default" }}
        nodeRef={nodeRef}
        positionPercent={0.5}
        isConnected={true}
      />
      {outputSpecs.map((spec) => {
        const positionPercent = (spec.order + 1) / (outputCount + 1);
        return (
          <HandlePoint
            key={spec.id}
            nodeId={node.id}
            spec={spec}
            nodeRef={nodeRef}
            positionPercent={positionPercent}
            isConnected={Boolean(handleAssignments[spec.id])}
          />
        );
      })}
      <div className="px-3 pt-3 text-[15px] font-semibold flex items-center gap-2 text-slate-800">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-700">{icon}</span>
        <span className="whitespace-normal leading-tight" title={node.label}>{node.label}</span>
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${badge}`}>{node.type}</span>
      </div>
      <div className="px-3 py-2">
        <div className="flex gap-2 flex-wrap">
          <button
            className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
            onPointerDown={stopNodeButtonPointerDown}
            onClick={(event) => {
              event.stopPropagation();
              onAddChild(node.id, "menu");
            }}
          >
            + menú
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
            onPointerDown={stopNodeButtonPointerDown}
            onClick={(event) => {
              event.stopPropagation();
              onAddChild(node.id, "action");
            }}
          >
            + acción
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
            onPointerDown={stopNodeButtonPointerDown}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicateNode(node.id);
            }}
          >
            duplicar
          </button>
          {node.id !== rootId && (
            <button
              className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
              onPointerDown={stopNodeButtonPointerDown}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteNode(node.id);
              }}
            >
              borrar
            </button>
          )}
        </div>
      </div>
      <div className="px-3 pb-3 text-xs text-slate-500">
        {node.type === "menu" ? `${(node.menuOptions ?? []).length} opción(es)` : node.action?.kind ?? "acción"}
      </div>
    </div>
  );
});

function FlowCanvas(props: {
  flow: Flow;
  selectedId: string;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, type: NodeType) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onInsertBetween: (parentId: string, childId: string) => void;
  onDeleteEdge: (parentId: string, childId: string) => void;
  soloRoot: boolean;
  toggleScope: () => void;
  nodePositions: Record<string, { x: number; y: number }>;
  onPositionsChange: (
    updater:
      | Record<string, { x: number; y: number }>
      | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)
  ) => void;
}) {
  const {
    flow,
    selectedId,
    onSelect,
    onAddChild,
    onDeleteNode,
    onDuplicateNode,
    onInsertBetween,
    onDeleteEdge,
    soloRoot,
    toggleScope,
    nodePositions,
    onPositionsChange,
  } = props;

  const autoLayout = useMemo(() => computeLayout(flow), [flow]);
  const visibleIds = useMemo(() => {
    if (soloRoot) return [flow.rootId, ...(flow.nodes[flow.rootId]?.children ?? [])];
    return Object.keys(flow.nodes);
  }, [flow, soloRoot]);
  const nodes = useMemo(
    () => visibleIds.map((id) => flow.nodes[id]).filter(Boolean) as FlowNode[],
    [visibleIds, flow.nodes]
  );
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const outputSpecsByNode = useMemo(() => {
    const map = new Map<string, HandleSpec[]>();
    for (const node of nodes) {
      map.set(node.id, getOutputHandleSpecs(node));
    }
    return map;
  }, [nodes]);
  const handleAssignmentsByNode = useMemo(() => {
    const map = new Map<string, Record<string, string | null>>();
    for (const node of nodes) {
      map.set(node.id, getHandleAssignments(node));
    }
    return map;
  }, [nodes]);
  const edges = useMemo(() => {
    const list: EdgeSpec[] = [];
    for (const node of nodes) {
      const specs = outputSpecsByNode.get(node.id) ?? [];
      const assignments = handleAssignmentsByNode.get(node.id) ?? {};
      for (const spec of specs) {
        const targetId = assignments[spec.id];
        if (!targetId || !visibleSet.has(targetId)) continue;
        list.push({
          key: `${node.id}:${spec.id}->${targetId}`,
          from: node.id,
          to: targetId,
          sourceHandleId: `${node.id}:${spec.id}`,
          targetHandleId: `${targetId}:in`,
          sourceSpec: spec,
        });
      }
    }
    return list;
  }, [nodes, outputSpecsByNode, handleAssignmentsByNode, visibleSet]);

  const [scale, setScaleState] = useState(1);
  const [pan, setPanState] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  const handleElements = useRef(new Map<string, { nodeElement: HTMLElement; handleElement: HTMLElement }>());
  const handleFrameRef = useRef<number | null>(null);
  const [handlePositions, setHandlePositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const setScaleSafe = useCallback((next: number) => {
    scaleRef.current = next;
    setScaleState(next);
  }, []);

  const setPanSafe = useCallback((next: { x: number; y: number }) => {
    panRef.current = next;
    setPanState(next);
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const next = Math.min(2.4, Math.max(0.4, scaleRef.current - event.deltaY * 0.001));
        setScaleSafe(next);
        return;
      }
      const currentScale = scaleRef.current || 1;
      event.preventDefault();
      setPanSafe({
        x: panRef.current.x + event.deltaX / currentScale,
        y: panRef.current.y + event.deltaY / currentScale,
      });
    },
    [setPanSafe, setScaleSafe]
  );

  const nodePosRef = useRef(nodePositions);
  useEffect(() => {
    nodePosRef.current = nodePositions;
  }, [nodePositions]);

  const updateNodePos = useCallback(
    (
      updater:
        | Record<string, { x: number; y: number }>
        | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)
    ) => {
      onPositionsChange(updater);
    },
    [onPositionsChange]
  );

  useEffect(() => {
    const current = nodePosRef.current;
    let needsUpdate = false;
    const missing: Record<string, { x: number; y: number }> = {};
    for (const id of Object.keys(autoLayout)) {
      if (!current[id]) {
        missing[id] = autoLayout[id];
        needsUpdate = true;
      }
    }
    if (!needsUpdate) return;
    onPositionsChange((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, pos] of Object.entries(missing)) {
        if (!next[id]) {
          next[id] = pos;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [autoLayout, onPositionsChange]);

  const getPos = useCallback(
    (id: string) => nodePosRef.current[id] ?? autoLayout[id] ?? { x: 0, y: 0 },
    [autoLayout]
  );

  type PointerState =
    | { type: "pan"; pointerId: number; startClient: { x: number; y: number }; startPan: { x: number; y: number } }
    | { type: "drag-node"; pointerId: number; nodeId: string; offset: { x: number; y: number } };

  const pointerState = useRef<PointerState | null>(null);
  const latestEventRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  const getStageContext = useCallback(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return null;
    const rect = stageEl.getBoundingClientRect();
    const viewport = containerRef.current;
    const scrollLeft = viewport ? viewport.scrollLeft : typeof window !== "undefined" ? window.scrollX : 0;
    const scrollTop = viewport ? viewport.scrollTop : typeof window !== "undefined" ? window.scrollY : 0;
    return {
      rect,
      scrollLeft,
      scrollTop,
      scale: scaleRef.current,
      pan: panRef.current,
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    };
  }, []);

  const recomputeHandlePositions = useCallback(() => {
    const context = getStageContext();
    if (!context) return;
    const viewport = { stageRect: context.rect, scale: context.scale, pan: context.pan };
    const next: Record<string, { x: number; y: number }> = {};
    handleElements.current.forEach(({ nodeElement, handleElement }, id) => {
      if (!nodeElement || !handleElement) return;
      const nodeRect = nodeElement.getBoundingClientRect();
      const handleRect = handleElement.getBoundingClientRect();
      if (nodeRect.width === 0 || nodeRect.height === 0) return;
      const anchor = {
        x: (handleRect.left - nodeRect.left + handleRect.width / 2) / nodeRect.width,
        y: (handleRect.top - nodeRect.top + handleRect.height / 2) / nodeRect.height,
      };
      const position = computeHandlePosition(nodeRect, anchor, viewport);
      const quantized = quantizeForDPR(position, context.devicePixelRatio);
      next[id] = quantized;
    });
    setHandlePositions(next);
  }, [getStageContext]);

  const scheduleHandleRecompute = useCallback(() => {
    if (handleFrameRef.current != null) return;
    handleFrameRef.current = requestAnimationFrame(() => {
      handleFrameRef.current = null;
      recomputeHandlePositions();
    });
  }, [recomputeHandlePositions]);

  const registerHandle = useCallback(
    (handleId: string, nodeElement: HTMLElement, handleElement: HTMLElement) => {
      handleElements.current.set(handleId, { nodeElement, handleElement });
      scheduleHandleRecompute();
    },
    [scheduleHandleRecompute]
  );

  const unregisterHandle = useCallback((handleId: string) => {
    handleElements.current.delete(handleId);
    setHandlePositions((prev) => {
      if (!(handleId in prev)) return prev;
      const next = { ...prev };
      delete next[handleId];
      return next;
    });
  }, []);

  useEffect(() => {
    scheduleHandleRecompute();
  }, [scheduleHandleRecompute, scale, pan, nodes, edges]);

  useEffect(() => {
    const onResize = () => scheduleHandleRecompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scheduleHandleRecompute]);

  const applyPointerUpdate = useCallback(() => {
    frameRef.current = null;
    const evt = latestEventRef.current;
    const state = pointerState.current;
    if (!evt || !state) return;
    if (state.type === "drag-node") {
      const context = getStageContext();
      if (!context) return;
      const pointerWorld = toWorldCoords(evt, context);
      const nx = pointerWorld.x - state.offset.x;
      const ny = pointerWorld.y - state.offset.y;
      const gx = Math.round(nx / 10) * 10;
      const gy = Math.round(ny / 10) * 10;
      updateNodePos((prev) => {
        const current = prev[state.nodeId];
        if (current && current.x === gx && current.y === gy) return prev;
        const next = { ...prev, [state.nodeId]: { x: gx, y: gy } };
        return next;
      });
      scheduleHandleRecompute();
    } else if (state.type === "pan") {
      const { startClient, startPan } = state;
      const currentScale = scaleRef.current || 1;
      const dx = (evt.clientX - startClient.x) / currentScale;
      const dy = (evt.clientY - startClient.y) / currentScale;
      setPanSafe({ x: startPan.x - dx, y: startPan.y - dy });
    }
  }, [getStageContext, scheduleHandleRecompute, setPanSafe, updateNodePos]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(applyPointerUpdate);
  }, [applyPointerUpdate]);

  const stopPointer = useCallback((pointerId: number) => {
    if (pointerState.current?.pointerId !== pointerId) return;
    pointerState.current = null;
    latestEventRef.current = null;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const container = containerRef.current;
    container?.releasePointerCapture?.(pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerState.current || pointerState.current.pointerId !== event.pointerId) return;
      latestEventRef.current = { clientX: event.clientX, clientY: event.clientY };
      clearSelection();
      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      stopPointer(event.pointerId);
    },
    [stopPointer]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (pointerState.current) return;
    if (isFromNode(event.target)) return;
    pointerState.current = {
      type: "pan",
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startPan: panRef.current,
    };
    latestEventRef.current = { clientX: event.clientX, clientY: event.clientY };
    containerRef.current?.setPointerCapture?.(event.pointerId);
    clearSelection();
  }, []);

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      stopPointer(event.pointerId);
    },
    [stopPointer]
  );

  const onNodePointerDown = useCallback(
    (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const context = getStageContext();
      if (!context) return;
      const pointerWorld = toWorldCoords(event, context);
      const position = getPos(id);
      pointerState.current = {
        type: "drag-node",
        pointerId: event.pointerId,
        nodeId: id,
        offset: { x: pointerWorld.x - position.x, y: pointerWorld.y - position.y },
      };
      latestEventRef.current = { clientX: event.clientX, clientY: event.clientY };
      containerRef.current?.setPointerCapture?.(event.pointerId);
      clearSelection();
      scheduleUpdate();
    },
    [getStageContext, getPos, scheduleUpdate]
  );

  const stopNodeButtonPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const handleContextValue = useMemo<HandleRegistryValue>(() => ({ registerHandle, unregisterHandle }), [registerHandle, unregisterHandle]);

  const getSourceFallback = useCallback(
    (edge: EdgeSpec) => {
      const specs = outputSpecsByNode.get(edge.from) ?? [edge.sourceSpec];
      const count = specs.length || 1;
      const ratio = (edge.sourceSpec.order + 1) / (count + 1);
      const pos = getPos(edge.from);
      const x = pos.x + (edge.sourceSpec.side === "right" ? NODE_W : 0);
      const y = pos.y + ratio * NODE_H;
      return { x, y };
    },
    [getPos, outputSpecsByNode]
  );

  const getTargetFallback = useCallback(
    (nodeId: string) => {
      const pos = getPos(nodeId);
      return { x: pos.x, y: pos.y + NODE_H / 2 };
    },
    [getPos]
  );

  return (
    <HandleRegistryContext.Provider value={handleContextValue}>
      <div className="relative w-full rounded-xl border overflow-hidden bg-white" style={{ minHeight: "74vh", height: "74vh" }}>
        <div className="absolute z-20 right-3 top-3 flex gap-2 bg-white/95 backdrop-blur rounded-full border border-emerald-200 p-2 shadow-lg">
          <button
            className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition"
            onClick={() => setScaleSafe(scaleRef.current)}
          >
            🔍
          </button>
          <button
            className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition"
            onClick={() => setScaleSafe(Math.min(2.4, scaleRef.current + 0.1))}
          >
            ＋
          </button>
          <button
            className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition"
            onClick={() => setScaleSafe(Math.max(0.4, scaleRef.current - 0.1))}
          >
            －
          </button>
          <button
            className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition"
            onClick={() => {
              setPanSafe({ x: 0, y: 0 });
              setScaleSafe(1);
            }}
          >
            ⛶
          </button>
          <button
            className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition"
            onClick={() => updateNodePos(() => ({ ...autoLayout }))}
          >
            Auto-ordenar
          </button>
          <button
            className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition"
            onClick={toggleScope}
          >
            {soloRoot ? "Mostrar todo" : "Solo raíz"}
          </button>
        </div>

        <div
          ref={containerRef}
          onWheel={onWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
        >
          <div
            ref={stageRef}
            className="absolute"
            style={{
              width: SURFACE_W,
              height: SURFACE_H,
              transform: `scale(${scale}) translate(${-pan.x}px, ${-pan.y}px)`,
              transformOrigin: "0 0",
              backgroundImage: "radial-gradient(var(--grid-dot) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {edges.length > 0 && (
              <svg className="absolute z-0" width={SURFACE_W} height={SURFACE_H}>
                {edges.map((edge) => {
                  const source = handlePositions[edge.sourceHandleId] ?? getSourceFallback(edge);
                  const target = handlePositions[edge.targetHandleId] ?? getTargetFallback(edge.to);
                  const direction = target.x >= source.x ? 1 : -1;
                  const distanceX = Math.max(80, Math.abs(target.x - source.x));
                  const controlOffset = distanceX * 0.35;
                  const c1x = source.x + direction * controlOffset;
                  const c2x = target.x - direction * controlOffset;
                  const c1y = source.y;
                  const c2y = target.y;
                  const mid = cubicMid(source.x, source.y, c1x, c1y, c2x, c2y, target.x, target.y, 0.5);

                  return (
                    <g key={edge.key}>
                      <path
                        d={`M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`}
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                      />
                      <foreignObject
                        x={mid.X - 24}
                        y={mid.Y - 14}
                        width={120}
                        height={28}
                        className="pointer-events-auto"
                      >
                        <div className="flex gap-1">
                          <button
                            className="px-1.5 py-0.5 text-[11px] border rounded bg-white"
                            onPointerDown={stopNodeButtonPointerDown}
                            onClick={(event) => {
                              event.stopPropagation();
                              onInsertBetween(edge.from, edge.to);
                            }}
                          >
                            + bloque
                          </button>
                          <button
                            className="px-1.5 py-0.5 text-[11px] border rounded bg-white"
                            onPointerDown={stopNodeButtonPointerDown}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteEdge(edge.from, edge.to);
                            }}
                          >
                            borrar
                          </button>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            )}

            {nodes.map((node) => {
              const position = getPos(node.id);
              const outputSpecs = outputSpecsByNode.get(node.id) ?? [];
              const assignments = handleAssignmentsByNode.get(node.id) ?? {};
              return (
                <CanvasNode
                  key={node.id}
                  node={node}
                  position={position}
                  selected={selectedId === node.id}
                  onSelect={onSelect}
                  onNodePointerDown={onNodePointerDown}
                  onAddChild={onAddChild}
                  onDuplicateNode={onDuplicateNode}
                  onDeleteNode={onDeleteNode}
                  stopNodeButtonPointerDown={stopNodeButtonPointerDown}
                  outputSpecs={outputSpecs}
                  handleAssignments={assignments}
                  rootId={flow.rootId}
                />
              );
            })}
          </div>
        </div>
      </div>
    </HandleRegistryContext.Provider>
  );
}
type PersistedState = {
  flow: Flow;
  positions: Record<string, { x: number; y: number }>;
};

type Toast = { id: number; message: string; type: "success" | "error" };

export default function App(): JSX.Element {
  const [flow, setFlowState] = useState<Flow>(demoFlow);
  const [positionsState, setPositionsState] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedId, setSelectedId] = useState(flow.rootId);
  const [channel, setChannel] = useState<'whatsapp'|'facebook'|'instagram'|'tiktok'>("whatsapp");
  const channelTheme = useMemo(()=>{
    switch(channel){
      case 'facebook': return { name:'Facebook', from:'#dbeafe', to:'#bfdbfe', chipBg:'#e0efff', chipText:'#1e3a8a' };
      case 'instagram': return { name:'Instagram', from:'#ffe4e6', to:'#fce7f3', chipBg:'#fde2f3', chipText:'#9d174d' };
      case 'tiktok': return { name:'TikTok', from:'#cffafe', to:'#bae6fd', chipBg:'#def7ff', chipText:'#0e7490' };
      default: return { name:'WhatsApp', from:'#dcfce7', to:'#bbf7d0', chipBg:'#e8fee7', chipText:'#065f46' };
    }
  },[channel]);
  const [soloRoot, setSoloRoot] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(flow.id);
  const [toast, setToast] = useState<Toast | null>(null);

  const suppressDirtyRef = useRef(false);
  const flowRef = useRef(flow);
  const positionsRef = useRef(positionsState);
  const dirtyRef = useRef(dirty);
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => { flowRef.current = flow; }, [flow]);
  useEffect(() => { positionsRef.current = positionsState; }, [positionsState]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  const setFlow = useCallback((updater: Flow | ((prev: Flow) => Flow)) => {
    setFlowState((prev) => {
      const candidate = typeof updater === "function" ? (updater as (prev: Flow) => Flow)(prev) : updater;
      const next = normalizeFlow(candidate);
      if (!suppressDirtyRef.current && next !== prev) {
        setDirty(true);
      }
      return next;
    });
  }, []);

  const setPositions = useCallback(
    (
      updater:
        | Record<string, { x: number; y: number }>
        | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)
    ) => {
      setPositionsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)(prev)
            : updater;
        if (next === prev) return prev;
        if (!suppressDirtyRef.current) {
          setDirty(true);
        }
        return next;
      });
    },
    []
  );

  const replaceFlow = useCallback((nextFlow: Flow, nextPositions: Record<string, { x: number; y: number }> = {}) => {
    suppressDirtyRef.current = true;
    setFlowState(normalizeFlow(nextFlow));
    setPositionsState(nextPositions);
    suppressDirtyRef.current = false;
    setSelectedId(nextFlow.rootId);
    setWorkspaceId(nextFlow.id);
    setDirty(false);
  }, []);

  const selected = flow.nodes[selectedId] ?? flow.nodes[flow.rootId];
  const menuOptionsForSelected = selected.type === "menu" ? getMenuOptions(selected) : [];
  const buttonsDataForSelected = getButtonsData(selected);
  const askDataForSelected = getAskData(selected);
  const askValidationOptions =
    askDataForSelected?.validation?.type === "options" ? askDataForSelected.validation.options : [];

  const handleMenuOptionUpdate = useCallback(
    (optionId: string, patch: Partial<MenuOption>) => {
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const node = next.nodes[selectedId];
        if (!node || node.type !== "menu") return next;
        const options = getMenuOptions(node);
        const index = options.findIndex((opt) => opt.id === optionId);
        if (index >= 0) {
          options[index] = { ...options[index], ...patch };
          node.menuOptions = options;
        }
        return next;
      });
    },
    [selectedId, setFlow]
  );

  const handleAddMenuOption = useCallback(() => {
    setFlow((prev) => {
      const next: Flow = JSON.parse(JSON.stringify(prev));
      const node = next.nodes[selectedId];
      if (!node || node.type !== "menu") return next;
      const options = getMenuOptions(node);
      options.push(createMenuOption(options.length));
      node.menuOptions = options;
      return next;
    });
  }, [selectedId, setFlow]);

  const handleRemoveMenuOption = useCallback(
    (optionId: string) => {
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const node = next.nodes[selectedId];
        if (!node || node.type !== "menu") return next;
        const options = getMenuOptions(node);
        const option = options.find((opt) => opt.id === optionId);
        if (!option || option.targetId) return next;
        const remaining = options.filter((opt) => opt.id !== optionId);
        node.menuOptions = remaining.map((opt, idx) => createMenuOption(idx, opt));
        return next;
      });
    },
    [selectedId, setFlow]
  );

  const handleButtonUpdate = useCallback(
    (buttonId: string, patch: Partial<ButtonOption>) => {
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const node = next.nodes[selectedId];
        if (!node || node.action?.kind !== "buttons") return next;
        const data = normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
        const index = data.items.findIndex((item) => item.id === buttonId);
        if (index >= 0) {
          data.items[index] = { ...data.items[index], ...patch };
          node.action = { ...node.action, data };
        }
        return next;
      });
    },
    [selectedId, setFlow]
  );

  const handleAddButton = useCallback(() => {
    setFlow((prev) => {
      const next: Flow = JSON.parse(JSON.stringify(prev));
      const node = next.nodes[selectedId];
      if (!node || node.action?.kind !== "buttons") return next;
      const data = normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
      data.items.push(createButtonOption(data.items.length));
      node.action = { ...node.action, data };
      return next;
    });
  }, [selectedId, setFlow]);

  const handleRemoveButton = useCallback(
    (buttonId: string) => {
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const node = next.nodes[selectedId];
        if (!node || node.action?.kind !== "buttons") return next;
        const data = normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
        const button = data.items.find((item) => item.id === buttonId);
        if (!button || button.targetId) return next;
        data.items = data.items.filter((item) => item.id !== buttonId).map((item, idx) => createButtonOption(idx, item));
        node.action = { ...node.action, data };
        return next;
      });
    },
    [selectedId, setFlow]
  );

  const handleAskUpdate = useCallback(
    (patch: Partial<Record<string, any>>) => {
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const node = next.nodes[selectedId];
        if (!node || node.action?.kind !== "ask") return next;
        node.action = { ...node.action, data: { ...node.action.data, ...patch } };
        return next;
      });
    },
    [selectedId, setFlow]
  );

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast || typeof window === "undefined") return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const performSave = useCallback(async (message?: string) => {
    const payload: PersistedState = { flow: flowRef.current, positions: positionsRef.current };
    try {
      await saveFlow(workspaceIdRef.current, payload);
      setDirty(false);
      if (message) showToast(message, "success");
    } catch (error) {
      showToast("Error al guardar", "error");
      throw error;
    }
  }, [showToast]);

  const debouncedManualSave = useMemo(() => debounce(() => {
    performSave("Flujo guardado").catch(() => {});
  }, 300), [performSave]);

  useEffect(() => {
    return () => {
      debouncedManualSave.cancel?.();
    };
  }, [debouncedManualSave]);

  const handleSaveClick = useCallback(() => {
    debouncedManualSave();
  }, [debouncedManualSave]);

  const handleLoad = useCallback(async () => {
    try {
      const stored = await loadFlow<PersistedState>(workspaceIdRef.current);
      if (!stored || !stored.flow) {
        showToast("No se encontró un flujo guardado", "error");
        return;
      }
      replaceFlow(stored.flow, stored.positions ?? {});
      showToast("Flujo cargado", "success");
    } catch (error) {
      showToast("Error al cargar", "error");
    }
  }, [replaceFlow, showToast]);

  const handleExport = useCallback(() => {
    if (typeof window === "undefined") {
      showToast("Exportación no disponible", "error");
      return;
    }
    try {
      const state: PersistedState = { flow: flowRef.current, positions: positionsRef.current };
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${workspaceIdRef.current || "flow"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Flujo exportado", "success");
    } catch (error) {
      showToast("Error al exportar", "error");
    }
  }, [showToast]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<PersistedState>;
      if (!parsed || !parsed.flow) throw new Error("Invalid file");
      replaceFlow(parsed.flow, parsed.positions ?? {});
      showToast("Flujo importado", "success");
    } catch (error) {
      showToast("Error al importar", "error");
    } finally {
      event.target.value = "";
    }
  }, [replaceFlow, showToast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      if (!dirtyRef.current) return;
      performSave("Auto-guardado").catch(() => {});
    }, AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [performSave]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadFlow<PersistedState>(workspaceIdRef.current);
        if (!stored || !stored.flow || cancelled) return;
        replaceFlow(stored.flow, stored.positions ?? {});
        showToast("Flujo cargado", "success");
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [replaceFlow, showToast]);

  function addChildTo(parentId: string, type: NodeType) {
    const parent = flow.nodes[parentId];
    if (!parent) return;
    const nid = nextChildId(flow, parentId);
    const newNode: FlowNode = {
      id: nid,
      label: type === "menu" ? "Nuevo submenú" : "Nueva acción",
      type,
      children: [],
      action: type === "action" ? { kind: "message", data: { text: "Respuesta…" } } : undefined,
      menuOptions: type === "menu" ? [] : undefined,
    };
    let linked = false;
    setFlow((prev) => {
      const next: Flow = JSON.parse(JSON.stringify(prev));
      next.nodes[nid] = newNode;
      const parentNode = next.nodes[parentId];
      if (!parentNode) return next;

      if (parentNode.type === "menu") {
        const options = getMenuOptions(parentNode);
        let optionIndex = options.findIndex((opt) => !opt.targetId);
        if (optionIndex === -1) {
          optionIndex = options.length;
          options.push(createMenuOption(optionIndex));
        }
        options[optionIndex] = { ...options[optionIndex], targetId: nid };
        parentNode.menuOptions = options;
        linked = true;
      } else if (parentNode.action?.kind === "buttons") {
        const data = normalizeButtonsData(parentNode.action.data as Partial<ButtonsActionData> | undefined);
        let assigned = false;
        for (const item of data.items) {
          if (!item.targetId) {
            item.targetId = nid;
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          if (data.items.length < data.maxButtons) {
            const newIndex = data.items.length;
            data.items.push(createButtonOption(newIndex, { targetId: nid }));
            assigned = true;
          } else if (!data.moreTargetId) {
            data.moreTargetId = nid;
            assigned = true;
          }
        }
        if (assigned) {
          parentNode.action = { ...parentNode.action, data };
          linked = true;
        }
      } else if (parentNode.action?.kind === "ask") {
        const ask = getAskData(parentNode);
        if (ask) {
          const updated: AskActionData = { ...ask };
          if (!updated.answerTargetId) {
            updated.answerTargetId = nid;
            linked = true;
          } else if (!updated.invalidTargetId) {
            updated.invalidTargetId = nid;
            linked = true;
          }
          if (linked) {
            parentNode.action = { ...parentNode.action, data: updated };
          }
        }
      } else {
        linked = true;
      }

      if (linked) {
        parentNode.children = Array.from(new Set([...(parentNode.children ?? []), nid]));
      } else {
        delete next.nodes[nid];
      }
      return next;
    });
    if (linked) {
      setSelectedId(nid);
    }
  }

  function addActionOfKind(
    parentId: string,
    kind: "message" | "buttons" | "attachment" | "webhook_out" | "webhook_in" | "transfer" | "handoff" | "ia_rag" | "tool" | "ask"
  ) {
    const nid = nextChildId(flow, parentId);
    const defaults: Record<string, any> = {
      message: { text: "Mensaje" },
      buttons: normalizeButtonsData({
        items: [
          createButtonOption(0, { label: "Sí", value: "YES" }),
          createButtonOption(1, { label: "No", value: "NO" }),
        ],
        maxButtons: DEFAULT_BUTTON_LIMIT,
      }),
      attachment: { attType:"image", url:"", name:"archivo" },
      webhook_out: {
        method:"POST",
        url:"https://api.ejemplo.com/webhook",
        headers:[{k:"Content-Type", v:"application/json"}],
        body:'{\\n  "user_id": "{{user.id}}",\\n  "input": "{{last_message}}"\\n}',
      },
      webhook_in: { path:"/hooks/inbound", secret:"", sample:"{ id: 123, text: 'hola' }" },
      transfer: { target:"open_channel", destination:"ventas" },
      handoff: { queue:"agentes", note:"pasar a humano" },
      ia_rag: { prompt:"Buscar en base de conocimiento..." },
      tool: { name:"mi-tool", args:{} },
      ask: {
        questionText: "¿Cuál es tu respuesta?",
        varName: "respuesta",
        varType: "text",
        validation: { type: "none" },
        retryMessage: "Lo siento, ¿puedes intentarlo de nuevo?",
        answerTargetId: null,
        invalidTargetId: null,
      },
    };
    const newNode: FlowNode = {
      id: nid,
      label: `Acción · ${kind}`,
      type: "action",
      children: [],
      action: { kind: kind as ActionKind, data: defaults[kind] },
    };
    setFlow(prev=>({
      ...prev,
      nodes:{
        ...prev.nodes,
        [nid]: newNode,
        [parentId]: { ...prev.nodes[parentId], children:[...prev.nodes[parentId].children, nid] }
      }
    }));
    setSelectedId(nid);
  }

  function deleteNode(id:string){
    if (id===flow.rootId) return;
    const parentId = Object.values(flow.nodes).find(n=>n.children.includes(id))?.id;
    const next: Flow = JSON.parse(JSON.stringify(flow));
    deleteSubtree(next, id);
    for (const node of Object.values(next.nodes)){
      node.children = node.children.filter(childId=>Boolean(next.nodes[childId]));
      if (node.type === "menu" && node.menuOptions) {
        node.menuOptions = node.menuOptions.map((option, idx) =>
          createMenuOption(idx, {
            ...option,
            targetId: option.targetId && next.nodes[option.targetId] ? option.targetId : null,
          })
        );
      }
      if (node.action?.kind === "buttons") {
        const data = normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
        data.items = data.items.map((item, idx) =>
          createButtonOption(idx, {
            ...item,
            targetId: item.targetId && next.nodes[item.targetId] ? item.targetId : null,
          })
        );
        if (data.moreTargetId && !next.nodes[data.moreTargetId]) {
          data.moreTargetId = null;
        }
        node.action = { ...node.action, data };
      }
      if (node.action?.kind === "ask") {
        const ask = getAskData(node);
        if (ask) {
          const updated: AskActionData = { ...ask };
          if (updated.answerTargetId && !next.nodes[updated.answerTargetId]) {
            updated.answerTargetId = null;
          }
          if (updated.invalidTargetId && !next.nodes[updated.invalidTargetId]) {
            updated.invalidTargetId = null;
          }
          node.action = { ...node.action, data: updated };
        }
      }
    }
    setFlow(next);
    setSelectedId(parentId && next.nodes[parentId] ? parentId : next.rootId);
    setPositions((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        if (!next.nodes[key]) {
          delete updated[key];
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }

  function duplicateNode(id:string){
    const parentId = Object.values(flow.nodes).find(n=>n.children.includes(id))?.id;
    if (!parentId) return;
    const basis = flow.nodes[id];
    const nid = nextChildId(flow, parentId);
    const clone: FlowNode = JSON.parse(JSON.stringify({ ...basis, id:nid }));
    clone.children = [];
    if (clone.menuOptions) {
      clone.menuOptions = clone.menuOptions.map((option, idx) => createMenuOption(idx, { ...option, targetId: null }));
    }
    if (clone.action?.kind === "buttons") {
      const data = normalizeButtonsData(clone.action.data as Partial<ButtonsActionData> | undefined);
      data.items = data.items.map((item, idx) => createButtonOption(idx, { ...item, targetId: null }));
      data.moreTargetId = null;
      clone.action = { ...clone.action, data };
    }
    if (clone.action?.kind === "ask") {
      const ask = getAskData(clone);
      const normalized: AskActionData = ask
        ? { ...ask, answerTargetId: null, invalidTargetId: null }
        : {
            questionText: "¿Cuál es tu respuesta?",
            varName: "respuesta",
            varType: "text",
            validation: { type: "none" },
            retryMessage: "Lo siento, ¿puedes intentarlo de nuevo?",
            answerTargetId: null,
            invalidTargetId: null,
          };
      clone.action = {
        ...clone.action,
        data: normalized,
      };
    }
    setFlow((prev) => {
      const next: Flow = JSON.parse(JSON.stringify(prev));
      next.nodes[nid] = clone;
      const parentNode = next.nodes[parentId];
      if (!parentNode) return next;
      parentNode.children = Array.from(new Set([...(parentNode.children ?? []), nid]));
      if (parentNode.type === "menu") {
        const options = getMenuOptions(parentNode);
        let optionIndex = options.findIndex((opt) => !opt.targetId);
        if (optionIndex === -1) {
          optionIndex = options.length;
          options.push(createMenuOption(optionIndex));
        }
        options[optionIndex] = { ...options[optionIndex], targetId: nid };
        parentNode.menuOptions = options;
      } else if (parentNode.action?.kind === "buttons") {
        const data = normalizeButtonsData(parentNode.action.data as Partial<ButtonsActionData> | undefined);
        let assigned = false;
        for (const item of data.items) {
          if (!item.targetId) {
            item.targetId = nid;
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          if (data.items.length < data.maxButtons) {
            const newIndex = data.items.length;
            data.items.push(createButtonOption(newIndex, { targetId: nid }));
            assigned = true;
          } else if (!data.moreTargetId) {
            data.moreTargetId = nid;
            assigned = true;
          }
        }
        parentNode.action = { ...parentNode.action, data };
      } else if (parentNode.action?.kind === "ask") {
        const ask = getAskData(parentNode);
        if (ask) {
          const updated: AskActionData = { ...ask };
          if (!updated.answerTargetId) {
            updated.answerTargetId = nid;
          } else if (!updated.invalidTargetId) {
            updated.invalidTargetId = nid;
          }
          parentNode.action = { ...parentNode.action, data: updated };
        }
      }
      return next;
    });
    setSelectedId(nid);
  }

  function insertBetween(parentId:string, childId:string){
    const nid = nextChildId(flow, parentId);
    setFlow(prev=>{
      const next: Flow = JSON.parse(JSON.stringify(prev));
      next.nodes[nid] = { id:nid, label:"Nueva acción", type:"action", children:[], action:{ kind:"message", data:{text:"Mensaje"} } };
      const arr = next.nodes[parentId].children;
      const idx = arr.indexOf(childId);
      if (idx>=0){
        arr.splice(idx,1,nid);
        next.nodes[nid].children.push(childId);
        const parentNode = next.nodes[parentId];
        if (parentNode.type === "menu" && parentNode.menuOptions) {
          parentNode.menuOptions = parentNode.menuOptions.map((option, optionIdx) =>
            createMenuOption(optionIdx, {
              ...option,
              targetId: option.targetId === childId ? nid : option.targetId,
            })
          );
        } else if (parentNode.action?.kind === "buttons") {
          const data = normalizeButtonsData(parentNode.action.data as Partial<ButtonsActionData> | undefined);
          data.items = data.items.map((item, itemIdx) =>
            createButtonOption(itemIdx, {
              ...item,
              targetId: item.targetId === childId ? nid : item.targetId,
            })
          );
          if (data.moreTargetId === childId) {
            data.moreTargetId = nid;
          }
          parentNode.action = { ...parentNode.action, data };
      } else if (parentNode.action?.kind === "ask") {
        const ask = getAskData(parentNode);
        if (ask) {
          const updated: AskActionData = { ...ask };
          if (updated.answerTargetId === childId) {
            updated.answerTargetId = nid;
          } else if (updated.invalidTargetId === childId) {
            updated.invalidTargetId = nid;
          }
          parentNode.action = { ...parentNode.action, data: updated };
        }
      }
      }
      return next;
    });
  }

  function deleteEdge(parentId:string, childId:string){
    setFlow((prev) => {
      const next: Flow = JSON.parse(JSON.stringify(prev));
      const parentNode = next.nodes[parentId];
      if (!parentNode) return next;
      parentNode.children = parentNode.children.filter((c) => c !== childId);
      if (parentNode.type === "menu" && parentNode.menuOptions) {
        parentNode.menuOptions = parentNode.menuOptions.map((option, idx) =>
          createMenuOption(idx, {
            ...option,
            targetId: option.targetId === childId ? null : option.targetId,
          })
        );
      } else if (parentNode.action?.kind === "buttons") {
        const data = normalizeButtonsData(parentNode.action.data as Partial<ButtonsActionData> | undefined);
        data.items = data.items.map((item, idx) =>
          createButtonOption(idx, {
            ...item,
            targetId: item.targetId === childId ? null : item.targetId,
          })
        );
        if (data.moreTargetId === childId) {
          data.moreTargetId = null;
        }
        parentNode.action = { ...parentNode.action, data };
      } else if (parentNode.action?.kind === "ask") {
        const ask = getAskData(parentNode);
        if (ask) {
          const updated: AskActionData = { ...ask };
          if (updated.answerTargetId === childId) {
            updated.answerTargetId = null;
          }
          if (updated.invalidTargetId === childId) {
            updated.invalidTargetId = null;
          }
          parentNode.action = { ...parentNode.action, data: updated };
        }
      }
      return next;
    });
  }

  function updateSelected(patch: Partial<FlowNode>){
    setFlow(prev=>({
      ...prev,
      nodes:{ ...prev.nodes, [selectedId]: { ...prev.nodes[selectedId], ...patch } }
    }));
  }

  function seedDemo(){
    setFlow(prev=>{
      const root = prev.nodes[prev.rootId];
      if (!root || root.children.length>0) return prev;
      const next: Flow = JSON.parse(JSON.stringify(prev));
      const a = nextChildId(next, next.rootId);
      next.nodes[a] = { id:a, label:"Submenú demo", type:"menu", children:[] } as FlowNode;
      next.nodes[next.rootId].children.push(a);
      const b = nextChildId(next, next.rootId);
      next.nodes[b] = { id:b, label:"Acción demo", type:"action", children:[], action:{ kind:"message", data:{ text:"Hola 👋" } } } as FlowNode;
      next.nodes[next.rootId].children.push(b);
      setTimeout(()=>setSelectedId(a),0);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1500px] px-3 md:px-6 py-4 md:py-6 space-y-4 bg-slate-50">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-4 py-2 rounded-full shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
            {toast.message}
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1 rounded-full border bg-slate-50">Builder · Beta</span>
          <h1 className="text-lg md:text-2xl font-semibold truncate">{flow.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-emerald-50 border-emerald-200" onClick={handleSaveClick}>Guardar</button>
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-slate-100" onClick={handleLoad}>Cargar</button>
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-slate-100" onClick={handleExport}>Exportar JSON</button>
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-slate-100" onClick={handleImportClick}>Importar JSON</button>
          <button className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Publicar</button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:items-start">
        <div className="order-2 lg:order-1 lg:col-span-9 lg:col-start-1">
          <div className="border rounded-xl bg-white shadow-sm">
            <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold flex items-center justify-between">
              <span>Canvas de flujo</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>setSoloRoot(s=>!s)}>{soloRoot?"Mostrar todo":"Solo raíz"}</button>
              </div>
            </div>
            <div className="p-2" style={{ minHeight: "76vh" }}>
              <FlowCanvas
                flow={flow}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddChild={addChildTo}
                onDeleteNode={deleteNode}
                onDuplicateNode={duplicateNode}
                onInsertBetween={insertBetween}
                onDeleteEdge={deleteEdge}
                soloRoot={soloRoot}
                toggleScope={()=>setSoloRoot(s=>!s)}
                nodePositions={positionsState}
                onPositionsChange={setPositions}
              />
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-3 lg:col-start-10 lg:self-start">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="border rounded-xl bg-white shadow-sm">
              <div className="px-3 py-2 border-b text-sm font-semibold">Inspector</div>
              <div className="p-3 space-y-3 text-sm">
                <div className="text-xs text-slate-500">ID: {selected.id}</div>
                <label className="block text-xs mb-1">Etiqueta</label>
                <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" value={selected.label} onChange={(e)=>updateSelected({ label:e.target.value })} />

                <label className="block text-xs mb-1">Tipo</label>
                <select className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" value={selected.type} onChange={(e)=>updateSelected({ type: e.target.value as any })}>
                  <option value="menu">Menú</option>
                  <option value="action">Acción</option>
                </select>

                {selected.type === "menu" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Opciones del menú</span>
                      <button
                        className="px-2 py-1 border rounded bg-white hover:bg-emerald-50 border-emerald-200"
                        onClick={handleAddMenuOption}
                      >
                        + opción
                      </button>
                    </div>
                    <div className="space-y-2">
                      {menuOptionsForSelected.length === 0 && (
                        <div className="text-xs text-slate-500 border rounded p-2">Sin opciones configuradas.</div>
                      )}
                      {menuOptionsForSelected.map((option, index) => (
                        <div key={option.id} className="border rounded p-2 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>
                              {index + 1}. {option.label || `Opción ${index + 1}`}
                            </span>
                            <div className="flex items-center gap-2">
                              {option.targetId ? (
                                <button
                                  className="px-2 py-0.5 border rounded bg-emerald-50 text-emerald-700"
                                  onClick={() => option.targetId && setSelectedId(option.targetId)}
                                >
                                  Ver destino
                                </button>
                              ) : (
                                <span className="text-slate-400">sin destino</span>
                              )}
                              <button
                                className="px-2 py-0.5 border rounded"
                                disabled={Boolean(option.targetId) || menuOptionsForSelected.length <= 1}
                                onClick={() => handleRemoveMenuOption(option.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] text-slate-500">Etiqueta</label>
                            <input
                              className="w-full border rounded px-2 py-1 text-xs"
                              value={option.label}
                              onChange={(e) => handleMenuOptionUpdate(option.id, { label: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] text-slate-500">Valor</label>
                            <input
                              className="w-full border rounded px-2 py-1 text-xs"
                              value={option.value ?? ""}
                              onChange={(e) => handleMenuOptionUpdate(option.id, { value: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.type==="action" && (
                  <div className="mt-2 space-y-3">
                    <label className="block text-xs mb-1">Tipo de acción</label>
                    <select className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" value={selected.action?.kind ?? "message"} onChange={(e)=>updateSelected({ action:{ kind:e.target.value as any, data:selected.action?.data ?? {} } })}>
                      <option value="message">Mensaje</option>
                      <option value="buttons">Botones</option>
                      <option value="attachment">Adjunto</option>
                      <option value="webhook_out">Webhook OUT</option>
                      <option value="webhook_in">Webhook IN</option>
                      <option value="transfer">Transferencia</option>
                      <option value="handoff">Handoff (Humano)</option>
                      <option value="ia_rag">IA · RAG</option>
                      <option value="tool">Tool/Acción externa</option>
                      <option value="ask">Pregunta al cliente</option>
                    </select>

                    {(selected.action?.kind ?? "message")==="message" && (
                      <div>
                        <label className="block text-xs mb-1">Mensaje</label>
                        <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" value={selected.action?.data?.text ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"message", data:{ text:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind === "buttons" && buttonsDataForSelected && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span>Lista de botones</span>
                          <button
                            className="px-2 py-1 border rounded bg-white hover:bg-emerald-50 border-emerald-200"
                            onClick={handleAddButton}
                          >
                            + botón
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Máximo visible: {buttonsDataForSelected.maxButtons} · Se usa la política más restrictiva (WhatsApp/Facebook).
                        </div>
                        {buttonsDataForSelected.items.map((item, idx) => {
                          const isOverflow = idx >= buttonsDataForSelected.maxButtons;
                          return (
                            <div
                              key={item.id}
                              className={`border rounded p-2 space-y-2 ${isOverflow ? "bg-slate-50" : "bg-white"}`}
                            >
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span>
                                  Botón {idx + 1}
                                  {isOverflow ? " · Lista" : ""}
                                </span>
                                <div className="flex items-center gap-2">
                                  {item.targetId ? (
                                    <button
                                      className="px-2 py-0.5 border rounded bg-emerald-50 text-emerald-700"
                                      onClick={() => item.targetId && setSelectedId(item.targetId)}
                                    >
                                      Ver destino
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">sin destino</span>
                                  )}
                                  <button
                                    className="px-2 py-0.5 border rounded"
                                    disabled={Boolean(item.targetId)}
                                    onClick={() => handleRemoveButton(item.id)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="space-y-1">
                                  <label className="block text-[11px] text-slate-500">Etiqueta</label>
                                  <input
                                    className="w-full border rounded px-2 py-1"
                                    value={item.label}
                                    onChange={(e) => handleButtonUpdate(item.id, { label: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[11px] text-slate-500">Valor</label>
                                  <input
                                    className="w-full border rounded px-2 py-1"
                                    value={item.value}
                                    onChange={(e) => handleButtonUpdate(item.id, { value: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {buttonsDataForSelected.items.length > buttonsDataForSelected.maxButtons && (
                          <div className="border rounded p-2 text-[11px] bg-violet-50 text-violet-700 space-y-1">
                            <div className="flex items-center justify-between font-semibold">
                              <span>Opción "Lista"</span>
                              {buttonsDataForSelected.moreTargetId ? (
                                <button
                                  className="px-2 py-0.5 border rounded bg-white"
                                  onClick={() => buttonsDataForSelected.moreTargetId && setSelectedId(buttonsDataForSelected.moreTargetId)}
                                >
                                  Ver destino
                                </button>
                              ) : (
                                <span className="text-violet-500">sin destino</span>
                              )}
                            </div>
                            <div>
                              Contiene: {buttonsDataForSelected.items.slice(buttonsDataForSelected.maxButtons).map((item) => item.label).join(", ") || "(vacío)"}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selected.action?.kind === "ask" && askDataForSelected && (
                      <div className="space-y-2 text-xs">
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-500">Pregunta</label>
                          <textarea
                            className="w-full border rounded px-2 py-1 h-16"
                            value={askDataForSelected.questionText}
                            onChange={(e) => handleAskUpdate({ questionText: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] text-slate-500">Variable</label>
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={askDataForSelected.varName}
                              onChange={(e) => handleAskUpdate({ varName: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] text-slate-500">Tipo</label>
                            <select
                              className="w-full border rounded px-2 py-1"
                              value={askDataForSelected.varType}
                              onChange={(e) => handleAskUpdate({ varType: e.target.value })}
                            >
                              <option value="text">Texto</option>
                              <option value="number">Número</option>
                              <option value="option">Opción</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-500">Validación</label>
                          <select
                            className="w-full border rounded px-2 py-1"
                            value={askDataForSelected.validation?.type ?? "none"}
                            onChange={(e) => {
                              const type = e.target.value as "none" | "regex" | "options";
                              if (type === "regex") {
                                handleAskUpdate({ validation: { type: "regex", pattern: "" } });
                              } else if (type === "options") {
                                handleAskUpdate({ validation: { type: "options", options: ["Sí", "No"] } });
                              } else {
                                handleAskUpdate({ validation: { type: "none" } });
                              }
                            }}
                          >
                            <option value="none">Sin validación</option>
                            <option value="regex">Expresión regular</option>
                            <option value="options">Lista de opciones</option>
                          </select>
                        </div>
                        {askDataForSelected.validation?.type === "regex" && (
                          <div className="space-y-1">
                            <label className="block text-[11px] text-slate-500">Patrón (RegExp)</label>
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={askDataForSelected.validation.pattern}
                              onChange={(e) => handleAskUpdate({ validation: { type: "regex", pattern: e.target.value } })}
                            />
                          </div>
                        )}
                        {askDataForSelected.validation?.type === "options" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Opciones esperadas</span>
                              <button
                                className="px-2 py-0.5 border rounded"
                                onClick={() => {
                                  handleAskUpdate({
                                    validation: { type: "options", options: [...askValidationOptions, "Nueva opción"] },
                                  });
                                }}
                              >
                                + opción
                              </button>
                            </div>
                            <div className="space-y-2">
                              {askValidationOptions.map((value: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    className="flex-1 border rounded px-2 py-1"
                                    value={value}
                                    onChange={(e) => {
                                      const nextOptions = [...askValidationOptions];
                                      nextOptions[idx] = e.target.value;
                                      handleAskUpdate({ validation: { type: "options", options: nextOptions } });
                                    }}
                                  />
                                  <button
                                    className="px-2 py-0.5 border rounded"
                                    disabled={askValidationOptions.length <= 1}
                                    onClick={() => {
                                      const nextOptions = askValidationOptions.filter(
                                        (_: string, optionIdx: number) => optionIdx !== idx
                                      );
                                      handleAskUpdate({ validation: { type: "options", options: nextOptions } });
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-500">Mensaje de reintento</label>
                          <textarea
                            className="w-full border rounded px-2 py-1 h-14"
                            value={askDataForSelected.retryMessage}
                            onChange={(e) => handleAskUpdate({ retryMessage: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {selected.action?.kind==="attachment" && (
                      <div className="space-y-2">
                        <div className="flex gap-2 text-xs">
                          <select className="border rounded px-2 py-1" value={selected.action?.data?.attType ?? "image"} onChange={(e)=>updateSelected({ action:{ kind:"attachment", data:{ ...(selected.action?.data||{}), attType:e.target.value } } })}>
                            <option value="image">Imagen</option>
                            <option value="file">Archivo</option>
                            <option value="audio">Audio</option>
                            <option value="video">Video</option>
                          </select>
                          <input className="flex-1 border rounded px-2 py-1" placeholder="URL" value={selected.action?.data?.url ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"attachment", data:{ ...(selected.action?.data||{}), url:e.target.value } } })} />
                        </div>
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Nombre visible" value={selected.action?.data?.name ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"attachment", data:{ ...(selected.action?.data||{}), name:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="webhook_out" && (
                      <div className="space-y-2">
                        <div className="flex gap-2 text-xs">
                          <select className="border rounded px-2 py-1" value={selected.action?.data?.method ?? "POST"} onChange={(e)=>updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), method:e.target.value } } })}>
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                          <input className="flex-1 border rounded px-2 py-1" placeholder="https://..." value={selected.action?.data?.url ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), url:e.target.value } } })} />
                        </div>
                        <div className="text-xs">Headers</div>
                        {(selected.action?.data?.headers ?? []).map((h:any, idx:number)=>(
                          <div key={idx} className="flex gap-2 text-xs">
                            <input className="flex-1 border rounded px-2 py-1" placeholder="Clave" value={h.k} onChange={(e)=>{ const headers=[...(selected.action?.data?.headers||[])]; headers[idx] = {...headers[idx], k:e.target.value}; updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), headers } } }); }} />
                            <input className="flex-1 border rounded px-2 py-1" placeholder="Valor" value={h.v} onChange={(e)=>{ const headers=[...(selected.action?.data?.headers||[])]; headers[idx] = {...headers[idx], v:e.target.value}; updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), headers } } }); }} />
                            <button className="px-2 py-1 border rounded" onClick={()=>{ const headers=[...(selected.action?.data?.headers||[])]; headers.splice(idx,1); updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), headers } } }); }}>✕</button>
                          </div>
                        ))}
                        <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ const headers=[...(selected.action?.data?.headers||[])]; headers.push({k:"X-Key", v:"value"}); updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), headers } } }); }}>+ header</button>
                        <label className="block text-xs mt-2">Body (JSON)</label>
                        <textarea className="w-full border rounded px-2 py-1 text-xs h-24 font-mono" value={selected.action?.data?.body ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"webhook_out", data:{ ...(selected.action?.data||{}), body:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="webhook_in" && (
                      <div className="space-y-2">
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="/hooks/inbound" value={selected.action?.data?.path ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"webhook_in", data:{ ...(selected.action?.data||{}), path:e.target.value } } })} />
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Secret opcional" value={selected.action?.data?.secret ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"webhook_in", data:{ ...(selected.action?.data||{}), secret:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="transfer" && (
                      <div className="space-y-2">
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Destino" value={selected.action?.data?.destination ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"transfer", data:{ ...(selected.action?.data||{}), destination:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="handoff" && (
                      <div className="space-y-2">
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Cola" value={selected.action?.data?.queue ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"handoff", data:{ ...(selected.action?.data||{}), queue:e.target.value } } })} />
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Nota" value={selected.action?.data?.note ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"handoff", data:{ ...(selected.action?.data||{}), note:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="ia_rag" && (
                      <div className="space-y-2">
                        <textarea className="w-full border rounded px-2 py-1 text-xs h-24" placeholder="Prompt" value={selected.action?.data?.prompt ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"ia_rag", data:{ ...(selected.action?.data||{}), prompt:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="tool" && (
                      <div className="space-y-2">
                        <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Nombre del tool" value={selected.action?.data?.name ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"tool", data:{ ...(selected.action?.data||{}), name:e.target.value } } })} />
                        <textarea className="w-full border rounded px-2 py-1 text-xs h-24 font-mono" placeholder='Args JSON' value={JSON.stringify(selected.action?.data?.args ?? {}, null, 2)} onChange={(e)=>{ let val={}; try{ val=JSON.parse(e.target.value||"{}"); }catch{} updateSelected({ action:{ kind:"tool", data:{ ...(selected.action?.data||{}), args:val } } }); }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 border-b text-sm font-semibold text-slate-800" style={{ background: `linear-gradient(90deg, ${channelTheme.from}, ${channelTheme.to})` }}>Canal & vista previa</div>
              <div className="px-3 pt-3 text-sm text-slate-800">
                <div className="flex gap-2 flex-wrap text-xs">
                  <button className={`${channel==='whatsapp'?'bg-emerald-500 text-white shadow':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full transition`} onClick={()=>setChannel('whatsapp')}>WhatsApp</button>
                  <button className={`${channel==='facebook'?'bg-blue-500 text-white shadow':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full transition`} onClick={()=>setChannel('facebook')}>Facebook</button>
                  <button className={`${channel==='instagram'?'bg-pink-400 text-white shadow':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full transition`} onClick={()=>setChannel('instagram')}>Instagram</button>
                  <button className={`${channel==='tiktok'?'bg-cyan-400 text-white shadow':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full transition`} onClick={()=>setChannel('tiktok')}>TikTok</button>
                </div>
                <div className="mt-3 text-xs">
                  <span className="px-2 py-0.5 rounded" style={{ background: channelTheme.chipBg, color: channelTheme.chipText }}>{channelTheme.name} · Vista previa</span>
                </div>
                <div className="mt-3 border rounded p-2 h-40 overflow-auto">
                  <NodePreview node={selected} flow={flow} channel={channel} />
                  <div className="mt-2 text-[10px] text-slate-400">
                    Límite estricto multi-canal: {STRICTEST_LIMIT.max} botones.
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 border-b text-sm font-semibold">Agregar</div>
              <div className="p-3 flex gap-3 flex-wrap">
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addChildTo(selectedId,"menu")}>Submenú</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addChildTo(selectedId,"action")}>Acción (mensaje)</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"buttons")}>Acción · Botones</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"ask")}>Acción · Pregunta</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"attachment")}>Acción · Adjunto</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"webhook_out")}>Acción · Webhook OUT</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"webhook_in")}>Acción · Webhook IN</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"transfer")}>Acción · Transferir</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={seedDemo}>Demo rápido</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
