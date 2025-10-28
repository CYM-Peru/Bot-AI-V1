import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CrmSocket, type ConnectionState, type WsIncomingFrame } from "../../utils/wsClient";

const STATUS_LABELS: Record<ConnectionState, string> = {
  idle: "Sin conectar",
  connecting: "Conectando…",
  connected: "Conectado",
  reconnecting: "Reconectando…",
  closed: "Cerrado",
};

export default function CrmDock() {
  const socketRef = useRef<CrmSocket | null>(null);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [clientId, setClientId] = useState<string>("");
  const [lastAck, setLastAck] = useState<string>("");
  const [message, setMessage] = useState<string>("Hola desde el CRM");
  const [frames, setFrames] = useState<WsIncomingFrame[]>([]);

  useEffect(() => {
    const socket = new CrmSocket();
    socketRef.current = socket;

    const handleFrame = (frame: WsIncomingFrame) => {
      setFrames((prev) => [...prev.slice(-3), frame]);
      if (frame.type === "welcome") {
        setClientId(frame.clientId);
      }
      if (frame.type === "ack" && frame.event === "message") {
        setLastAck(new Date().toLocaleTimeString());
      }
    };

    socket.on("state", setStatus);
    socket.on("frame", handleFrame);
    socket.connect();
    socket.send("hello", { scope: "crm-dock" });

    return () => {
      socket.off("state", setStatus);
      socket.off("frame", handleFrame);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const statusColor = useMemo(() => {
    switch (status) {
      case "connected":
        return "text-emerald-600";
      case "reconnecting":
        return "text-amber-600";
      case "connecting":
        return "text-sky-600";
      default:
        return "text-slate-500";
    }
  }, [status]);

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    socketRef.current?.send("message", { text: message.trim() });
  };

  const handleReconnect = () => {
    socketRef.current?.connect();
    socketRef.current?.send("hello", { scope: "crm-dock" });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Canal WebSocket CRM</p>
          <p className={`text-xs ${statusColor}`}>
            {STATUS_LABELS[status]}
            {clientId ? ` · ID ${clientId.slice(0, 8)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReconnect}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Reintentar
        </button>
      </div>
      <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escribe un mensaje de prueba"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Enviar
        </button>
      </form>
      <div className="mt-3 text-xs text-slate-500">
        {lastAck ? `Último ack: ${lastAck}` : "Aún sin confirmaciones"}
      </div>
      <div className="mt-3 space-y-1 text-[11px] text-slate-500">
        {frames.slice().reverse().map((frame, index) => (
          <div key={index} className="rounded bg-slate-100 px-2 py-1 font-mono">
            {JSON.stringify(frame)}
          </div>
        ))}
      </div>
    </div>
  );
}
