#!/bin/bash

# Script para agregar await a todas las llamadas de crmDb en conversations.ts

FILE="/opt/flow-builder/server/crm/routes/conversations.ts"

# Hacer backup
cp "$FILE" "$FILE.backup-$(date +%s)"

# Agregar await a todas las llamadas de crmDb que no lo tienen
sed -i 's/\([^a-z]\)crmDb\.\(getConversationById\|updateConversationMeta\|acceptConversation\|releaseConversation\|addAdvisorToAttendedBy\|listQueuedConversations\|archiveConversation\)/\1await crmDb.\2/g' "$FILE"

echo "✅ Awaits agregados en $FILE"
echo "📦 Backup guardado en $FILE.backup-*"
