# 🚀 Guía Completa: Poner WhatsApp en Producción

## Estado Actual ✅

### ✅ Completado
- Backend funcionando en puerto 3000
- Endpoints WhatsApp configurados y respondiendo
- CRM con WebSocket funcionando
- Credenciales de WhatsApp configuradas en .env
- Frontend compilado y listo

### ⚠️ Pendiente
- Configurar servidor web con HTTPS (Nginx/Apache/Caddy)
- Configurar webhook en Meta for Developers
- Probar flujo completo de mensajes

---

## Requisitos Previos

### 1. Credenciales de WhatsApp (Ya tienes ✅)
```env
WHATSAPP_ACCESS_TOKEN=EAAQ2uEgACPwBP5Bkg...
WHATSAPP_PHONE_NUMBER_ID=741220429081783
WHATSAPP_VERIFY_TOKEN=azaleia_meta_token_2025
WHATSAPP_API_VERSION=v20.0
```

### 2. Dominio con SSL/HTTPS
- Dominio: `wsp.azaleia.com.pe`
- **IMPORTANTE**: Meta for Developers SOLO acepta webhooks con HTTPS
- Necesitas certificado SSL válido (Let's Encrypt es gratis)

### 3. Servidor Web (Nginx recomendado)
- Puerto 80 (HTTP) → redirige a HTTPS
- Puerto 443 (HTTPS) → proxy a backend (puerto 3000)

---

## Paso 1: Configurar Nginx con SSL

### A. Instalar Nginx y Certbot (si no están instalados)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx -y

# Iniciar Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### B. Obtener Certificado SSL

```bash
# Importante: El dominio debe estar apuntando a tu servidor
sudo certbot --nginx -d wsp.azaleia.com.pe

# Sigue las instrucciones:
# 1. Ingresa tu email
# 2. Acepta términos de servicio
# 3. Elige: Sí (redirigir HTTP a HTTPS)
```

### C. Configurar Nginx

Crea el archivo de configuración:

```bash
sudo nano /etc/nginx/sites-available/wsp.azaleia.com.pe
```

Pega esta configuración:

```nginx
# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name wsp.azaleia.com.pe;
    return 301 https://$server_name$request_uri;
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    server_name wsp.azaleia.com.pe;

    # Certificados SSL (Certbot los genera automáticamente)
    ssl_certificate /etc/letsencrypt/live/wsp.azaleia.com.pe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wsp.azaleia.com.pe/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logs
    access_log /var/log/nginx/wsp.azaleia.access.log;
    error_log /var/log/nginx/wsp.azaleia.error.log;

    # Frontend (archivos estáticos)
    root /home/user/Bot-AI-V1/dist;
    index index.html;

    # Servir frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para API backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Proxy para WhatsApp webhook
    location /webhook/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # WebSocket para CRM
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Archivos adjuntos
    location /attachments/ {
        alias /home/user/Bot-AI-V1/data/attachments/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### D. Activar la configuración

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/wsp.azaleia.com.pe /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Si todo está OK, recargar Nginx
sudo systemctl reload nginx
```

---

## Paso 2: Configurar Backend como Servicio (PM2 o Systemd)

### Opción A: Usar PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar backend
cd /home/user/Bot-AI-V1
pm2 start npm --name "bot-ai-backend" -- run dev:server

# Guardar configuración
pm2 save

# Configurar inicio automático
pm2 startup
# Copia y ejecuta el comando que PM2 te muestra

# Verificar estado
pm2 status
pm2 logs bot-ai-backend
```

### Opción B: Usar Systemd

Crear archivo de servicio:

```bash
sudo nano /etc/systemd/system/bot-ai-backend.service
```

Contenido:

```ini
[Unit]
Description=Bot AI WhatsApp Backend
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/Bot-AI-V1
ExecStart=/usr/bin/npm run dev:server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl start bot-ai-backend
sudo systemctl enable bot-ai-backend
sudo systemctl status bot-ai-backend
```

---

## Paso 3: Configurar Webhook en Meta for Developers

### A. Acceder a Meta for Developers

1. Ve a: https://developers.facebook.com/
2. Login con tu cuenta de Facebook
3. Ve a "Mis Apps" o "My Apps"
4. Selecciona tu app de WhatsApp Business
   - Si no tienes una app, crea una nueva:
     - Click "Crear App" → "Business" → Siguiente
     - Nombre: "Azaleia WhatsApp CRM"
     - Email de contacto
     - "Crear app"

### B. Agregar el Producto WhatsApp

Si aún no lo has hecho:

1. En el panel de tu app, click "Agregar producto"
2. Busca "WhatsApp" y click "Configurar"
3. Selecciona tu Business Account

### C. Configurar el Webhook

1. En el panel izquierdo, click en **"WhatsApp" → "Configuración"**

2. En la sección **"Webhook"**, click en **"Configurar webhook"** o **"Editar"**

3. Ingresa los siguientes datos:

   **URL de callback:**
   ```
   https://wsp.azaleia.com.pe/webhook/whatsapp
   ```

   **Token de verificación:**
   ```
   azaleia_meta_token_2025
   ```

4. Click en **"Verificar y guardar"**

   - Meta enviará una petición GET a tu webhook
   - Tu backend responderá con el challenge
   - Si todo está bien, verás "✓ Verificado"

5. **Suscribirse a eventos**:

   En la misma página, en la sección "Campos de webhook", activa:

   - ☑️ **messages** (para recibir mensajes)
   - ☑️ **message_status** (para recibir estados: enviado, entregado, leído)

6. Click en **"Guardar"**

### D. Obtener Access Token (ya lo tienes, pero por si necesitas renovarlo)

1. En "WhatsApp" → "Configuración"
2. En la sección "Tokens de acceso"
3. Copia el token temporal (válido 24 horas) o genera uno permanente:
   - Ve a "Configuración del sistema" → "Tokens de acceso"
   - Genera un token permanente con permisos `whatsapp_business_messaging`

---

## Paso 4: Verificar que Todo Funciona

### A. Verificar Backend

```bash
# Health check
curl https://wsp.azaleia.com.pe/health
# Debe responder: {"status":"ok","timestamp":"..."}

# CRM health
curl https://wsp.azaleia.com.pe/api/crm/health
# Debe responder: {"ok":true,"ws":true,"clients":0}

# Webhook verification (simular lo que Meta hace)
curl "https://wsp.azaleia.com.pe/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=azaleia_meta_token_2025&hub.challenge=test123"
# Debe responder: test123
```

### B. Verificar Frontend

1. Abre el navegador: https://wsp.azaleia.com.pe
2. Debe cargar la aplicación sin errores
3. Click en la pestaña "🗂️ CRM"
4. Debe abrir la interfaz del CRM

### C. Probar Webhook desde Meta

En Meta for Developers:

1. Ve a "WhatsApp" → "Configuración de la API"
2. En "Enviar y recibir mensajes de muestra"
3. Agrega tu número de teléfono personal
4. Envía un mensaje de prueba desde tu WhatsApp al número de la Business Account

Verificar logs del backend:

```bash
# Si usas PM2
pm2 logs bot-ai-backend --lines 50

# Si usas systemd
sudo journalctl -u bot-ai-backend -f
```

Debes ver:

```
📩 Incoming WhatsApp message: {...}
✅ Message received from: +51999888777
🔄 Processing message in CRM module...
✅ Message saved to conversation: conv_...
```

### D. Verificar en el CRM

1. Abre https://wsp.azaleia.com.pe
2. Ve a la pestaña "🗂️ CRM"
3. Debe aparecer una nueva conversación con el mensaje recibido
4. Intenta responder desde el CRM
5. Verifica que el mensaje llegue a tu WhatsApp

---

## Paso 5: Enviar Mensajes desde el CRM

### Probar envío de mensajes:

1. En el CRM, selecciona una conversación
2. Escribe un mensaje en el composer
3. Click en "Enviar"

**Seguimiento del estado del mensaje:**

- ⏳ Spinner → Enviando
- ✓ Check gris → Enviado a WhatsApp
- ✓✓ Check gris → Entregado al destinatario
- ✓✓ Check azul → Leído por el destinatario

### Probar envío de archivos:

1. Click en el ícono 📎
2. Selecciona una imagen, video o documento
3. Click en "Enviar"
4. Verifica que se vea correctamente
5. Click en la imagen → Debe abrir modal fullscreen

---

## Scripts Útiles para Producción

### Script de Deploy Rápido

Crea un archivo `deploy-whatsapp.sh`:

```bash
#!/bin/bash

echo "🚀 Deploying WhatsApp Bot..."

# Pull latest changes
git pull origin claude/session-011CUZiX79n53oWk783SSjfA

# Install dependencies
npm install

# Build frontend
npm run build

# Restart backend
pm2 restart bot-ai-backend

# Check status
pm2 status

echo "✅ Deploy completed!"
echo "🔍 Check logs: pm2 logs bot-ai-backend"
```

Hacerlo ejecutable:

```bash
chmod +x deploy-whatsapp.sh
```

### Script de Monitoreo

Crea `monitor.sh`:

```bash
#!/bin/bash

echo "📊 Bot AI - Status Monitor"
echo "=========================="
echo ""

# Backend status
echo "🔧 Backend Status:"
pm2 status bot-ai-backend

echo ""
echo "📝 Recent Logs (last 20 lines):"
pm2 logs bot-ai-backend --lines 20 --nostream

echo ""
echo "🌐 Endpoints Check:"
curl -s https://wsp.azaleia.com.pe/health | jq '.'
curl -s https://wsp.azaleia.com.pe/api/crm/health | jq '.'

echo ""
echo "💾 Disk Usage:"
df -h /home/user/Bot-AI-V1

echo ""
echo "🗂️ Active Conversations:"
curl -s https://wsp.azaleia.com.pe/api/crm/conversations | jq 'length'
```

---

## Troubleshooting

### ❌ Error: "Webhook verification failed"

**Causa**: El WHATSAPP_VERIFY_TOKEN no coincide o el backend no está respondiendo

**Solución**:

```bash
# Verificar que el backend esté corriendo
pm2 status

# Probar localmente
curl "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=azaleia_meta_token_2025&hub.challenge=test"

# Debe responder: test

# Verificar logs
pm2 logs bot-ai-backend
```

### ❌ Error: "SSL certificate problem"

**Causa**: Certificado SSL no válido o expirado

**Solución**:

```bash
# Renovar certificado
sudo certbot renew

# Verificar validez
sudo certbot certificates
```

### ❌ No llegan mensajes al CRM

**Checklist**:

1. ✓ Backend está corriendo: `pm2 status`
2. ✓ Webhook verificado en Meta
3. ✓ Eventos suscritos: "messages" y "message_status"
4. ✓ Access Token válido (revisa fecha de expiración)
5. ✓ Logs del backend: `pm2 logs bot-ai-backend`

### ❌ No se pueden enviar mensajes

**Causa**: Access Token expiró o no tiene permisos

**Solución**:

1. Ve a Meta for Developers
2. Genera un nuevo Access Token permanente
3. Actualiza el .env:
   ```bash
   nano /home/user/Bot-AI-V1/.env
   # Actualiza WHATSAPP_ACCESS_TOKEN
   ```
4. Reinicia backend:
   ```bash
   pm2 restart bot-ai-backend
   ```

### ❌ Error 502 Bad Gateway

**Causa**: Backend no está corriendo o Nginx no puede conectarse

**Solución**:

```bash
# Verificar backend
pm2 status
pm2 restart bot-ai-backend

# Verificar configuración Nginx
sudo nginx -t

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/wsp.azaleia.error.log
```

---

## Checklist Final de Producción

### ✅ Antes de ir a producción:

- [ ] Backend corriendo como servicio (PM2 o systemd)
- [ ] Nginx configurado con SSL
- [ ] Dominio apunta al servidor (DNS)
- [ ] Certificado SSL válido (Let's Encrypt)
- [ ] Webhook verificado en Meta for Developers
- [ ] Eventos suscritos: messages + message_status
- [ ] Access Token permanente configurado
- [ ] Frontend compilado (`npm run build`)
- [ ] Archivos estáticos sirviendo desde /dist
- [ ] Logs configurados y rotando
- [ ] Backup automático de /data/

### ✅ Después de ir a producción:

- [ ] Probar enviar mensaje de WhatsApp → aparece en CRM
- [ ] Probar responder desde CRM → llega a WhatsApp
- [ ] Probar enviar imagen → se visualiza correctamente
- [ ] Verificar estados de mensajes (✓, ✓✓, ✓✓ azul)
- [ ] Probar filtros en CRM (Todas, No leídas, Archivadas)
- [ ] Configurar monitoreo (Uptime, alerts)
- [ ] Configurar backup automático diario

---

## Monitoreo Continuo

### Logs a revisar regularmente:

```bash
# Backend logs
pm2 logs bot-ai-backend --lines 100

# Nginx access logs
sudo tail -f /var/log/nginx/wsp.azaleia.access.log

# Nginx error logs
sudo tail -f /var/log/nginx/wsp.azaleia.error.log

# System logs
sudo journalctl -u bot-ai-backend -f
```

### Métricas importantes:

- Tiempo de respuesta del webhook (debe ser < 5 segundos)
- Mensajes recibidos por día
- Mensajes enviados por día
- Errores de API de WhatsApp
- Uso de disco (archivos adjuntos)

---

## Siguiente Paso: Integración con Bitrix24

Una vez que WhatsApp esté funcionando correctamente, podemos proceder con la integración de Bitrix24.

Para eso necesitarás:

1. Acceso a tu cuenta de Bitrix24
2. Crear un Webhook Incoming en Bitrix24
3. Configurar el BITRIX24_WEBHOOK_URL en el .env
4. Probar creación de contactos desde el CRM

---

## Contacto y Soporte

Si tienes problemas o necesitas ayuda:

1. Revisa los logs: `pm2 logs bot-ai-backend`
2. Verifica configuración de Nginx: `sudo nginx -t`
3. Revisa el estado del servicio: `pm2 status`

**Documentación adicional**:
- CRM_MEJORAS_COMPLETADAS.md
- NGINX_SETUP.md (si existe)
- .env (configuración de credenciales)

---

🎉 **¡Listo! Tu WhatsApp Bot está en producción**

Sigue esta guía paso a paso y tendrás tu CRM de WhatsApp funcionando completamente.
