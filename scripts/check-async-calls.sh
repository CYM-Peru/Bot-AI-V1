#!/bin/bash
# Script to detect missing await calls for async PostgreSQL methods

echo "🔍 Buscando llamadas a métodos async sin await..."
echo ""

# Lista de métodos async de PostgreSQL que requieren await
ASYNC_METHODS=(
  "listConversations"
  "getAllConversations"
  "getConversationById"
  "getConversationByIdAsync"
  "getConversationByPhoneAndChannel"
  "createConversation"
  "updateConversationMeta"
  "appendMessage"
  "acceptConversation"
  "assignConversation"
  "archiveConversation"
  "unarchiveConversation"
  "deleteConversation"
  "getMessages"
  "deleteMessage"
  "addAdvisorToAttendedBy"
)

ERRORS_FOUND=0

for method in "${ASYNC_METHODS[@]}"; do
  # Buscar llamadas sin await en archivos .ts (excluyendo definiciones)
  results=$(grep -rn "crmDb\.$method(" --include="*.ts" /opt/flow-builder/server 2>/dev/null | \
    grep -v "async.*$method\(" | \
    grep -v "await.*crmDb\.$method(" | \
    grep -v "return.*crmDb\.$method(" | \
    grep -v "//" | \
    grep -v "^\s*/\*" | \
    grep -v "db-postgres.ts" | \
    grep -v "db.ts:")

  if [ -n "$results" ]; then
    echo "⚠️  Método '$method' llamado SIN await:"
    echo "$results"
    echo ""
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
  fi
done

if [ $ERRORS_FOUND -eq 0 ]; then
  echo "✅ No se encontraron errores de async/await"
else
  echo "❌ Se encontraron $ERRORS_FOUND métodos con posibles errores"
  echo ""
  echo "💡 Tip: Todos los métodos de crmDb con PostgreSQL son async y requieren 'await'"
fi

exit $ERRORS_FOUND
