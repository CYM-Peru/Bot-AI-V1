#!/bin/bash
###############################################################################
# SCRIPT DE VALIDACIÓN DE CONFIGURACIÓN CRÍTICA
# Verifica que el sistema esté configurado correctamente según especificaciones
# Ejecutar diariamente o después de cambios
###############################################################################

# No usar set -e para que el script continúe incluso si hay errores
set +e

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_FILE="/opt/flow-builder/config-validation-report.txt"

echo "========================================" | tee $REPORT_FILE
echo "REPORTE DE VALIDACIÓN DE CONFIGURACIÓN" | tee -a $REPORT_FILE
echo "Fecha: $TIMESTAMP" | tee -a $REPORT_FILE
echo "========================================" | tee -a $REPORT_FILE
echo "" | tee -a $REPORT_FILE

ERRORS=0
WARNINGS=0

# ============================================================================
# 1. VERIFICAR QUE BOUNCE SERVICE NO ESTÉ ACTIVO
# ============================================================================
echo "✓ [1/5] Verificando que bounce-service NO esté activo..." | tee -a $REPORT_FILE

if grep -r "bounceService.start()" /opt/flow-builder/server/crm/index.ts 2>/dev/null; then
    echo "  ❌ ERROR: bounce-service ESTÁ ACTIVO en crm/index.ts" | tee -a $REPORT_FILE
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ bounce-service NO está activo (correcto)" | tee -a $REPORT_FILE
fi

if [ -f "/opt/flow-builder/server/crm/bounce-service.ts" ]; then
    echo "  ⚠️  ADVERTENCIA: bounce-service.ts aún existe (debería estar renombrado)" | tee -a $REPORT_FILE
    WARNINGS=$((WARNINGS + 1))
else
    echo "  ✅ bounce-service.ts no existe (correcto)" | tee -a $REPORT_FILE
fi

echo "" | tee -a $REPORT_FILE

# ============================================================================
# 2. VERIFICAR CONFIGURACIÓN DE COLAS EN BASE DE DATOS
# ============================================================================
echo "✓ [2/5] Verificando configuración de colas..." | tee -a $REPORT_FILE

QUEUE_CHECK=$(POSTGRES_PASSWORD=azaleia_pg_2025_secure PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -t -c "
SELECT
    id,
    name,
    distribution_mode,
    assigned_advisors
FROM queues
WHERE active = true;
" 2>&1)

if [ $? -eq 0 ]; then
    echo "  ✅ Conexión a base de datos exitosa" | tee -a $REPORT_FILE
    echo "" | tee -a $REPORT_FILE
    echo "  Colas activas:" | tee -a $REPORT_FILE
    echo "$QUEUE_CHECK" | tee -a $REPORT_FILE

    # Verificar que haya al menos una cola con least-busy
    if echo "$QUEUE_CHECK" | grep -q "least-busy"; then
        echo "  ✅ Al menos una cola tiene distribución 'least-busy'" | tee -a $REPORT_FILE
    else
        echo "  ⚠️  ADVERTENCIA: Ninguna cola usa 'least-busy' (recomendado)" | tee -a $REPORT_FILE
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "  ⚠️  ADVERTENCIA: No se pudo verificar colas en BD (psql no disponible)" | tee -a $REPORT_FILE
    echo "  💡 Esto no afecta el funcionamiento si el servicio está corriendo" | tee -a $REPORT_FILE
    WARNINGS=$((WARNINGS + 1))
fi

echo "" | tee -a $REPORT_FILE

# ============================================================================
# 3. VERIFICAR CÓDIGO DE DISTRIBUCIÓN EQUITATIVA
# ============================================================================
echo "✓ [3/5] Verificando código de distribución equitativa..." | tee -a $REPORT_FILE

if grep -q "Only distribute chats" /opt/flow-builder/server/crm/advisor-presence.ts 2>/dev/null; then
    echo "  ✅ Código de distribución equitativa presente" | tee -a $REPORT_FILE
else
    echo "  ❌ ERROR: Código de distribución equitativa NO encontrado" | tee -a $REPORT_FILE
    ERRORS=$((ERRORS + 1))
fi

if grep -q "NEVER removes chats from advisors" /opt/flow-builder/server/crm/advisor-presence.ts 2>/dev/null; then
    echo "  ✅ Protección contra remoción de chats presente" | tee -a $REPORT_FILE
else
    echo "  ⚠️  ADVERTENCIA: Comentario de protección no encontrado" | tee -a $REPORT_FILE
    WARNINGS=$((WARNINGS + 1))
fi

echo "" | tee -a $REPORT_FILE

# ============================================================================
# 4. VERIFICAR REDISTRIBUCIÓN POR CAMBIO DE ESTADO
# ============================================================================
echo "✓ [4/5] Verificando redistribución por cambio de estado..." | tee -a $REPORT_FILE

if grep -q "Try to reassign IMMEDIATELY to other available advisors" /opt/flow-builder/server/routes/admin.ts 2>/dev/null; then
    echo "  ✅ Código de redistribución inmediata presente" | tee -a $REPORT_FILE
else
    echo "  ❌ ERROR: Código de redistribución NO encontrado" | tee -a $REPORT_FILE
    ERRORS=$((ERRORS + 1))
fi

echo "" | tee -a $REPORT_FILE

# ============================================================================
# 5. VERIFICAR ESTADO DEL SERVICIO
# ============================================================================
echo "✓ [5/5] Verificando estado del servicio flowbuilder..." | tee -a $REPORT_FILE

if systemctl is-active --quiet flowbuilder.service; then
    echo "  ✅ Servicio flowbuilder está activo" | tee -a $REPORT_FILE

    # Verificar que no haya errores recientes en logs
    RECENT_ERRORS=$(journalctl -u flowbuilder.service --since "5 minutes ago" -p err --no-pager 2>/dev/null | wc -l)

    if [ "$RECENT_ERRORS" -eq 0 ]; then
        echo "  ✅ Sin errores en logs recientes (últimos 5 minutos)" | tee -a $REPORT_FILE
    else
        echo "  ⚠️  ADVERTENCIA: $RECENT_ERRORS error(es) en logs recientes" | tee -a $REPORT_FILE
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "  ❌ ERROR: Servicio flowbuilder NO está activo" | tee -a $REPORT_FILE
    ERRORS=$((ERRORS + 1))
fi

echo "" | tee -a $REPORT_FILE

# ============================================================================
# RESUMEN FINAL
# ============================================================================
echo "========================================" | tee -a $REPORT_FILE
echo "RESUMEN DE VALIDACIÓN" | tee -a $REPORT_FILE
echo "========================================" | tee -a $REPORT_FILE
echo "Errores críticos: $ERRORS" | tee -a $REPORT_FILE
echo "Advertencias: $WARNINGS" | tee -a $REPORT_FILE
echo "" | tee -a $REPORT_FILE

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ ¡TODO CORRECTO! Sistema configurado según especificaciones." | tee -a $REPORT_FILE
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Sistema funcional pero con advertencias. Revisar." | tee -a $REPORT_FILE
    exit 0
else
    echo "❌ ERRORES CRÍTICOS ENCONTRADOS. ¡ACCIÓN REQUERIDA!" | tee -a $REPORT_FILE
    exit 1
fi
