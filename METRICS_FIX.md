# Solución de Errores de Métricas - Bot AI

## 🚨 Problema Identificado

Tu servidor backend está en estado "errored" con 15+ reinicios. Los problemas principales son:

1. **PM2 ejecutándose desde directorio incorrecto** (`/root` en lugar del proyecto)
2. **Ruta del proyecto incorrecta** (`/var/www/bot-ai/` no existe)
3. **Proceso reiniciando constantemente**

## ✅ Solución Rápida

### En tu servidor, ejecuta estos comandos:

```bash
# 1. Encontrar el proyecto
find /home /var/www /opt /root -name "Bot-AI-V1" -type d 2>/dev/null

# 2. Ir al directorio del proyecto (ajusta la ruta según lo que encontraste)
cd /ruta/encontrada/Bot-AI-V1

# 3. Hacer pull de los últimos cambios
git pull origin claude/session-011CUZiX79n53oWk783SSjfA

# 4. Ejecutar el script de diagnóstico
chmod +x diagnose.sh
./diagnose.sh

# 5. Si todo se ve bien, ejecutar el despliegue
chmod +x deploy.sh
./deploy.sh
```

## 📋 Pasos Detallados

### Paso 1: Detener el proceso PM2 actual

```bash
pm2 stop bot-ai-backend
pm2 delete bot-ai-backend
```

### Paso 2: Ubicar y navegar al proyecto

```bash
# Buscar el proyecto
find /home /var/www /opt /root -name "Bot-AI-V1" -type d 2>/dev/null

# Cambiar al directorio (ejemplo)
cd /home/user/Bot-AI-V1
```

### Paso 3: Actualizar el código

```bash
# Hacer pull de los cambios más recientes
git pull

# Verificar que tienes los nuevos archivos
ls -la ecosystem.config.js deploy.sh diagnose.sh
```

### Paso 4: Ejecutar diagnóstico

```bash
./diagnose.sh
```

Este script verificará:
- ✅ Directorio correcto
- ✅ Node.js y npm instalados
- ✅ PM2 instalado
- ✅ Archivo .env configurado
- ✅ Directorios de datos
- ✅ Dependencias instaladas
- ✅ Puerto disponible
- ✅ Servidor funcionando

### Paso 5: Corregir problemas encontrados

Si el diagnóstico encuentra problemas:

```bash
# Crear .env si no existe
cp .env.example .env

# Editar .env con tus credenciales
nano .env

# Instalar dependencias
npm install

# Crear directorios
mkdir -p data/flows data/sessions logs
```

### Paso 6: Actualizar ecosystem.config.js

Editar el archivo con la ruta correcta:

```bash
nano ecosystem.config.js
```

Cambiar la línea `cwd` a la ruta absoluta de tu proyecto:

```javascript
cwd: '/home/user/Bot-AI-V1',  // O la ruta que encontraste
```

### Paso 7: Desplegar

```bash
./deploy.sh
```

### Paso 8: Verificar

```bash
# Ver estado de PM2
pm2 status

# Ver logs
pm2 logs bot-ai-backend --lines 50

# Probar servidor
curl http://localhost:3000/health

# Probar métricas
curl http://localhost:3000/api/stats
```

## 📊 Endpoints de Métricas Disponibles

Una vez que el servidor esté funcionando:

### Estadísticas Generales
```bash
curl http://localhost:3000/api/stats
```

Respuesta esperada:
```json
{
  "activeConversations": 0,
  "totalConversations": 0,
  "messagesPerMinute": 0,
  "averageResponseTime": 0,
  "errorRate": 0,
  "uptime": 123.45
}
```

### Métricas de Conversaciones
```bash
curl http://localhost:3000/api/metrics
```

### Conversaciones Activas
```bash
curl http://localhost:3000/api/conversations/active
```

### Logs del Sistema
```bash
# Últimos 50 logs
curl http://localhost:3000/api/logs?limit=50

# Solo errores
curl "http://localhost:3000/api/logs?level=error&limit=20"

# Por sesión
curl "http://localhost:3000/api/logs?sessionId=whatsapp_1234567890"
```

## 🐛 Problemas Comunes y Soluciones

### El servidor no inicia

```bash
# Ver logs de error
pm2 logs bot-ai-backend --err --lines 100

# Verificar que el puerto no esté ocupado
lsof -i :3000

# Intentar iniciar manualmente para ver errores
npm run dev:server
```

### PM2 no encuentra npm

```bash
# Ver dónde está npm
which npm

# Editar ecosystem.config.js y usar ruta completa
script: '/usr/bin/npm',  # Usar la ruta que devolvió 'which npm'
```

### Puerto 3000 ocupado

```bash
# Cambiar puerto en .env
PORT=3001

# O detener el proceso que usa 3000
lsof -i :3000
kill -9 <PID>
```

### Permisos denegados

```bash
# Dar permisos al usuario actual
sudo chown -R $USER:$USER /ruta/al/Bot-AI-V1

# Dar permisos a scripts
chmod +x deploy.sh diagnose.sh
```

### Métricas devuelven 404

Verificar que el servidor esté usando las rutas correctas:

```bash
# Ver logs del servidor al iniciar
pm2 logs bot-ai-backend | grep "Additional Endpoints"

# Deberías ver:
# - Stats: GET http://localhost:3000/api/stats
# - Metrics: GET http://localhost:3000/api/metrics
# - Active Conversations: GET http://localhost:3000/api/conversations/active
```

## 📝 Comandos Útiles PM2

```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs bot-ai-backend

# Ver monitoreo de recursos
pm2 monit

# Reiniciar
pm2 restart bot-ai-backend

# Detener
pm2 stop bot-ai-backend

# Eliminar
pm2 delete bot-ai-backend

# Información detallada
pm2 info bot-ai-backend

# Guardar configuración
pm2 save

# Listar procesos
pm2 list
```

## 🔄 Si Nada Funciona

Como último recurso:

```bash
# 1. Detener y eliminar todo de PM2
pm2 kill

# 2. Ir al directorio del proyecto
cd /ruta/al/Bot-AI-V1

# 3. Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install

# 4. Verificar .env
cat .env

# 5. Crear directorios
mkdir -p data/flows data/sessions logs

# 6. Iniciar con PM2 manualmente
pm2 start ecosystem.config.js --update-env

# 7. Ver logs inmediatamente
pm2 logs bot-ai-backend
```

## 📞 Obtener Más Ayuda

Si después de seguir todos estos pasos sigues teniendo problemas, comparte:

1. Salida de `./diagnose.sh`
2. Últimos 100 logs: `pm2 logs bot-ai-backend --lines 100`
3. Info del proceso: `pm2 info bot-ai-backend`
4. Contenido del .env (sin exponer tokens): `cat .env | grep -v TOKEN | grep -v SECRET`

## ✅ Checklist Final

Antes de dar por resuelto:

- [ ] `pm2 status` muestra bot-ai-backend como "online"
- [ ] No hay reinicios constantes (restarts: 0 o muy bajo)
- [ ] `curl http://localhost:3000/health` devuelve `{"status":"ok",...}`
- [ ] `curl http://localhost:3000/api/stats` devuelve datos JSON
- [ ] Los logs no muestran errores: `pm2 logs bot-ai-backend --lines 20`
- [ ] El `cwd` en PM2 apunta al directorio correcto: `pm2 info bot-ai-backend | grep cwd`

¡Listo! Tu backend de métricas debería estar funcionando correctamente.
