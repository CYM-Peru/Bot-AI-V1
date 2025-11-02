import { Router } from "express";
import { attachmentStorage } from "../storage";
import { crmDb } from "../db";

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
      const attachment = crmDb.getAttachment(req.params.id);
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
      if (!filename || !mime || !data) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }
      const buffer = Buffer.from(data, "base64");
      const stored = await attachmentStorage.saveBuffer({ buffer, filename, mime });
      const attachment = crmDb.storeAttachment({
        id: stored.id,
        msgId: null,
        filename,
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
