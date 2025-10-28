# ConfiguraciÛn de Nginx para MÈtricas - Bot AI

## =® Problema Actual

El frontend muestra el error:
```
Error al cargar mÈtricas
Failed to fetch stats
Aseg˙rate de que el servidor estÈ disponible en https://wsp.azaleia.com.pe
```

**Causa**: Nginx no est· haciendo proxy de las rutas `/api/*` al backend en el puerto 3000.

##  SoluciÛn Paso a Paso

### Paso 1: Verificar que el Backend EstÈ Corriendo

En tu servidor, ejecuta:

```bash
# Ir al directorio del proyecto
cd /home/user/Bot-AI-V1  # O la ruta donde estÈ tu proyecto

# Verificar estado de PM2
pm2 status

# Debe mostrar bot-ai-backend como "online"
# Si no, ejecuta:
./deploy.sh

# Verificar que el backend responde en localhost
curl http://localhost:3000/health
# Debe responder: {"status":"ok","timestamp":"..."}

curl http://localhost:3000/api/stats
# Debe responder con JSON de estadÌsticas
```

Si el backend NO responde, primero arrÈglalo siguiendo `METRICS_FIX.md`.

### Paso 2: Encontrar el Archivo de ConfiguraciÛn de Nginx

```bash
# Buscar el archivo de configuraciÛn para tu dominio
ls -la /etc/nginx/sites-enabled/ | grep -i wsp

# Probablemente sea uno de estos:
# - 020-b24-oauth.wsp.calzadosazaleia.com.pe.conf
# - O alguno que contenga "wsp.azaleia.com.pe"

# Ver el contenido del archivo
sudo cat /etc/nginx/sites-enabled/020-b24-oauth.wsp.calzadosazaleia.com.pe.conf
```

### Paso 3: Hacer Backup del Archivo

```bash
# Reemplaza con el nombre de tu archivo
sudo cp /etc/nginx/sites-enabled/020-b24-oauth.wsp.calzadosazaleia.com.pe.conf \
       /etc/nginx/sites-enabled/020-b24-oauth.wsp.calzadosazaleia.com.pe.conf.backup-$(date +%Y%m%d-%H%M%S)
```

### Paso 4: Editar la ConfiguraciÛn de Nginx

```bash
# Editar el archivo (reemplaza con tu archivo)
sudo nano /etc/nginx/sites-enabled/020-b24-oauth.wsp.calzadosazaleia.com.pe.conf
```

### Paso 5: Agregar la ConfiguraciÛn de Proxy

Busca el bloque `server { ... }` y **ANTES del ˙ltimo `}` del bloque server**, agrega estas lÌneas:

```nginx
    # ============================================
    # Bot AI Backend - API y Webhooks
    # ============================================

    # API endpoints - MÈtricas, logs, simulaciÛn, etc.
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Webhook endpoints - WhatsApp, Bitrix24, etc.
    location /webhook/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts para webhooks (m·s cortos)
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

**Ejemplo de dÛnde colocarlo:**

```nginx
server {
    listen 443 ssl;
    server_name wsp.azaleia.com.pe;

    # ... otras configuraciones SSL, logs, etc. ...

    location / {
        # ... configuraciÛn existente para el frontend ...
    }

    #  AGREGAR AQUÕ LAS NUEVAS CONFIGURACIONES 
    location /api/ {
        proxy_pass http://localhost:3000;
        # ... resto de la configuraciÛn ...
    }

    location /webhook/ {
        proxy_pass http://localhost:3000;
        # ... resto de la configuraciÛn ...
    }

    location /health {
        proxy_pass http://localhost:3000;
        # ... resto de la configuraciÛn ...
    }
    #  HASTA AQUÕ 

} # ê Este es el cierre del bloque server
```

### Paso 6: Guardar y Salir

En nano:
- Presiona `Ctrl + O` para guardar
- Presiona `Enter` para confirmar
- Presiona `Ctrl + X` para salir

### Paso 7: Verificar la ConfiguraciÛn

```bash
# Probar la sintaxis de Nginx
sudo nginx -t

# Debe mostrar:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Si hay errores, revisa que:
- Todos los `{` tengan su correspondiente `}`
- Los puntos y comas `;` estÈn al final de cada lÌnea
- No hayas eliminado ninguna configuraciÛn existente

### Paso 8: Recargar Nginx

```bash
# Recargar configuraciÛn de Nginx (sin interrumpir conexiones)
sudo systemctl reload nginx

# O reiniciar completamente si hay problemas
sudo systemctl restart nginx

# Verificar que Nginx estÈ corriendo
sudo systemctl status nginx
```

### Paso 9: Probar desde el Exterior

```bash
# Desde tu m·quina local o desde el servidor

# Probar health check
curl https://wsp.azaleia.com.pe/health

# Probar endpoint de stats
curl https://wsp.azaleia.com.pe/api/stats

# Probar endpoint de metrics
curl https://wsp.azaleia.com.pe/api/metrics

# Probar conversaciones activas
curl https://wsp.azaleia.com.pe/api/conversations/active
```

DeberÌan responder con JSON. Si obtienes errores 404 o 502:

- **404**: Nginx no est· redirigiendo correctamente
- **502 Bad Gateway**: El backend no est· corriendo o no responde

### Paso 10: Verificar en el Frontend

Abre tu navegador y ve a:
- `https://wsp.azaleia.com.pe`

Navega a la secciÛn de MÈtricas. Ahora deberÌa cargar correctamente.

## = SoluciÛn de Problemas

### Error 502 Bad Gateway

**Causa**: El backend no est· corriendo

**SoluciÛn**:
```bash
cd /home/user/Bot-AI-V1
pm2 status
pm2 logs bot-ai-backend

# Si no est· corriendo:
./deploy.sh
```

### Error 404 Not Found

**Causa**: Nginx no tiene la configuraciÛn de proxy

**SoluciÛn**: Vuelve al Paso 5 y verifica que agregaste las lÌneas correctamente

### CORS Errors en el navegador

**Causa**: Headers CORS no configurados

**SoluciÛn**: El backend ya tiene CORS configurado. Verifica que el backend estÈ corriendo:
```bash
curl -I http://localhost:3000/api/stats
# Debe incluir: Access-Control-Allow-Origin: *
```

### Nginx no recarga

```bash
# Ver logs de error de Nginx
sudo tail -100 /var/log/nginx/error.log

# Ver configuraciÛn actual
sudo nginx -T | grep -A 20 "server_name.*wsp"
```

### El backend no inicia

```bash
# Ver logs de error
pm2 logs bot-ai-backend --err --lines 50

# Verificar configuraciÛn
cd /home/user/Bot-AI-V1
./diagnose.sh
```

## =À Checklist de VerificaciÛn

Antes de dar por terminado:

- [ ] Backend corriendo: `pm2 status` muestra "online"
- [ ] Backend responde localmente: `curl http://localhost:3000/health` funciona
- [ ] Nginx configurado: archivo editado con las rutas /api/, /webhook/, /health
- [ ] Nginx sin errores: `sudo nginx -t` es exitoso
- [ ] Nginx recargado: `sudo systemctl reload nginx` ejecutado
- [ ] Endpoints externos funcionan: `curl https://wsp.azaleia.com.pe/api/stats` responde
- [ ] Frontend carga mÈtricas: No hay error "Failed to fetch stats"

## =› ConfiguraciÛn Completa de Nginx (Ejemplo)

Si necesitas un archivo de configuraciÛn completo de referencia:

```nginx
server {
    listen 443 ssl http2;
    server_name wsp.azaleia.com.pe;

    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Logs
    access_log /var/log/nginx/wsp-access.log;
    error_log /var/log/nginx/wsp-error.log;

    # Frontend (React/Vite build)
    root /path/to/frontend/dist;
    index index.html;

    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Webhooks
    location /webhook/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name wsp.azaleia.com.pe;
    return 301 https://$server_name$request_uri;
}
```

## <Ø Resumen R·pido

Si ya sabes lo que haces:

```bash
# 1. Verificar backend
cd /home/user/Bot-AI-V1 && pm2 status

# 2. Editar Nginx
sudo nano /etc/nginx/sites-enabled/tu-archivo.conf
# Agregar location /api/, /webhook/, /health con proxy_pass a localhost:3000

# 3. Recargar
sudo nginx -t && sudo systemctl reload nginx

# 4. Probar
curl https://wsp.azaleia.com.pe/api/stats
```

°Listo! =Ä
