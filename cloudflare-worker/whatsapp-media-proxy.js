/**
 * Cloudflare Worker - WhatsApp Media Proxy
 *
 * Este worker descarga archivos de media de WhatsApp Business API
 * y los devuelve al servidor que lo solicita.
 *
 * Uso:
 * POST https://your-worker.workers.dev/download
 * Body: { "mediaId": "123", "accessToken": "EAA..." }
 */

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      // Parse request body
      const { mediaId, accessToken, apiVersion } = await request.json();

      if (!mediaId || !accessToken) {
        return new Response(JSON.stringify({
          error: 'Missing mediaId or accessToken'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const version = apiVersion || 'v20.0';

      // Step 1: Get media URL from Meta
      console.log(`[Worker] Fetching metadata for media ID: ${mediaId}`);
      const metaUrl = `https://graph.facebook.com/${version}/${mediaId}`;

      const metaResponse = await fetch(metaUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!metaResponse.ok) {
        const errorText = await metaResponse.text();
        console.error(`[Worker] Error getting metadata: ${metaResponse.status}`, errorText);
        return new Response(JSON.stringify({
          error: 'Failed to get media metadata',
          status: metaResponse.status,
          details: errorText
        }), {
          status: metaResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const metadata = await metaResponse.json();

      if (!metadata.url) {
        return new Response(JSON.stringify({
          error: 'No URL in metadata',
          metadata
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[Worker] Downloading from: ${metadata.url.substring(0, 50)}...`);

      // Step 2: Download the actual file
      const mediaResponse = await fetch(metadata.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'curl/7.64.1', // Important!
        },
      });

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        console.error(`[Worker] Error downloading media: ${mediaResponse.status}`, errorText);
        return new Response(JSON.stringify({
          error: 'Failed to download media',
          status: mediaResponse.status,
          details: errorText
        }), {
          status: mediaResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 3: Return the file
      const fileBuffer = await mediaResponse.arrayBuffer();
      const mimeType = metadata.mime_type || 'application/octet-stream';

      console.log(`[Worker] Success! Downloaded ${fileBuffer.byteLength} bytes, mime: ${mimeType}`);

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.byteLength.toString(),
          'X-Media-Id': mediaId,
          'X-File-Size': metadata.file_size?.toString() || '',
        },
      });

    } catch (error) {
      console.error('[Worker] Exception:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};
