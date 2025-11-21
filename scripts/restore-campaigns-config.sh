#!/bin/bash
#
# Script de restauración automática de configuración de campañas
# Restaura desde los respaldos inmutables WORKING
#

set -e

echo "============================================"
echo "🔄 RESTAURANDO CONFIGURACIÓN DE CAMPAÑAS"
echo "============================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -d "config-backups" ]; then
  echo -e "${RED}❌ Error: Directorio config-backups no encontrado${NC}"
  echo "   Ejecutar desde /opt/flow-builder"
  exit 1
fi

# Buscar respaldos WORKING más recientes
ROUTES_BACKUP=$(ls -t config-backups/routes.ts.WORKING_* 2>/dev/null | head -1)
STORAGE_BACKUP=$(ls -t config-backups/storage-db.ts.WORKING_* 2>/dev/null | head -1)
CAMPAIGNS_PAGE_BACKUP=$(ls -t config-backups/CampaignsPage.tsx.WORKING_* 2>/dev/null | head -1)
WEBHOOK_BACKUP=$(ls -t config-backups/status-webhook-handler.ts.WORKING_* 2>/dev/null | head -1)

if [ -z "$ROUTES_BACKUP" ] || [ -z "$STORAGE_BACKUP" ] || [ -z "$CAMPAIGNS_PAGE_BACKUP" ] || [ -z "$WEBHOOK_BACKUP" ]; then
  echo -e "${RED}❌ Error: No se encontraron todos los respaldos WORKING${NC}"
  echo ""
  echo "Respaldos encontrados:"
  echo "  routes.ts: $ROUTES_BACKUP"
  echo "  storage-db.ts: $STORAGE_BACKUP"
  echo "  CampaignsPage.tsx: $CAMPAIGNS_PAGE_BACKUP"
  echo "  status-webhook-handler.ts: $WEBHOOK_BACKUP"
  exit 1
fi

echo "📦 Respaldos a restaurar:"
echo "  $ROUTES_BACKUP"
echo "  $STORAGE_BACKUP"
echo "  $CAMPAIGNS_PAGE_BACKUP"
echo "  $WEBHOOK_BACKUP"
echo ""

# Pedir confirmación
read -p "¿Continuar con la restauración? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Restauración cancelada."
  exit 0
fi

# Crear respaldos de archivos actuales antes de restaurar
echo ""
echo "💾 Creando respaldos de archivos actuales..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p config-backups/pre-restore-$TIMESTAMP

cp server/campaigns/routes.ts config-backups/pre-restore-$TIMESTAMP/routes.ts.backup 2>/dev/null || true
cp server/campaigns/storage-db.ts config-backups/pre-restore-$TIMESTAMP/storage-db.ts.backup 2>/dev/null || true
cp src/campaigns/CampaignsPage.tsx config-backups/pre-restore-$TIMESTAMP/CampaignsPage.tsx.backup 2>/dev/null || true
cp server/crm/status-webhook-handler.ts config-backups/pre-restore-$TIMESTAMP/status-webhook-handler.ts.backup 2>/dev/null || true

echo -e "${GREEN}✓${NC} Respaldos actuales guardados en config-backups/pre-restore-$TIMESTAMP/"
echo ""

# Restaurar archivos
echo "🔄 Restaurando archivos..."

cp "$ROUTES_BACKUP" server/campaigns/routes.ts
echo -e "${GREEN}✓${NC} server/campaigns/routes.ts restaurado"

cp "$STORAGE_BACKUP" server/campaigns/storage-db.ts
echo -e "${GREEN}✓${NC} server/campaigns/storage-db.ts restaurado"

cp "$CAMPAIGNS_PAGE_BACKUP" src/campaigns/CampaignsPage.tsx
echo -e "${GREEN}✓${NC} src/campaigns/CampaignsPage.tsx restaurado"

cp "$WEBHOOK_BACKUP" server/crm/status-webhook-handler.ts
echo -e "${GREEN}✓${NC} server/crm/status-webhook-handler.ts restaurado"

echo ""

# Recompilar frontend
echo "🔨 Recompilando frontend..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Frontend recompilado exitosamente"
else
  echo -e "${YELLOW}⚠${NC} Advertencia: Error al recompilar frontend"
fi
echo ""

# Validar configuración
echo "🔍 Validando configuración restaurada..."
if bash scripts/validate-campaigns-config.sh; then
  echo ""
  echo "============================================"
  echo -e "${GREEN}✅ RESTAURACIÓN EXITOSA${NC}"
  echo "============================================"
  echo ""
  echo "Próximos pasos:"
  echo "  1. Reiniciar servicio: sudo systemctl restart flowbuilder.service"
  echo "  2. Verificar logs: sudo journalctl -u flowbuilder.service -f"
  echo ""
else
  echo ""
  echo "============================================"
  echo -e "${YELLOW}⚠️  RESTAURACIÓN COMPLETADA CON ADVERTENCIAS${NC}"
  echo "============================================"
  echo ""
  echo "Algunos checks de validación fallaron."
  echo "Revisar manualmente o consultar CONFIGURACION-CRITICA-CAMPANAS.md"
  echo ""
fi
