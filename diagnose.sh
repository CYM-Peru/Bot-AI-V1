#!/bin/bash

# Script de diagnóstico para Bot AI Backend
# Este script verifica la configuración y detecta problemas comunes

echo "======================================"
echo "🔍 Diagnóstico de Bot AI Backend"
echo "======================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_status() {
    if [ "$2" = "OK" ]; then
        echo -e "${GREEN}✓${NC} $1"
    elif [ "$2" = "WARNING" ]; then
        echo -e "${YELLOW}⚠${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
    fi
}

# 1. Verificar directorio actual
echo "1️⃣  Verificando directorio actual..."
if [ -f "package.json" ]; then
    PKG_NAME=$(grep -o '"name": "[^"]*' package.json | cut -d'"' -f4)
    if [ "$PKG_NAME" = "flow-builder-demo" ]; then
        print_status "Directorio correcto: $(pwd)" "OK"
        PROJECT_DIR=$(pwd)
    else
        print_status "package.json encontrado pero nombre incorrecto: $PKG_NAME" "ERROR"
        exit 1
    fi
else
    print_status "No se encuentra package.json en el directorio actual" "ERROR"
    echo ""
    echo "Por favor, navega al directorio del proyecto Bot-AI-V1"
    echo "Ejemplo: cd /home/user/Bot-AI-V1"
    exit 1
fi
echo ""

# 2. Verificar Node.js y npm
echo "2️⃣  Verificando Node.js y npm..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js instalado: $NODE_VERSION" "OK"
else
    print_status "Node.js no está instalado" "ERROR"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm instalado: $NPM_VERSION" "OK"
else
    print_status "npm no está instalado" "ERROR"
fi
echo ""

# 3. Verificar PM2
echo "3️⃣  Verificando PM2..."
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    print_status "PM2 instalado: v$PM2_VERSION" "OK"

    # Verificar estado del proceso
    if pm2 list | grep -q "bot-ai-backend"; then
        STATUS=$(pm2 jlist | grep -A 10 "bot-ai-backend" | grep "pm2_env" -A 5 | grep "status" | cut -d'"' -f4)
        CWD=$(pm2 jlist | grep -A 20 "bot-ai-backend" | grep "\"cwd\"" | cut -d'"' -f4)

        if [ "$STATUS" = "online" ]; then
            print_status "Proceso bot-ai-backend: $STATUS" "OK"
        elif [ "$STATUS" = "errored" ]; then
            print_status "Proceso bot-ai-backend: $STATUS ⚠️  Necesita reinicio" "ERROR"
        else
            print_status "Proceso bot-ai-backend: $STATUS" "WARNING"
        fi

        if [ "$CWD" = "$PROJECT_DIR" ]; then
            print_status "Directorio de trabajo correcto: $CWD" "OK"
        else
            print_status "Directorio de trabajo incorrecto: $CWD (debería ser $PROJECT_DIR)" "ERROR"
        fi
    else
        print_status "Proceso bot-ai-backend no encontrado en PM2" "WARNING"
    fi
else
    print_status "PM2 no está instalado" "WARNING"
    echo "   Instalar con: npm install -g pm2"
fi
echo ""

# 4. Verificar archivo .env
echo "4️⃣  Verificando configuración (.env)..."
if [ -f ".env" ]; then
    print_status "Archivo .env existe" "OK"

    # Verificar variables importantes
    if grep -q "WHATSAPP_ACCESS_TOKEN=" .env && ! grep -q "WHATSAPP_ACCESS_TOKEN=your_" .env; then
        print_status "WHATSAPP_ACCESS_TOKEN configurado" "OK"
    else
        print_status "WHATSAPP_ACCESS_TOKEN no configurado" "ERROR"
    fi

    if grep -q "WHATSAPP_PHONE_NUMBER_ID=" .env && ! grep -q "WHATSAPP_PHONE_NUMBER_ID=your_" .env; then
        print_status "WHATSAPP_PHONE_NUMBER_ID configurado" "OK"
    else
        print_status "WHATSAPP_PHONE_NUMBER_ID no configurado" "ERROR"
    fi

    if grep -q "WHATSAPP_VERIFY_TOKEN=" .env && ! grep -q "WHATSAPP_VERIFY_TOKEN=your_" .env; then
        print_status "WHATSAPP_VERIFY_TOKEN configurado" "OK"
    else
        print_status "WHATSAPP_VERIFY_TOKEN no configurado" "ERROR"
    fi

    if grep -q "PORT=" .env; then
        PORT=$(grep "PORT=" .env | cut -d'=' -f2)
        print_status "Puerto configurado: $PORT" "OK"
    else
        print_status "Puerto no configurado (usará 3000 por defecto)" "WARNING"
        PORT=3000
    fi
else
    print_status "Archivo .env no existe" "ERROR"
    echo "   Crear con: cp .env.example .env"
fi
echo ""

# 5. Verificar directorios de datos
echo "5️⃣  Verificando directorios de datos..."
if [ -d "data/flows" ]; then
    print_status "Directorio data/flows existe" "OK"
    FLOW_COUNT=$(find data/flows -name "*.json" 2>/dev/null | wc -l)
    print_status "Flows encontrados: $FLOW_COUNT" "OK"
else
    print_status "Directorio data/flows no existe" "WARNING"
    echo "   Crear con: mkdir -p data/flows"
fi

if [ -d "data/sessions" ]; then
    print_status "Directorio data/sessions existe" "OK"
else
    print_status "Directorio data/sessions no existe" "WARNING"
    echo "   Crear con: mkdir -p data/sessions"
fi

if [ -d "logs" ]; then
    print_status "Directorio logs existe" "OK"
else
    print_status "Directorio logs no existe" "WARNING"
    echo "   Crear con: mkdir -p logs"
fi
echo ""

# 6. Verificar node_modules
echo "6️⃣  Verificando dependencias..."
if [ -d "node_modules" ]; then
    print_status "node_modules existe" "OK"

    # Contar paquetes instalados
    PKG_COUNT=$(ls -1 node_modules | wc -l)
    print_status "Paquetes instalados: $PKG_COUNT" "OK"
else
    print_status "node_modules no existe - ejecutar npm install" "ERROR"
fi
echo ""

# 7. Verificar puerto
echo "7️⃣  Verificando disponibilidad del puerto..."
if command -v lsof &> /dev/null; then
    if lsof -i :${PORT:-3000} &> /dev/null; then
        PROCESS=$(lsof -i :${PORT:-3000} | tail -n 1 | awk '{print $1}')
        print_status "Puerto ${PORT:-3000} está en uso por: $PROCESS" "WARNING"
    else
        print_status "Puerto ${PORT:-3000} está disponible" "OK"
    fi
else
    print_status "lsof no disponible, no se puede verificar puerto" "WARNING"
fi
echo ""

# 8. Probar conexión al servidor (si está corriendo)
echo "8️⃣  Probando conexión al servidor..."
if curl -s -f -m 3 http://localhost:${PORT:-3000}/health &> /dev/null; then
    print_status "Servidor responde en http://localhost:${PORT:-3000}" "OK"

    # Probar endpoint de métricas
    if curl -s -f -m 3 http://localhost:${PORT:-3000}/api/stats &> /dev/null; then
        print_status "Endpoint de métricas /api/stats funciona" "OK"
    else
        print_status "Endpoint de métricas /api/stats no responde" "ERROR"
    fi
else
    print_status "Servidor no responde en http://localhost:${PORT:-3000}" "WARNING"
    echo "   El servidor puede no estar corriendo"
fi
echo ""

# 9. Resumen y recomendaciones
echo "======================================"
echo "📋 Resumen y Recomendaciones"
echo "======================================"
echo ""

# Contar errores
ERRORS=0
WARNINGS=0

if [ ! -f ".env" ]; then
    ERRORS=$((ERRORS + 1))
fi

if [ ! -d "node_modules" ]; then
    ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}❌ Se encontraron $ERRORS error(es) crítico(s)${NC}"
    echo ""
    echo "Pasos recomendados:"
    echo "1. Crear archivo .env: cp .env.example .env"
    echo "2. Instalar dependencias: npm install"
    echo "3. Crear directorios: mkdir -p data/flows data/sessions logs"
    echo "4. Ejecutar script de despliegue: ./deploy.sh"
    echo ""
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Configuración funcional pero con advertencias${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Configuración correcta - Todo listo para usar${NC}"
    echo ""
    echo "Comandos útiles:"
    echo "  - Iniciar servidor: npm run dev:server"
    echo "  - Ver logs de PM2: pm2 logs bot-ai-backend"
    echo "  - Reiniciar con PM2: ./deploy.sh"
    echo "  - Ver métricas: curl http://localhost:${PORT:-3000}/api/stats"
    echo ""
fi

echo "======================================"
