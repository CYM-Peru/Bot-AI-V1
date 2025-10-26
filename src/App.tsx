import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  SchedulerMode,
  SchedulerNodeData,
  CustomSchedule,
  TimeWindow,
  DateException,
  Weekday,
} from "./flow/types";
import { screenToCanvas, canvasToScreen } from "./utils/coords";
import { type NodeGeometry } from "./utils/handles";
import { createHandleScheduler } from "./utils/scheduler";
import { buildOrthogonalPath } from "./utils/edgePath";
import { findNearestHandle, type HandlePointCandidate } from "./utils/hitTest";
import { formatNextOpening, isInWindow, nextOpening, validateCustomSchedule } from "./flow/scheduler";
import { computeAutoPanDelta } from "./utils/autoPan";

const NODE_W = 300;
const NODE_H = 128;
const SURFACE_W = 4000;
const SURFACE_H = 3000;
const GRID_SIZE = 24;
const HANDLE_SNAP_TOLERANCE = 12;
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;
const AUTOPAN_MARGIN = 96;
const AUTOPAN_MAX_SPEED = 24;

const DEFAULT_TIMEZONE = "America/Lima";
const DEFAULT_SCHEDULE_WINDOW: TimeWindow = {
  weekdays: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "18:00",
  overnight: false,
};

const WEEKDAY_CHOICES: { value: Weekday; label: string; title: string }[] = [
  { value: 1, label: "L", title: "Lunes" },
  { value: 2, label: "Ma", title: "Martes" },
  { value: 3, label: "Mi", title: "Miércoles" },
  { value: 4, label: "J", title: "Jueves" },
  { value: 5, label: "V", title: "Viernes" },
  { value: 6, label: "S", title: "Sábado" },
  { value: 7, label: "D", title: "Domingo" },
];

function sanitizeWeekdays(weekdays: Weekday[] | undefined): Weekday[] {
  if (!Array.isArray(weekdays)) {
    return [...DEFAULT_SCHEDULE_WINDOW.weekdays];
  }
  const filtered = weekdays.filter((day): day is Weekday => typeof day === "number" && day >= 1 && day <= 7);
  return Array.from(new Set(filtered));
}

function sanitizeTimeWindow(window: Partial<TimeWindow> | undefined): TimeWindow {
  if (!window) {
    return { ...DEFAULT_SCHEDULE_WINDOW };
  }
  const weekdayList = window.weekdays === undefined ? DEFAULT_SCHEDULE_WINDOW.weekdays : sanitizeWeekdays(window.weekdays);
  return {
    weekdays: weekdayList,
    start: typeof window.start === "string" && window.start.trim() ? window.start : DEFAULT_SCHEDULE_WINDOW.start,
    end: typeof window.end === "string" && window.end.trim() ? window.end : DEFAULT_SCHEDULE_WINDOW.end,
    overnight: Boolean(window.overnight),
  };
}

function sanitizeExceptions(exceptions: DateException[] | undefined): DateException[] {
  if (!exceptions) return [];
  return exceptions
    .filter((item) => typeof item?.date === "string" && item.date.trim().length > 0)
    .map((item) => ({
      date: item.date,
      closed: Boolean(item.closed),
      start: item.start,
      end: item.end,
    }));
}

export function normalizeSchedulerData(data?: Partial<SchedulerNodeData> | null): SchedulerNodeData {
  const mode: SchedulerMode = data?.mode === "bitrix" ? "bitrix" : "custom";
  const baseCustom: CustomSchedule = {
    timezone: typeof data?.custom?.timezone === "string" ? data.custom.timezone : DEFAULT_TIMEZONE,
    windows:
      data?.custom?.windows && data.custom.windows.length > 0
        ? data.custom.windows.map((window) => sanitizeTimeWindow(window))
        : [sanitizeTimeWindow(undefined)],
    exceptions: sanitizeExceptions(data?.custom?.exceptions),
  };
  return {
    mode,
    custom: mode === "custom" ? baseCustom : data?.custom ?? baseCustom,
    inWindowTargetId: typeof data?.inWindowTargetId === "string" ? data.inWindowTargetId : null,
    outOfWindowTargetId: typeof data?.outOfWindowTargetId === "string" ? data.outOfWindowTargetId : null,
  };
}

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

export function convertButtonsOverflowToList(flow: Flow, nodeId: string): { nextFlow: Flow; listNodeId: string | null } {
  const source = flow.nodes[nodeId];
  if (!source || source.action?.kind !== "buttons") {
    return { nextFlow: flow, listNodeId: null };
  }
  const normalized = normalizeButtonsData(source.action.data as Partial<ButtonsActionData> | undefined);
  if (normalized.items.length <= normalized.maxButtons) {
    return { nextFlow: flow, listNodeId: null };
  }
  const overflowItems = normalized.items.slice(normalized.maxButtons);
  if (overflowItems.length === 0) {
    return { nextFlow: flow, listNodeId: null };
  }
  const next: Flow = JSON.parse(JSON.stringify(flow));
  const target = next.nodes[nodeId];
  if (!target || target.action?.kind !== "buttons") {
    return { nextFlow: flow, listNodeId: null };
  }
  const listNodeId = nextChildId(next, nodeId);
  const listOptions = overflowItems.map((item, idx) =>
    createMenuOption(idx, { label: item.label, value: item.value, targetId: item.targetId ?? null })
  );
  const listNode: FlowNode = {
    id: listNodeId,
    label: `${target.label} · Lista`,
    type: "menu",
    children: listOptions.map((option) => option.targetId).filter((id): id is string => Boolean(id)),
    menuOptions: listOptions,
  } as FlowNode;
  next.nodes[listNodeId] = listNode;
  const trimmedItems = normalized.items.slice(0, normalized.maxButtons);
  target.action = {
    ...target.action,
    data: { ...normalized, items: trimmedItems, moreTargetId: listNodeId },
  };
  target.children = Array.from(
    new Set([...(target.children ?? []), listNodeId, ...listNode.children])
  );
  return { nextFlow: normalizeFlow(next), listNodeId };
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

  if (node.action?.kind === "scheduler") {
    const data = node.action.data as Partial<SchedulerNodeData> | undefined;
    const normalized = normalizeSchedulerData(data ?? undefined);
    const childSet = new Set(node.children ?? []);
    if (normalized.inWindowTargetId) childSet.add(normalized.inWindowTargetId);
    if (normalized.outOfWindowTargetId) childSet.add(normalized.outOfWindowTargetId);
    const childList = Array.from(childSet);
    const dataChanged =
      (data?.mode === "bitrix" ? "bitrix" : "custom") !== normalized.mode ||
      (normalized.custom?.timezone ?? DEFAULT_TIMEZONE) !==
        (typeof data?.custom?.timezone === "string" ? data.custom.timezone : DEFAULT_TIMEZONE) ||
      JSON.stringify((data?.custom?.windows ?? []).map((window) => sanitizeTimeWindow(window))) !==
        JSON.stringify(normalized.custom?.windows ?? []) ||
      JSON.stringify(sanitizeExceptions(data?.custom?.exceptions)) !==
        JSON.stringify(normalized.custom?.exceptions ?? []) ||
      (typeof data?.inWindowTargetId === "string" ? data.inWindowTargetId : null) !== normalized.inWindowTargetId ||
      (typeof data?.outOfWindowTargetId === "string" ? data.outOfWindowTargetId : null) !== normalized.outOfWindowTargetId;
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
  const version = typeof flow.version === "number" ? flow.version : 1;
  if (!mutated && version === flow.version) return flow;
  return { ...flow, version, nodes };
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

export function getSchedulerData(node: FlowNode): SchedulerNodeData | null {
  if (node.action?.kind !== "scheduler") return null;
  const data = node.action.data as Partial<SchedulerNodeData> | undefined;
  return normalizeSchedulerData(data ?? undefined);
}

function applyHandleAssignment(flow: Flow, sourceId: string, handleId: string, targetId: string | null): boolean {
  const node = flow.nodes[sourceId];
  if (!node) return false;

  if (node.type === "menu" && handleId.startsWith("out:menu:")) {
    const options = getMenuOptions(node);
    const index = options.findIndex((option) => `out:menu:${option.id}` === handleId);
    if (index === -1) return false;
    const current = options[index].targetId ?? null;
    if (current === targetId) return false;
    options[index] = { ...options[index], targetId };
    node.menuOptions = options;
    const children = new Set<string>();
    for (const option of options) {
      if (option.targetId) {
        children.add(option.targetId);
      }
    }
    node.children = Array.from(children);
    return true;
  }

  if (node.action?.kind === "buttons" && handleId.startsWith("out:button:")) {
    const data = normalizeButtonsData(node.action.data as Partial<ButtonsActionData> | undefined);
    const token = handleId.split(":")[2];
    if (!token) return false;
    if (token === "more") {
      const current = data.moreTargetId ?? null;
      if (current === targetId) return false;
      data.moreTargetId = targetId;
    } else {
      const index = data.items.findIndex((item) => item.id === token);
      if (index === -1) return false;
      const current = data.items[index].targetId ?? null;
      if (current === targetId) return false;
      data.items[index] = { ...data.items[index], targetId };
    }
    node.action = { ...node.action, data };
    const children = new Set<string>();
    for (const item of data.items) {
      if (item.targetId) {
        children.add(item.targetId);
      }
    }
    if (data.moreTargetId) {
      children.add(data.moreTargetId);
    }
    node.children = Array.from(children);
    return true;
  }

  if (node.action?.kind === "ask") {
    const ask = getAskData(node);
    if (!ask) return false;
    const updated: AskActionData = { ...ask };
    if (handleId === "out:answer") {
      if (updated.answerTargetId === targetId) return false;
      updated.answerTargetId = targetId;
    } else if (handleId === "out:invalid") {
      if (updated.invalidTargetId === targetId) return false;
      updated.invalidTargetId = targetId;
    } else {
      return false;
    }
    node.action = { ...node.action, data: updated };
    const children = new Set<string>();
    if (updated.answerTargetId) children.add(updated.answerTargetId);
    if (updated.invalidTargetId) children.add(updated.invalidTargetId);
    node.children = Array.from(children);
    return true;
  }

  if (node.action?.kind === "scheduler") {
    const scheduler = getSchedulerData(node);
    if (!scheduler) return false;
    const updated = { ...scheduler };
    const previousIn = scheduler.inWindowTargetId;
    const previousOut = scheduler.outOfWindowTargetId;
    if (handleId === "out:schedule:in") {
      if (updated.inWindowTargetId === targetId) return false;
      updated.inWindowTargetId = targetId;
    } else if (handleId === "out:schedule:out") {
      if (updated.outOfWindowTargetId === targetId) return false;
      updated.outOfWindowTargetId = targetId;
    } else {
      return false;
    }
    node.action = { ...node.action, data: updated };
    const childSet = new Set(node.children ?? []);
    if (previousIn && previousIn !== updated.inWindowTargetId) childSet.delete(previousIn);
    if (previousOut && previousOut !== updated.outOfWindowTargetId) childSet.delete(previousOut);
    if (updated.inWindowTargetId) childSet.add(updated.inWindowTargetId);
    if (updated.outOfWindowTargetId) childSet.add(updated.outOfWindowTargetId);
    node.children = Array.from(childSet);
    return true;
  }

  if (handleId === "out:default") {
    const current = node.children?.[0] ?? null;
    if (current === targetId) return false;
    node.children = targetId ? [targetId] : [];
    return true;
  }

  if (!targetId) {
    return false;
  }

  const existing = new Set(node.children ?? []);
  if (existing.has(targetId)) return false;
  existing.add(targetId);
  node.children = Array.from(existing);
  return true;
}

type HandleSpec = {
  id: string;
  label: string;
  side: "left" | "right";
  type: "input" | "output";
  order: number;
  variant?: "default" | "more" | "invalid" | "answer";
};

const INPUT_HANDLE_SPEC: HandleSpec = {
  id: "in",
  label: "Entrada",
  side: "left",
  type: "input",
  order: 0,
  variant: "default",
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

  if (node.action?.kind === "scheduler") {
    const scheduler = getSchedulerData(node);
    if (!scheduler) return null;
    const schedule = scheduler.mode === "custom" ? scheduler.custom : undefined;
    const errors = scheduler.mode === "custom" ? validateCustomSchedule(schedule) : [];
    const now = new Date();
    const openNow = schedule ? isInWindow(now, schedule) : false;
    const nextSlot = schedule ? formatNextOpening(nextOpening(now, schedule)) : null;
    return (
      <div className="space-y-1 text-[11px]">
        <div className="text-xs font-semibold text-slate-700">Scheduler</div>
        <div className="text-slate-600">Zona horaria: {schedule?.timezone ?? ""}</div>
        <div className={`font-medium ${openNow ? "text-emerald-600" : "text-amber-600"}`}>
          {openNow ? "Abierto ahora" : "Fuera de horario"}
        </div>
        {nextSlot && (
          <div className="text-slate-500">Próxima ventana: {nextSlot}</div>
        )}
        {errors.length > 0 && (
          <ul className="text-rose-500 list-disc list-inside space-y-0.5">
            {errors.slice(0, 2).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (node.action?.kind === "message") {
    const rawText = typeof node.action?.data?.text === "string" ? node.action.data.text : "";
    const trimmed = rawText.trim();
    return (
      <div className="text-[11px] space-y-1">
        <div className="text-xs font-semibold text-slate-700">Mensaje</div>
        <div className={trimmed ? "text-slate-600" : "text-rose-600 font-medium"}>
          {trimmed || "Mensaje sin contenido"}
        </div>
        {!trimmed && <div className="text-[10px] text-rose-500">Completa este mensaje para publicar.</div>}
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
  const scheduler = getSchedulerData(node);
  if (scheduler) {
    return [
      { id: "out:schedule:in", label: "Dentro de horario", side: "right", type: "output", order: 0, variant: "default" },
      { id: "out:schedule:out", label: "Fuera de horario", side: "right", type: "output", order: 1, variant: "default" },
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
  const scheduler = getSchedulerData(node);
  if (scheduler) {
    return {
      "out:schedule:in": scheduler.inWindowTargetId ?? null,
      "out:schedule:out": scheduler.outOfWindowTargetId ?? null,
    };
  }
  return { "out:default": node.children[0] ?? null };
}

const demoFlow: Flow = normalizeFlow({
  version: 1,
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
type EdgeSpec = {
  key: string;
  from: string;
  to: string;
  sourceHandleId: string;
  targetHandleId: string;
  sourceSpec: HandleSpec;
  sourceCount: number;
};

type ConnectionCreationKind = "menu" | "message" | "buttons" | "ask";

type ConnectionPromptState = {
  sourceId: string;
  handleId: string;
  spec: HandleSpec;
  anchor: { x: number; y: number };
  currentTargetId: string | null;
};

type NodeHandlePointProps = {
  nodeId: string;
  handleKey: string;
  spec: HandleSpec;
  positionPercent: number;
  isConnected: boolean;
  onStartConnection?: (event: React.PointerEvent<HTMLElement>) => void;
};

const NodeHandlePoint: React.FC<NodeHandlePointProps> = ({
  nodeId,
  handleKey,
  spec,
  positionPercent,
  isConnected,
  onStartConnection,
}) => {
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
      data-handle={spec.id}
      className={`absolute ${sideClass} -translate-y-1/2 w-4 h-4 rounded-full border ${variantClass} ${connectedClass}`}
      style={{ top: `${positionPercent * 100}%` }}
      title={spec.label}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (spec.type === "output" && onStartConnection) {
          onStartConnection(event);
        }
      }}
    />
  );
};

type FlowCanvasNodeProps = {
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
  onStartConnection: (
    nodeId: string,
    spec: HandleSpec,
    event: React.PointerEvent<HTMLElement>
  ) => void;
  onSizeChange: (nodeId: string, size: { width: number; height: number }) => void;
  duplicatePending: boolean;
  hasValidationError: boolean;
};

const FlowCanvasNode = React.memo((props: FlowCanvasNodeProps) => {
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
    onStartConnection,
    onSizeChange,
    duplicatePending,
    hasValidationError,
  } = props;
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const badge = node.type === "menu" ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-violet-50 border-violet-300 text-violet-600";
  const icon = node.type === "menu" ? "🟢" : "🔗";
  const outputCount = outputSpecs.length || 1;
  const inputSpec = INPUT_HANDLE_SPEC;
  const buttonData = node.action?.kind === "buttons" ? getButtonsData(node) : null;
  const overflowCount = buttonData && buttonData.items.length > buttonData.maxButtons
    ? buttonData.items.length - buttonData.maxButtons
    : 0;
  const borderClass = hasValidationError ? "border-rose-300" : "border-slate-300";
  const ringClass = hasValidationError
    ? "ring-2 ring-rose-400 shadow-rose-100"
    : selected
    ? "ring-2 ring-emerald-500 shadow-emerald-200"
    : "hover:ring-1 hover:ring-emerald-200";

  useEffect(() => {
    const element = nodeRef.current;
    if (!element) return;

    const report = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const next = { width, height };
      onSizeChange(node.id, next);
    };

    report();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        report();
      });
      observer.observe(element);
      return () => observer.disconnect();
    }

    return () => {
      /* noop */
    };
  }, [node.id, onSizeChange]);

  return (
    <div
      ref={nodeRef}
      key={node.id}
      data-node="true"
      className={`absolute w-[300px] rounded-2xl border-2 bg-white shadow-lg transition ${borderClass} ${ringClass} relative`}
      style={{ left: position.x, top: position.y, cursor: "move" }}
      onPointerDown={onNodePointerDown(node.id)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
    >
      <NodeHandlePoint
        nodeId={node.id}
        handleKey={`${node.id}:${inputSpec.id}`}
        spec={inputSpec}
        positionPercent={0.5}
        isConnected={true}
      />
      {outputSpecs.map((spec) => {
        const positionPercent = (spec.order + 1) / (outputCount + 1);
        return (
            <NodeHandlePoint
              key={spec.id}
              nodeId={node.id}
              handleKey={`${node.id}:${spec.id}`}
              spec={spec}
              positionPercent={positionPercent}
              isConnected={Boolean(handleAssignments[spec.id])}
              onStartConnection={(event) => onStartConnection(node.id, spec, event)}
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
            <span className="inline-flex items-center gap-1">
              {duplicatePending && (
                <span
                  className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                  aria-hidden="true"
                />
              )}
              <span>duplicar</span>
            </span>
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
      <div className={`px-3 pb-3 text-xs ${hasValidationError ? "text-rose-600" : "text-slate-500"}`}>
        {node.type === "menu"
          ? `${(node.menuOptions ?? []).length} opción(es)`
          : buttonData
          ? `${buttonData.items.length} botón(es)${overflowCount ? ` · ${overflowCount} en lista` : ""}`
          : node.action?.kind ?? "acción"}
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
  onDuplicateNode: (id: string) => void | Promise<void>;
  onInsertBetween: (parentId: string, childId: string) => void;
  onDeleteEdge: (parentId: string, childId: string) => void;
  onConnectHandle: (sourceId: string, handleId: string, targetId: string | null) => boolean;
  onCreateForHandle: (sourceId: string, handleId: string, kind: ConnectionCreationKind) => string | null;
  onInvalidConnection: (message: string) => void;
  invalidMessageIds: Set<string>;
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
    onConnectHandle,
    onCreateForHandle,
    onInvalidConnection,
    invalidMessageIds,
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
          sourceCount: specs.length || 1,
        });
      }
    }
    return list;
  }, [nodes, outputSpecsByNode, handleAssignmentsByNode, visibleSet]);

  const [scale, setScaleState] = useState(1);
  const [pan, setPanState] = useState({ x: 0, y: 0 });
  const [nodeSizes, setNodeSizes] = useState<Record<string, { width: number; height: number }>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  const [connectionPrompt, setConnectionPrompt] = useState<ConnectionPromptState | null>(null);
  const connectionPromptRef = useRef<HTMLDivElement | null>(null);

  type PointerState =
    | { type: "pan"; pointerId: number; startClient: { x: number; y: number }; startPan: { x: number; y: number } }
    | { type: "drag-node"; pointerId: number; nodeId: string; offset: { x: number; y: number } }
    | {
        type: "drag-connection";
        pointerId: number;
        nodeId: string;
        handleId: string;
        handleKey: string;
        spec: HandleSpec;
        anchorClient: { x: number; y: number };
      };

  type HandleRecomputeReason = "move" | "zoom" | "scroll" | "resize";
  type ConnectionDraft = {
    sourceId: string;
    handleId: string;
    handleKey: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    targetHandleKey: string | null;
  };

  const pointerState = useRef<PointerState | null>(null);
  const latestEventRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const pointerSchedulerRef = useRef(createHandleScheduler(() => {}));
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const connectionDraftRef = useRef(connectionDraft);
  const [pendingDuplicateId, setPendingDuplicateId] = useState<string | null>(null);

  function scheduleHandleRecompute(_reason: HandleRecomputeReason = "move"): void {
    /* handle anchors derive directly from node geometry */
  }

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    connectionDraftRef.current = connectionDraft;
  }, [connectionDraft]);

  const setScaleSafe = useCallback(
    (next: number) => {
      scaleRef.current = next;
      setScaleState(next);
      scheduleHandleRecompute("zoom");
    },
    [scheduleHandleRecompute]
  );

  const setPanSafe = useCallback(
    (next: { x: number; y: number }) => {
      panRef.current = next;
      setPanState(next);
      scheduleHandleRecompute("scroll");
    },
    [scheduleHandleRecompute]
  );

  const maybeAutoPan = useCallback(
    (clientX: number, clientY: number) => {
      const viewportEl = containerRef.current;
      if (!viewportEl) return false;

      const rect = viewportEl.getBoundingClientRect();
      const { dx, dy } = computeAutoPanDelta({
        clientX,
        clientY,
        rect,
        margin: AUTOPAN_MARGIN,
        maxSpeed: AUTOPAN_MAX_SPEED,
      });

      if (dx === 0 && dy === 0) {
        return false;
      }

      const currentScale = scaleRef.current || 1;
      const next = {
        x: panRef.current.x - dx / currentScale,
        y: panRef.current.y - dy / currentScale,
      };

      if (
        Math.abs(next.x - panRef.current.x) < 0.001 &&
        Math.abs(next.y - panRef.current.y) < 0.001
      ) {
        return false;
      }

      setPanSafe(next);
      return true;
    },
    [setPanSafe]
  );

  useEffect(() => {
    if (!connectionPrompt) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!connectionPromptRef.current) return;
      const target = event.target as Node | null;
      if (target && connectionPromptRef.current.contains(target)) return;
      setConnectionPrompt(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnectionPrompt(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [connectionPrompt]);

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
    let needsUpdate = false;
    const missing: Record<string, { x: number; y: number }> = {};
    for (const id of Object.keys(autoLayout)) {
      if (!nodePositions[id]) {
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
  }, [autoLayout, nodePositions, onPositionsChange]);

  const getPos = useCallback(
    (id: string) => nodePositions[id] ?? autoLayout[id] ?? { x: 0, y: 0 },
    [nodePositions, autoLayout]
  );

  const getHandlePercent = useCallback(
    (nodeId: string, spec: HandleSpec): number => {
      if (spec.type === "input") {
        return 0.5;
      }
      const specs = outputSpecsByNode.get(nodeId) ?? [];
      if (specs.length === 0) {
        return 0.5;
      }
      const match = specs.find((candidate) => candidate.id === spec.id);
      const order = match ? match.order : spec.order;
      const divisor = specs.length + 1;
      return divisor > 0 ? (order + 1) / divisor : 0.5;
    },
    [outputSpecsByNode]
  );

  const getNodeGeometry = useCallback(
    (id: string): NodeGeometry => {
      const position = getPos(id);
      const size = nodeSizes[id] ?? { width: NODE_W, height: NODE_H };
      return { position, size };
    },
    [getPos, nodeSizes]
  );

  const getHandlePoint = useCallback(
    (nodeId: string, spec: HandleSpec): { x: number; y: number } => {
      const geometry = getNodeGeometry(nodeId);
      const percent = getHandlePercent(nodeId, spec);
      const baseX = geometry.position.x;
      const baseY = geometry.position.y;
      const width = geometry.size.width;
      const height = geometry.size.height;
      const x = spec.side === "left" ? baseX : baseX + width;
      const y = baseY + height * percent;
      return { x, y };
    },
    [getHandlePercent, getNodeGeometry]
  );

  const buildInputCandidates = useCallback((): HandlePointCandidate[] => {
    return nodes.map((node) => {
      const point = getHandlePoint(node.id, INPUT_HANDLE_SPEC);
      return {
        id: `${node.id}:${INPUT_HANDLE_SPEC.id}`,
        nodeId: node.id,
        type: "input",
        x: point.x,
        y: point.y,
      };
    });
  }, [nodes, getHandlePoint]);

  const handleStartConnection = useCallback(
    (nodeId: string, spec: HandleSpec, event: React.PointerEvent<HTMLElement>) => {
      if (spec.type !== "output") return;
      const viewportEl = containerRef.current;
      if (!viewportEl) return;
      setConnectionPrompt(null);
      const viewportState = { x: panRef.current.x, y: panRef.current.y, zoom: scaleRef.current };
      const origin = getHandlePoint(nodeId, spec);
      const anchorClient = canvasToScreen(origin.x, origin.y, viewportEl, viewportState);
      pointerState.current = {
        type: "drag-connection",
        pointerId: event.pointerId,
        nodeId,
        handleId: spec.id,
        handleKey: `${nodeId}:${spec.id}`,
        spec,
        anchorClient: { x: anchorClient.clientX, y: anchorClient.clientY },
      };
      latestEventRef.current = { clientX: event.clientX, clientY: event.clientY };
      viewportEl.setPointerCapture?.(event.pointerId);
      setConnectionDraft({
        sourceId: nodeId,
        handleId: spec.id,
        handleKey: `${nodeId}:${spec.id}`,
        from: origin,
        to: origin,
        targetHandleKey: null,
      });
      pointerSchedulerRef.current.schedule();
      scheduleHandleRecompute("move");
    },
    [getHandlePoint, scheduleHandleRecompute]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const result = onDuplicateNode(id);
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        setPendingDuplicateId(id);
        Promise.resolve(result).finally(() => {
          setPendingDuplicateId((current) => (current === id ? null : current));
        });
      }
    },
    [onDuplicateNode]
  );

  const handleConnectSelection = useCallback(
    (targetId: string | null) => {
      setConnectionPrompt((prev) => {
        if (!prev) return prev;
        const success = onConnectHandle(prev.sourceId, prev.handleId, targetId);
        if (success) {
          scheduleHandleRecompute("move");
          return null;
        }
        return prev;
      });
    },
    [onConnectHandle, scheduleHandleRecompute]
  );

  const handleCreateSelection = useCallback(
    (kind: ConnectionCreationKind) => {
      setConnectionPrompt((prev) => {
        if (!prev) return prev;
        const createdId = onCreateForHandle(prev.sourceId, prev.handleId, kind);
        return createdId ? null : prev;
      });
    },
    [onCreateForHandle]
  );

  const targetOptions = useMemo(() => {
    if (!connectionPrompt) return [];
    return Object.values(flow.nodes)
      .filter((node) => node.id !== connectionPrompt.sourceId)
      .map((node) => ({
        id: node.id,
        label: node.label,
        descriptor:
          node.type === "menu"
            ? "Menú"
            : node.action?.kind
            ? `Acción · ${node.action.kind}`
            : "Acción",
      }));
  }, [connectionPrompt, flow.nodes]);

  const handleNodeSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setNodeSizes((prev) => {
      const current = prev[id];
      if (current && Math.abs(current.width - size.width) < 0.5 && Math.abs(current.height - size.height) < 0.5) {
        return prev;
      }
      return { ...prev, [id]: size };
    });
    scheduleHandleRecompute("resize");
  }, []);

  const applyPointerUpdate = useCallback(() => {
    const evt = latestEventRef.current;
    const state = pointerState.current;
    if (!evt || !state) return;
    if (state.type === "drag-connection") {
      const viewportEl = containerRef.current;
      if (!viewportEl) return;
      const autoPanned = maybeAutoPan(evt.clientX, evt.clientY);
      if (autoPanned) {
        pointerSchedulerRef.current.schedule();
      }
      const viewportState = { x: panRef.current.x, y: panRef.current.y, zoom: scaleRef.current };
      const pointerWorld = screenToCanvas(evt.clientX, evt.clientY, viewportEl, viewportState);
      const origin = getHandlePoint(state.nodeId, state.spec);
      const candidates = buildInputCandidates();
      const hit = findNearestHandle(
        pointerWorld,
        candidates,
        HANDLE_SNAP_TOLERANCE,
        (candidate) => candidate.type === "input" && candidate.id !== state.handleKey
      );
      setConnectionDraft({
        sourceId: state.nodeId,
        handleId: state.handleId,
        handleKey: state.handleKey,
        from: origin,
        to: hit ? { x: hit.handle.x, y: hit.handle.y } : pointerWorld,
        targetHandleKey: hit ? hit.handle.id : null,
      });
      return;
    }

    if (state.type === "drag-node") {
      const viewportEl = containerRef.current;
      if (!viewportEl) return;
      const autoPanned = maybeAutoPan(evt.clientX, evt.clientY);
      if (autoPanned) {
        pointerSchedulerRef.current.schedule();
      }
      const viewportState = { x: panRef.current.x, y: panRef.current.y, zoom: scaleRef.current };
      const pointerWorld = screenToCanvas(evt.clientX, evt.clientY, viewportEl, viewportState);
      const nx = pointerWorld.x - state.offset.x;
      const ny = pointerWorld.y - state.offset.y;
      updateNodePos((prev) => {
        const current = prev[state.nodeId];
        if (current && Math.abs(current.x - nx) < 0.1 && Math.abs(current.y - ny) < 0.1) {
          return prev;
        }
        const next = { ...prev, [state.nodeId]: { x: nx, y: ny } };
        return next;
      });
    } else if (state.type === "pan") {
      const { startClient, startPan } = state;
      const currentScale = scaleRef.current || 1;
      const dx = (evt.clientX - startClient.x) / currentScale;
      const dy = (evt.clientY - startClient.y) / currentScale;
      setPanSafe({ x: startPan.x - dx, y: startPan.y - dy });
    }
  }, [maybeAutoPan, setPanSafe, updateNodePos, setConnectionDraft]);

  useEffect(() => {
    pointerSchedulerRef.current.setCallback(applyPointerUpdate);
    return () => {
      pointerSchedulerRef.current.cancel();
    };
  }, [applyPointerUpdate]);

  const stopPointer = useCallback((pointerId: number) => {
    const current = pointerState.current;
    if (current?.pointerId !== pointerId) return;
    pointerState.current = null;
    if (current.type === "drag-connection") {
      setConnectionDraft(null);
    }
    latestEventRef.current = null;
    pointerSchedulerRef.current.cancel();
    const container = containerRef.current;
    container?.releasePointerCapture?.(pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerState.current || pointerState.current.pointerId !== event.pointerId) return;
      latestEventRef.current = { clientX: event.clientX, clientY: event.clientY };
      clearSelection();
      pointerSchedulerRef.current.schedule();
      scheduleHandleRecompute("move");
    },
    [clearSelection, scheduleHandleRecompute]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = pointerState.current;
      if (state?.pointerId === event.pointerId && state.type === "drag-connection") {
        const draft = connectionDraftRef.current;
        setConnectionDraft(null);
        if (draft?.targetHandleKey) {
          const targetId = draft.targetHandleKey.split(":")[0];
          if (!onConnectHandle(state.nodeId, state.handleId, targetId)) {
            onInvalidConnection("No se pudo conectar el bloque seleccionado");
          } else {
            scheduleHandleRecompute("move");
          }
        } else {
          onInvalidConnection("Conecta el enlace a un puerto válido");
          const viewportEl = containerRef.current;
          const viewportState = { x: panRef.current.x, y: panRef.current.y, zoom: scaleRef.current };
          const handlePoint = getHandlePoint(state.nodeId, state.spec);
          const anchorScreen = viewportEl
            ? canvasToScreen(handlePoint.x, handlePoint.y, viewportEl, viewportState)
            : { clientX: state.anchorClient.x, clientY: state.anchorClient.y };
          const containerRect = viewportEl?.getBoundingClientRect();
          const anchor = {
            x: anchorScreen.clientX - (containerRect?.left ?? 0),
            y: anchorScreen.clientY - (containerRect?.top ?? 0),
          };
          const assignments = handleAssignmentsByNode.get(state.nodeId) ?? {};
          setConnectionPrompt({
            sourceId: state.nodeId,
            handleId: state.handleId,
            spec: state.spec,
            anchor,
            currentTargetId: assignments[state.handleId] ?? null,
          });
          scheduleHandleRecompute("move");
        }
      }
      stopPointer(event.pointerId);
    },
    [
      stopPointer,
      onConnectHandle,
      onInvalidConnection,
      handleAssignmentsByNode,
      getHandlePoint,
      scheduleHandleRecompute,
    ]
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
      setConnectionDraft(null);
      scheduleHandleRecompute("move");
      stopPointer(event.pointerId);
    },
    [stopPointer, scheduleHandleRecompute]
  );

  const onNodePointerDown = useCallback(
    (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const viewportEl = containerRef.current;
      if (!viewportEl) return;
      const viewportState = { x: panRef.current.x, y: panRef.current.y, zoom: scaleRef.current };
      const pointerWorld = screenToCanvas(event.clientX, event.clientY, viewportEl, viewportState);
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
      pointerSchedulerRef.current.schedule();
      scheduleHandleRecompute("move");
    },
    [clearSelection, getPos, scheduleHandleRecompute]
  );

  const stopCanvasButtonPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const gridStyle = useMemo<React.CSSProperties>(() => {
    const scaledSize = GRID_SIZE * scale;
    const offsetX = ((-pan.x * scale) % scaledSize + scaledSize) % scaledSize;
    const offsetY = ((-pan.y * scale) % scaledSize + scaledSize) % scaledSize;

    return {
      backgroundImage: "radial-gradient(var(--grid-dot) 1px, transparent 1px)",
      backgroundSize: `${scaledSize}px ${scaledSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
  }, [pan.x, pan.y, scale]);

  return (
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
          style={gridStyle}
        >
          <div
            className="absolute"
            style={{
              width: SURFACE_W,
              height: SURFACE_H,
              transform: `scale(${scale}) translate(${-pan.x}px, ${-pan.y}px)`,
              transformOrigin: "0 0",
            }}
          >
            {(edges.length > 0 || connectionDraft) && (
              <svg className="absolute z-0" width={SURFACE_W} height={SURFACE_H}>
                {edges.map((edge) => {
                  const source = getHandlePoint(edge.from, edge.sourceSpec);
                  const target = getHandlePoint(edge.to, INPUT_HANDLE_SPEC);
                  const label = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
                  const overlayRect = {
                    left: label.x - 60,
                    right: label.x + 60,
                    top: label.y - 18,
                    bottom: label.y + 18,
                  };
                  const pathD = buildOrthogonalPath(source, target, {
                    avoid: overlayRect,
                    padding: 12,
                  });

                  return (
                    <g key={edge.key}>
                      <path
                        d={pathD}
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                      />
                      <foreignObject
                        x={overlayRect.left}
                        y={overlayRect.top}
                        width={overlayRect.right - overlayRect.left}
                        height={overlayRect.bottom - overlayRect.top}
                        className="pointer-events-auto"
                      >
                        <div className="flex gap-1">
                          <button
                            className="px-1.5 py-0.5 text-[11px] border rounded bg-white"
                            onPointerDown={stopCanvasButtonPointerDown}
                            onClick={(event) => {
                              event.stopPropagation();
                              onInsertBetween(edge.from, edge.to);
                            }}
                          >
                            + bloque
                          </button>
                          <button
                            className="px-1.5 py-0.5 text-[11px] border rounded bg-white"
                            onPointerDown={stopCanvasButtonPointerDown}
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
                {connectionDraft && (
                  <path
                    d={buildOrthogonalPath(connectionDraft.from, connectionDraft.to)}
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    strokeDasharray="6 4"
                  />
                )}
              </svg>
            )}

            {nodes.map((node) => {
              const position = getPos(node.id);
              const outputSpecs = outputSpecsByNode.get(node.id) ?? [];
              const assignments = handleAssignmentsByNode.get(node.id) ?? {};
              return (
                <FlowCanvasNode
                  key={node.id}
                  node={node}
                  position={position}
                  selected={selectedId === node.id}
                  onSelect={onSelect}
                  onNodePointerDown={onNodePointerDown}
                  onAddChild={onAddChild}
                  onDuplicateNode={handleDuplicate}
                  onDeleteNode={onDeleteNode}
                  stopNodeButtonPointerDown={stopCanvasButtonPointerDown}
                  outputSpecs={outputSpecs}
                  handleAssignments={assignments}
                  rootId={flow.rootId}
                  onStartConnection={handleStartConnection}
                  onSizeChange={handleNodeSizeChange}
                  duplicatePending={pendingDuplicateId === node.id}
                  hasValidationError={invalidMessageIds.has(node.id)}
                />
              );
            })}
          </div>
          {connectionPrompt && (
            <div
              className="absolute z-30"
              style={{ left: connectionPrompt.anchor.x, top: connectionPrompt.anchor.y }}
            >
              <div
                ref={connectionPromptRef}
                className="min-w-[240px] max-w-[280px] -translate-x-1/2 translate-y-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-xl"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="text-[11px] font-semibold text-slate-600 mb-2">
                  Siguiente paso · {connectionPrompt.spec.label}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    className="px-2.5 py-1 text-xs rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                    onClick={() => handleCreateSelection("message")}
                  >
                    Nuevo mensaje
                  </button>
                  <button
                    className="px-2.5 py-1 text-xs rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                    onClick={() => handleCreateSelection("buttons")}
                  >
                    Botones
                  </button>
                  <button
                    className="px-2.5 py-1 text-xs rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                    onClick={() => handleCreateSelection("ask")}
                  >
                    Pregunta
                  </button>
                  <button
                    className="px-2.5 py-1 text-xs rounded-full bg-emerald-200 text-emerald-700 shadow-sm hover:bg-emerald-300"
                    onClick={() => handleCreateSelection("menu")}
                  >
                    Submenú
                  </button>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                  Conectar con existente
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {targetOptions.length === 0 ? (
                    <div className="text-[11px] text-slate-400">No hay otros nodos disponibles.</div>
                  ) : (
                    targetOptions.map((option) => {
                      const isActive = option.id === connectionPrompt.currentTargetId;
                      return (
                        <button
                          key={option.id}
                          className={`w-full text-left px-2 py-1 rounded-lg border text-xs flex flex-col gap-0.5 transition hover:border-emerald-300 hover:bg-emerald-50 ${
                            isActive ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                          }`}
                          onClick={() => handleConnectSelection(option.id)}
                        >
                          <span className="font-medium text-slate-700 truncate">{option.label}</span>
                          <span className="text-[10px] text-slate-400">{option.descriptor}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                {connectionPrompt.currentTargetId && (
                  <button
                    className="mt-3 w-full px-2.5 py-1 text-xs rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleConnectSelection(null)}
                  >
                    Quitar destino
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

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
  const emptyMessageNodes = useMemo(() => {
    const ids = new Set<string>();
    for (const node of Object.values(flow.nodes)) {
      if (node.action?.kind === "message") {
        const text = typeof node.action.data?.text === "string" ? node.action.data.text.trim() : "";
        if (!text) {
          ids.add(node.id);
        }
      }
    }
    return ids;
  }, [flow.nodes]);
  const hasBlockingErrors = emptyMessageNodes.size > 0;
  const selectedHasMessageError = emptyMessageNodes.has(selected.id);
  const menuOptionsForSelected = selected.type === "menu" ? getMenuOptions(selected) : [];
  const buttonsDataForSelected = getButtonsData(selected);
  const askDataForSelected = getAskData(selected);
  const askValidationOptions =
    askDataForSelected?.validation?.type === "options" ? askDataForSelected.validation.options : [];
  const schedulerDataForSelected = getSchedulerData(selected);

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

  const handleConvertButtonsToList = useCallback(() => {
    let createdId: string | null = null;
    setFlow((prev) => {
      const { nextFlow, listNodeId } = convertButtonsOverflowToList(prev, selectedId);
      createdId = listNodeId;
      return nextFlow;
    });
    if (createdId) {
      setSelectedId(createdId);
      showToast("Se movieron las opciones extra a un bloque Lista", "success");
    } else {
      showToast("No hay botones adicionales para convertir", "error");
    }
  }, [selectedId, setFlow, setSelectedId, showToast]);

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

  const handleSchedulerUpdate = useCallback(
    (updater: (current: SchedulerNodeData) => SchedulerNodeData) => {
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const node = next.nodes[selectedId];
        if (!node || node.action?.kind !== "scheduler") return next;
        const current = getSchedulerData(node);
        if (!current) return next;
        const updated = normalizeSchedulerData(updater(current));
        node.action = { ...node.action, data: updated };
        return next;
      });
    },
    [selectedId, setFlow]
  );

  const handleSchedulerModeChange = useCallback(
    (mode: SchedulerMode) => {
      handleSchedulerUpdate((current) => ({ ...current, mode }));
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerTimezoneChange = useCallback(
    (timezone: string) => {
      handleSchedulerUpdate((current) => ({
        ...current,
        custom: current.custom ? { ...current.custom, timezone } : undefined,
      }));
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerWindowChange = useCallback(
    (index: number, patch: Partial<TimeWindow>) => {
      handleSchedulerUpdate((current) => {
        const windows = [...(current.custom?.windows ?? [])];
        if (!windows[index]) return current;
        windows[index] = sanitizeTimeWindow({ ...windows[index], ...patch });
        return {
          ...current,
          custom: current.custom ? { ...current.custom, windows } : undefined,
        };
      });
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerToggleWeekday = useCallback(
    (index: number, day: Weekday) => {
      handleSchedulerUpdate((current) => {
        const windows = [...(current.custom?.windows ?? [])];
        const target = windows[index];
        if (!target) return current;
        const set = new Set(target.weekdays);
        if (set.has(day)) {
          set.delete(day);
        } else {
          set.add(day);
        }
        const nextWeekdays = Array.from(set).sort((a, b) => a - b) as Weekday[];
        windows[index] = { ...target, weekdays: nextWeekdays };
        return {
          ...current,
          custom: current.custom ? { ...current.custom, windows } : undefined,
        };
      });
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerToggleOvernight = useCallback(
    (index: number) => {
      handleSchedulerUpdate((current) => {
        const windows = [...(current.custom?.windows ?? [])];
        const target = windows[index];
        if (!target) return current;
        windows[index] = { ...target, overnight: !target.overnight };
        return {
          ...current,
          custom: current.custom ? { ...current.custom, windows } : undefined,
        };
      });
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerAddWindow = useCallback(() => {
    handleSchedulerUpdate((current) => ({
      ...current,
      custom: current.custom
        ? { ...current.custom, windows: [...current.custom.windows, sanitizeTimeWindow(undefined)] }
        : undefined,
    }));
  }, [handleSchedulerUpdate]);

  const handleSchedulerRemoveWindow = useCallback(
    (index: number) => {
      handleSchedulerUpdate((current) => {
        const windows = [...(current.custom?.windows ?? [])];
        windows.splice(index, 1);
        return {
          ...current,
          custom: current.custom
            ? { ...current.custom, windows: windows.length > 0 ? windows : [sanitizeTimeWindow(undefined)] }
            : undefined,
        };
      });
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerExceptionChange = useCallback(
    (index: number, patch: Partial<DateException>) => {
      handleSchedulerUpdate((current) => {
        const exceptions = [...(current.custom?.exceptions ?? [])];
        if (!exceptions[index]) return current;
        exceptions[index] = { ...exceptions[index], ...patch };
        return {
          ...current,
          custom: current.custom ? { ...current.custom, exceptions } : undefined,
        };
      });
    },
    [handleSchedulerUpdate]
  );

  const handleSchedulerAddException = useCallback(() => {
    handleSchedulerUpdate((current) => ({
      ...current,
      custom: current.custom
        ? {
            ...current.custom,
            exceptions: [
              ...(current.custom.exceptions ?? []),
              { date: "", closed: true } as DateException,
            ],
          }
        : undefined,
    }));
  }, [handleSchedulerUpdate]);

  const handleSchedulerRemoveException = useCallback(
    (index: number) => {
      handleSchedulerUpdate((current) => {
        const exceptions = [...(current.custom?.exceptions ?? [])];
        exceptions.splice(index, 1);
        return {
          ...current,
          custom: current.custom ? { ...current.custom, exceptions } : undefined,
        };
      });
    },
    [handleSchedulerUpdate]
  );

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
      } else if (parentNode.action?.kind === "scheduler") {
        const scheduler = getSchedulerData(parentNode);
        if (scheduler) {
          const updated: SchedulerNodeData = { ...scheduler };
          if (!updated.inWindowTargetId) {
            updated.inWindowTargetId = nid;
            linked = true;
          } else if (!updated.outOfWindowTargetId) {
            updated.outOfWindowTargetId = nid;
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
    kind:
      | "message"
      | "buttons"
      | "attachment"
      | "webhook_out"
      | "webhook_in"
      | "transfer"
      | "handoff"
      | "ia_rag"
      | "tool"
      | "ask"
      | "scheduler"
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
      scheduler: normalizeSchedulerData(undefined),
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
      if (node.action?.kind === "scheduler") {
        const scheduler = getSchedulerData(node);
        if (scheduler) {
          const updated: SchedulerNodeData = { ...scheduler };
          if (updated.inWindowTargetId && !next.nodes[updated.inWindowTargetId]) {
            updated.inWindowTargetId = null;
          }
          if (updated.outOfWindowTargetId && !next.nodes[updated.outOfWindowTargetId]) {
            updated.outOfWindowTargetId = null;
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
    if (clone.action?.kind === "scheduler") {
      const scheduler = getSchedulerData(clone);
      const normalized: SchedulerNodeData = scheduler
        ? { ...scheduler, inWindowTargetId: null, outOfWindowTargetId: null }
        : normalizeSchedulerData(undefined);
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

  const handleConnectHandle = useCallback(
    (sourceId: string, handleId: string, targetId: string | null) => {
      let updated = false;
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        if (targetId && !next.nodes[targetId]) {
          return prev;
        }
        if (!applyHandleAssignment(next, sourceId, handleId, targetId ?? null)) {
          return prev;
        }
        updated = true;
        return next;
      });
      return updated;
    },
    [setFlow]
  );

  const handleCreateForHandle = useCallback(
    (sourceId: string, handleId: string, kind: ConnectionCreationKind) => {
      let createdId: string | null = null;
      setFlow((prev) => {
        const next: Flow = JSON.parse(JSON.stringify(prev));
        const source = next.nodes[sourceId];
        if (!source) return prev;
        const nid = nextChildId(next, sourceId);
        const baseLabel =
          kind === "menu"
            ? "Nuevo submenú"
            : kind === "ask"
            ? "Pregunta al cliente"
            : kind === "buttons"
            ? "Acción · botones"
            : "Acción · mensaje";
        let newNode: FlowNode;
        if (kind === "menu") {
          newNode = { id: nid, label: baseLabel, type: "menu", children: [], menuOptions: [] } as FlowNode;
        } else if (kind === "ask") {
          newNode = {
            id: nid,
            label: baseLabel,
            type: "action",
            children: [],
            action: {
              kind: "ask",
              data: {
                questionText: "¿Cuál es tu respuesta?",
                varName: "respuesta",
                varType: "text",
                validation: { type: "none" },
                retryMessage: "Lo siento, ¿puedes intentarlo de nuevo?",
                answerTargetId: null,
                invalidTargetId: null,
              },
            },
          } as FlowNode;
        } else if (kind === "buttons") {
          newNode = {
            id: nid,
            label: baseLabel,
            type: "action",
            children: [],
            action: {
              kind: "buttons",
              data: normalizeButtonsData({
                items: [
                  createButtonOption(0, { label: "Opción 1", value: "OP_1" }),
                  createButtonOption(1, { label: "Opción 2", value: "OP_2" }),
                ],
                maxButtons: DEFAULT_BUTTON_LIMIT,
              }),
            },
          } as FlowNode;
        } else {
          newNode = {
            id: nid,
            label: baseLabel,
            type: "action",
            children: [],
            action: { kind: "message", data: { text: "Mensaje" } },
          } as FlowNode;
        }
        next.nodes[nid] = newNode;
        if (!applyHandleAssignment(next, sourceId, handleId, nid)) {
          delete next.nodes[nid];
          return prev;
        }
        createdId = nid;
        return next;
      });
      if (createdId) {
        const parentPos = positionsRef.current[sourceId] ?? computeLayout(flowRef.current)[sourceId] ?? { x: 0, y: 0 };
        setPositions((prev) => ({
          ...prev,
          [createdId as string]: { x: parentPos.x + NODE_W + 40, y: parentPos.y + NODE_H + 40 },
        }));
        setSelectedId(createdId);
      }
      return createdId;
    },
    [setFlow, setPositions, setSelectedId]
  );

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
      } else if (parentNode.action?.kind === "scheduler") {
        const scheduler = getSchedulerData(parentNode);
        if (scheduler) {
          const updated: SchedulerNodeData = { ...scheduler };
          if (updated.inWindowTargetId === childId) {
            updated.inWindowTargetId = null;
          }
          if (updated.outOfWindowTargetId === childId) {
            updated.outOfWindowTargetId = null;
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
          <button
            className={`px-3 py-1.5 text-sm border rounded ${
              hasBlockingErrors
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-white hover:bg-emerald-50 border-emerald-200"
            }`}
            onClick={handleSaveClick}
            disabled={hasBlockingErrors}
          >
            Guardar
          </button>
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-slate-100" onClick={handleLoad}>Cargar</button>
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-slate-100" onClick={handleExport}>Exportar JSON</button>
          <button className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-slate-100" onClick={handleImportClick}>Importar JSON</button>
          <button
            className={`px-3 py-1.5 text-sm rounded ${
              hasBlockingErrors
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            }`}
            disabled={hasBlockingErrors}
          >
            Publicar
          </button>
        </div>
        {hasBlockingErrors && (
          <div className="text-xs text-rose-600 flex items-center gap-1">
            <span aria-hidden="true">⚠️</span>
            <span>Completa los mensajes vacíos antes de guardar o publicar.</span>
          </div>
        )}
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
                onConnectHandle={handleConnectHandle}
                onCreateForHandle={handleCreateForHandle}
                onInvalidConnection={(message) => showToast(message, "error")}
                invalidMessageIds={emptyMessageNodes}
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
                      <div className="space-y-1">
                        <label className="block text-xs mb-1">Mensaje</label>
                        <input
                          className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
                            selectedHasMessageError
                              ? "border-rose-300 focus:ring-rose-300"
                              : "focus:ring-emerald-300"
                          }`}
                          aria-invalid={selectedHasMessageError}
                          value={selected.action?.data?.text ?? ""}
                          onChange={(e)=>updateSelected({ action:{ kind:"message", data:{ text:e.target.value } } })}
                        />
                        {selectedHasMessageError && (
                          <p className="text-[11px] text-rose-600">Este mensaje no puede estar vacío.</p>
                        )}
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
                        {buttonsDataForSelected.items.length > buttonsDataForSelected.maxButtons && (
                          <div className="border rounded p-2 text-[11px] bg-amber-50 text-amber-700 space-y-2">
                            <div className="font-semibold">
                              Superaste el límite de {buttonsDataForSelected.maxButtons} botones visibles.
                            </div>
                            <div>Convierte las opciones adicionales en una lista para cumplir con la política multi-canal.</div>
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700"
                              onClick={handleConvertButtonsToList}
                            >
                              Convertir a lista automáticamente
                            </button>
                          </div>
                        )}
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

                    {selected.action?.kind === "scheduler" && schedulerDataForSelected && (
                      <div className="space-y-3 text-xs">
                        <div className="space-y-1">
                          <label className="block text-[11px] text-slate-500">Modo</label>
                          <select
                            className="w-full border rounded px-2 py-1"
                            value={schedulerDataForSelected.mode}
                            onChange={(event) => handleSchedulerModeChange(event.target.value as SchedulerMode)}
                          >
                            <option value="custom">Horario personalizado</option>
                            <option value="bitrix">Bitrix (compatibilidad)</option>
                          </select>
                        </div>
                        {schedulerDataForSelected.mode === "custom" && schedulerDataForSelected.custom && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="block text-[11px] text-slate-500">Zona horaria (IANA)</label>
                              <input
                                className="w-full border rounded px-2 py-1"
                                value={schedulerDataForSelected.custom.timezone}
                                onChange={(event) => handleSchedulerTimezoneChange(event.target.value)}
                                placeholder="America/Lima"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-600">Ventanas horarias</span>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 border rounded"
                                  onClick={handleSchedulerAddWindow}
                                >
                                  + ventana
                                </button>
                              </div>
                              {schedulerDataForSelected.custom.windows.map((window, idx) => (
                                <div key={idx} className="border rounded p-2 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-medium">
                                    <span>Ventana {idx + 1}</span>
                                    <button
                                      type="button"
                                      className="px-2 py-0.5 border rounded"
                                      onClick={() => handleSchedulerRemoveWindow(idx)}
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {WEEKDAY_CHOICES.map((choice) => {
                                      const active = window.weekdays.includes(choice.value);
                                      return (
                                        <button
                                          key={choice.value}
                                          type="button"
                                          title={choice.title}
                                          className={`px-2 py-0.5 rounded border ${
                                            active
                                              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                              : "border-slate-200 text-slate-500"
                                          }`}
                                          onClick={() => handleSchedulerToggleWeekday(idx, choice.value)}
                                        >
                                          {choice.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="block text-[11px] text-slate-500">Inicio</label>
                                      <input
                                        className="w-full border rounded px-2 py-1"
                                        value={window.start}
                                        onChange={(event) => handleSchedulerWindowChange(idx, { start: event.target.value })}
                                        placeholder="09:00"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[11px] text-slate-500">Fin</label>
                                      <input
                                        className="w-full border rounded px-2 py-1"
                                        value={window.end}
                                        onChange={(event) => handleSchedulerWindowChange(idx, { end: event.target.value })}
                                        placeholder="18:00"
                                      />
                                    </div>
                                  </div>
                                  <label className="flex items-center gap-2 text-[11px] text-slate-500">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(window.overnight)}
                                      onChange={() => handleSchedulerToggleOvernight(idx)}
                                    />
                                    Cruza medianoche
                                  </label>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-600">Excepciones</span>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 border rounded"
                                  onClick={handleSchedulerAddException}
                                >
                                  + excepción
                                </button>
                              </div>
                              {(schedulerDataForSelected.custom.exceptions ?? []).map((exception, idx) => (
                                <div key={idx} className="border rounded p-2 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <input
                                      type="date"
                                      className="flex-1 border rounded px-2 py-1"
                                      value={exception.date}
                                      onChange={(event) =>
                                        handleSchedulerExceptionChange(idx, { date: event.target.value })
                                      }
                                    />
                                    <button
                                      type="button"
                                      className="ml-2 px-2 py-0.5 border rounded"
                                      onClick={() => handleSchedulerRemoveException(idx)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <label className="flex items-center gap-2 text-[11px] text-slate-500">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(exception.closed)}
                                      onChange={(event) =>
                                        handleSchedulerExceptionChange(idx, { closed: event.target.checked })
                                      }
                                    />
                                    Cerrado todo el día
                                  </label>
                                  {!exception.closed && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        className="border rounded px-2 py-1"
                                        value={exception.start ?? ""}
                                        onChange={(event) =>
                                          handleSchedulerExceptionChange(idx, { start: event.target.value })
                                        }
                                        placeholder="Inicio"
                                      />
                                      <input
                                        className="border rounded px-2 py-1"
                                        value={exception.end ?? ""}
                                        onChange={(event) =>
                                          handleSchedulerExceptionChange(idx, { end: event.target.value })
                                        }
                                        placeholder="Fin"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            {schedulerDataForSelected.mode === "custom" && (
                              <div className="text-[11px] text-rose-500 space-y-1">
                                {validateCustomSchedule(schedulerDataForSelected.custom).map((error) => (
                                  <div key={error}>{error}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"scheduler")}>Acción · Scheduler</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={seedDemo}>Demo rápido</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
