import { Router } from "express";
import { attachmentStorage } from "../storage";
import { crmDb } from "../db";

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

  router.get("/:id", async (req, res) => {
    try {
      const attachment = crmDb.getAttachment(req.params.id);
      if (!attachment) {
        res.status(404).end();
        return;
      }
      const metadata = await attachmentStorage.getMetadata(req.params.id);
      if (!metadata) {
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", metadata.mime);
      res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
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
