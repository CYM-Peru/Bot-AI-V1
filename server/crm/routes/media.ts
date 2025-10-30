import express, { type Request, type Response } from "express";
import { logDebug, logError } from "../../utils/file-logger";
import { getWhatsAppEnv } from "../../utils/env";
import axios from "axios";
import crypto from "crypto";

const router = express.Router();

/**
 * Calcula el appsecret_proof requerido por WhatsApp para algunas peticiones
 */
function calculateAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

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

  const whatsappEnv = getWhatsAppEnv();
  if (!whatsappEnv.accessToken) {
    logError("[Media Proxy] WHATSAPP_ACCESS_TOKEN not configured");
    res.status(500).json({ error: "Server not configured" });
    return;
  }

  // Calcular appsecret_proof si tenemos app secret
  const appsecretProof = whatsappEnv.appSecret
    ? calculateAppSecretProof(whatsappEnv.accessToken, whatsappEnv.appSecret)
    : undefined;

  try {
    logDebug(`[Media Proxy] Fetching metadata for media ID: ${mediaId}`);

    // Step 1: Get metadata usando axios
    let metaUrl = `${whatsappEnv.baseUrl}/${whatsappEnv.apiVersion}/${mediaId}`;
    if (appsecretProof) {
      metaUrl += `?appsecret_proof=${appsecretProof}`;
      logDebug(`[Media Proxy] Usando appsecret_proof para verificación`);
    }

    const metaResponse = await axios.get(metaUrl, {
      headers: {
        Authorization: `Bearer ${whatsappEnv.accessToken}`,
      },
    });

    const metadata = metaResponse.data as {
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

    // Agregar appsecret_proof a la URL de descarga si está disponible
    let downloadUrl = metadata.url;
    if (appsecretProof) {
      const separator = downloadUrl.includes('?') ? '&' : '?';
      downloadUrl += `${separator}appsecret_proof=${appsecretProof}`;
      logDebug(`[Media Proxy] Agregando appsecret_proof a URL de descarga`);
    }

    logDebug("[Media Proxy] Using axios with responseType: arraybuffer");

    // Step 2: Download binary file usando axios
    // Según Stack Overflow, axios funciona donde fetch falla
    const binaryResponse = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${whatsappEnv.accessToken}`,
        "User-Agent": "curl/7.64.1",
      },
      responseType: "arraybuffer",
      maxRedirects: 5,
      timeout: 30000,
    });

    logDebug(`[Media Proxy] ✅ Download successful with axios`);

    // Step 3: Set proper headers and send to client
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

    // Send the binary data
    const buffer = Buffer.from(binaryResponse.data);
    logDebug(`[Media Proxy] Sent ${buffer.length} bytes to client`);
    res.send(buffer);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError(`[Media Proxy] Axios error: HTTP ${error.response?.status}`, error.response?.data);
      res.status(error.response?.status || 500).json({
        error: "Failed to download media",
        details: error.message,
      });
    } else {
      logError("[Media Proxy] Exception:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

export default router;
