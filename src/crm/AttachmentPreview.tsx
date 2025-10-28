import type { Attachment } from "./types";

interface AttachmentPreviewProps {
  attachment: Attachment;
  compact?: boolean;
}

export default function AttachmentPreview({ attachment, compact = false }: AttachmentPreviewProps) {
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
    <div className="overflow-hidden rounded-lg border border-white/20 bg-white text-slate-700 shadow-sm">
      {isImage && <img src={attachment.url} alt={attachment.filename} className="max-h-64 w-full object-cover" loading="lazy" />}
      {isVideo && (
        <video controls className="w-full" src={attachment.url}>
          <track kind="captions" />
        </video>
      )}
      {isAudio && (
        <audio controls className="w-full">
          <source src={attachment.url} type={attachment.mime} />
        </audio>
      )}
      {!isImage && !isVideo && !isAudio && (
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-xl">{isPdf ? "📄" : "📎"}</span>
          <div>
            <p className="text-sm font-medium">{attachment.filename}</p>
            <p className="text-xs text-slate-500">{formatSize(attachment.size)}</p>
          </div>
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700"
          >
            Descargar
          </a>
        </div>
      )}
    </div>
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
