#!/bin/bash
set -euo pipefail

echo "============================================"
echo "🚀 DESPLIEGUE DE FIX PARA ADJUNTOS WHATSAPP"
echo "============================================"
echo ""

cd /opt/flow-builder

echo "📋 Paso 1: Verificando configuración de token..."
echo ""

# Verificar si existe el token en .env
TOKEN_ENV=$(grep "^WHATSAPP_ACCESS_TOKEN=" .env 2>/dev/null | cut -d'=' -f2 | xargs || echo "")
TOKEN_WSP=$(grep "^WSP_ACCESS_TOKEN=" .env 2>/dev/null | cut -d'=' -f2 | xargs || echo "")

# Verificar si existe el archivo de secrets
if [ -f "data/secrets/whatsapp.json" ]; then
    echo "✅ Encontrado: data/secrets/whatsapp.json"
    HAS_SECRETS=true
else
    echo "⚠️  No existe: data/secrets/whatsapp.json"
    HAS_SECRETS=false
fi

# Verificar tokens en .env
if [ -n "$TOKEN_ENV" ] && [ "$TOKEN_ENV" != "" ]; then
    echo "✅ Token configurado en .env (WHATSAPP_ACCESS_TOKEN)"
    HAS_TOKEN=true
elif [ -n "$TOKEN_WSP" ] && [ "$TOKEN_WSP" != "" ]; then
    echo "✅ Token configurado en .env (WSP_ACCESS_TOKEN)"
    HAS_TOKEN=true
elif [ "$HAS_SECRETS" = true ]; then
    echo "✅ Token podría estar en data/secrets/whatsapp.json"
    HAS_TOKEN=true
else
    echo "❌ ERROR: No se encontró WHATSAPP_ACCESS_TOKEN en ningún lado"
    echo ""
    echo "Necesitas configurar el token en UNO de estos lugares:"
    echo "1. En .env: WHATSAPP_ACCESS_TOKEN=tu_token_aqui"
    echo "2. En data/secrets/whatsapp.json: {\"accessToken\": \"tu_token_aqui\"}"
    echo ""
    exit 1
fi

echo ""
echo "📦 Paso 2: Descargando cambios desde GitHub..."
git fetch origin
git pull origin claude/bitrix-waba-connection-fix-011CUc71xRXz1f38URo63thz

echo ""
echo "📚 Paso 3: Instalando dependencias (axios)..."
npm install

echo ""
echo "🔄 Paso 4: Reiniciando servidor con PM2..."
pm2 restart bot-ai

echo ""
echo "⏳ Esperando a que el servidor inicie (5 segundos)..."
sleep 5

echo ""
echo "🏥 Paso 5: Verificando que el servidor esté corriendo..."
if pm2 describe bot-ai > /dev/null 2>&1; then
    echo "✅ Servidor bot-ai está corriendo"
else
    echo "❌ ERROR: Servidor no está corriendo"
    echo "Ejecuta: pm2 logs bot-ai"
    exit 1
fi

echo ""
echo "📊 Paso 6: Verificando logs recientes..."
echo "----------------------------------------"
pm2 logs bot-ai --lines 20 --nostream
echo "----------------------------------------"

echo ""
echo "============================================"
echo "✅ DESPLIEGUE COMPLETADO"
echo "============================================"
echo ""
echo "🧪 PASOS PARA PROBAR:"
echo ""
echo "1. Abre WhatsApp Business API"
echo "2. Envía una IMAGEN NUEVA a tu número de WhatsApp"
echo "3. Monitorea los logs en tiempo real:"
echo "   pm2 logs bot-ai"
echo ""
echo "4. Deberías ver en los logs:"
echo "   [CRM][Media] Obteniendo metadata de: https://graph.facebook.com/..."
echo "   [CRM][Media] URL completa de descarga: https://lookaside.fbsbx.com/..."
echo "   [CRM][Media] Descargando con axios (responseType: arraybuffer)..."
echo "   [CRM][Media] ✅ Descarga exitosa con axios: XXXX bytes"
echo ""
echo "5. Verifica en tu CRM que la imagen aparezca correctamente"
echo ""
echo "📝 Logs adicionales en: logs/debug.log"
echo "   tail -f /opt/flow-builder/logs/debug.log"
echo ""
echo "⚠️  Si NO funciona, avísame para implementar el Plan B (proxy separado)"
echo ""
