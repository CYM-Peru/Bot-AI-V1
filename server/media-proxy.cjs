/**
 * Media Proxy Server - Node.js
 *
 * Proxy local para descargar media de WhatsApp Business API
 * Escucha en puerto 3080 por defecto
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.MEDIA_PROXY_PORT || 3080;
const ACCESS_TOKEN = process.env.META_WABA_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const APP_SECRET = process.env.FB_APP_SECRET;
const API_VERSION = process.env.FB_GRAPH_VERSION || 'v20.0';

if (!ACCESS_TOKEN) {
  console.error('ERROR: META_WABA_TOKEN o WHATSAPP_ACCESS_TOKEN no configurado');
  process.exit(1);
}

// Generar appsecret_proof si tenemos el app secret
let appsecretProof = null;
if (APP_SECRET) {
  appsecretProof = crypto.createHmac('sha256', APP_SECRET).update(ACCESS_TOKEN).digest('hex');
  console.log(`[Proxy] App Secret configurado - usando appsecret_proof`);
}

console.log(`[Proxy] Iniciando con API version: ${API_VERSION}`);
console.log(`[Proxy] Token configurado: ${ACCESS_TOKEN.substring(0, 20)}...`);

// Endpoint: GET /media/:mediaId
app.get('/media/:mediaId', async (req, res) => {
  const { mediaId } = req.params;

  console.log(`[Proxy] Descargando media ID: ${mediaId}`);

  try {
    // Step 1: Obtener metadata de Facebook
    let metaUrl = `https://graph.facebook.com/${API_VERSION}/${mediaId}`;

    // Agregar appsecret_proof si está disponible
    if (appsecretProof) {
      metaUrl += `?appsecret_proof=${appsecretProof}`;
    }

    console.log(`[Proxy] Obteniendo metadata: ${metaUrl.replace(appsecretProof || '', 'XXX')}`);

    const metaResponse = await axios.get(metaUrl, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    });

    const metadata = metaResponse.data;

    if (!metadata.url) {
      console.error('[Proxy] Metadata no contiene URL');
      return res.status(500).json({
        error: 'no_url_in_metadata',
        metadata
      });
    }

    console.log(`[Proxy] URL de descarga: ${metadata.url.substring(0, 60)}...`);

    // Step 2: Descargar el archivo
    // Agregar appsecret_proof a la URL de descarga también
    let downloadUrl = metadata.url;
    if (appsecretProof && !downloadUrl.includes('appsecret_proof')) {
      const separator = downloadUrl.includes('?') ? '&' : '?';
      downloadUrl += `${separator}appsecret_proof=${appsecretProof}`;
    }

    const mediaResponse = await axios.get(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'User-Agent': 'curl/7.64.1',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(mediaResponse.data);
    const mimeType = metadata.mime_type || 'application/octet-stream';

    console.log(`[Proxy] ✅ Descarga exitosa: ${buffer.length} bytes, mime: ${mimeType}`);

    // Step 3: Devolver el archivo
    res.set({
      'Content-Type': mimeType,
      'Content-Length': buffer.length,
      'X-Media-Id': mediaId,
      'X-File-Size': metadata.file_size || buffer.length,
    });

    res.send(buffer);

  } catch (error) {
    console.error(`[Proxy] Error descargando media ${mediaId}:`, error.message);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;

      console.error(`[Proxy] HTTP ${status}:`, details);

      return res.status(status).json({
        error: 'download_failed',
        details
      });
    }

    res.status(500).json({
      error: 'internal_error',
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    token_configured: !!ACCESS_TOKEN,
    api_version: API_VERSION
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Proxy] ✅ Media proxy escuchando en http://127.0.0.1:${PORT}`);
  console.log(`[Proxy] Health check: http://127.0.0.1:${PORT}/health`);
  console.log(`[Proxy] Endpoint: http://127.0.0.1:${PORT}/media/:mediaId`);
});
