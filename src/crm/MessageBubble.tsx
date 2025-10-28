import type { Attachment, Message } from "./types";
import AttachmentPreview from "./AttachmentPreview";

interface MessageBubbleProps {
  message: Message;
  attachments: Attachment[];
  repliedTo: Message | null;
  repliedAttachments: Attachment[];
  onReply: () => void;
}

export default function MessageBubble({ message, attachments, repliedTo, repliedAttachments, onReply }: MessageBubbleProps) {
  const isOutgoing = message.direction === "outgoing";
  const bubbleClasses = isOutgoing
    ? "bg-emerald-500 text-white"
    : "bg-white text-slate-900 border border-slate-200";
  const alignment = isOutgoing ? "items-end" : "items-start";
  const containerAlign = isOutgoing ? "ml-auto" : "mr-auto";

  return (
    <div className={`flex ${alignment}`}>
      <div className={`max-w-xl rounded-2xl px-4 py-3 shadow-sm ${bubbleClasses} ${containerAlign}`}>
        {repliedTo && (
          <div className={`mb-2 rounded-lg border-l-4 ${isOutgoing ? "border-white/70" : "border-emerald-400"} bg-black/5 px-3 py-2 text-xs`}
            role="note"
          >
            <p className="font-semibold">Respuesta a:</p>
            <ReplyPreview message={repliedTo} attachments={repliedAttachments} />
          </div>
        )}
        {message.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment) => (
              <AttachmentPreview key={attachment.id} attachment={attachment} compact={false} />
            ))}
          </div>
        )}
        <div className={`mt-2 flex items-center gap-2 text-[11px] ${isOutgoing ? "text-white/80" : "text-slate-400"}`}>
          <span>{new Date(message.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
          {isOutgoing && <StatusBadge status={message.status} />}
          <button
            type="button"
            onClick={onReply}
            className={`ml-2 text-[11px] underline ${isOutgoing ? "text-white/90" : "text-emerald-600"}`}
          >
            Responder
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Message["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1" title="Enviando...">
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="3" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      );
    case "sent":
      return (
        <span className="text-white/90" title="Enviado">
          ✓
        </span>
      );
    case "delivered":
      return (
        <span className="text-white/90" title="Entregado">
          ✓✓
        </span>
      );
    case "read":
      return (
        <span className="text-blue-300" title="Leído">
          ✓✓
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-rose-100" title="Falló el envío">
          ⚠️
        </span>
      );
    default:
      return null;
  }
}

function ReplyPreview({ message, attachments }: { message: Message; attachments: Attachment[] }) {
  return (
    <div className="space-y-1">
      {message.text && <p className="line-clamp-2 text-xs opacity-90">{message.text}</p>}
      {attachments.length > 0 && (
        <AttachmentPreview attachment={attachments[0]} compact />
      )}
    </div>
  );
}
