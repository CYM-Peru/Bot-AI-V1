#!/bin/bash
# Script de instalación automatizada para Raspberry Pi
# Ejecutar en la Raspberry Pi después de transferir los archivos

set -e

MIGRATION_DIR="/home/pi/migration"
INSTALL_DIR="/opt/flow-builder"

echo "🍓 Instalación de Flow Builder en Raspberry Pi"
echo "=============================================="
echo ""

# Verificar que estamos en Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
    echo "⚠️  Advertencia: No parece ser una Raspberry Pi"
    read -p "¿Continuar de todos modos? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Verificar archivos de migración
if [ ! -d "$MIGRATION_DIR" ]; then
    echo "❌ Error: No se encontró el directorio de migración"
    echo "   Esperado: $MIGRATION_DIR"
    echo ""
    echo "   Primero ejecuta el script de migración en el servidor actual:"
    echo "   ./scripts/migrate-to-raspberry.sh <IP_RASPBERRY_PI>"
    exit 1
fi

echo "1️⃣  Verificando archivos de migración..."
if [ ! -f "$MIGRATION_DIR/flowbuilder_backup.dump" ]; then
    echo "❌ Error: No se encontró el backup de base de datos"
    exit 1
fi
if [ ! -f "$MIGRATION_DIR/flow-builder.tar.gz" ]; then
    echo "❌ Error: No se encontró el código fuente"
    exit 1
fi
echo "✅ Archivos de migración encontrados"

echo ""
echo "2️⃣  Actualizando sistema..."
sudo apt update

echo ""
echo "3️⃣  Instalando dependencias básicas..."
sudo apt install -y curl git build-essential

echo ""
echo "4️⃣  Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "   Instalando Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "   ⚠️  Node.js versión $NODE_VERSION es muy antigua"
        echo "   Actualizando a Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
fi
echo "✅ Node.js $(node -v) instalado"

echo ""
echo "5️⃣  Verificando PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "   Instalando PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
else
    echo "   PostgreSQL ya está instalado"
    sudo systemctl start postgresql || true
fi
echo "✅ PostgreSQL instalado"

echo ""
echo "6️⃣  Creando base de datos y usuario..."
sudo -u postgres psql << EOF || echo "⚠️  Base de datos puede ya existir"
CREATE USER whatsapp_user WITH PASSWORD 'azaleia_pg_2025_secure';
CREATE DATABASE flowbuilder_crm OWNER whatsapp_user;
GRANT ALL PRIVILEGES ON DATABASE flowbuilder_crm TO whatsapp_user;
EOF

echo ""
echo "7️⃣  Restaurando base de datos..."
sudo -u postgres pg_restore -d flowbuilder_crm -1 "$MIGRATION_DIR/flowbuilder_backup.dump" || true

echo ""
echo "8️⃣  Otorgando permisos en PostgreSQL..."
sudo -u postgres psql -d flowbuilder_crm << EOF
-- Otorgar permisos en todas las tablas
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO whatsapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO whatsapp_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO whatsapp_user;

-- Otorgar permisos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO whatsapp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO whatsapp_user;
EOF
echo "✅ Permisos otorgados"

echo ""
echo "9️⃣  Instalando aplicación..."
sudo mkdir -p "$INSTALL_DIR"
cd /opt
sudo tar -xzf "$MIGRATION_DIR/flow-builder.tar.gz"
sudo chown -R pi:pi "$INSTALL_DIR"

echo ""
echo "🔟 Restaurando datos..."
cd "$INSTALL_DIR"
if [ -f "$MIGRATION_DIR/data_backup.tar.gz" ]; then
    tar -xzf "$MIGRATION_DIR/data_backup.tar.gz"
    echo "✅ Datos restaurados"
else
    echo "⚠️  No se encontró backup de datos, creando directorio vacío"
    mkdir -p data
fi

echo ""
echo "1️⃣1️⃣  Instalando dependencias de Node.js..."
npm install

echo ""
echo "1️⃣2️⃣  Compilando aplicación..."
npm run build

echo ""
echo "1️⃣3️⃣  Creando script de kill-processes..."
mkdir -p scripts
cat > scripts/kill-old-processes.sh << 'EOF'
#!/bin/bash
pkill -f "tsx server/index.ts" || true
sleep 2
EOF
chmod +x scripts/kill-old-processes.sh

echo ""
echo "1️⃣4️⃣  Creando servicio systemd..."
sudo tee /etc/systemd/system/flowbuilder.service > /dev/null << 'EOF'
[Unit]
Description=Flow Builder WhatsApp Bot
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/flow-builder
EnvironmentFile=/opt/flow-builder/.env
ExecStartPre=/opt/flow-builder/scripts/kill-old-processes.sh
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=flowbuilder

# Security
NoNewPrivileges=true
PrivateTmp=true

# Performance
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "1️⃣5️⃣  Habilitando e iniciando servicio..."
sudo systemctl daemon-reload
sudo systemctl enable flowbuilder
sudo systemctl start flowbuilder

echo ""
echo "1️⃣6️⃣  Verificando estado del servicio..."
sleep 3
if sudo systemctl is-active --quiet flowbuilder; then
    echo "✅ Servicio flowbuilder está corriendo"
else
    echo "⚠️  El servicio no está corriendo, verificando logs..."
    sudo journalctl -u flowbuilder -n 50 --no-pager
fi

echo ""
echo "✅ ¡Instalación completada!"
echo ""
echo "📊 Estado del sistema:"
echo "   - Servicio: $(sudo systemctl is-active flowbuilder)"
echo "   - PostgreSQL: $(sudo systemctl is-active postgresql)"
echo "   - Node.js: $(node -v)"
echo "   - Temperatura: $(vcgencmd measure_temp)"
echo ""
echo "🌐 Acceso a la aplicación:"
echo "   - Red local: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📋 Comandos útiles:"
echo "   - Ver logs:     sudo journalctl -u flowbuilder -f"
echo "   - Reiniciar:    sudo systemctl restart flowbuilder"
echo "   - Estado:       sudo systemctl status flowbuilder"
echo "   - Temperatura:  vcgencmd measure_temp"
echo ""
echo "📖 Próximos pasos:"
echo "   1. Verifica que la app funcione accediendo desde tu navegador"
echo "   2. Si necesitas acceso desde Internet, sigue la guía en:"
echo "      /home/pi/migration/RASPBERRY_PI_SETUP.md"
echo "   3. Configura los webhooks de WhatsApp/Bitrix con tu nueva URL"
echo ""
