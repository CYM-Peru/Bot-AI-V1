# 🚀 Despliegue: Fix para Adjuntos de WhatsApp

Este documento describe cómo desplegar la solución para el problema de descarga de adjuntos de WhatsApp.

## 🚨 ATENCIÓN: Fix de Seguridad Crítico Incluido (P1)

**Este despliegue incluye un fix de seguridad crítico (P1)** que protege los endpoints del CRM.

📄 Ver detalles completos en: [SECURITY-FIX.md](./SECURITY-FIX.md)

**Resumen:** Los endpoints de CRM estaban expuestos sin autenticación. Ahora requieren JWT válido.

---

## 📋 Problemas Identificados

### 1. **Problema de Descarga de Media**

El código de descarga de media estaba leyendo **directamente** `process.env.WHATSAPP_ACCESS_TOKEN`, ignorando el archivo de secrets `data/secrets/whatsapp.json`.

### 2. **🚨 Problema de Seguridad (P1 - CRÍTICO)**

Los endpoints del CRM estaban **sin autenticación**, exponiendo:
- Media de WhatsApp (`/api/crm/media/:id`)
- Upload de archivos (`/api/crm/attachments/*`)
- Mensajes y conversaciones (`/api/crm/messages/*`, `/api/crm/conversations/*`)

Esto permitía a cualquiera acceder a archivos privados de WhatsApp sin login.

## ✅ Soluciones Implementadas

### 1. **Fix de Carga de Token**

Modificados los archivos para usar `getWhatsAppEnv()` que busca el token en:
1. Variables de entorno (.env): `WSP_ACCESS_TOKEN` o `WHATSAPP_ACCESS_TOKEN`
2. Archivo de secrets: `data/secrets/whatsapp.json`

### 2. **🔒 Fix de Seguridad**

Aplicado middleware `requireAuth` a TODOS los endpoints del CRM excepto `/health`:
- ✅ Ahora requieren JWT válido (usuario autenticado)
- ✅ `/health` sigue público para monitoreo
- ✅ Mayor seguridad sin afectar funcionalidad del frontend

## 🎯 Plan de Despliegue

### **OPCIÓN C (Recomendada): Probar solución principal, si falla usar Plan B**

---

## 📦 PASO 1: Desplegar Solución Principal

Conecta a tu servidor de producción y ejecuta:

```bash
# Copiar el script al servidor (desde tu máquina local)
scp deploy-media-fix.sh root@147.93.10.141:/opt/flow-builder/

# Conectar al servidor
ssh root@147.93.10.141

# Ejecutar el script de despliegue
cd /opt/flow-builder
chmod +x deploy-media-fix.sh
./deploy-media-fix.sh
```

El script hará automáticamente:
- ✅ Verificar que el token esté configurado
- ✅ Descargar los cambios del branch
- ✅ Instalar dependencias (axios)
- ✅ Reiniciar el servidor
- ✅ Mostrar logs para verificación

---

## 🧪 PASO 2: Probar

Después del despliegue:

1. **Monitorear logs en tiempo real:**
   ```bash
   pm2 logs bot-ai
   ```

2. **Enviar una imagen NUEVA** por WhatsApp a tu número

3. **Verificar en los logs que veas:**
   ```
   [CRM][Media] Obteniendo metadata de: https://graph.facebook.com/...
   [CRM][Media] URL completa de descarga: https://lookaside.fbsbx.com/...
   [CRM][Media] Descargando con axios (responseType: arraybuffer)...
   [CRM][Media] ✅ Descarga exitosa con axios: XXXX bytes
   ```

4. **Verificar en el CRM** que la imagen aparezca correctamente

---

## 🔧 PASO 3: Si NO Funciona → Plan B (Proxy Separado)

Si después de probar la solución principal las imágenes **siguen sin aparecer**, ejecuta:

```bash
# Copiar el script del Plan B al servidor
scp plan-b-proxy-separado.sh root@147.93.10.141:/opt/flow-builder/

# En el servidor
cd /opt/flow-builder
chmod +x plan-b-proxy-separado.sh
./plan-b-proxy-separado.sh
```

Este script:
- ✅ Crea un servicio proxy independiente en puerto 3080
- ✅ Usa axios (que funciona mejor con lookaside.fbsbx.com)
- ✅ Se ejecuta como servicio PM2 separado
- ✅ No afecta tu aplicación principal

**Después de instalar el proxy**, necesitarás configurar tu app para usarlo (te daré instrucciones).

---

## 📊 Comandos Útiles

```bash
# Ver logs de la app principal
pm2 logs bot-ai

# Ver logs del archivo de debug
tail -f /opt/flow-builder/logs/debug.log

# Verificar estado de los servicios PM2
pm2 status

# Reiniciar servicio
pm2 restart bot-ai

# Ver logs del proxy (solo si instalaste Plan B)
pm2 logs media-proxy-3080
```

---

## ⚠️ Notas Importantes

1. **URLs de media expiran:** Las URLs de WhatsApp expiran después de 5 minutos. Solo podrás descargar imágenes NUEVAS, no las antiguas.

2. **Token requerido:** Asegúrate de tener el token configurado en UNO de estos lugares:
   - `.env`: `WHATSAPP_ACCESS_TOKEN=tu_token`
   - `data/secrets/whatsapp.json`: `{"accessToken": "tu_token"}`

3. **Axios es necesario:** La dependencia `axios` debe estar instalada (el script lo hace automáticamente).

---

## 🆘 ¿Problemas?

Si tienes problemas en cualquier paso:

1. Revisa los logs: `pm2 logs bot-ai`
2. Verifica el token: `grep WHATSAPP_ACCESS_TOKEN /opt/flow-builder/.env`
3. Verifica que axios esté instalado: `ls -la /opt/flow-builder/node_modules/axios`
4. Reporta el error específico que veas en los logs

---

## 📝 Commits Relacionados

- `774ccf0` - feat: agregar dependencia axios
- `bc80984` - fix: usar getWhatsAppEnv() para cargar access token

Branch: `claude/bitrix-waba-connection-fix-011CUc71xRXz1f38URo63thz`
