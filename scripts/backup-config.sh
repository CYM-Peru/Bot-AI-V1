#!/bin/bash
###############################################################################
# SCRIPT DE BACKUP AUTOMÁTICO DE CONFIGURACIONES CRÍTICAS
# Crea backups diarios de archivos y configuraciones importantes
###############################################################################

set +e

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="/opt/flow-builder/backups/config"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo "========================================="
echo "BACKUP DE CONFIGURACIONES CRÍTICAS"
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# Archivos críticos a respaldar
CRITICAL_FILES=(
    "server/crm/advisor-presence.ts"
    "server/routes/admin.ts"
    "server/crm/index.ts"
    "src/crm/types.ts"
    ".env"
    "CONFIGURACION-CRITICA.md"
)

# Crear backup
echo "📦 Creando backup..."
cd /opt/flow-builder

# Crear tar con archivos críticos
tar -czf "$BACKUP_FILE" "${CRITICAL_FILES[@]}" 2>/dev/null

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup creado exitosamente: $BACKUP_FILE"
    echo "📊 Tamaño: $FILE_SIZE"
else
    echo "❌ Error al crear backup"
    exit 1
fi

# Limitar backups a los últimos 30 días
echo "🧹 Limpiando backups antiguos..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
echo "📁 Backups actuales: $REMAINING archivos"

# Crear snapshot de configuración de colas en BD (si es posible)
echo "💾 Intentando backup de colas..."
POSTGRES_PASSWORD=azaleia_pg_2025_secure PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -c "
COPY (SELECT id, name, distribution_mode, assigned_advisors, active, created_at FROM queues)
TO '/tmp/queues_backup_$TIMESTAMP.csv' WITH CSV HEADER;
" 2>/dev/null

if [ $? -eq 0 ]; then
    mv "/tmp/queues_backup_$TIMESTAMP.csv" "$BACKUP_DIR/"
    echo "✅ Backup de colas creado"
else
    echo "⚠️  No se pudo crear backup de colas (no crítico)"
fi

echo ""
echo "========================================="
echo "✅ Proceso de backup completado"
echo "========================================="

exit 0
