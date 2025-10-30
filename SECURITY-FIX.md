# 🚨 FIX DE SEGURIDAD CRÍTICO (P1)

## ⚠️ PROBLEMA IDENTIFICADO

**Severidad:** P1 (Critical - Priority 1)
**Reportado por:** chatgpt-codex-connector bot
**Fecha:** 2025-10-30

### Vulnerabilidad

Los siguientes endpoints del CRM estaban **expuestos públicamente SIN autenticación**:

```
❌ /api/crm/media/:id           - Descarga de media WhatsApp
❌ /api/crm/attachments/upload  - Subida de archivos
❌ /api/crm/attachments/*       - Gestión de adjuntos
❌ /api/crm/messages/*          - Gestión de mensajes
❌ /api/crm/conversations/*     - Gestión de conversaciones
```

### Riesgo

Cualquier persona que conociera o adivinara un `media ID` podía:

1. **Descargar archivos privados** de WhatsApp sin autenticación
2. **Acceder a toda la biblioteca de media** del negocio
3. **Usar el access token privilegiado** del servidor para hacer peticiones a Graph API
4. **Subir archivos maliciosos** al sistema
5. **Manipular conversaciones y mensajes** del CRM

**Esto exponía efectivamente el access token privilegiado de WhatsApp al público.**

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambios en `server/crm/index.ts`

```typescript
// Health check - NO REQUIERE AUTENTICACIÓN (para monitoreo)
router.get("/health", (_req, res) => {
  const status = realtime.getStatus();
  res.json({ ok: true, ws: status.clients >= 0, clients: status.clients });
});

// TODOS los demás endpoints del CRM REQUIEREN AUTENTICACIÓN
router.use(requireAuth);

router.use("/attachments", createAttachmentsRouter());
router.use("/messages", createMessagesRouter(realtime, bitrixService));
router.use("/conversations", createConversationsRouter(realtime, bitrixService));
router.use(mediaRouter); // Media proxy endpoint: /api/crm/media/:id
```

### Ahora Protegido

✅ **Todos los endpoints CRM** ahora requieren un JWT válido (cookie httpOnly)
✅ **Solo usuarios autenticados** pueden acceder a media, mensajes y conversaciones
✅ **/health** sigue público (necesario para monitoreo de infraestructura)

---

## 🔒 Comportamiento Actual

### Con Autenticación (usuarios logueados)
```bash
# Usuario autenticado puede descargar media
curl -b cookies.txt http://wsp.azaleia.com.pe/api/crm/media/12345
# ✅ Descarga exitosa
```

### Sin Autenticación (público)
```bash
# Usuario NO autenticado recibe error
curl http://wsp.azaleia.com.pe/api/crm/media/12345
# ❌ {"error":"unauthorized","message":"No token provided"}
```

### Health Check (siempre público)
```bash
# Health check NO requiere autenticación
curl http://wsp.azaleia.com.pe/api/crm/health
# ✅ {"ok":true,"ws":true,"clients":5}
```

---

## 🚀 DESPLIEGUE

Este fix de seguridad **ya está incluido** en los scripts de despliegue.

Al ejecutar `./deploy-media-fix.sh`, automáticamente se descargará y aplicará este fix.

**NO se requiere ninguna acción adicional del usuario** más allá de ejecutar el script de despliegue normal.

---

## 📊 IMPACTO EN USUARIOS

### Frontend (React)

El frontend ya usa el hook `useAuth` que:
- ✅ Envía automáticamente las cookies de autenticación
- ✅ Gestiona tokens JWT en cookies httpOnly
- ✅ Redirige al login si no está autenticado

**No se requieren cambios en el código del frontend.**

### API Calls

Todas las llamadas a `/api/crm/*` (excepto `/health`) ahora:
- ✅ Verifican el JWT en la cookie
- ✅ Retornan 401 si no hay token válido
- ✅ Procesan normalmente si el usuario está autenticado

---

## ✅ VERIFICACIÓN POST-DESPLIEGUE

Después de desplegar, verifica que la seguridad funcione:

```bash
# 1. Health check debe funcionar sin auth
curl https://wsp.azaleia.com.pe/api/crm/health
# Esperado: {"ok":true,...}

# 2. Media debe requerir auth
curl https://wsp.azaleia.com.pe/api/crm/media/test
# Esperado: {"error":"unauthorized",...}

# 3. Attachments debe requerir auth
curl -X POST https://wsp.azaleia.com.pe/api/crm/attachments/upload
# Esperado: {"error":"unauthorized",...}

# 4. Con login debe funcionar
# (desde el navegador después de hacer login, las imágenes deben cargarse normalmente)
```

---

## 📝 COMMITS RELACIONADOS

- `60cb2fa` - security: proteger endpoints CRM con autenticación (P1 Critical)
- `bc80984` - fix: usar getWhatsAppEnv() para cargar access token
- `774ccf0` - feat: agregar dependencia axios

Branch: `claude/bitrix-waba-connection-fix-011CUc71xRXz1f38URo63thz`

---

## 🆘 SOPORTE

Si después del despliegue encuentras problemas:

1. **Imágenes no cargan en el CRM:** Verifica que el usuario esté logueado
2. **Error 401 en consola del navegador:** Verifica cookies y sesión
3. **Health check falla:** Verifica que el servidor esté corriendo

Reporta cualquier issue con:
- Logs del navegador (F12 → Console)
- Logs del servidor (`pm2 logs bot-ai`)
- Request específico que falla

---

**Gracias al bot chatgpt-codex-connector por identificar esta vulnerabilidad crítica.**
