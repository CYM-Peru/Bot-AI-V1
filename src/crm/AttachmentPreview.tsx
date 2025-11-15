import { useState } from "react";
import type { Attachment } from "./types";

interface AttachmentPreviewProps {
  attachment: Attachment;
  compact?: boolean;
}

export default function AttachmentPreview({ attachment, compact = false }: AttachmentPreviewProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Download handler that properly sets the filename with extension
  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDownloading) return;

    setIsDownloading(true);
    try {
      // Fetch the file as a blob
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error('Error al descargar el archivo');

      const blob = await response.blob();

      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.filename; // This will work with blob URLs
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL after a short delay
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error descargando archivo:', error);
      alert('Error al descargar el archivo. Por favor intenta de nuevo.');
    } finally {
      setIsDownloading(false);
    }
  };

  const mime = attachment.mime || "application/octet-stream";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isPdf = mime === "application/pdf";

  if (compact) {
    // For images, show a thumbnail instead of just filename
    if (isImage && attachment.thumbUrl) {
      return (
        <div className="flex items-center gap-2 rounded-md bg-white/70 overflow-hidden border border-white/40">
          <img
            src={attachment.thumbUrl || attachment.url}
            alt={attachment.filename}
            className="h-12 w-12 object-cover flex-shrink-0"
            loading="lazy"
            onError={() => setImageError(true)}
          />
          <span className="truncate pr-2 text-xs text-slate-700 font-medium" title={attachment.filename}>
            {attachment.filename}
          </span>
        </div>
      );
    }

    // For other file types, show emoji + filename
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
              className="max-h-80 w-full object-contain cursor-pointer transition hover:opacity-90 bg-slate-50"
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
                className="inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur-sm cursor-pointer"
                onClick={handleDownload}
              >
                {isDownloading ? '⏳ Descargando...' : '⬇️ Descargar'}
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
                className="inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur-sm cursor-pointer"
                onClick={handleDownload}
              >
                {isDownloading ? '⏳ Descargando...' : '⬇️ Descargar'}
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
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 cursor-pointer hover:bg-emerald-50"
              onClick={handleDownload}
            >
              {isDownloading ? '⏳ Descargando...' : '⬇️ Descargar'}
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
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50 cursor-pointer"
              onClick={handleDownload}
            >
              {isDownloading ? '⏳ Descargando...' : '⬇️ Descargar'}
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
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 cursor-pointer"
              onClick={handleDownload}
            >
              {isDownloading ? '⏳ Descargando...' : '⬇️ Descargar'}
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
  const mime = attachment.mime || "application/octet-stream";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎞️";
  if (mime.startsWith("audio/")) return "🎧";
  if (mime === "application/pdf") return "📄";
  return "📎";
}
