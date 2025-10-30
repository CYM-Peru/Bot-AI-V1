#!/bin/bash
set -euo pipefail

echo "============================================"
echo "🔧 PLAN B: PROXY SEPARADO PARA MEDIA WHATSAPP"
echo "============================================"
echo ""

echo "📋 Este script creará un servicio proxy independiente en el puerto 3080"
echo "   que descargará media de WhatsApp usando axios (que funciona mejor que fetch)"
echo ""

# Crear directorio para el proxy
echo "📁 Creando directorio /opt/media-proxy..."
mkdir -p /opt/media-proxy
cd /opt/media-proxy

# Instalar axios en el directorio del proxy
echo "📦 Instalando axios..."
npm init -y > /dev/null 2>&1
npm install axios > /dev/null 2>&1

echo "📝 Creando servidor proxy con axios..."
cat > /opt/media-proxy/server.cjs <<'EOF'
const http = require('http');
const axios = require('axios');

const PORT  = process.env.MEDIA_PROXY_PORT || 3080;
const TOKEN = process.env.META_WABA_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v20.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function send(res, code, body, headers = {}) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...headers
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

if (!TOKEN) {
  console.error('❌ META_WABA_TOKEN o WHATSAPP_ACCESS_TOKEN no definido');
  process.exit(1);
}

console.log('✅ Token configurado');
console.log(`🚀 Graph API: ${GRAPH}`);

const srv = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');

    // Health check
    if (u.pathname === '/health') {
      return send(res, 200, { ok: true, timestamp: new Date().toISOString() });
    }

    // Match /media/:id
    const m = u.pathname.match(/^\/media\/([^/]+)$/);
    if (!m) {
      return send(res, 404, { error: 'not_found', path: u.pathname });
    }

    const mediaId = decodeURIComponent(m[1]);
    console.log(`[${new Date().toISOString()}] 📥 Descargando media: ${mediaId}`);

    // PASO 1: Obtener metadata con axios
    const metaUrl = `${GRAPH}/${mediaId}`;
    console.log(`  → Metadata URL: ${metaUrl}`);

    const metaResponse = await axios.get(metaUrl, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
    });

    const meta = metaResponse.data;

    if (!meta.url) {
      console.error('  ❌ No URL in metadata');
      return send(res, 500, { error: 'no_url_in_metadata' });
    }

    console.log(`  → Download URL: ${meta.url.substring(0, 60)}...`);
    console.log(`  → MIME: ${meta.mime_type || 'unknown'}`);

    // PASO 2: Descargar archivo binario con axios + arraybuffer
    const binaryResponse = await axios.get(meta.url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'curl/7.64.1',
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 30000,
    });

    const buffer = Buffer.from(binaryResponse.data);
    console.log(`  ✅ Descargado: ${buffer.length} bytes`);

    // PASO 3: Enviar al cliente
    const mime = meta.mime_type || 'application/octet-stream';
    const filename = (meta.file_name || mediaId).replace(/[^A-Za-z0-9._-]/g, '_');
    const disp = /image|video/.test(mime) ? 'inline' : 'attachment';

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': `${disp}; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });

    res.end(buffer);
    console.log(`  ✅ Enviado al cliente`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('   HTTP Status:', error.response?.status);
      console.error('   Response:', error.response?.data);
      return send(res, error.response?.status || 500, {
        error: 'axios_error',
        message: error.message,
        status: error.response?.status
      });
    }
    send(res, 500, { error: 'proxy_error', message: error.message });
  }
});

srv.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('============================================');
  console.log(`✅ Media Proxy Server ACTIVO`);
  console.log(`🌐 Puerto: ${PORT}`);
  console.log(`📡 Escuchando en: http://0.0.0.0:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('============================================');
  console.log('');
});
EOF

echo ""
echo "🔑 Obteniendo token de WhatsApp..."

# Tomar token desde .env
cd /opt/flow-builder
TOKEN="${META_WABA_TOKEN:-}"
[ -z "${TOKEN}" ] && TOKEN="$(grep '^WHATSAPP_ACCESS_TOKEN=' .env 2>/dev/null | cut -d'=' -f2 | xargs || echo '')"
[ -z "${TOKEN}" ] && TOKEN="$(grep '^WSP_ACCESS_TOKEN=' .env 2>/dev/null | cut -d'=' -f2 | xargs || echo '')"

if [ -z "${TOKEN}" ]; then
    echo "❌ No se encontró token en .env"
    echo "   Verifica que exista WHATSAPP_ACCESS_TOKEN o WSP_ACCESS_TOKEN en /opt/flow-builder/.env"
    exit 1
fi

echo "✅ Token encontrado (${#TOKEN} caracteres)"
echo ""

# Detener instancia previa si existe
echo "🔄 Deteniendo instancia previa (si existe)..."
pm2 delete media-proxy-3080 2>/dev/null || true

echo "🚀 Iniciando servicio proxy con PM2..."
cd /opt/media-proxy
META_WABA_TOKEN="${TOKEN}" \
WHATSAPP_ACCESS_TOKEN="${TOKEN}" \
MEDIA_PROXY_PORT=3080 \
FB_GRAPH_VERSION="v20.0" \
pm2 start server.cjs --name media-proxy-3080 --time

pm2 save

echo ""
echo "⏳ Esperando a que el servicio inicie (3 segundos)..."
sleep 3

echo ""
echo "🏥 Verificando health check..."
HEALTH=$(curl -sS http://127.0.0.1:3080/health || echo '{"error": true}')
echo "   Response: $HEALTH"

if echo "$HEALTH" | grep -q '"ok":true'; then
    echo "✅ Servicio funcionando correctamente"
else
    echo "❌ Servicio no responde correctamente"
    echo "   Revisa los logs: pm2 logs media-proxy-3080"
    exit 1
fi

echo ""
echo "============================================"
echo "✅ PROXY SEPARADO INSTALADO Y FUNCIONANDO"
echo "============================================"
echo ""
echo "📡 El proxy está escuchando en:"
echo "   - Interno: http://127.0.0.1:3080"
echo "   - Externo: http://147.93.10.141:3080 (si el puerto está abierto)"
echo ""
echo "🧪 Para probar manualmente (reemplaza MEDIA_ID):"
echo "   curl http://127.0.0.1:3080/media/MEDIA_ID -o test.jpg"
echo ""
echo "📊 Ver logs en tiempo real:"
echo "   pm2 logs media-proxy-3080"
echo ""
echo "🔧 SIGUIENTE PASO: Configurar tu app para usar este proxy"
echo ""
echo "Opción 1: Modificar server/crm/storage.ts"
echo "   Cambiar la URL base de attachments a:"
echo "   http://127.0.0.1:3080/media/{id}"
echo ""
echo "Opción 2: Exponer vía nginx (recomendado para producción)"
echo "   location /media-proxy/ {"
echo "       proxy_pass http://127.0.0.1:3080/;"
echo "       proxy_set_header Host \$host;"
echo "   }"
echo ""
