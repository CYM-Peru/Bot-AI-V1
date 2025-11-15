#!/bin/bash
# Script para preparar migración a Raspberry Pi
# Ejecutar en el servidor actual

set -e

RASPBERRY_IP="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/migration_backup"

echo "🔧 Script de Migración a Raspberry Pi"
echo "======================================"
echo ""

# Validar IP de Raspberry Pi
if [ -z "$RASPBERRY_IP" ]; then
    echo "❌ Error: Debes proporcionar la IP de tu Raspberry Pi"
    echo "Uso: $0 <IP_RASPBERRY_PI>"
    echo "Ejemplo: $0 192.168.1.100"
    exit 1
fi

echo "📍 Raspberry Pi IP: $RASPBERRY_IP"
echo "📁 Directorio del proyecto: $PROJECT_DIR"
echo "💾 Directorio de backup: $BACKUP_DIR"
echo ""

# Crear directorio de backup
mkdir -p "$BACKUP_DIR"

echo "1️⃣  Creando backup de la base de datos PostgreSQL..."
PGPASSWORD="${POSTGRES_PASSWORD:-azaleia_pg_2025_secure}" pg_dump \
    -U "${POSTGRES_USER:-whatsapp_user}" \
    -d "${POSTGRES_DB:-flowbuilder_crm}" \
    -h "${POSTGRES_HOST:-localhost}" \
    --no-owner --no-privileges \
    -F c \
    -f "$BACKUP_DIR/flowbuilder_backup.dump"

if [ $? -eq 0 ]; then
    echo "✅ Backup de base de datos creado: $BACKUP_DIR/flowbuilder_backup.dump"
else
    echo "❌ Error creando backup de base de datos"
    exit 1
fi

echo ""
echo "2️⃣  Creando backup de archivos de datos..."
cd "$PROJECT_DIR"
tar -czf "$BACKUP_DIR/data_backup.tar.gz" \
    data/ \
    --exclude='data/sessions' \
    --exclude='*.log'

if [ $? -eq 0 ]; then
    echo "✅ Backup de datos creado: $BACKUP_DIR/data_backup.tar.gz"
else
    echo "❌ Error creando backup de datos"
    exit 1
fi

echo ""
echo "3️⃣  Empaquetando código fuente..."
tar -czf "$BACKUP_DIR/flow-builder.tar.gz" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='migration_backup' \
    --exclude='backups' \
    --exclude='data/sessions' \
    -C "$(dirname "$PROJECT_DIR")" \
    "$(basename "$PROJECT_DIR")"

if [ $? -eq 0 ]; then
    echo "✅ Código empaquetado: $BACKUP_DIR/flow-builder.tar.gz"
else
    echo "❌ Error empaquetando código"
    exit 1
fi

echo ""
echo "4️⃣  Verificando conexión SSH a Raspberry Pi..."
if ssh -o ConnectTimeout=5 pi@"$RASPBERRY_IP" "echo 'Conexión exitosa'" > /dev/null 2>&1; then
    echo "✅ Conexión SSH exitosa"
else
    echo "⚠️  No se pudo conectar por SSH"
    echo "   Asegúrate de:"
    echo "   - Tener SSH habilitado en la Raspberry Pi"
    echo "   - Haber configurado las llaves SSH o tener la contraseña"
    echo ""
    echo "📦 Los archivos de backup están en: $BACKUP_DIR"
    echo "   Puedes transferirlos manualmente usando:"
    echo "   scp $BACKUP_DIR/* pi@$RASPBERRY_IP:/home/pi/"
    exit 0
fi

echo ""
echo "5️⃣  Creando directorio en Raspberry Pi..."
ssh pi@"$RASPBERRY_IP" "mkdir -p /home/pi/migration"

echo ""
echo "6️⃣  Transfiriendo archivos a Raspberry Pi..."
echo "   Esto puede tardar varios minutos dependiendo del tamaño..."

scp -C "$BACKUP_DIR/flowbuilder_backup.dump" pi@"$RASPBERRY_IP":/home/pi/migration/
echo "   ✅ Base de datos transferida"

scp -C "$BACKUP_DIR/data_backup.tar.gz" pi@"$RASPBERRY_IP":/home/pi/migration/
echo "   ✅ Datos transferidos"

scp -C "$BACKUP_DIR/flow-builder.tar.gz" pi@"$RASPBERRY_IP":/home/pi/migration/
echo "   ✅ Código fuente transferido"

# Transferir script de instalación
scp -C "$SCRIPT_DIR/../RASPBERRY_PI_SETUP.md" pi@"$RASPBERRY_IP":/home/pi/migration/
echo "   ✅ Guía de instalación transferida"

echo ""
echo "✅ ¡Migración preparada exitosamente!"
echo ""
echo "📋 Archivos de backup creados en:"
echo "   $BACKUP_DIR"
echo ""
echo "📤 Archivos transferidos a Raspberry Pi:"
echo "   pi@$RASPBERRY_IP:/home/pi/migration/"
echo ""
echo "📖 Próximos pasos en la Raspberry Pi:"
echo ""
echo "   1. Conectarse a la Raspberry Pi:"
echo "      ssh pi@$RASPBERRY_IP"
echo ""
echo "   2. Seguir la guía de instalación:"
echo "      less /home/pi/migration/RASPBERRY_PI_SETUP.md"
echo ""
echo "   3. Los archivos están en:"
echo "      /home/pi/migration/"
echo ""
echo "💡 Consejo: Guarda los backups en $BACKUP_DIR por si los necesitas"
echo ""
