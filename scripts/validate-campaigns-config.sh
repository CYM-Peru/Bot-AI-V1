#!/bin/bash
#
# Script de validación de configuración crítica de campañas
# Se ejecuta al arranque del servidor para verificar que todo está correcto
#

set -e

echo "============================================"
echo "🔍 VALIDANDO CONFIGURACIÓN DE CAMPAÑAS"
echo "============================================"
echo ""

ERRORS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar archivos críticos existen
echo "📁 Verificando archivos críticos..."
CRITICAL_FILES=(
  "server/campaigns/routes.ts"
  "server/campaigns/storage-db.ts"
  "src/campaigns/CampaignsPage.tsx"
  "server/crm/status-webhook-handler.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${RED}✗${NC} $file - FALTA"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# 2. Verificar respaldos existen
echo "💾 Verificando respaldos inmutables..."
BACKUP_COUNT=$(ls -1 config-backups/*.WORKING_* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -ge 4 ]; then
  echo -e "  ${GREEN}✓${NC} $BACKUP_COUNT respaldos encontrados"
else
  echo -e "  ${YELLOW}⚠${NC} Solo $BACKUP_COUNT respaldos (se esperan 4+)"
fi
echo ""

# 3. Verificar código crítico en routes.ts
echo "🔧 Verificando código crítico en routes.ts..."

# Check for media_id usage (not link)
if grep -q 'id: mediaId' server/campaigns/routes.ts; then
  echo -e "  ${GREEN}✓${NC} Usa media_id correctamente (no link)"
else
  echo -e "  ${RED}✗${NC} NO usa media_id - puede causar error 403"
  ERRORS=$((ERRORS + 1))
fi

# Check for auto-detection
if grep -q "attempting to auto-detect and upload template header" server/campaigns/routes.ts; then
  echo -e "  ${GREEN}✓${NC} Auto-detección de imágenes habilitada"
else
  echo -e "  ${RED}✗${NC} Auto-detección de imágenes DESHABILITADA"
  ERRORS=$((ERRORS + 1))
fi

# Check for uploadMedia call
if grep -q "uploadMedia(config, imageBuffer" server/campaigns/routes.ts; then
  echo -e "  ${GREEN}✓${NC} Re-upload de imágenes implementado"
else
  echo -e "  ${RED}✗${NC} Re-upload de imágenes NO implementado"
  ERRORS=$((ERRORS + 1))
fi

# Check for campaign.language usage
if grep -q "campaign.language" server/campaigns/routes.ts; then
  echo -e "  ${GREEN}✓${NC} Usa campaign.language (no hardcodeado)"
else
  echo -e "  ${RED}✗${NC} NO usa campaign.language - siempre enviará en español"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Verificar frontend envía language
echo "🖥️  Verificando frontend..."
if grep -q 'language: selectedTemplateObj?.language' src/campaigns/CampaignsPage.tsx; then
  echo -e "  ${GREEN}✓${NC} Frontend envía campo 'language'"
else
  echo -e "  ${RED}✗${NC} Frontend NO envía 'language' - campañas siempre en español"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Verificar storage-db no actualiza updated_at manualmente
echo "🗄️  Verificando storage-db.ts..."
if grep -q "FIXED VERSION - updated_at handled by trigger" server/campaigns/storage-db.ts; then
  echo -e "  ${GREEN}✓${NC} updated_at manejado por trigger (correcto)"
else
  echo -e "  ${RED}✗${NC} Puede estar actualizando updated_at manualmente"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 6. Verificar logs detallados de errores
echo "📊 Verificando logs de errores..."
if grep -q "ERROR DETAILS.*JSON.stringify" server/crm/status-webhook-handler.ts; then
  echo -e "  ${GREEN}✓${NC} Logs detallados de errores habilitados"
else
  echo -e "  ${YELLOW}⚠${NC} Logs detallados de errores pueden faltar"
fi
echo ""

# 7. Verificar PostgreSQL (si está disponible)
if command -v psql &> /dev/null; then
  echo "🐘 Verificando PostgreSQL..."

  # Check campaigns table has language column
  if PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -tc "SELECT column_name FROM information_schema.columns WHERE table_name='campaigns' AND column_name='language'" 2>/dev/null | grep -q language; then
    echo -e "  ${GREEN}✓${NC} Tabla 'campaigns' tiene columna 'language'"
  else
    echo -e "  ${RED}✗${NC} Tabla 'campaigns' NO tiene columna 'language'"
    ERRORS=$((ERRORS + 1))
  fi

  # Check campaigns table has updated_at column
  if PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -tc "SELECT column_name FROM information_schema.columns WHERE table_name='campaigns' AND column_name='updated_at'" 2>/dev/null | grep -q updated_at; then
    echo -e "  ${GREEN}✓${NC} Tabla 'campaigns' tiene columna 'updated_at'"
  else
    echo -e "  ${RED}✗${NC} Tabla 'campaigns' NO tiene columna 'updated_at'"
    ERRORS=$((ERRORS + 1))
  fi

  # Check trigger exists
  if PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -tc "SELECT tgname FROM pg_trigger WHERE tgname='update_campaigns_updated_at'" 2>/dev/null | grep -q update_campaigns_updated_at; then
    echo -e "  ${GREEN}✓${NC} Trigger 'update_campaigns_updated_at' existe"
  else
    echo -e "  ${RED}✗${NC} Trigger 'update_campaigns_updated_at' NO existe"
    ERRORS=$((ERRORS + 1))
  fi

  echo ""
else
  echo -e "  ${YELLOW}⚠${NC} PostgreSQL no disponible para validar"
  echo ""
fi

# Resultado final
echo "============================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ VALIDACIÓN EXITOSA - TODO CORRECTO${NC}"
  echo "============================================"
  exit 0
else
  echo -e "${RED}❌ VALIDACIÓN FALLIDA - $ERRORS ERRORES ENCONTRADOS${NC}"
  echo "============================================"
  echo ""
  echo "⚠️  Para restaurar configuración funcional:"
  echo "   cd /opt/flow-builder"
  echo "   ./scripts/restore-campaigns-config.sh"
  echo ""
  exit 1
fi
