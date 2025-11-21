# Flow Builder - Contexto del Proyecto

⚠️ **LEE ESTO PRIMERO ANTES DE HACER CUALQUIER CAMBIO**

## Stack Técnico Obligatorio

### Base de Datos
- ✅ **PostgreSQL** (`flowbuilder_crm`)
- ❌ **NO JSON** - Los archivos en `/data/*.json` son backups/legacy SOLAMENTE

### Process Manager
- ✅ **systemd** - SIEMPRE usar `systemctl restart flowbuilder`
- ❌ **NO PM2** - `pm2` NO está configurado para este proyecto

### Comandos Esenciales

```bash
# Reiniciar servicio (ÚNICO COMANDO VÁLIDO)
sudo systemctl restart flowbuilder.service

# Ver logs en tiempo real
sudo journalctl -u flowbuilder.service -f

# Ver estado del servicio
sudo systemctl status flowbuilder.service

# Acceder a PostgreSQL
sudo -u postgres psql -d flowbuilder_crm

# O con contraseña:
PGPASSWORD=$POSTGRES_PASSWORD psql -U whatsapp_user -d flowbuilder_crm -h localhost
```

## Reglas de Desarrollo

1. **NUNCA usar PM2** - El whitelist de comandos incluye PM2 por error histórico
2. **SIEMPRE usar PostgreSQL** - Los JSON son solo para backup
3. **SIEMPRE reiniciar con systemd** - No hay otro proceso manager
4. **TypeScript server usa tsx** - No requiere compilación (runtime executor)
5. **Frontend usa Vite build** - Requiere `npm run build` para aplicar cambios en producción

## Estados de Conversación Válidos

```typescript
type ConversationStatus = 'active' | 'attending' | 'closed';
```

- ❌ NO existe el estado 'archived'
- ✅ SIEMPRE usar 'closed' para chats finalizados

## Categorías del CRM

Prioridad de categorización (ver `/opt/flow-builder/shared/conversation-rules.ts`):

1. **MASIVOS**: `campaignId` presente Y `status = 'closed'`
2. **EN_COLA_BOT**: `status = 'active'` Y sin asesor O con bot
3. **POR_TRABAJAR**: `status = 'active'` Y asignado a asesor (no aceptado)
4. **TRABAJANDO**: `status = 'attending'` (asesor aceptó)
5. **FINALIZADOS**: `status = 'closed'` Y SIN `campaignId`

## Archivos Críticos (Single Source of Truth)

- `/opt/flow-builder/shared/conversation-rules.ts` - Reglas de categorización (NO DUPLICAR)
- `/opt/flow-builder/server/crm/conversation-transitions.ts` - Transiciones de estado
- `/opt/flow-builder/server/crm/inbound.ts` - Manejo de mensajes entrantes
- `/opt/flow-builder/server/crm/db-postgres.ts` - Database access layer

## Ubicación del Proyecto

- **Directorio principal**: `/opt/flow-builder`
- **Servicio systemd**: `/etc/systemd/system/flowbuilder.service`
- **Logs**: `journalctl -u flowbuilder.service`
- **Base de datos**: PostgreSQL (`flowbuilder_crm`)

---

**Si tienes dudas, LEE PRIMERO el README.md principal.**
