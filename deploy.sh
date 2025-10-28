#!/bin/bash

# Script de despliegue para Bot AI Backend
# Este script configura y despliega el backend correctamente

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue de Bot AI Backend..."

# 1. Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encuentra package.json. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi

# 2. Crear directorios necesarios
echo "📁 Creando directorios necesarios..."
mkdir -p data/flows
mkdir -p data/sessions
mkdir -p logs

# 3. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# 4. Compilar servidor (si es producción)
if [ "$NODE_ENV" = "production" ]; then
    echo "🔨 Compilando servidor..."
    npm run build:server
fi

# 5. Detener proceso PM2 existente (si existe)
echo "🛑 Deteniendo proceso PM2 existente..."
pm2 delete bot-ai-backend 2>/dev/null || true

# 6. Iniciar con PM2
echo "▶️  Iniciando aplicación con PM2..."
if [ "$NODE_ENV" = "production" ]; then
    pm2 start ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js
fi

# 7. Guardar configuración PM2
echo "💾 Guardando configuración PM2..."
pm2 save

# 8. Configurar PM2 para arranque automático (solo si no está configurado)
if ! pm2 startup | grep -q "already been set"; then
    echo "⚙️  Configurando arranque automático de PM2..."
    pm2 startup
fi

# 9. Mostrar estado
echo ""
echo "✅ Despliegue completado!"
echo ""
echo "📊 Estado actual:"
pm2 status

echo ""
echo "📝 Ver logs en tiempo real:"
echo "   pm2 logs bot-ai-backend"
echo ""
echo "📈 Ver métricas:"
echo "   pm2 monit"
echo ""
echo "🔄 Reiniciar aplicación:"
echo "   pm2 restart bot-ai-backend"
echo ""
echo "🛑 Detener aplicación:"
echo "   pm2 stop bot-ai-backend"
echo ""
