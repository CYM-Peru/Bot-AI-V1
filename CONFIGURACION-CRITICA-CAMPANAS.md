# CONFIGURACIÓN CRÍTICA DE CAMPAÑAS - NO MODIFICAR

**Fecha de última configuración funcional:** 2025-11-16 23:05

## ⚠️ ARCHIVOS CRÍTICOS - NO MODIFICAR SIN RESPALDO

### 1. `/opt/flow-builder/server/campaigns/routes.ts`
**Función crítica:** `sendCampaignMessages()` (líneas 261-422)

**Características esenciales que DEBEN mantenerse:**

✅ **Auto-detección de imágenes de template** (líneas 285-350)
- Cuando `variables` está vacío, detecta automáticamente la imagen del template desde Meta API
- Descarga la imagen del `header_handle`
- Re-sube la imagen a WhatsApp usando `uploadMedia()` para obtener `media_id`
- Usa `media_id` (NO link directo) para evitar error 403 Forbidden

```typescript
// CÓDIGO CRÍTICO - NO ELIMINAR
if (isEmptyVariables) {
  console.log('[Campaigns] No variables provided, attempting to auto-detect and upload template header from Meta');
  // ... descarga y re-sube imagen ...
  templateVariables = [{
    type: 'header',
    parameters: [{
      type: 'image',
      image: {
        id: mediaId // ← DEBE ser 'id', NO 'link'
      }
    }]
  }];
}
```

✅ **Uso correcto del idioma del template** (línea 336)
- Envía con `campaign.language` (no hardcodeado a 'es')

✅ **Reactivación de conversaciones archivadas** (líneas 349-369)
- NO crea conversaciones duplicadas
- Reactiva conversaciones cerradas/archivadas correctamente

---

### 2. `/opt/flow-builder/src/campaigns/CampaignsPage.tsx`
**Línea crítica:** 263

✅ **Envío del campo language:**
```typescript
language: selectedTemplateObj?.language || 'es', // ← DEBE incluirse
```

**¿Por qué es crítico?**
- Sin esto, todas las campañas se envían en español aunque el template sea en otro idioma
- El backend usa este campo para buscar el template correcto en Meta API

---

### 3. `/opt/flow-builder/server/campaigns/storage-db.ts`
**Líneas críticas:** 217-222

✅ **NO actualizar manualmente `updated_at`:**
```typescript
// Build update query (updated_at is handled automatically by trigger)
console.log('[CampaignStorage] 🔥 FIXED VERSION - updated_at handled by trigger');
let query = `
  UPDATE campaign_message_details
  SET status = $1
`;
// ← NO agregar: db_updated_at = NOW() o updated_at = NOW()
```

**¿Por qué es crítico?**
- PostgreSQL tiene un trigger que actualiza `updated_at` automáticamente
- Intentar actualizarlo manualmente causa error: "record new has no field updated_at"

---

### 4. `/opt/flow-builder/server/crm/status-webhook-handler.ts`
**Líneas críticas:** 77-83

✅ **Logs detallados de errores de WhatsApp:**
```typescript
if (status.errors && status.errors.length > 0) {
  logDebug(`[CRM Status] 🔴 FAILED MESSAGE: whatsappMessageId=${whatsappMessageId}, phone=${recipientPhone}`);
  logDebug(`[CRM Status] 🔴 ERROR DETAILS:`, JSON.stringify(status.errors, null, 2));
}
```

**¿Por qué es crítico?**
- Permite diagnosticar por qué fallan los mensajes (403, media upload, etc.)
- Sin estos logs, los errores son invisibles

---

## 🔧 CONFIGURACIÓN DE BASE DE DATOS

### Tabla: `campaigns`
✅ **Columnas requeridas:**
- `id` (text, PK)
- `name` (text)
- `whatsapp_number_id` (text)
- `template_name` (text)
- `language` (text) ← CRÍTICO: debe existir
- `recipients` (jsonb)
- `variables` (jsonb)
- `status` (text)
- `created_at` (bigint)
- `created_by` (text)
- `throttle_rate` (integer)
- `started_at` (bigint, nullable)
- `completed_at` (bigint, nullable)
- `updated_at` (timestamp) ← CRÍTICO: debe existir
- `db_updated_at` (timestamp, auto)

### Tabla: `campaign_message_details`
✅ **Columnas requeridas:**
- `id` (serial, PK)
- `campaign_id` (text, FK)
- `phone` (text)
- `status` (text)
- `sent_at` (bigint, nullable)
- `delivered_at` (bigint, nullable)
- `read_at` (bigint, nullable)
- `responded` (boolean)
- `clicked_button` (text, nullable)
- `error_message` (text, nullable)
- `updated_at` (timestamp) ← CRÍTICO: debe existir
- `created_at` (timestamp, auto)

### Triggers críticos:
```sql
-- ✅ DEBE existir
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ✅ DEBE existir
CREATE TRIGGER update_campaign_details_updated_at
  BEFORE UPDATE ON campaign_message_details
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 📋 CHECKLIST DE VALIDACIÓN

Ejecutar ANTES de cualquier cambio en campañas:

```bash
cd /opt/flow-builder

# 1. Verificar que existen los respaldos
ls -lh config-backups/*.WORKING_*

# 2. Verificar columnas críticas en PostgreSQL
POSTGRES_PASSWORD=azaleia_pg_2025_secure psql -U whatsapp_user -d flowbuilder_crm -c "\d campaigns" | grep -E "language|updated_at"

# 3. Verificar triggers
POSTGRES_PASSWORD=azaleia_pg_2025_secure psql -U whatsapp_user -d flowbuilder_crm -c "\d campaigns" | grep -i trigger

# 4. Probar envío de campaña con imagen
# Debe ver en logs:
# - "Auto-detected template header image URL"
# - "Downloading image from header_handle"
# - "Re-uploading image to WhatsApp"
# - "Image uploaded successfully! media_id:"
```

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error 1: "Media upload error 403 Forbidden"
**Causa:** Se está usando `link` con `header_handle` en lugar de `media_id`
**Solución:** Verificar que `routes.ts` use `image: { id: mediaId }` NO `image: { link: ... }`

### Error 2: "record new has no field updated_at"
**Causa:** Se está intentando actualizar `updated_at` manualmente en el query
**Solución:** Dejar que el trigger lo maneje automáticamente

### Error 3: Mensajes en español cuando deberían ser en otro idioma
**Causa:** Frontend no envía el campo `language`
**Solución:** Verificar `CampaignsPage.tsx` línea 263

### Error 4: "crmDb.updateConversation is not a function"
**Causa:** Se importó el DB incorrecto (debe ser PostgreSQL)
**Solución:** Verificar que `routes.ts` importe `crmDb` de `./db-postgres`

---

## 🔒 RESPALDOS INMUTABLES

Los siguientes archivos contienen la configuración FUNCIONAL confirmada:

```bash
config-backups/routes.ts.WORKING_20251116_230557
config-backups/storage-db.ts.WORKING_20251116_230557
config-backups/CampaignsPage.tsx.WORKING_20251116_230557
config-backups/status-webhook-handler.ts.WORKING_20251116_230557
```

**Estos archivos son read-only (444)** - no se pueden modificar accidentalmente.

### Restaurar desde respaldo:
```bash
# Si algo se desconfigura:
cp config-backups/routes.ts.WORKING_20251116_230557 server/campaigns/routes.ts
cp config-backups/storage-db.ts.WORKING_20251116_230557 server/campaigns/storage-db.ts
cp config-backups/CampaignsPage.tsx.WORKING_20251116_230557 src/campaigns/CampaignsPage.tsx
cp config-backups/status-webhook-handler.ts.WORKING_20251116_230557 server/crm/status-webhook-handler.ts

# Recompilar frontend
npm run build

# Reiniciar servicio
sudo systemctl restart flowbuilder.service
```

---

## 📝 HISTORIAL DE FIXES

### 2025-11-16 - Fix completo de campañas con imágenes
1. ✅ Agregada columna `updated_at` a tabla `campaigns`
2. ✅ Removida actualización manual de `updated_at` en queries (usar trigger)
3. ✅ Frontend ahora envía campo `language` correctamente
4. ✅ Auto-detección de imágenes de template desde Meta API
5. ✅ Descarga y re-upload de imágenes para obtener `media_id` válido
6. ✅ Uso de `media_id` en lugar de `link` directo (evita 403 Forbidden)
7. ✅ Logs detallados de errores de WhatsApp en webhook handler
8. ✅ Reactivación correcta de conversaciones archivadas (no duplicar)

**Resultado:** Campañas con plantillas de imágenes funcionan correctamente ✅

---

**IMPORTANTE:** Ante cualquier duda, consultar este documento ANTES de modificar código relacionado con campañas.
