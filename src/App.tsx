import React, { useEffect, useMemo, useRef, useState } from "react";
import { computeOffset } from "./lib/dragOffset";

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

function usePanZoom() {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panning = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) { setTx((v) => v - e.deltaX); setTy((v) => v - e.deltaY); return; }
    const next = Math.min(2.2, Math.max(0.6, scale - e.deltaY * 0.001));
    setScale(next);
  };
  const onMouseDown = (e: React.MouseEvent) => { panning.current = true; last.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!panning.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setTx((v) => v + dx); setTy((v) => v + dy);
  };
  const onMouseUp = () => { panning.current = false; };
  return { scale, tx, ty, setScale, setTx, setTy, onWheel, onMouseDown, onMouseMove, onMouseUp, containerRef };
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
}){
  const { flow, selectedId, onSelect, onAddChild, onDeleteNode, onDuplicateNode, onInsertBetween, onDeleteEdge, soloRoot, toggleScope } = props;

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

  const { scale, tx, ty, setScale, setTx, setTy, onWheel, onMouseDown, onMouseMove, onMouseUp, containerRef } = usePanZoom();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [nodePos, setNodePos] = useState<Record<string, {x:number;y:number}>>({});
  const nodePosRef = useRef<Record<string, {x:number;y:number}>>({});
  useEffect(()=>{
    setNodePos(prev=>{
      const next = { ...prev };
      for (const id of Object.keys(autoLayout)) if (!next[id]) next[id] = autoLayout[id];
      nodePosRef.current = next; return next;
    });
  },[autoLayout]);

  const draggingId = useRef<string|null>(null);
  const dragOff = useRef({x:0,y:0});
  const getPos = (id:string)=> nodePosRef.current[id] ?? nodePos[id] ?? autoLayout[id] ?? {x:0,y:0};

  const startDrag = (id:string, e:React.MouseEvent)=>{
    e.stopPropagation();
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const pointer = computeOffset({
      pageX: e.pageX,
      pageY: e.pageY,
      rect,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scale,
    });
    const p = getPos(id);
    draggingId.current = id;
    dragOff.current = { x: pointer.x - p.x, y: pointer.y - p.y };
  };
  const moveDrag = (pageX:number, pageY:number)=>{
    const id = draggingId.current; if (!id) return;
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const pointer = computeOffset({
      pageX,
      pageY,
      rect,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scale,
    });
    const nx = pointer.x - dragOff.current.x; const ny = pointer.y - dragOff.current.y;
    const gx = Math.round(nx/10)*10; const gy = Math.round(ny/10)*10;
    setNodePos(prev=>{ const next = { ...prev, [id]: { x: gx, y: gy } }; nodePosRef.current = next; return next; });
  };

  const onMoveStage = (e:React.MouseEvent)=>{
    if (draggingId.current){
      moveDrag(e.pageX, e.pageY); e.preventDefault(); clearSelection();
    }else{
      onMouseMove(e);
    }
  };
  useEffect(()=>{
    const mm=(e:MouseEvent)=>{ if (draggingId.current) moveDrag(e.pageX, e.pageY); };
    const mu=()=>{ draggingId.current = null; };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return ()=>{ window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); }
  },[]);

  return (
    <div className="relative w-full rounded-xl border overflow-hidden bg-white" style={{ minHeight: "74vh", height: "74vh" }}>
      <div className="absolute z-20 right-3 top-3 flex gap-2 bg-white/95 backdrop-blur rounded-full border border-emerald-200 p-2 shadow-lg">
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setScale(s=>s)}>🔍</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setScale(s=>Math.min(2.2, s+0.1))}>＋</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setScale(s=>Math.max(0.6, s-0.1))}>－</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>{ setTx(0); setTy(0); setScale(1); }}>⛶</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={()=>setNodePos(autoLayout)}>Auto-ordenar</button>
        <button className="px-3 py-1.5 text-sm border rounded-full bg-white/95 hover:bg-emerald-50 border-emerald-200 transition" onClick={toggleScope}>{props.soloRoot ? "Mostrar todo" : "Solo raíz"}</button>
      </div>

      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={(e)=>{ if (draggingId.current) return; if (isFromNode(e.target)) return; onMouseDown(e); }}
        onMouseMove={onMoveStage}
        onMouseUp={()=>{ draggingId.current=null; clearSelection(); onMouseUp(); }}
        onMouseLeave={()=>{ draggingId.current=null; clearSelection(); onMouseUp(); }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
      >
        <div
          ref={stageRef}
          className="absolute"
          style={{
            width: SURFACE_W, height: SURFACE_H,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
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
                        <button className="px-1.5 py-0.5 text-[11px] border rounded bg-white" onClick={(e)=>{e.stopPropagation(); onInsertBetween(from,to);}}>+ bloque</button>
                        <button className="px-1.5 py-0.5 text-[11px] border rounded bg-white" onClick={(e)=>{e.stopPropagation(); onDeleteEdge(from,to);}}>borrar</button>
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
                onMouseDown={(e)=>{ e.preventDefault(); startDrag(n.id,e); }}
                onClick={(e)=>{ e.stopPropagation(); onSelect(n.id); }}
              >
                <div className="px-3 pt-3 text-[15px] font-semibold flex items-center gap-2 text-slate-800">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-700">{icon}</span>
                  <span className="whitespace-normal leading-tight" title={n.label}>{n.label}</span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${badge}`}>{n.type}</span>
                </div>
                <div className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <button className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition" onClick={(e)=>{ e.stopPropagation(); onAddChild(n.id,"menu"); }}>+ menú</button>
                    <button className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition" onClick={(e)=>{ e.stopPropagation(); onAddChild(n.id,"action"); }}>+ acción</button>
                    <button className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition" onClick={(e)=>{ e.stopPropagation(); onDuplicateNode(n.id); }}>duplicar</button>
                    {n.id !== flow.rootId && (
                      <button className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-emerald-50 border-emerald-200 transition" onClick={(e)=>{ e.stopPropagation(); onDeleteNode(n.id); }}>borrar</button>
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

export default function App(): JSX.Element {
  const [flow, setFlow] = useState<Flow>(demoFlow);
  const [selectedId, setSelectedId] = useState(flow.rootId);
  const selected = flow.nodes[selectedId];
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1 rounded-full border bg-slate-50">Builder · Beta</span>
          <h1 className="text-lg md:text-2xl font-semibold truncate">{flow.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm border rounded">Guardar</button>
          <button className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Publicar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="px-3 py-2 border-b text-sm font-semibold text-slate-800" style={{ background: `linear-gradient(90deg, ${channelTheme.from}, ${channelTheme.to})` }}>Canal & vista previa</div>
            <div className="px-3 pt-3 text-sm text-slate-800">
              <div className="flex gap-2 text-xs">
                <button className={`${channel==='whatsapp'?'bg-emerald-500 text-white':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full shadow-sm`} onClick={()=>setChannel('whatsapp')}>WhatsApp</button>
                <button className={`${channel==='facebook'?'bg-blue-500 text-white':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full shadow-sm`} onClick={()=>setChannel('facebook')}>Facebook</button>
                <button className={`${channel==='instagram'?'bg-pink-400 text-white':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full shadow-sm`} onClick={()=>setChannel('instagram')}>Instagram</button>
                <button className={`${channel==='tiktok'?'bg-cyan-400 text-white':'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3 py-1.5 rounded-full shadow-sm`} onClick={()=>setChannel('tiktok')}>TikTok</button>
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
            <div className="p-3 flex gap-2 flex-wrap">
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addChildTo(selectedId,"menu")}>Submenú</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addChildTo(selectedId,"action")}>Acción (mensaje)</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addActionOfKind(selectedId,"buttons")}>Acción · Botones</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addActionOfKind(selectedId,"attachment")}>Acción · Adjunto</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addActionOfKind(selectedId,"webhook_out")}>Acción · Webhook OUT</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addActionOfKind(selectedId,"webhook_in")}>Acción · Webhook IN</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={()=>addActionOfKind(selectedId,"transfer")}>Acción · Transferir</button>
              <button className="px-3 py-1.5 text-sm rounded border border-emerald-200 bg-white hover:bg-emerald-50 transition" onClick={seedDemo}>Demo rápido</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2">
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
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 order-3">
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
        </div>
      </div>
    </div>
  );
}