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

type NodeType = "menu" | "action";
type ActionKind =
  | "message"
  | "buttons"
  | "attachment"
  | "webhook_out"
  | "webhook_in"
  | "transfer"
  | "handoff"
  | "ia_rag"
  | "tool";

type FlowNode = {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
  action?: { kind: ActionKind; data?: Record<string, any> };
  children: string[];
};
type Flow = {
  id: string;
  name: string;
  rootId: string;
  nodes: Record<string, FlowNode>;
};

const NODE_W = 300;
const NODE_H = 128;
const SURFACE_W = 4000;
const SURFACE_H = 3000;
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

const demoFlow: Flow = {
  id: "flow-demo",
  name: "Azaleia · Menú principal",
  rootId: "root",
  nodes: { root: { id: "root", label: "Menú principal", type: "menu", children: [] } },
};

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
}){
  const { flow, selectedId, onSelect, onAddChild, onDeleteNode, onDuplicateNode, onInsertBetween, onDeleteEdge, soloRoot, toggleScope, nodePositions, onPositionsChange } = props;

  const autoLayout = useMemo(()=>computeLayout(flow),[flow]);
  const visibleIds = useMemo(()=>{
    if (soloRoot) return [flow.rootId, ...(flow.nodes[flow.rootId]?.children ?? [])];
    return Object.keys(flow.nodes);
  },[flow, soloRoot]);
  const nodes = useMemo(()=>visibleIds.map(id=>flow.nodes[id]).filter(Boolean),[visibleIds, flow.nodes]);
  const visibleSet = useMemo(()=>new Set(visibleIds),[visibleIds]);

  const edges = useMemo(()=>{
    const out: Array<[string,string]> = [];
    for (const id of visibleIds){
      const n = flow.nodes[id]; if (!n) continue;
      for (const cid of n.children) if (visibleSet.has(cid)) out.push([id, cid]);
    }
    return out;
  },[visibleIds, visibleSet, flow.nodes]);

  const [scale, setScaleState] = useState(1);
  const [pan, setPanState] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const setScaleSafe = useCallback((next: number) => {
    scaleRef.current = next;
    setScaleState(next);
  }, []);

  const setPanSafe = useCallback((next: { x: number; y: number }) => {
    panRef.current = next;
    setPanState(next);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const next = Math.min(2.4, Math.max(0.4, scaleRef.current - e.deltaY * 0.001));
      setScaleSafe(next);
      return;
    }
    const currentScale = scaleRef.current || 1;
    e.preventDefault();
    setPanSafe({
      x: panRef.current.x + e.deltaX / currentScale,
      y: panRef.current.y + e.deltaY / currentScale,
    });
  }, [setPanSafe, setScaleSafe]);

  const nodePosRef = useRef(nodePositions);
  useEffect(() => { nodePosRef.current = nodePositions; }, [nodePositions]);

  const updateNodePos = useCallback((updater: Record<string, { x: number; y: number }> | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)) => {
    onPositionsChange(updater);
  }, [onPositionsChange]);

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

  const getPos = (id: string) => nodePosRef.current[id] ?? autoLayout[id] ?? { x: 0, y: 0 };

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
    } else if (state.type === "pan") {
      const { startClient, startPan } = state;
      const currentScale = scaleRef.current || 1;
      const dx = (evt.clientX - startClient.x) / currentScale;
      const dy = (evt.clientY - startClient.y) / currentScale;
      setPanSafe({ x: startPan.x - dx, y: startPan.y - dy });
    }
  }, [getStageContext, setPanSafe, updateNodePos]);

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

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerState.current || pointerState.current.pointerId !== e.pointerId) return;
    latestEventRef.current = { clientX: e.clientX, clientY: e.clientY };
    clearSelection();
    scheduleUpdate();
  }, [scheduleUpdate]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopPointer(e.pointerId);
  }, [stopPointer]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (pointerState.current) return;
    if (isFromNode(e.target)) return;
    pointerState.current = {
      type: "pan",
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startPan: panRef.current,
    };
    latestEventRef.current = { clientX: e.clientX, clientY: e.clientY };
    containerRef.current?.setPointerCapture?.(e.pointerId);
    clearSelection();
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopPointer(e.pointerId);
  }, [stopPointer]);

  const onNodePointerDown = useCallback((id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const context = getStageContext();
    if (!context) return;
    const pointerWorld = toWorldCoords(e, context);
    const position = getPos(id);
    pointerState.current = {
      type: "drag-node",
      pointerId: e.pointerId,
      nodeId: id,
      offset: { x: pointerWorld.x - position.x, y: pointerWorld.y - position.y },
    };
    latestEventRef.current = { clientX: e.clientX, clientY: e.clientY };
    containerRef.current?.setPointerCapture?.(e.pointerId);
    clearSelection();
    scheduleUpdate();
  }, [getStageContext, getPos, scheduleUpdate]);

  const stopNodeButtonPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="relative w-full rounded-xl border overflow-hidden bg-white" style={{ minHeight: "74vh", height: "74vh" }}>
      <div className="absolute z-20 right-3 top-3 flex gap-2 bg-white/95 backdrop-blur rounded-full border border-emerald-200 p-2 shadow-lg">
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setScaleSafe(scaleRef.current)}>🔍</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setScaleSafe(Math.min(2.4, scaleRef.current + 0.1))}>＋</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setScaleSafe(Math.max(0.4, scaleRef.current - 0.1))}>－</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>{ setPanSafe({ x: 0, y: 0 }); setScaleSafe(1); }}>⛶</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>updateNodePos(()=>({ ...autoLayout }))}>Auto-ordenar</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={toggleScope}>{props.soloRoot ? "Mostrar todo" : "Solo raíz"}</button>
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
            width: SURFACE_W, height: SURFACE_H,
            transform: `scale(${scale}) translate(${-pan.x}px, ${-pan.y}px)`,
            transformOrigin: "0 0",
            backgroundImage: "radial-gradient(var(--grid-dot) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {edges.length>0 && (
            <svg className="absolute z-0" width={SURFACE_W} height={SURFACE_H}>
              {edges.map(([from,to])=>{
                const a = getPos(from), b = getPos(to);
                const y1 = a.y + NODE_H/2, y2 = b.y + NODE_H/2;
                const fromRight = b.x >= a.x;
                const IN = 14;
                const x1 = fromRight ? a.x + NODE_W - IN : a.x + IN;
                const x2 = fromRight ? b.x + IN : b.x + NODE_W - IN;
                const distX = Math.max(40, Math.abs((fromRight? b.x : b.x + NODE_W) - (fromRight? a.x + NODE_W : a.x)));
                const dx = Math.max(60, distX * 0.35);
                const c1x = fromRight ? x1 + dx : x1 - dx;
                const c2x = fromRight ? x2 - dx : x2 + dx;
                const c1y = y1, c2y = y2;
                const midX = (x1 + x2)/2;
                const midY = (y1 + y2)/2;

                return (
                  <g key={`${from}-${to}`}>
                    <path d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`} stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" />
                    <foreignObject x={midX - 24} y={midY - 14} width={120} height={28} className="pointer-events-auto">
                      <div className="flex gap-1">
                        <button
                          className="px-1.5 py-0.5 text-[11px] border rounded bg-white"
                          onPointerDown={stopNodeButtonPointerDown}
                          onClick={(e)=>{e.stopPropagation(); onInsertBetween(from,to);}}
                        >+ bloque</button>
                        <button
                          className="px-1.5 py-0.5 text-[11px] border rounded bg-white"
                          onPointerDown={stopNodeButtonPointerDown}
                          onClick={(e)=>{e.stopPropagation(); onDeleteEdge(from,to);}}
                        >borrar</button>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          )}

          {nodes.map(n=>{
            const p = getPos(n.id);
            const isSel = selectedId === n.id;
            const badge = n.type==="menu" ? "bg-emerald-50 border-emerald-300 text-emerald-600" : "bg-violet-50 border-violet-300 text-violet-600";
            const icon = n.type==="menu" ? "🟢" : "🔗";
            return (
              <div
                key={n.id}
                data-node="true"
                className={`absolute w-[300px] rounded-2xl border-2 bg-white shadow-lg transition border-slate-300 ${isSel ? "ring-2 ring-emerald-500 shadow-emerald-200" : "hover:ring-1 hover:ring-emerald-200"}`}
                style={{ left: p.x, top: p.y, cursor: "move" }}
                onPointerDown={onNodePointerDown(n.id)}
                onClick={(e)=>{ e.stopPropagation(); onSelect(n.id); }}
              >
                <div className="px-3 pt-3 text-[15px] font-semibold flex items-center gap-2 text-slate-800">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-700">{icon}</span>
                  <span className="whitespace-normal leading-tight" title={n.label}>{n.label}</span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${badge}`}>{n.type}</span>
                </div>
                <div className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
                      onPointerDown={stopNodeButtonPointerDown}
                      onClick={(e)=>{ e.stopPropagation(); onAddChild(n.id,"menu"); }}
                    >+ menú</button>
                    <button
                      className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
                      onPointerDown={stopNodeButtonPointerDown}
                      onClick={(e)=>{ e.stopPropagation(); onAddChild(n.id,"action"); }}
                    >+ acción</button>
                    <button
                      className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
                      onPointerDown={stopNodeButtonPointerDown}
                      onClick={(e)=>{ e.stopPropagation(); onDuplicateNode(n.id); }}
                    >duplicar</button>
                    {n.id !== flow.rootId && (
                      <button
                        className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition"
                        onPointerDown={stopNodeButtonPointerDown}
                        onClick={(e)=>{ e.stopPropagation(); onDeleteNode(n.id); }}
                      >borrar</button>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-3 text-xs text-slate-500">{n.type==="menu" ? `${n.children.length} opción(es)` : n.action?.kind ?? "acción"}</div>
              </div>
            );
          })}
        </div>
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

  const suppressDirtyRef = useRef(false);
  const flowRef = useRef(flow);
  const positionsRef = useRef(positionsState);
  const dirtyRef = useRef(dirty);
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => { flowRef.current = flow; }, [flow]);
  useEffect(() => { positionsRef.current = positionsState; }, [positionsState]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  const selected = flow.nodes[selectedId] ?? flow.nodes[flow.rootId];

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast || typeof window === "undefined") return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const setFlow = useCallback((updater: Flow | ((prev: Flow) => Flow)) => {
    setFlowState((prev) => {
      const next = typeof updater === "function" ? (updater as (prev: Flow) => Flow)(prev) : updater;
      if (!suppressDirtyRef.current && next !== prev) {
        setDirty(true);
      }
      return next;
    });
  }, []);

  const setPositions = useCallback((updater: Record<string, { x: number; y: number }> | ((prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)) => {
    setPositionsState((prev) => {
      const next = typeof updater === "function" ? (updater as (prev: Record<string, { x: number; y: number }>) => Record<string, { x: number; y: number }>)(prev) : updater;
      if (next === prev) return prev;
      if (!suppressDirtyRef.current) {
        setDirty(true);
      }
      return next;
    });
  }, []);

  const replaceFlow = useCallback((nextFlow: Flow, nextPositions: Record<string, { x: number; y: number }> = {}) => {
    suppressDirtyRef.current = true;
    setFlowState(nextFlow);
    setPositionsState(nextPositions);
    suppressDirtyRef.current = false;
    setSelectedId(nextFlow.rootId);
    setWorkspaceId(nextFlow.id);
    setDirty(false);
  }, []);

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

  function addChildTo(parentId:string, type:NodeType){
    const nid = nextChildId(flow, parentId);
    const newNode: FlowNode = {
      id: nid, label: type==="menu"?"Nuevo submenú":"Nueva acción", type, children: [],
      action: type==="action" ? { kind:"message", data:{ text:"Respuesta…" } } : undefined,
    };
    setFlow(prev=>({
      ...prev,
      nodes: { 
        ...prev.nodes,
        [nid]: newNode,
        [parentId]: { ...prev.nodes[parentId], children: [...prev.nodes[parentId].children, nid] }
      }
    }));
    setSelectedId(nid);
  }

  function addActionOfKind(parentId:string, kind:"message"|"buttons"|"attachment"|"webhook_out"|"webhook_in"|"transfer"|"handoff"|"ia_rag"|"tool"){
    const nid = nextChildId(flow, parentId);
    const defaults: Record<string, any> = {
      message: { text: "Mensaje" },
      buttons: { items:[ {label:"Sí",payload:"YES"}, {label:"No",payload:"NO"} ] },
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
    };
    const newNode: FlowNode = { id:nid, label:`Acción · ${kind}`, type:"action", children:[], action:{kind:kind as any, data:defaults[kind]} };
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
    if (!parentId) return;
    const next: Flow = JSON.parse(JSON.stringify(flow));
    deleteSubtree(next, id);
    next.nodes[parentId].children = next.nodes[parentId].children.filter(c=>c!==id);
    setFlow(next);
    setSelectedId(parentId);
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
    setFlow(prev=>({
      ...prev,
      nodes:{
        ...prev.nodes,
        [nid]: clone,
        [parentId]: { ...prev.nodes[parentId], children:[...prev.nodes[parentId].children, nid] }
      }
    }));
    setSelectedId(nid);
  }

  function insertBetween(parentId:string, childId:string){
    const nid = nextChildId(flow, parentId);
    setFlow(prev=>{
      const next: Flow = JSON.parse(JSON.stringify(prev));
      next.nodes[nid] = { id:nid, label:"Nueva acción", type:"action", children:[], action:{ kind:"message", data:{text:"Mensaje"} } };
      const arr = next.nodes[parentId].children;
      const idx = arr.indexOf(childId);
      if (idx>=0){ arr.splice(idx,1,nid); next.nodes[nid].children.push(childId); }
      return next;
    });
  }

  function deleteEdge(parentId:string, childId:string){
    setFlow(prev=>{
      const next: Flow = JSON.parse(JSON.stringify(prev));
      next.nodes[parentId].children = next.nodes[parentId].children.filter(c=>c!==childId);
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

                {selected.type==="menu" && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Opciones</div>
                    <div className="border rounded divide-y">
                      {selected.children.length===0 && <div className="p-2 text-xs text-slate-500">Sin opciones.</div>}
                    </div>
                  </div>
                )}

                {selected.type==="menu" && selected.children.length>0 && (
                  <div className="mt-2 border rounded divide-y">
                    {selected.children.map(cid=>(
                      <div key={cid} className="p-2 text-xs flex items-center gap-2">
                        <span className="flex-1 truncate" title={flow.nodes[cid]?.label}>{flow.nodes[cid]?.label ?? cid}</span>
                        <button className="px-2 py-1 border rounded" onClick={()=>setSelectedId(cid)}>Ver</button>
                        <button className="px-2 py-1 border rounded" onClick={()=>deleteNode(cid)}>Eliminar</button>
                      </div>
                    ))}
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
                    </select>

                    {(selected.action?.kind ?? "message")==="message" && (
                      <div>
                        <label className="block text-xs mb-1">Mensaje</label>
                        <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" value={selected.action?.data?.text ?? ""} onChange={(e)=>updateSelected({ action:{ kind:"message", data:{ text:e.target.value } } })} />
                      </div>
                    )}

                    {selected.action?.kind==="buttons" && (
                      <div className="space-y-2">
                        <div className="text-xs">Lista de botones</div>
                        {(selected.action?.data?.items ?? []).map((it:any, idx:number)=>(
                          <div key={idx} className="flex gap-2 text-xs">
                            <input className="flex-1 border rounded px-2 py-1" placeholder="Etiqueta" value={it.label} onChange={(e)=>{ const items=[...(selected.action?.data?.items ?? [])]; items[idx]={...items[idx], label:e.target.value}; updateSelected({ action:{ kind:"buttons", data:{ items } } }); }} />
                            <input className="flex-1 border rounded px-2 py-1" placeholder="Payload" value={it.payload} onChange={(e)=>{ const items=[...(selected.action?.data?.items ?? [])]; items[idx]={...items[idx], payload:e.target.value}; updateSelected({ action:{ kind:"buttons", data:{ items } } }); }} />
                            <button className="px-2 py-1 border rounded" onClick={()=>{ const items=[...(selected.action?.data?.items ?? [])]; items.splice(idx,1); updateSelected({ action:{ kind:"buttons", data:{ items } } }); }}>✕</button>
                          </div>
                        ))}
                        <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ const items=[...(selected.action?.data?.items ?? [])]; items.push({label:"Nuevo",payload:"NEW"}); updateSelected({ action:{ kind:"buttons", data:{ items } } }); }}>+ agregar botón</button>
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
                  <div className="text-xs font-medium">Menú principal</div>
                  <div className="text-[11px] text-slate-500 mb-1">Lista de opciones</div>
                  {selected.type==="menu" ? (
                    <ul className="text-[12px] space-y-1">
                      {selected.children.length===0 && <li className="text-slate-400">(Sin opciones)</li>}
                      {selected.children.map(cid=>(
                        <li key={cid} className="truncate">{flow.nodes[cid]?.label ?? cid}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[12px] text-slate-600">{selected.action?.data?.text ?? selected.action?.kind ?? "Mensaje"}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-2 border-b text-sm font-semibold">Agregar</div>
              <div className="p-3 flex gap-3 flex-wrap">
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addChildTo(selectedId,"menu")}>Submenú</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addChildTo(selectedId,"action")}>Acción (mensaje)</button>
                <button className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300" onClick={()=>addActionOfKind(selectedId,"buttons")}>Acción · Botones</button>
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
