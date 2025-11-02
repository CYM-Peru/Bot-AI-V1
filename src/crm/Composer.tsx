import { useRef, useState } from "react";
import type { Attachment, Message } from "./types";
import AttachmentPreview from "./AttachmentPreview";
import QuickReplies from "./QuickReplies";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface ComposerProps {
  disabled?: boolean;
  onSend: (payload: { text: string; files?: File[]; replyToId?: string | null; isInternal?: boolean }) => Promise<void> | void;
  replyingTo: { message: Message; attachments: Attachment[] } | null;
  onCancelReply?: () => void;
}

export default function Composer({ disabled, onSend, replyingTo, onCancelReply }: ComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [sending, setSending] = useState(false);

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    // Agregar nuevos archivos a la lista existente
    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);

    // Crear URLs de preview
    const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls([...previewUrls, ...newUrls]);

    // Cerrar menú de adjuntos
    setShowAttachmentMenu(false);
  };

  const handleSend = async () => {
    if (sending || (!text.trim() && files.length === 0)) return;
    setSending(true);
    try {
      await onSend({
        text: text.trim(),
        files: files.length > 0 ? files : undefined,
        replyToId: replyingTo?.message.id ?? null,
        isInternal
      });
      setText("");
      setFiles([]);
      setIsInternal(false);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
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
    // Send on Enter (without Shift) or Ctrl+Enter / Cmd+Enter
    if (event.key === "Enter" && (!event.shiftKey || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSend();
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const urlToRevoke = previewUrls[index];
    const newUrls = previewUrls.filter((_, i) => i !== index);

    setFiles(newFiles);
    if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    setPreviewUrls(newUrls);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText(text + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const triggerFileInput = (accept?: string) => {
    if (inputRef.current) {
      inputRef.current.accept = accept || "*/*";
      inputRef.current.click();
    }
    setShowAttachmentMenu(false);
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

      {/* Multiple Files Preview */}
      {files.length > 0 && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{files.length} archivo{files.length > 1 ? 's' : ''} listo{files.length > 1 ? 's' : ''} para enviar</span>
            <button type="button" onClick={() => {
              previewUrls.forEach(url => URL.revokeObjectURL(url));
              setFiles([]);
              setPreviewUrls([]);
            }} className="text-rose-500 hover:underline font-medium">
              Quitar todos
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 z-10 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-lg"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {file.type.startsWith("image/") ? (
                  <img src={previewUrls[index]} alt={file.name} className="h-24 w-full rounded-lg object-cover border border-slate-200" />
                ) : (
                  <div className="h-24 w-full rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-2">
                    <span className="text-2xl mb-1">{emojiForMime(file.type)}</span>
                    <span className="text-xs text-slate-600 truncate w-full text-center">{file.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3 relative">
          {/* Attachment Menu */}
          {showAttachmentMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAttachmentMenu(false)}
              />
              <div className="absolute bottom-14 left-0 z-50 w-64 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800">Adjuntar archivos</h3>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => triggerFileInput("image/*")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-50 transition text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Fotos y videos</p>
                      <p className="text-xs text-slate-500">Archivos multimedia</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerFileInput("application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-blue-50 transition text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Documentos</p>
                      <p className="text-xs text-slate-500">PDF, Word, Excel</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerFileInput("audio/*")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-orange-50 transition text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Audio</p>
                      <p className="text-xs text-slate-500">Archivos de audio</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerFileInput()}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Otros archivos</p>
                      <p className="text-xs text-slate-500">Cualquier tipo</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowEmojiPicker(false)}
              />
              <div className="absolute bottom-14 left-0 z-50">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={350}
                  height={450}
                  searchPlaceholder="Buscar emoji..."
                  previewConfig={{ showPreview: false }}
                />
              </div>
            </>
          )}

          <button
            type="button"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
            onClick={() => {
              setShowAttachmentMenu(!showAttachmentMenu);
              setShowEmojiPicker(false);
            }}
            disabled={disabled || sending}
            title="Adjuntar archivos"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button
            type="button"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-600"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachmentMenu(false);
            }}
            disabled={disabled || sending}
            title="Insertar emoji"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            disabled={disabled || sending || (!text.trim() && files.length === 0)}
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
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFilesChange}
        multiple
      />
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
