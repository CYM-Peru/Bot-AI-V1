#!/bin/bash

# Script de verificación para producción de WhatsApp
# Verifica que todos los componentes estén funcionando correctamente

echo "🔍 Verificando configuración de producción..."
echo "=============================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        return 0
    else
        echo -e "${RED}❌ $1${NC}"
        return 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Verificar archivo .env
echo "1️⃣  Verificando archivo .env..."
if [ -f ".env" ]; then
    check "Archivo .env existe"

    # Verificar credenciales
    if grep -q "WHATSAPP_ACCESS_TOKEN=EAAQ" .env; then
        check "WHATSAPP_ACCESS_TOKEN configurado"
    else
        warn "WHATSAPP_ACCESS_TOKEN no configurado"
    fi

    if grep -q "WHATSAPP_PHONE_NUMBER_ID=741220429081783" .env; then
        check "WHATSAPP_PHONE_NUMBER_ID configurado"
    else
        warn "WHATSAPP_PHONE_NUMBER_ID no configurado"
    fi

    if grep -q "WHATSAPP_VERIFY_TOKEN=azaleia_meta_token_2025" .env; then
        check "WHATSAPP_VERIFY_TOKEN configurado"
    else
        warn "WHATSAPP_VERIFY_TOKEN no configurado"
    fi
else
    warn "Archivo .env NO existe"
fi
echo ""

# 2. Verificar backend
echo "2️⃣  Verificando backend..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    check "Backend respondiendo en puerto 3000"
    HEALTH=$(curl -s http://localhost:3000/health)
    echo "   Respuesta: $HEALTH"
else
    warn "Backend NO está respondiendo"
    echo "   Ejecuta: npm run dev:server"
fi
echo ""

# 3. Verificar endpoints críticos
echo "3️⃣  Verificando endpoints críticos..."

# Health endpoint
if curl -s http://localhost:3000/health | grep -q "ok"; then
    check "/health respondiendo correctamente"
else
    warn "/health no responde"
fi

# CRM health endpoint
if curl -s http://localhost:3000/api/crm/health | grep -q "ok"; then
    check "/api/crm/health respondiendo correctamente"
else
    warn "/api/crm/health no responde"
fi

# Webhook verification
CHALLENGE=$(curl -s "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=azaleia_meta_token_2025&hub.challenge=test123")
if [ "$CHALLENGE" = "test123" ]; then
    check "Webhook verification funcionando"
else
    warn "Webhook verification no responde correctamente"
    echo "   Esperado: test123"
    echo "   Recibido: $CHALLENGE"
fi
echo ""

# 4. Verificar frontend compilado
echo "4️⃣  Verificando frontend..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    check "Frontend compilado en /dist"
else
    warn "Frontend NO compilado"
    echo "   Ejecuta: npm run build"
fi
echo ""

# 5. Verificar Nginx
echo "5️⃣  Verificando Nginx..."
if command -v nginx &> /dev/null; then
    check "Nginx instalado"

    if systemctl is-active --quiet nginx 2>/dev/null || service nginx status &> /dev/null; then
        check "Nginx corriendo"
    else
        warn "Nginx NO está corriendo"
        echo "   Ejecuta: sudo systemctl start nginx"
    fi

    if [ -f "/etc/nginx/sites-available/wsp.azaleia.com.pe" ]; then
        check "Configuración de Nginx existe"
    else
        warn "Configuración de Nginx NO existe"
        echo "   Revisa: GUIA_PRODUCCION_WHATSAPP.md"
    fi
else
    warn "Nginx NO está instalado"
    echo "   Ejecuta: sudo apt install nginx"
fi
echo ""

# 6. Verificar SSL
echo "6️⃣  Verificando SSL..."
if command -v certbot &> /dev/null; then
    check "Certbot instalado"

    if [ -f "/etc/letsencrypt/live/wsp.azaleia.com.pe/fullchain.pem" ]; then
        check "Certificado SSL existe para wsp.azaleia.com.pe"
    else
        warn "Certificado SSL NO existe"
        echo "   Ejecuta: sudo certbot --nginx -d wsp.azaleia.com.pe"
    fi
else
    warn "Certbot NO está instalado"
    echo "   Ejecuta: sudo apt install certbot python3-certbot-nginx"
fi
echo ""

# 7. Verificar PM2
echo "7️⃣  Verificando PM2..."
if command -v pm2 &> /dev/null; then
    check "PM2 instalado"

    if pm2 list | grep -q "bot-ai-backend"; then
        check "Backend registrado en PM2"
        pm2 status bot-ai-backend
    else
        warn "Backend NO está registrado en PM2"
        echo "   Ejecuta: pm2 start npm --name 'bot-ai-backend' -- run dev:server"
    fi
else
    warn "PM2 NO está instalado"
    echo "   Ejecuta: sudo npm install -g pm2"
fi
echo ""

# 8. Verificar dominio y DNS
echo "8️⃣  Verificando dominio..."
if command -v dig &> /dev/null; then
    IP=$(dig +short wsp.azaleia.com.pe | tail -1)
    if [ -n "$IP" ]; then
        check "DNS configurado para wsp.azaleia.com.pe"
        echo "   IP: $IP"
    else
        warn "DNS NO está configurado"
    fi
else
    warn "Comando 'dig' no disponible para verificar DNS"
fi
echo ""

# 9. Verificar directorios de datos
echo "9️⃣  Verificando directorios de datos..."
if [ -d "data" ]; then
    check "Directorio /data existe"

    if [ -d "data/sessions" ]; then
        check "Directorio /data/sessions existe"
    else
        warn "Directorio /data/sessions NO existe"
        echo "   Ejecuta: mkdir -p data/sessions"
    fi

    if [ -d "data/attachments" ]; then
        check "Directorio /data/attachments existe"
    else
        warn "Directorio /data/attachments NO existe"
        echo "   Ejecuta: mkdir -p data/attachments"
    fi
else
    warn "Directorio /data NO existe"
    echo "   Ejecuta: mkdir -p data/sessions data/attachments data/flows"
fi
echo ""

# 10. Resumen final
echo "=============================================="
echo "📋 RESUMEN"
echo "=============================================="
echo ""

# Verificar si el dominio con HTTPS funciona
if command -v curl &> /dev/null; then
    if curl -k -s https://wsp.azaleia.com.pe/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Todo listo! El sitio está funcionando en HTTPS${NC}"
        echo ""
        echo "🔗 URL: https://wsp.azaleia.com.pe"
        echo ""
        echo "Próximos pasos:"
        echo "1. Configura el webhook en Meta for Developers"
        echo "2. Suscríbete a eventos: messages + message_status"
        echo "3. Envía un mensaje de prueba desde WhatsApp"
        echo ""
    else
        warn "El sitio aún NO está accesible via HTTPS"
        echo ""
        echo "Pasos pendientes:"
        echo "1. Verifica que Nginx esté corriendo"
        echo "2. Verifica que el certificado SSL esté instalado"
        echo "3. Revisa: GUIA_PRODUCCION_WHATSAPP.md"
        echo ""
    fi
fi

echo "📚 Documentación completa: GUIA_PRODUCCION_WHATSAPP.md"
echo ""
