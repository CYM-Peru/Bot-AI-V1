# 🚨 DEPLOYMENT URGENTE - Resolver Errores 404

## ❌ Errores Actuales en wsp.azaleia.com.pe

```
404 - /api/conversations/active
404 - /api/crm/conversations  
404 - /api/crm/ws (WebSocket)
404 - /api/connections/whatsapp/check
```

## ✅ Solución: Deploy de la rama con todos los cambios

### Paso 1: Conectar al servidor

```bash
ssh root@srv1003117
cd /ruta/a/Bot-AI-V1
```

### Paso 2: Pull de los cambios

```bash
# Guardar cambios locales si hay
git stash

# Fetch la rama con todos los fixes
git fetch origin

# Checkout a la rama con todos los cambios
git checkout claude/session-011CUZiX79n53oWk783SSjfA

# Pull los últimos commits
git pull origin claude/session-011CUZiX79n53oWk783SSjfA
```

### Paso 3: Instalar nuevas dependencias

```bash
npm install
```

### Paso 4: Verificar .env

```bash
# Verificar que tengas el token correcto
cat .env | grep WHATSAPP

# Debería mostrar:
# WHATSAPP_ACCESS_TOKEN=EAAQ2uEgACPwBP1D...
# WHATSAPP_PHONE_NUMBER_ID=741220429081783
# WHATSAPP_VERIFY_TOKEN=azaleia_meta_token_2025
# WHATSAPP_API_VERSION=v23.0
```

### Paso 5: Build del frontend

```bash
npm run build
```

### Paso 6: Reiniciar el backend

**Opción A: Con PM2 (Recomendado)**
```bash
pm2 restart bot-ai
# O si no existe:
pm2 start npm --name "bot-ai" -- run dev:server
pm2 save
```

**Opción B: Sin PM2**
```bash
# Matar proceso actual
pkill -f "node.*server"

# Iniciar nuevo
nohup npm run dev:server > server.log 2>&1 &
```

### Paso 7: Verificar que funciona

```bash
# Test health
curl http://localhost:3000/health

# Test endpoints
curl http://localhost:3000/api/conversations/active
curl http://localhost:3000/api/connections/whatsapp/check
curl http://localhost:3000/api/crm/conversations
```

## 🔧 Si siguen los errores 404

### Verificar que Nginx esté configurado correctamente

```bash
# Editar configuración de Nginx
nano /etc/nginx/sites-available/wsp.azaleia.com.pe

# Debe tener:
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# WebSocket para CRM
location /api/crm/ws {
    proxy_pass http://localhost:3000/api/crm/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}

# Recargar Nginx
nginx -t
systemctl reload nginx
```

## 📋 Checklist de Verificación

- [ ] `git checkout claude/session-011CUZiX79n53oWk783SSjfA`
- [ ] `git pull` exitoso
- [ ] `npm install` completado
- [ ] `npm run build` exitoso
- [ ] Backend reiniciado (PM2 o nohup)
- [ ] `curl http://localhost:3000/health` responde
- [ ] Nginx configurado correctamente
- [ ] `nginx -t` pasa sin errores
- [ ] `systemctl reload nginx` ejecutado
- [ ] Abrir https://wsp.azaleia.com.pe en navegador
- [ ] F12 → Console → NO debe haber errores 404

## 🎯 Resultado Esperado

Después del deployment, al abrir F12 en wsp.azaleia.com.pe:

✅ NO debe haber errores 404
✅ WebSocket /api/crm/ws debe conectar
✅ Panel de Conexiones debe cargar sin errores
✅ Conversaciones activas deben cargar
