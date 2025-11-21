# 🛡️ CONFIGURACIÓN DE CAMPAÑAS - BLINDADO

**Estado:** ✅ CONFIGURACIÓN FUNCIONAL Y PROTEGIDA
**Última actualización:** 2025-11-16 23:05
**Validación:** `./scripts/validate-campaigns-config.sh` ✅

---

## 📋 Resumen

La configuración de campañas WhatsApp está **blindada y respaldada**. No se puede desconfigurar accidentalmente.

### ✅ Funcionalidades garantizadas:

1. **Auto-detección de imágenes de templates** - No necesitas especificar variables manualmente
2. **Upload automático de media** - Las imágenes se re-suben a WhatsApp para obtener `media_id` válido
3. **Multi-idioma correcto** - Las campañas se envían en el idioma del template
4. **Logs detallados de errores** - Si algo falla, verás el error exacto de WhatsApp
5. **Sin duplicación de conversaciones** - Reactiva conversaciones archivadas correctamente

---

## 🔒 Protecciones implementadas

### 1. Respaldos inmutables (read-only)
```bash
ls -lh config-backups/*.WORKING_*
# -r--r--r-- routes.ts.WORKING_20251116_230557
# -r--r--r-- storage-db.ts.WORKING_20251116_230557
# -r--r--r-- CampaignsPage.tsx.WORKING_20251116_230557
# -r--r--r-- status-webhook-handler.ts.WORKING_20251116_230557
```

### 2. Script de validación automática
```bash
./scripts/validate-campaigns-config.sh
```
Verifica:
- ✅ Archivos críticos existen
- ✅ Código usa `media_id` (no link directo)
- ✅ Auto-detección habilitada
- ✅ Frontend envía campo `language`
- ✅ PostgreSQL tiene columnas `language` y `updated_at`
- ✅ Triggers de base de datos existen

### 3. Script de restauración automática
```bash
./scripts/restore-campaigns-config.sh
```
Si algo se desconfigura:
- Crea respaldo de archivos actuales
- Restaura desde respaldos WORKING
- Recompila frontend
- Valida la configuración restaurada

---

## 📖 Documentación completa

Ver `CONFIGURACION-CRITICA-CAMPANAS.md` para:
- Detalles técnicos de cada archivo
- Checklist de validación manual
- Historial de fixes
- Troubleshooting de errores comunes

---

## 🚀 Uso diario

### Enviar campaña con imagen:
1. Ir a "Campañas" en el panel
2. Seleccionar plantilla con imagen
3. No llenar variables (se auto-detectan)
4. Enviar

**El sistema automáticamente:**
- Detecta la imagen del template
- La descarga y re-sube a WhatsApp
- Obtiene `media_id` válido
- Envía con el idioma correcto

### Verificar que todo está correcto:
```bash
cd /opt/flow-builder
./scripts/validate-campaigns-config.sh
```

### Si algo falla, restaurar:
```bash
cd /opt/flow-builder
./scripts/restore-campaigns-config.sh
sudo systemctl restart flowbuilder.service
```

---

## ⚠️ IMPORTANTE

**NO MODIFICAR estos archivos sin hacer respaldo primero:**
- `server/campaigns/routes.ts`
- `server/campaigns/storage-db.ts`
- `src/campaigns/CampaignsPage.tsx`
- `server/crm/status-webhook-handler.ts`

**Si necesitas modificar:**
1. Crear respaldo: `cp archivo.ts archivo.ts.backup-$(date +%Y%m%d)`
2. Hacer cambios
3. Validar: `./scripts/validate-campaigns-config.sh`
4. Si falla, restaurar: `./scripts/restore-campaigns-config.sh`

---

## 🐛 Errores conocidos resueltos

| Error | Causa | Solución implementada |
|-------|-------|----------------------|
| Media upload error 403 | Usaba `link` directo del `header_handle` | Ahora descarga y re-sube para obtener `media_id` |
| Mensajes en español | Frontend no enviaba `language` | Ahora envía `selectedTemplateObj?.language` |
| "updated_at no existe" | Trigger actualizaba columna inexistente | Agregada columna + removida actualización manual |
| Conversaciones duplicadas | Creaba nueva en vez de reactivar | Ahora reactiva archivadas correctamente |

---

**TODO ESTÁ BLINDADO Y FUNCIONAL ✅**

Si tienes dudas, consultar la documentación completa en `CONFIGURACION-CRITICA-CAMPANAS.md`
