#!/bin/bash
###############################################################################
# SCRIPT DE MONITOREO DE COMPORTAMIENTO EN TIEMPO REAL
# Monitorea logs del servicio para detectar redistribuciones y asignaciones
###############################################################################

echo "========================================="
echo "🔍 MONITOR DE COMPORTAMIENTO DEL SISTEMA"
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""
echo "Monitoreando eventos de:"
echo "  - Distribución de chats nuevos"
echo "  - Redistribución por cambio de estado"
echo "  - Auto-asignación a asesores"
echo "  - Errores críticos"
echo ""
echo "Presiona Ctrl+C para detener..."
echo "========================================="
echo ""

# Monitorear logs del servicio con filtros específicos
journalctl -u flowbuilder.service -f --no-pager --since "1 minute ago" 2>&1 | grep --line-buffered -E "(QueueRedistribution|Status-change|Auto-assign|assigned conversation|released|ERROR|CRITICAL)" | while read -r line; do
    # Colorear output según tipo de evento
    if echo "$line" | grep -q "ERROR\|CRITICAL\|Failed"; then
        echo -e "\033[0;31m❌ $line\033[0m"  # Rojo para errores
    elif echo "$line" | grep -q "Auto-assign\|assigned conversation"; then
        echo -e "\033[0;32m✅ $line\033[0m"  # Verde para asignaciones
    elif echo "$line" | grep -q "Status-change\|released"; then
        echo -e "\033[0;33m⚠️  $line\033[0m"  # Amarillo para cambios de estado
    elif echo "$line" | grep -q "QueueRedistribution"; then
        echo -e "\033[0;36m🔄 $line\033[0m"  # Cyan para redistribución
    else
        echo "$line"
    fi
done
