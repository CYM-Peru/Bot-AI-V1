#!/bin/bash
# Backup script for campaign system
# This prevents configuration loss and allows recovery

BACKUP_DIR="/opt/flow-builder/data/backups/campaigns"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup campaigns data
if [ -f "/opt/flow-builder/data/campaigns.json" ]; then
  cp "/opt/flow-builder/data/campaigns.json" "$BACKUP_DIR/campaigns_${TIMESTAMP}.json"
  echo "[Backup] ✅ Campaigns backed up: campaigns_${TIMESTAMP}.json"
fi

# Backup WhatsApp connections
if [ -f "/opt/flow-builder/data/whatsapp-connections.json" ]; then
  cp "/opt/flow-builder/data/whatsapp-connections.json" "$BACKUP_DIR/connections_${TIMESTAMP}.json"
  echo "[Backup] ✅ Connections backed up: connections_${TIMESTAMP}.json"
fi

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "*.json" -mtime +30 -delete
echo "[Backup] 🧹 Cleaned old backups (>30 days)"

# Verify backup integrity
if [ -f "$BACKUP_DIR/campaigns_${TIMESTAMP}.json" ]; then
  if jq empty "$BACKUP_DIR/campaigns_${TIMESTAMP}.json" 2>/dev/null; then
    echo "[Backup] ✅ Backup integrity verified"
  else
    echo "[Backup] ❌ ERROR: Backup file is corrupted!"
    exit 1
  fi
fi

echo "[Backup] ✅ Backup completed successfully"
