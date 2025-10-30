import express, { type Request, type Response } from "express";
import { logDebug, logError } from "../../utils/file-logger";

const router = express.Router();

const GRAPH_API_BASE = process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com";
const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * GET /crm/media/:id
 *
 * Proxy endpoint para descargar media de WhatsApp.
 * Obtiene la URL de descarga desde Graph API y luego descarga el archivo binario.
 */
router.get("/media/:id", async (req: Request, res: Response) => {
  const mediaId = req.params.id;

  if (!mediaId) {
    res.status(400).json({ error: "Missing media ID" });
    return;
  }

  if (!ACCESS_TOKEN) {
    logError("[Media Proxy] WHATSAPP_ACCESS_TOKEN not configured");
    res.status(500).json({ error: "Server not configured" });
    return;
  }

  try {
    logDebug(`[Media Proxy] Fetching metadata for media ID: ${mediaId}`);

    // Step 1: Get metadata (URL, mime_type, etc.)
    const metaUrl = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${mediaId}`;
    const metaResponse = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    if (!metaResponse.ok) {
      logError(`[Media Proxy] Failed to get metadata: HTTP ${metaResponse.status}`);
      res.status(metaResponse.status).json({ error: "Failed to get media metadata" });
      return;
    }

    const metadata = (await metaResponse.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
      sha256?: string;
      id?: string;
    };

    if (!metadata.url) {
      logError("[Media Proxy] No URL in metadata");
      res.status(500).json({ error: "No download URL" });
      return;
    }

    logDebug(`[Media Proxy] Downloading from: ${metadata.url.substring(0, 50)}...`);

    // Step 2: Download binary file
    // Try multiple methods to handle Meta's weird authentication
    let binaryResponse: Response | null = null;

    // Method 1: With Authorization header
    logDebug("[Media Proxy] Attempt 1: With Authorization Bearer");
    binaryResponse = await fetch(metadata.url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "User-Agent": "curl/7.64.1",
      },
    });

    // Method 2: Without Authorization (signed URL)
    if (!binaryResponse.ok && binaryResponse.status === 404) {
      logDebug("[Media Proxy] Attempt 2: Without Authorization (signed URL)");
      binaryResponse = await fetch(metadata.url, {
        headers: {
          "User-Agent": "curl/7.64.1",
        },
      });
    }

    // Method 3: Authorization without Bearer prefix
    if (!binaryResponse.ok && binaryResponse.status === 401) {
      logDebug("[Media Proxy] Attempt 3: Authorization without Bearer");
      binaryResponse = await fetch(metadata.url, {
        headers: {
          Authorization: ACCESS_TOKEN,
          "User-Agent": "curl/7.64.1",
        },
      });
    }

    if (!binaryResponse.ok) {
      const errorText = await binaryResponse.text();
      logError(`[Media Proxy] Failed to download: HTTP ${binaryResponse.status}`, errorText);
      res.status(binaryResponse.status).json({
        error: "Failed to download media",
        details: errorText,
      });
      return;
    }

    logDebug(`[Media Proxy] Download successful, streaming to client`);

    // Step 3: Set proper headers and stream to client
    const mimeType = metadata.mime_type || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);

    const filename = `${mediaId}`;
    const disposition = /^(image|video)/.test(mimeType)
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;
    res.setHeader("Content-Disposition", disposition);

    if (metadata.file_size) {
      res.setHeader("Content-Length", metadata.file_size.toString());
    }

    // Cache for 1 hour (media doesn't change)
    res.setHeader("Cache-Control", "public, max-age=3600");

    // Stream the binary data to the client
    const arrayBuffer = await binaryResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logDebug(`[Media Proxy] Sent ${buffer.length} bytes to client`);
    res.send(buffer);
  } catch (error) {
    logError("[Media Proxy] Exception:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
