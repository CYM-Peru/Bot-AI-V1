# ✅ Checklist: Producción WhatsApp

## Lo que YA está listo ✅

- ✅ Backend funcionando en puerto 3000
- ✅ Credenciales de WhatsApp configuradas en .env
- ✅ Endpoints respondiendo correctamente:
  - `/health` → OK
  - `/api/crm/health` → OK
  - `/webhook/whatsapp` → OK (verificación funciona)
- ✅ Frontend compilado en `/dist`
- ✅ Directorios de datos creados
- ✅ CRM con todas las mejoras implementadas
- ✅ Sistema de archivos adjuntos configurado

---

## Lo que NECESITAS hacer 🔧

### 1. Configurar tu Servidor Web (HTTPS)

**¿Ya tienes un servidor web configurado?**

Tu dominio `wsp.azaleia.com.pe` parece estar funcionando. Si ya tienes Nginx, Apache o Caddy configurado, solo necesitas:

**Asegurarte que estos paths estén configurados:**

```
https://wsp.azaleia.com.pe/         → /home/user/Bot-AI-V1/dist (frontend)
https://wsp.azaleia.com.pe/api/*    → http://localhost:3000/api/* (proxy)
https://wsp.azaleia.com.pe/webhook/* → http://localhost:3000/webhook/* (proxy)
https://wsp.azaleia.com.pe/health   → http://localhost:3000/health (proxy)
```

**Si NO tienes servidor web configurado:**

Sigue la sección "Paso 1" de `GUIA_PRODUCCION_WHATSAPP.md`

---

### 2. Mantener el Backend Corriendo (Producción)

Actualmente el backend está corriendo en tu sesión actual. Para producción, necesitas que se ejecute automáticamente:

**Opción recomendada: PM2**

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar backend con PM2
cd /home/user/Bot-AI-V1
pm2 start npm --name "bot-ai-backend" -- run dev:server

# Guardar configuración
pm2 save

# Configurar inicio automático al reiniciar servidor
pm2 startup
# (copia y ejecuta el comando que te muestra)

# Ver logs
pm2 logs bot-ai-backend

# Ver estado
pm2 status
```

---

### 3. Configurar Webhook en Meta for Developers

**URL del webhook que debes configurar:**
```
https://wsp.azaleia.com.pe/webhook/whatsapp
```

**Token de verificación:**
```
azaleia_meta_token_2025
```

**Pasos detallados:**

1. Ve a: https://developers.facebook.com/
2. Login con tu cuenta
3. Selecciona tu app de WhatsApp Business (o créala)
4. En el panel izquierdo → "WhatsApp" → "Configuración"
5. Sección "Webhook" → Click "Configurar webhook" o "Editar"
6. Ingresa:
   - URL: `https://wsp.azaleia.com.pe/webhook/whatsapp`
   - Token: `azaleia_meta_token_2025`
7. Click "Verificar y guardar" → Debe decir "✓ Verificado"
8. Suscríbete a estos eventos:
   - ☑️ **messages**
   - ☑️ **message_status**
9. Click "Guardar"

**Guía completa con screenshots:** Ver sección "Paso 3" de `GUIA_PRODUCCION_WHATSAPP.md`

---

### 4. Probar que Todo Funciona

**A. Enviar mensaje de prueba:**

1. Desde tu WhatsApp personal, envía un mensaje al número de negocio: `+51 741220429081783`
2. El mensaje debe aparecer automáticamente en:
   - Logs del backend
   - Panel CRM en https://wsp.azaleia.com.pe

**B. Responder desde el CRM:**

1. Abre https://wsp.azaleia.com.pe
2. Click en pestaña "🗂️ CRM"
3. Selecciona la conversación
4. Escribe una respuesta y envía
5. Debe llegar a tu WhatsApp

**C. Probar archivos adjuntos:**

1. Desde WhatsApp, envía una imagen
2. En el CRM, debe aparecer la imagen
3. Click en la imagen → Debe abrir modal fullscreen
4. Desde el CRM, envía una imagen usando el botón 📎
5. Debe llegar a tu WhatsApp

---

## Verificación Rápida

**Ejecuta este comando para ver el estado:**

```bash
cd /home/user/Bot-AI-V1
./verificar-produccion.sh
```

---

## Estado Actual: CASI LISTO 🎯

**Lo único que falta para estar 100% en producción:**

1. ✅ Backend funcionando → **LISTO**
2. ⚠️ Servidor web con HTTPS → **VERIFICAR** (parece que ya está)
3. ❌ Webhook configurado en Meta → **PENDIENTE** (necesitas hacerlo)
4. ⚠️ PM2 para producción → **RECOMENDADO** (opcional pero importante)

---

## ¿Qué Necesito de Ti?

Para completar la configuración, necesito que me digas:

1. **¿Ya tienes un servidor web configurado (Nginx/Apache/Caddy)?**
   - Si sí: ¿Cuál usas?
   - Si no: ¿Quieres que te ayude a configurar Nginx?

2. **¿Tienes acceso a Meta for Developers?**
   - ¿Ya tienes una app de WhatsApp Business creada?
   - ¿Necesitas ayuda para configurar el webhook?

3. **¿Quieres que configure PM2 para que el backend corra automáticamente?**

---

## Próximos Pasos Sugeridos

### Ahora (Crítico):
1. Configurar webhook en Meta for Developers
2. Probar recepción de mensajes

### Después (Importante):
1. Configurar PM2 para backend en producción
2. Configurar logs automáticos
3. Configurar backups de `/data`

### Más tarde (Opcional):
1. Integración con Bitrix24
2. Monitoreo y alertas
3. Métricas y analytics

---

## Ayuda Adicional

- **Guía completa**: `GUIA_PRODUCCION_WHATSAPP.md`
- **Mejoras del CRM**: `CRM_MEJORAS_COMPLETADAS.md`
- **Script de verificación**: `./verificar-produccion.sh`

---

🚀 **¡Estás a un paso de tener WhatsApp en producción!**

Dime qué necesitas y te ayudo a completar la configuración.
