import { useRef, useState } from "react";
import type { Attachment, Message } from "./types";
import AttachmentPreview from "./AttachmentPreview";
import QuickReplies from "./QuickReplies";

interface ComposerProps {
  disabled?: boolean;
  onSend: (payload: { text: string; file?: File | null; replyToId?: string | null; isInternal?: boolean }) => Promise<void> | void;
  replyingTo: { message: Message; attachments: Attachment[] } | null;
  onCancelReply?: () => void;
}

export default function Composer({ disabled, onSend, replyingTo, onCancelReply }: ComposerProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isInternal, setIsInternal] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [sending, setSending] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(next));
  };

  const handleSend = async () => {
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    try {
      await onSend({
        text: text.trim(),
        file,
        replyToId: replyingTo?.message.id ?? null,
        isInternal
      });
      setText("");
      setFile(null);
      setIsInternal(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      onCancelReply?.();
      // Mantener el foco en el textarea para seguir escribiendo
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
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

  const removeFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {replyingTo && (
        <div className="mb-3 flex items-start gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 border-l-4 border-emerald-500 px-4 py-3">
          {replyingTo.attachments.length > 0 && replyingTo.attachments[0].mime.startsWith("image/") && (
            <img
              src={replyingTo.attachments[0].thumbUrl || replyingTo.attachments[0].url}
              alt="Miniatura"
              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-700 mb-1">Respondiendo a</p>
            <p className="text-sm text-slate-700 line-clamp-2">{replyingTo.message.text || "Mensaje multimedia"}</p>
            {replyingTo.attachments.length > 0 && !replyingTo.attachments[0].mime.startsWith("image/") && (
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <span>{emojiForMime(replyingTo.attachments[0].mime)}</span>
                <span className="truncate">{replyingTo.attachments[0].filename}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onCancelReply} className="text-slate-400 hover:text-rose-500 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {file && previewUrl && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>Adjunto listo para enviar</span>
            <button type="button" onClick={removeFile} className="text-rose-500 hover:underline">
              Quitar
            </button>
          </div>
          {file.type.startsWith("image/") ? (
            <img src={previewUrl} alt={file.name} className="max-h-48 rounded-lg object-cover" />
          ) : (
            <p className="text-sm">{file.name}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3">
          <button
            type="button"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || sending}
            title="Adjuntar archivo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <div className="flex h-11 items-center">
            <QuickReplies onSelectReply={(message) => setText(message)} />
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            className="h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 focus:border-emerald-400 focus:outline-none focus:ring focus:ring-emerald-100"
            placeholder="Escribe un mensaje (Enter para enviar, Shift+Enter para salto de línea)"
            rows={1}
            disabled={disabled || sending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || sending || (!text.trim() && !file)}
            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-amber-600 transition">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
            />
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="font-medium">Nota interna (solo asesores)</span>
          </label>
        </div>
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

function emojiForMime(mime: string): string {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎞️";
  if (mime.startsWith("audio/")) return "🎧";
  if (mime === "application/pdf") return "📄";
  return "📎";
}
