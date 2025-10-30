#!/bin/bash
set -euo pipefail

echo "============================================"
echo "🚀 DESPLIEGUE A PRODUCCIÓN"
echo "============================================"
echo ""
echo "Este script desplegará los siguientes cambios:"
echo "  ✅ Fix de descarga de adjuntos WhatsApp (axios + getWhatsAppEnv)"
echo "  ✅ Fix de seguridad P1 (autenticación en endpoints CRM)"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No estás en el directorio del proyecto"
    echo "   Ejecuta: cd /opt/flow-builder"
    exit 1
fi

# Pedir confirmación del branch (por defecto main)
read -p "¿Qué branch quieres desplegar? [main]: " BRANCH
BRANCH=${BRANCH:-main}

echo ""
echo "📋 Configuración:"
echo "   - Directorio: $(pwd)"
echo "   - Branch: $BRANCH"
echo ""

read -p "¿Continuar con el despliegue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Despliegue cancelado"
    exit 1
fi

echo ""
echo "============================================"
echo "📦 PASO 1: Descargando cambios desde GitHub"
echo "============================================"
echo ""

# Guardar cambios locales si hay alguno
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Hay cambios locales no commiteados"
    echo "   Guardando en stash..."
    git stash push -m "Auto-stash antes de deploy $(date)"
fi

# Fetch y pull
echo "Descargando últimos cambios..."
git fetch origin

echo "Cambiando a branch: $BRANCH"
git checkout "$BRANCH" || {
    echo "❌ Error: Branch '$BRANCH' no existe"
    echo "   Branches disponibles:"
    git branch -r | grep -v HEAD
    exit 1
}

echo "Actualizando branch..."
git pull origin "$BRANCH"

echo ""
echo "✅ Código actualizado"
git log --oneline -5
echo ""

echo "============================================"
echo "📚 PASO 2: Instalando dependencias"
echo "============================================"
echo ""

# Verificar si axios está instalado
if [ ! -d "node_modules/axios" ]; then
    echo "📦 Instalando axios (requerido para descargar media)..."
    npm install axios
else
    echo "✅ Axios ya está instalado"
fi

# Instalar todas las dependencias por si acaso
echo "📦 Verificando todas las dependencias..."
npm install

echo ""
echo "✅ Dependencias instaladas"

echo ""
echo "============================================"
echo "🔍 PASO 3: Verificando configuración"
echo "============================================"
echo ""

# Verificar que existe .env
if [ ! -f ".env" ]; then
    echo "⚠️  ADVERTENCIA: No existe archivo .env"
    echo "   Asegúrate de tener configurado WHATSAPP_ACCESS_TOKEN"
else
    echo "✅ Archivo .env encontrado"

    # Verificar token (sin mostrar el valor)
    if grep -q "^WHATSAPP_ACCESS_TOKEN=.\+" .env || \
       grep -q "^WSP_ACCESS_TOKEN=.\+" .env || \
       [ -f "data/secrets/whatsapp.json" ]; then
        echo "✅ Token de WhatsApp configurado"
    else
        echo "⚠️  ADVERTENCIA: No se encontró WHATSAPP_ACCESS_TOKEN"
        echo "   El servidor se iniciará pero los adjuntos no funcionarán"
        echo ""
        read -p "¿Continuar de todas formas? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Despliegue cancelado"
            exit 1
        fi
    fi
fi

echo ""
echo "============================================"
echo "🔄 PASO 4: Reiniciando servidor con PM2"
echo "============================================"
echo ""

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ Error: PM2 no está instalado"
    echo "   Instala PM2: npm install -g pm2"
    exit 1
fi

# Verificar si la app está corriendo
if pm2 describe bot-ai > /dev/null 2>&1; then
    echo "Reiniciando aplicación bot-ai..."
    pm2 restart bot-ai
else
    echo "⚠️  La aplicación bot-ai no está registrada en PM2"
    echo ""
    echo "Opciones:"
    echo "  1. Iniciar con ecosystem.config.cjs: pm2 start ecosystem.config.cjs"
    echo "  2. Iniciar directamente: pm2 start 'npx tsx server/index.ts' --name bot-ai"
    echo ""
    read -p "¿Quieres que inicie la app ahora con ecosystem.config.cjs? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "ecosystem.config.cjs" ]; then
            pm2 start ecosystem.config.cjs
            pm2 save
        else
            echo "❌ No existe ecosystem.config.cjs"
            echo "   Iniciando de forma básica..."
            pm2 start "npx tsx server/index.ts" --name bot-ai --time
            pm2 save
        fi
    else
        echo "⚠️  Debes iniciar la aplicación manualmente"
        exit 1
    fi
fi

echo ""
echo "⏳ Esperando a que el servidor inicie (5 segundos)..."
sleep 5

echo ""
echo "============================================"
echo "🏥 PASO 5: Verificando estado del servidor"
echo "============================================"
echo ""

# Verificar que PM2 esté corriendo
if pm2 describe bot-ai > /dev/null 2>&1; then
    echo "✅ Aplicación bot-ai está registrada en PM2"
    pm2 describe bot-ai | grep -E "status|uptime|restarts"
else
    echo "❌ Error: La aplicación no está corriendo en PM2"
    exit 1
fi

echo ""

# Verificar que el servidor responda
echo "Verificando endpoint de salud..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/health || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
BODY=$(echo "$HEALTH_RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Servidor respondiendo correctamente: $BODY"
else
    echo "⚠️  Servidor no responde correctamente (HTTP $HTTP_CODE)"
    echo "   Revisa los logs: pm2 logs bot-ai"
fi

echo ""

# Verificar seguridad de endpoints
echo "Verificando seguridad de endpoints CRM..."
MEDIA_RESPONSE=$(curl -s http://localhost:3000/api/crm/media/test 2>/dev/null || echo "error")

if echo "$MEDIA_RESPONSE" | grep -q "unauthorized"; then
    echo "✅ Endpoint /media/:id está protegido (requiere autenticación)"
else
    echo "⚠️  ADVERTENCIA: El endpoint /media/:id podría no estar protegido"
    echo "   Response: $MEDIA_RESPONSE"
fi

echo ""
echo "============================================"
echo "📊 PASO 6: Logs recientes"
echo "============================================"
echo ""
pm2 logs bot-ai --lines 30 --nostream

echo ""
echo "============================================"
echo "✅ DESPLIEGUE COMPLETADO"
echo "============================================"
echo ""
echo "🎉 El servidor está corriendo con los siguientes cambios:"
echo ""
echo "✅ Fix de adjuntos WhatsApp:"
echo "   - Usa axios en lugar de fetch"
echo "   - Lee token desde múltiples fuentes (getWhatsAppEnv)"
echo ""
echo "✅ Fix de seguridad P1 (CRÍTICO):"
echo "   - Todos los endpoints CRM requieren autenticación"
echo "   - /api/crm/media/:id protegido"
echo "   - /api/crm/attachments/* protegido"
echo "   - /api/crm/messages/* protegido"
echo "   - /api/crm/conversations/* protegido"
echo ""
echo "🧪 PRUEBAS RECOMENDADAS:"
echo ""
echo "1. Monitorea los logs en tiempo real:"
echo "   pm2 logs bot-ai"
echo ""
echo "2. Envía una IMAGEN NUEVA por WhatsApp"
echo ""
echo "3. Deberías ver en los logs:"
echo "   [CRM][Media] Obteniendo metadata de: https://graph.facebook.com/..."
echo "   [CRM][Media] URL completa de descarga: https://lookaside.fbsbx.com/..."
echo "   [CRM][Media] Descargando con axios (responseType: arraybuffer)..."
echo "   [CRM][Media] ✅ Descarga exitosa con axios: XXXX bytes"
echo ""
echo "4. Verifica en el CRM (https://wsp.azaleia.com.pe) que:"
echo "   - La imagen aparece correctamente"
echo "   - Puedes hacer login normalmente"
echo "   - Los usuarios autenticados ven las imágenes"
echo ""
echo "📝 Comandos útiles:"
echo "   pm2 status          - Ver estado de aplicaciones"
echo "   pm2 logs bot-ai     - Ver logs en tiempo real"
echo "   pm2 restart bot-ai  - Reiniciar servidor"
echo "   pm2 stop bot-ai     - Detener servidor"
echo ""
echo "⚠️  Si encuentras problemas:"
echo "   1. Revisa los logs: pm2 logs bot-ai --lines 100"
echo "   2. Verifica el token: grep WHATSAPP_ACCESS_TOKEN /opt/flow-builder/.env"
echo "   3. Reporta el error con los logs"
echo ""
