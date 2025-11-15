#!/bin/bash

# Script para configurar Nginx para Bot AI con endpoints de métricas
# Este script agrega las rutas /api/* al proxy reverso de Nginx

set -e

echo "======================================"
echo "🔧 Configuración de Nginx para Bot AI"
echo "======================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar que se está ejecutando con permisos adecuados
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script debe ejecutarse con sudo${NC}"
    echo "Ejecuta: sudo ./setup-nginx.sh"
    exit 1
fi

# Pedir dominio
read -p "Ingresa el dominio (ej: wsp.azaleia.com.pe): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Dominio no puede estar vacío${NC}"
    exit 1
fi

# Buscar archivo de configuración de Nginx para el dominio
echo ""
echo -e "${BLUE}🔍 Buscando configuración de Nginx para $DOMAIN...${NC}"

NGINX_CONFIG=""
for file in /etc/nginx/sites-available/*$DOMAIN* /etc/nginx/sites-enabled/*$DOMAIN*; do
    if [ -f "$file" ] && [ ! -L "$file" ]; then
        NGINX_CONFIG="$file"
        break
    fi
done

if [ -z "$NGINX_CONFIG" ]; then
    # Buscar archivos que contengan el dominio
    NGINX_CONFIG=$(grep -l "server_name.*$DOMAIN" /etc/nginx/sites-available/* 2>/dev/null | head -1)
fi

if [ -z "$NGINX_CONFIG" ]; then
    echo -e "${RED}❌ No se encontró configuración de Nginx para $DOMAIN${NC}"
    echo ""
    echo "Archivos disponibles en /etc/nginx/sites-available:"
    ls -1 /etc/nginx/sites-available/
    echo ""
    read -p "Ingresa el nombre del archivo (sin ruta): " FILENAME
    NGINX_CONFIG="/etc/nginx/sites-available/$FILENAME"

    if [ ! -f "$NGINX_CONFIG" ]; then
        echo -e "${RED}❌ El archivo $NGINX_CONFIG no existe${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Encontrado: $NGINX_CONFIG"

# Hacer backup
BACKUP_FILE="${NGINX_CONFIG}.backup-$(date +%Y%m%d-%H%M%S)"
echo ""
echo -e "${BLUE}💾 Creando backup...${NC}"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Backup creado: $BACKUP_FILE"

# Verificar si ya tiene configuración de /api
if grep -q "location /api" "$NGINX_CONFIG"; then
    echo ""
    echo -e "${YELLOW}⚠️  Ya existe una configuración para /api en el archivo${NC}"
    read -p "¿Deseas continuar y reemplazarla? (s/n): " REPLACE
    if [ "$REPLACE" != "s" ]; then
        echo "Operación cancelada"
        exit 0
    fi
fi

# Pedir puerto del backend
read -p "¿En qué puerto corre el backend? (default: 3000): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-3000}

echo ""
echo -e "${BLUE}📝 Configuración a aplicar:${NC}"
echo "   - Dominio: $DOMAIN"
echo "   - Puerto backend: $BACKEND_PORT"
echo "   - Rutas proxy: /api/*, /webhook/*, /health"
echo ""

# Crear configuración temporal
cat > /tmp/nginx-api-config.txt << EOF

    # API y Webhook endpoints - proxy al backend
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /webhook/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts para webhooks
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /health {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
EOF

echo -e "${BLUE}🔧 Instrucciones para configurar Nginx:${NC}"
echo ""
echo "1. Edita el archivo de configuración:"
echo "   sudo nano $NGINX_CONFIG"
echo ""
echo "2. Dentro del bloque 'server { ... }', agrega estas líneas:"
echo "   (antes del cierre del bloque server)"
echo ""
cat /tmp/nginx-api-config.txt
echo ""
echo "3. Guarda el archivo (Ctrl+O, Enter, Ctrl+X en nano)"
echo ""
echo "4. Verifica la configuración:"
echo "   sudo nginx -t"
echo ""
echo "5. Si no hay errores, recarga Nginx:"
echo "   sudo systemctl reload nginx"
echo ""
echo -e "${YELLOW}⚠️  Nota: Este script no modifica automáticamente el archivo${NC}"
echo "   para evitar errores. Sigue las instrucciones manualmente."
echo ""

read -p "¿Quieres ver el contenido actual del archivo de configuración? (s/n): " SHOW_FILE
if [ "$SHOW_FILE" = "s" ]; then
    echo ""
    echo "======================================"
    cat "$NGINX_CONFIG"
    echo "======================================"
    echo ""
fi

echo ""
echo -e "${GREEN}✅ Configuración preparada${NC}"
echo ""
echo "La configuración está en: /tmp/nginx-api-config.txt"
echo "Backup del archivo original: $BACKUP_FILE"
echo ""
