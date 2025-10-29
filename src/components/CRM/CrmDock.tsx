import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CrmSocket, type ConnectionState, type WsIncomingFrame } from "../../utils/wsClient";
import { sendMessage } from "../../crm/crmApi";

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
  const [message, setMessage] = useState<string>("Hola desde el CRM");
  const [providerStatus, setProviderStatus] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const socket = new CrmSocket();
    socketRef.current = socket;

    const handleFrame = (frame: WsIncomingFrame) => {
      if (frame.type === "welcome") {
        setClientId(frame.clientId);
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

  const handleSend = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const result = await sendMessage({ phone: "51918131082", text });
      setProviderStatus(
        result.ok
          ? `Proveedor ok · status ${result.providerStatus}`
          : `Error proveedor (${result.providerStatus})${result.error ? ` · ${result.error}` : ""}`,
      );
      socketRef.current?.send("message", { text });
      setMessage(""); // Clear message after sending
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setProviderStatus(`Fallo al enviar · ${message}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
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
      <form onSubmit={handleSend} className="mt-3 flex items-start gap-2">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje de prueba (Enter para enviar, Shift+Enter para salto de línea)"
          rows={2}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={sending}
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </form>
      {providerStatus && <div className="mt-3 text-xs text-slate-600">{providerStatus}</div>}
    </div>
  );
}
