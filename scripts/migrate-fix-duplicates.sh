#!/bin/bash

# ================================================================
# SCRIPT DE MIGRACIÓN NOCTURNA
# Limpia duplicados en conversation_metrics
# Fecha: 2025-11-19
# ================================================================

set -e  # Detener si hay errores

echo "================================================================"
echo "🌙 MIGRACIÓN NOCTURNA: Fix Duplicados en Métricas"
echo "================================================================"
echo ""
echo "⏰ Iniciando a las: $(date)"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ================================================================
# PASO 1: VERIFICACIÓN PRE-MIGRACIÓN
# ================================================================
echo "📊 PASO 1/6: Verificando estado actual..."
echo ""

PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm << 'EOF'
SELECT
  COUNT(*) as total_registros,
  COUNT(DISTINCT conversation_id) as conversaciones_unicas,
  COUNT(*) - COUNT(DISTINCT conversation_id) as duplicados
FROM conversation_metrics;
EOF

echo ""
read -p "¿Los números se ven correctos? (s/n): " confirm
if [ "$confirm" != "s" ]; then
    echo -e "${RED}❌ Migración cancelada por el usuario${NC}"
    exit 1
fi

# ================================================================
# PASO 2: DETENER SERVIDOR
# ================================================================
echo ""
echo -e "${YELLOW}⏸️  PASO 2/6: Deteniendo servidor FlowBuilder...${NC}"
sudo systemctl stop flowbuilder
echo -e "${GREEN}✅ Servidor detenido${NC}"
sleep 2

# ================================================================
# PASO 3: BACKUP DE BASE DE DATOS
# ================================================================
echo ""
echo "💾 PASO 3/6: Creando backup de base de datos..."
BACKUP_FILE="/root/backups-flowbuilder/pre-migration-metrics-$(date +%Y%m%d-%H%M%S).sql"
sudo -u postgres pg_dump flowbuilder_crm > "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup creado: $BACKUP_FILE${NC}"

# ================================================================
# PASO 4: EJECUTAR MIGRACIÓN SQL
# ================================================================
echo ""
echo -e "${YELLOW}🔧 PASO 4/6: Ejecutando migración SQL...${NC}"
echo ""
echo "IMPORTANTE: El script mostrará estadísticas y esperará confirmación"
echo "Al final verás: 'Si todo se ve bien, ejecuta: COMMIT;'"
echo ""
read -p "Presiona ENTER para continuar..."

# Ejecutar script SQL en modo interactivo
sudo -u postgres psql -d flowbuilder_crm -f /opt/flow-builder/scripts/fix-duplicate-metrics.sql

echo ""
echo -e "${YELLOW}⚠️  DECISIÓN CRÍTICA:${NC}"
echo "Si las estadísticas se ven bien, ejecuta manualmente:"
echo -e "${GREEN}sudo -u postgres psql -d flowbuilder_crm -c 'COMMIT;'${NC}"
echo ""
echo "Si algo salió mal, ejecuta:"
echo -e "${RED}sudo -u postgres psql -d flowbuilder_crm -c 'ROLLBACK;'${NC}"
echo ""
read -p "¿Ejecutaste COMMIT exitosamente? (s/n): " commit_confirm

if [ "$commit_confirm" != "s" ]; then
    echo -e "${RED}❌ Migración no confirmada${NC}"
    echo "Iniciando servidor sin cambios..."
    sudo systemctl start flowbuilder
    exit 1
fi

# ================================================================
# PASO 5: REINICIAR SERVIDOR
# ================================================================
echo ""
echo -e "${YELLOW}🔄 PASO 5/6: Reiniciando servidor FlowBuilder...${NC}"
sudo systemctl start flowbuilder
sleep 5

# Verificar que inició correctamente
if systemctl is-active --quiet flowbuilder; then
    echo -e "${GREEN}✅ Servidor reiniciado exitosamente${NC}"
else
    echo -e "${RED}❌ ERROR: Servidor no inició correctamente${NC}"
    sudo systemctl status flowbuilder
    exit 1
fi

# ================================================================
# PASO 6: VERIFICACIÓN POST-MIGRACIÓN
# ================================================================
echo ""
echo "✅ PASO 6/6: Verificando migración..."
echo ""

PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm << 'EOF'
-- Estadísticas finales
SELECT '=== ESTADÍSTICAS FINALES ===' AS info;

SELECT
  COUNT(*) as total_registros_limpios,
  COUNT(DISTINCT conversation_id) as conversaciones_unicas
FROM conversation_metrics;

-- Top asesores
SELECT '=== TOP 10 ASESORES (Conversaciones Reales) ===' AS info;

SELECT
  u.name as asesor,
  COUNT(*) as conversaciones
FROM conversation_metrics cm
JOIN users u ON cm.advisor_id = u.id
GROUP BY u.name
ORDER BY conversaciones DESC
LIMIT 10;

-- Verificar que no hay duplicados
SELECT '=== VERIFICACIÓN: Duplicados ===' AS info;

SELECT COUNT(*) as duplicados_encontrados
FROM (
  SELECT conversation_id, advisor_id, COUNT(*) as veces
  FROM conversation_metrics
  GROUP BY conversation_id, advisor_id
  HAVING COUNT(*) > 1
) duplicados;

EOF

echo ""
echo "================================================================"
echo -e "${GREEN}✅ MIGRACIÓN COMPLETADA${NC}"
echo "================================================================"
echo ""
echo "⏰ Finalizada a las: $(date)"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Verificar dashboard de métricas en la web"
echo "2. Confirmar que Angela tiene ~10-20 conversaciones (no 1,819)"
echo "3. Verificar que el parpadeo ya no ocurre"
echo ""
echo "💾 Backup guardado en: $BACKUP_FILE"
echo ""
