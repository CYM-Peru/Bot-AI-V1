#!/bin/bash

# Script de instalación de Metabase para análisis CRM
# Metabase es una herramienta open-source de Business Intelligence

echo "📊 Instalando Metabase para FlowBuilder CRM..."
echo ""

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Instalando..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado"
fi

# Detener contenedor existente si existe
docker stop metabase 2>/dev/null
docker rm metabase 2>/dev/null

# Iniciar Metabase conectado a PostgreSQL
echo "🚀 Iniciando Metabase..."
docker run -d \
  --name metabase \
  --restart always \
  -p 3000:3000 \
  -e MB_DB_TYPE=postgres \
  -e MB_DB_HOST=host.docker.internal \
  -e MB_DB_PORT=5432 \
  -e MB_DB_DBNAME=flowbuilder_crm \
  -e MB_DB_USER=whatsapp_user \
  -e MB_DB_PASS=azaleia_pg_2025_secure \
  -v metabase-data:/metabase-data \
  metabase/metabase

echo ""
echo "⏳ Metabase está iniciando (toma ~2 minutos)..."
echo ""
echo "✅ Cuando esté listo, accede a:"
echo "   http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📋 Configuración inicial:"
echo "   1. Crea usuario admin"
echo "   2. Ya está conectado a tu base de datos flowbuilder_crm"
echo "   3. Empieza a crear dashboards"
echo ""
echo "🔍 Ver logs:"
echo "   docker logs -f metabase"
echo ""
echo "🛑 Detener Metabase:"
echo "   docker stop metabase"
echo ""
echo "🔄 Reiniciar Metabase:"
echo "   docker restart metabase"
