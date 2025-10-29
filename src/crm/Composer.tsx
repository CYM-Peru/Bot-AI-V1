import { useRef, useState } from "react";
import type { Attachment, Message } from "./types";
import AttachmentPreview from "./AttachmentPreview";

interface ComposerProps {
  disabled?: boolean;
  onSend: (payload: { text: string; file?: File | null; replyToId?: string | null }) => Promise<void> | void;
  replyingTo: { message: Message; attachments: Attachment[] } | null;
  onCancelReply?: () => void;
}

export default function Composer({ disabled, onSend, replyingTo, onCancelReply }: ComposerProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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
      await onSend({ text: text.trim(), file, replyToId: replyingTo?.message.id ?? null });
      setText("");
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      onCancelReply?.();
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
        <div className="mb-3 flex items-start justify-between rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
          <div>
            <p className="text-xs font-semibold text-emerald-700">Respondiendo a</p>
            <p className="line-clamp-2 text-sm">{replyingTo.message.text || "Mensaje"}</p>
            {replyingTo.attachments.length > 0 && (
              <div className="mt-2 max-w-xs">
                <AttachmentPreview attachment={replyingTo.attachments[0]} compact />
              </div>
            )}
          </div>
          <button type="button" onClick={onCancelReply} className="text-xs text-slate-400 hover:text-rose-500">
            Cerrar
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
        <textarea
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
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
