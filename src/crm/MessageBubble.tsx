import type { Attachment, Message } from "./types";
import AttachmentPreview from "./AttachmentPreview";

interface MessageBubbleProps {
  message: Message;
  attachments: Attachment[];
  repliedTo: Message | null;
  repliedAttachments: Attachment[];
  onReply: () => void;
  onScrollToMessage?: (messageId: string) => void;
}

export default function MessageBubble({ message, attachments, repliedTo, repliedAttachments, onReply, onScrollToMessage }: MessageBubbleProps) {
  const isOutgoing = message.direction === "outgoing";

  const bubbleClasses = isOutgoing
    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
    : "bg-white text-slate-800 border border-slate-200 shadow-md";

  const alignment = isOutgoing ? "items-end" : "items-start";
  const containerAlign = isOutgoing ? "ml-auto" : "mr-auto";

  const handleReplyClick = () => {
    if (repliedTo && onScrollToMessage) {
      onScrollToMessage(repliedTo.id);
    }
  };

  return (
    <div className={`flex ${alignment}`} id={`message-${message.id}`}>
      <div className={`max-w-[75%] rounded-xl px-3 py-2.5 ${bubbleClasses} ${containerAlign} backdrop-blur-sm`}>
        {repliedTo && (
          <div
            className={`mb-2 rounded-lg border-l-3 ${isOutgoing ? "border-white/70" : "border-emerald-500"} bg-black/5 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-black/10 transition-colors`}
            role="button"
            onClick={handleReplyClick}
            title="Click para ir al mensaje original"
          >
            <p className="font-semibold text-[10px] mb-0.5">Respuesta a:</p>
            <ReplyPreview message={repliedTo} attachments={repliedAttachments} />
          </div>
        )}
        {message.text && <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.text}</p>}
        {attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {attachments.map((attachment) => (
              <AttachmentPreview key={attachment.id} attachment={attachment} compact={false} />
            ))}
          </div>
        )}
        <div className={`mt-1.5 flex items-center gap-2 text-[10px] ${isOutgoing ? "text-white/70" : "text-slate-400"}`}>
          <span>{new Date(message.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</span>
          {isOutgoing && <StatusBadge status={message.status} />}
          {isOutgoing && message.sentBy && (
            <span className="text-[9px] font-medium opacity-80">
              • {message.sentBy}
            </span>
          )}
          <button
            type="button"
            onClick={onReply}
            className={`ml-1 text-[10px] font-medium underline decoration-dotted underline-offset-2 ${isOutgoing ? "text-white/80 hover:text-white" : "text-emerald-600 hover:text-emerald-700"} transition-colors`}
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
