# Información del Proyecto Flow Builder

## ⚠️ IMPORTANTE - LEER PRIMERO

### Stack Técnico
- **Storage**: PostgreSQL (`CRM_STORAGE_MODE=postgres` en `.env`)
  - ❌ NO usar archivos JSON en `/data/` - son backups/legacy
  - ✅ SIEMPRE verificar y modificar PostgreSQL directamente

- **Process Manager**: systemd
  - ❌ NO usar PM2 (`pm2 restart flowbuilder` NO funciona)
  - ✅ SIEMPRE usar `systemctl restart flowbuilder`

### Comandos Importantes

**Base de datos:**
```bash
PGPASSWORD=azaleia_pg_2025_secure psql -U whatsapp_user -d flowbuilder_crm -h localhost
```

**Reiniciar servicio:**
```bash
systemctl restart flowbuilder
systemctl status flowbuilder
```

**Ver logs:**
```bash
journalctl -u flowbuilder -f
```

### Configuración de Colas

- **Archivo**: `/opt/flow-builder/data/admin/whatsapp-numbers.json`
- **Tabla PostgreSQL**: `crm_conversations` (columna `queue_id`)
- **Reglas**:
  - 961842916 → Counter (`queue-1761859362582`)
  - 6193636 → ATC (`queue-1761859343408`)
  - 966748784 → Prospectos (`queue-1762287006531`)

### Verificar antes de asumir

1. Storage mode: `cat /opt/flow-builder/.env | grep CRM_STORAGE_MODE`
2. Process manager: `systemctl list-units | grep flowbuilder`
3. Servicios activos: `ps aux | grep flowbuilder`
