#!/bin/bash
cd /opt/flow-builder

# Cargar .env línea por línea de forma segura
while IFS='=' read -r key value; do
  # Ignorar líneas vacías y comentarios
  [[ -z "$key" || "$key" =~ ^#.* ]] && continue
  # Exportar solo si la key es válida
  if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    export "$key=$value"
  fi
done < .env

exec npx tsx server/index.ts
