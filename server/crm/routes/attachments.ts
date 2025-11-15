import { Router } from "express";
import path from "path";
import { attachmentStorage } from "../storage";
import { crmDb } from "../db-postgres";

// Security constants for file uploads (based on WhatsApp limits)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (WhatsApp document limit)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'audio/mpeg',
  'audio/ogg',
  'audio/aac',
  'audio/amr',
  'video/mp4',
  'video/3gpp',
  'video/webm',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

/**
 * Creates PUBLIC router for attachments (GET endpoint)
 * This is needed so bots can download files without authentication
 */
export function createPublicAttachmentsRouter() {
  const router = Router();

  router.get("/:id", async (req, res) => {
    try {
      // Try to get metadata from storage first (works even if not in DB)
      const metadata = await attachmentStorage.getMetadata(req.params.id);
      if (!metadata) {
        res.status(404).end();
        return;
      }

      // Try to get attachment from DB for filename
      const attachment = await crmDb.getAttachment(req.params.id);
      const filename = attachment?.filename || metadata.filename || "attachment";

      res.setHeader("Content-Type", metadata.mime);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

      const stream = await attachmentStorage.getStream(req.params.id);
      if (!stream) {
        res.status(404).end();
        return;
      }
      stream.pipe(res);
    } catch (error) {
      console.error("[CRM] attachment download error", error);
      res.status(500).end();
    }
  });

  return router;
}

/**
 * Creates PRIVATE router for attachments (POST endpoint)
 * Requires authentication
 */
export function createAttachmentsRouter() {
  const router = Router();

  router.post("/upload", async (req, res) => {
    try {
      const { filename, mime, data } = req.body as { filename?: string; mime?: string; data?: string };

      // Validate required fields
      if (!filename || !mime || !data) {
        res.status(400).json({ error: "invalid_payload", message: "Missing required fields" });
        return;
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(mime)) {
        res.status(400).json({
          error: "invalid_file_type",
          message: "File type not allowed",
          allowedTypes: ALLOWED_MIME_TYPES
        });
        return;
      }

      // Validate base64 data
      if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
        res.status(400).json({ error: "invalid_data", message: "Invalid base64 data" });
        return;
      }

      // Decode and validate file size
      const buffer = Buffer.from(data, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        res.status(413).json({
          error: "file_too_large",
          message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
          maxSize: MAX_FILE_SIZE
        });
        return;
      }

      // Sanitize filename - prevent path traversal
      const sanitizedFilename = path.basename(filename).replace(/[^a-zA-Z0-9._\-\s]/g, '_');
      if (sanitizedFilename.length === 0 || sanitizedFilename === '.' || sanitizedFilename === '..') {
        res.status(400).json({ error: "invalid_filename", message: "Invalid filename" });
        return;
      }

      // Store the file
      const stored = await attachmentStorage.saveBuffer({
        buffer,
        filename: sanitizedFilename,
        mime
      });

      const attachment = await crmDb.storeAttachment({
        id: stored.id,
        msgId: null,
        filename: sanitizedFilename,
        mime,
        size: stored.size,
        url: stored.url,
        thumbUrl: stored.url,
      });

      res.json({ attachment });
    } catch (error) {
      console.error("[CRM] upload error", error);
      res.status(500).json({ error: "upload_failed" });
    }
  });

  return router;
}
