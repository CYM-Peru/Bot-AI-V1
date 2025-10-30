# 🚀 Instrucciones de Despliegue a Producción

## Resumen de Cambios

Este despliegue incluye:

✅ **Fix de descarga de adjuntos WhatsApp**
- Usa axios en lugar de fetch (soluciona problemas con lookaside.fbsbx.com)
- Lee token desde múltiples fuentes usando getWhatsAppEnv()

✅ **Fix de seguridad crítico (P1)**
- Protege todos los endpoints CRM con autenticación
- Previene acceso no autorizado a media, mensajes y conversaciones
- Ver detalles en: [SECURITY-FIX.md](./SECURITY-FIX.md)

---

## 📦 Despliegue Automático (RECOMENDADO)

### Opción 1: Conexión SSH directa

```bash
# 1. Conéctate al servidor
ssh root@147.93.10.141

# 2. Ve al directorio del proyecto
cd /opt/flow-builder

# 3. Descarga el script de despliegue (si no lo tienes)
git fetch origin
git pull origin main  # o el branch que hayas usado para el merge

# 4. Ejecuta el script
chmod +x deploy-to-production.sh
./deploy-to-production.sh
```

### Opción 2: Desde tu máquina local (SSH remoto)

```bash
# Ejecuta el script remotamente vía SSH
ssh root@147.93.10.141 'cd /opt/flow-builder && git pull origin main && chmod +x deploy-to-production.sh && ./deploy-to-production.sh'
```

---

## 🔧 Despliegue Manual (si el script falla)

```bash
# 1. Conéctate al servidor
ssh root@147.93.10.141

# 2. Ve al directorio del proyecto
cd /opt/flow-builder

# 3. Descarga los cambios
git fetch origin
git pull origin main  # o tu branch principal

# 4. Instala dependencias
npm install

# 5. Verifica que axios esté instalado
ls -la node_modules/axios

# 6. Reinicia el servidor con PM2
pm2 restart bot-ai

# 7. Verifica que esté funcionando
pm2 logs bot-ai --lines 50
curl http://localhost:3000/health
```

---

## ✅ Verificación Post-Despliegue

### 1. Verificar que el servidor esté corriendo

```bash
pm2 status
pm2 logs bot-ai --lines 30
```

Deberías ver:
```
[PM2] bot-ai status: online
```

### 2. Verificar endpoint de salud

```bash
curl http://localhost:3000/health
```

Esperado: `{"status":"ok","timestamp":"..."}`

### 3. Verificar seguridad de endpoints

```bash
# Este comando DEBE retornar error de autenticación
curl http://localhost:3000/api/crm/media/test
```

Esperado: `{"error":"unauthorized","message":"No token provided"}`

Si retorna otra cosa, **la seguridad NO está funcionando**.

### 4. Probar descarga de adjuntos (la prueba definitiva)

1. **Monitorea los logs en tiempo real:**
   ```bash
   pm2 logs bot-ai
   ```

2. **Envía una IMAGEN NUEVA** por WhatsApp a tu número de negocio

3. **Verifica en los logs que veas:**
   ```
   [CRM][Media] Obteniendo metadata de: https://graph.facebook.com/v20.0/...
   [CRM][Media] URL completa de descarga: https://lookaside.fbsbx.com/...
   [CRM][Media] Descargando con axios (responseType: arraybuffer)...
   [CRM][Media] ✅ Descarga exitosa con axios: 45678 bytes
   [CRM][Media] Guardado en storage: /api/crm/attachments/...
   ```

4. **Abre el CRM en el navegador:**
   - Ve a: https://wsp.azaleia.com.pe
   - Login con tu usuario
   - Busca la conversación
   - **Verifica que la imagen aparezca correctamente**

---

## 🚨 Si Algo Falla

### Problema: "El servidor no inicia"

```bash
# Ver logs completos
pm2 logs bot-ai --lines 100

# Ver errores específicos
pm2 logs bot-ai --err

# Reintentar inicio
pm2 restart bot-ai
```

### Problema: "Las imágenes no se descargan"

```bash
# 1. Verifica que axios esté instalado
ls -la /opt/flow-builder/node_modules/axios

# Si no está, instálalo:
cd /opt/flow-builder
npm install axios
pm2 restart bot-ai

# 2. Verifica el token de WhatsApp
grep WHATSAPP_ACCESS_TOKEN /opt/flow-builder/.env

# Si está vacío, configúralo:
nano /opt/flow-builder/.env
# Agrega: WHATSAPP_ACCESS_TOKEN=tu_token_aqui

# 3. Reinicia
pm2 restart bot-ai

# 4. Envía una imagen NUEVA y revisa logs
pm2 logs bot-ai
```

### Problema: "Error 401 Unauthorized en el frontend"

Esto es **NORMAL** si el usuario no está logueado. Es parte del fix de seguridad.

**Solución:** Los usuarios deben hacer login en https://wsp.azaleia.com.pe

Una vez autenticados, todo funcionará normalmente.

### Problema: "Error 502 Bad Gateway en nginx"

Significa que el servidor Node.js no está escuchando en el puerto 3000.

```bash
# Verifica que el servidor esté corriendo
pm2 status

# Verifica que esté escuchando en puerto 3000
netstat -tlnp | grep :3000

# Si no está, reinicia
pm2 restart bot-ai

# Espera 5 segundos y vuelve a verificar
sleep 5
netstat -tlnp | grep :3000
```

---

## 📊 Comandos Útiles de PM2

```bash
# Ver estado de todos los procesos
pm2 status

# Ver logs en tiempo real
pm2 logs bot-ai

# Ver solo errores
pm2 logs bot-ai --err

# Ver últimas 100 líneas
pm2 logs bot-ai --lines 100

# Reiniciar aplicación
pm2 restart bot-ai

# Detener aplicación
pm2 stop bot-ai

# Iniciar aplicación
pm2 start bot-ai

# Ver información detallada
pm2 describe bot-ai

# Ver monitoreo en vivo
pm2 monit
```

---

## 📞 Soporte

Si después de seguir todos los pasos sigues teniendo problemas:

1. Captura los logs completos: `pm2 logs bot-ai --lines 200 > logs.txt`
2. Captura la configuración: `pm2 describe bot-ai > config.txt`
3. Reporta el problema con estos archivos

---

## 🎯 Checklist de Despliegue Exitoso

- [ ] Servidor corriendo en PM2 (`pm2 status`)
- [ ] Health check responde OK (`curl http://localhost:3000/health`)
- [ ] Endpoints CRM requieren auth (`curl http://localhost:3000/api/crm/media/test` → 401)
- [ ] Axios instalado (`ls node_modules/axios`)
- [ ] Token configurado (verificar .env o data/secrets/whatsapp.json)
- [ ] Imagen nueva descarga correctamente (ver logs)
- [ ] Imagen aparece en el CRM web

Si todos los items están ✅, el despliegue fue exitoso! 🎉
