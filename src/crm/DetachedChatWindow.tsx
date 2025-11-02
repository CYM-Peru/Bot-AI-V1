import { useEffect, useState } from "react";
import ChatWindow from "./ChatWindow";
import type { Attachment, Conversation, Message } from "./types";

interface DetachedChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  attachments: Attachment[];
  onSend: (payload: { text: string; files?: File[]; replyToId?: string | null; isInternal?: boolean }) => Promise<void>;
  onReattach: () => void;
}

export default function DetachedChatWindow({
  conversation,
  messages,
  attachments,
  onSend,
  onReattach,
}: DetachedChatWindowProps) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    // Sincronización con ventana padre usando BroadcastChannel
    const channel = new BroadcastChannel("crm-chat-sync");

    channel.onmessage = (event) => {
      if (event.data.type === "reattach") {
        window.close();
      }
    };

    // Cleanup al cerrar la ventana
    window.addEventListener("beforeunload", () => {
      channel.postMessage({ type: "detached-closed" });
      channel.close();
    });

    return () => {
      channel.close();
    };
  }, []);

  const handleReattach = () => {
    // Notificar a la ventana padre que se va a reacoplar
    const channel = new BroadcastChannel("crm-chat-sync");
    channel.postMessage({ type: "reattach-request" });
    channel.close();

    // Cerrar esta ventana con animación
    document.body.classList.add("fade-out");
    setTimeout(() => {
      window.close();
    }, 300);
  };

  const togglePin = () => {
    setIsPinned(!isPinned);
    // Nota: JavaScript en navegador no puede forzar "always on top",
    // pero podemos dar feedback visual y el usuario debe configurarlo manualmente
    // en el sistema operativo (generalmente con Alt+Click o similar)
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      {/* Header con botones de control */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 flex items-center justify-between shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h1 className="text-white font-bold text-lg">Chat Desacoplado</h1>
          {conversation && (
            <span className="text-purple-100 text-sm">
              · {conversation.contactName || conversation.phone}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Pin button */}
          <button
            onClick={togglePin}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              isPinned
                ? "bg-white text-purple-600 shadow-md"
                : "bg-purple-500 text-white hover:bg-purple-400"
            }`}
            title={isPinned ? "Despinear ventana" : "Pinear ventana (mantener encima)"}
          >
            {isPinned ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                Pineado
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Pinear
              </>
            )}
          </button>

          {/* Reattach button */}
          <button
            onClick={handleReattach}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition shadow-md"
            title="Volver a acoplar la ventana"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Acoplar
          </button>
        </div>
      </div>

      {/* Notification when pinned */}
      {isPinned && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-amber-800">
            <strong>Ventana pineada.</strong> Para mantenerla siempre visible, configura "Siempre encima" en tu sistema operativo.
          </p>
        </div>
      )}

      {/* Chat Window */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <ChatWindow
          conversation={conversation}
          messages={messages}
          attachments={attachments}
          onSend={onSend}
          isDetached={true}
        />
      </div>

      <style>{`
        .fade-out {
          animation: fadeOut 0.3s ease-out forwards;
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }

        body {
          margin: 0;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
