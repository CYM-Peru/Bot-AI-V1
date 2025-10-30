import { useState } from "react";
import type { Attachment } from "./types";

interface AttachmentPreviewProps {
  attachment: Attachment;
  compact?: boolean;
}

export default function AttachmentPreview({ attachment, compact = false }: AttachmentPreviewProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  console.log("[AttachmentPreview] Renderizando attachment:", {
    id: attachment.id,
    filename: attachment.filename,
    url: attachment.url,
    thumbUrl: attachment.thumbUrl,
    mime: attachment.mime
  });

  const isImage = attachment.mime.startsWith("image/");
  const isVideo = attachment.mime.startsWith("video/");
  const isAudio = attachment.mime.startsWith("audio/");
  const isPdf = attachment.mime === "application/pdf";

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-white/70 px-2 py-1 text-xs text-slate-600">
        <span>{emojiForAttachment(attachment)}</span>
        <span className="truncate" title={attachment.filename}>
          {attachment.filename}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-white/20 bg-white text-slate-700 shadow-sm">
        {isImage && (
          <div className="relative group">
            <img
              src={attachment.thumbUrl || attachment.url}
              alt={attachment.filename}
              className="max-h-64 w-full object-cover cursor-pointer transition hover:opacity-90"
              loading="lazy"
              onClick={() => setShowModal(true)}
              onError={() => setImageError(true)}
            />
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <p className="text-sm text-slate-500">Error al cargar imagen</p>
              </div>
            )}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
              <a
                href={attachment.url}
                download={attachment.filename}
                className="inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                ⬇️ Descargar
              </a>
            </div>
          </div>
        )}
        {isVideo && (
          <div className="relative group">
            <video controls className="w-full" poster={attachment.thumbUrl || undefined}>
              <source src={attachment.url} type={attachment.mime} />
              Tu navegador no soporta el elemento de video.
            </video>
            <div className="absolute bottom-2 right-2">
              <a
                href={attachment.url}
                download={attachment.filename}
                className="inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur-sm"
              >
                ⬇️ Descargar
              </a>
            </div>
          </div>
        )}
        {isAudio && (
          <div className="p-3">
            <audio controls className="w-full mb-2">
              <source src={attachment.url} type={attachment.mime} />
              Tu navegador no soporta el elemento de audio.
            </audio>
            <a
              href={attachment.url}
              download={attachment.filename}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700"
            >
              ⬇️ Descargar
            </a>
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl">{isPdf ? "📄" : "📎"}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{attachment.filename}</p>
              <p className="text-xs text-slate-500">{formatSize(attachment.size)}</p>
            </div>
            <a
              href={attachment.url}
              download={attachment.filename}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
            >
              ⬇️ Descargar
            </a>
          </div>
        )}
      </div>

      {/* Modal para ver imagen en tamaño completo */}
      {showModal && isImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 rounded-full bg-white/20 px-4 py-2 text-white backdrop-blur-sm hover:bg-white/30"
            >
              ✕ Cerrar
            </button>
            <a
              href={attachment.url}
              download={attachment.filename}
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
              onClick={(e) => e.stopPropagation()}
            >
              ⬇️ Descargar
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function formatSize(size: number): string {
  if (!size) return "";
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function emojiForAttachment(attachment: Attachment): string {
  if (attachment.mime.startsWith("image/")) return "🖼️";
  if (attachment.mime.startsWith("video/")) return "🎞️";
  if (attachment.mime.startsWith("audio/")) return "🎧";
  if (attachment.mime === "application/pdf") return "📄";
  return "📎";
}
