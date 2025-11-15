#!/bin/bash
# Script para matar procesos viejos antes de iniciar flowbuilder

echo "[Pre-start] Verificando procesos en puerto 3000..."

# Encontrar PIDs usando el puerto 3000 (excepto el proceso actual de systemd)
OLD_PIDS=$(lsof -ti :3000 2>/dev/null | grep -v $$ || true)

if [ -n "$OLD_PIDS" ]; then
  echo "[Pre-start] Encontrados procesos viejos: $OLD_PIDS"
  for PID in $OLD_PIDS; do
    CMDLINE=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
    echo "[Pre-start] Matando proceso $PID ($CMDLINE)"
    kill -9 $PID 2>/dev/null || true
  done
  sleep 2
  echo "[Pre-start] Procesos viejos eliminados"
else
  echo "[Pre-start] No hay procesos viejos en puerto 3000"
fi

exit 0
