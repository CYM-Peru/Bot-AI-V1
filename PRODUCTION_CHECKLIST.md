# Production Deployment Checklist

## Estado Actual: Casi Listo para Producción ✅

**Branch**: `claude/integrate-project-011CUXzfQm1VoYekL5VzfZNU`
**Build Status**: ✅ Sin errores TypeScript
**Bundle Size**: 503.63 kB (gzip: 150.89 kB)
**Server Status**: ✅ Corriendo en puerto 3000

---

## 1. CONFIGURACIÓN DE ENTORNO (.env)

### Estado Actual: ⚠️ PENDIENTE
- **Archivo .env NO existe** - Solo hay `.env.example`
- **Requerido**: Copiar y configurar antes de desplegar

### Acción Requerida:
```bash
cp .env.example .env
```

### Variables Críticas a Configurar:

#### WhatsApp Business API (OBLIGATORIO para funcionalidad completa):
```env
WHATSAPP_ACCESS_TOKEN=tu_token_real_aqui
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id_aqui
WHATSAPP_VERIFY_TOKEN=tu_token_verificacion_personalizado
WHATSAPP_API_VERSION=v20.0
```
**Obtener en**: https://business.facebook.com → Developer Portal → WhatsApp Business API

#### Bitrix24 (OPCIONAL pero recomendado):
```env
BITRIX24_WEBHOOK_URL=https://tu-dominio.bitrix24.com/rest/1/xxxxx/
```
**Obtener en**: Bitrix24 → Configuración → Integraciones → Webhook entrante

#### Configuración del Servidor:
```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://tu-dominio-frontend.com
```

---

## 2. INFRAESTRUCTURA

### 2.1 Hosting del Frontend
**Opciones Recomendadas**:

#### Opción A: Vercel (Recomendado) ⭐
```bash
npm install -g vercel
vercel --prod
```
- **Pros**: Deploy automático, HTTPS gratis, CDN global, zero config
- **Configuración**: Conectar repo GitHub → Auto-deploy en cada push
- **Precio**: Gratis para proyectos hobby

#### Opción B: Netlify
```bash
npm run build
# Subir carpeta dist/ a Netlify
```
- Similar a Vercel, también gratuito

#### Opción C: VPS Tradicional (Digital Ocean, AWS, etc.)
```bash
npm run build
# Servir dist/ con Nginx/Apache
```

### 2.2 Hosting del Backend
**CRÍTICO**: El servidor Express debe estar en un servidor Node.js 24/7

#### Opción A: Railway.app (Recomendado) ⭐
```bash
# Crear railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:server",
    "restartPolicyType": "ON_FAILURE"
  }
}
```
- **Pros**: $5/mes, fácil setup, escalable
- **Variables de entorno**: Configurar en Railway Dashboard

#### Opción B: Heroku
```bash
# Crear Procfile
web: npm run start:server
```

#### Opción C: VPS con PM2
```bash
npm install -g pm2
pm2 start npm --name "bot-ai-server" -- run start:server
pm2 startup
pm2 save
```

### 2.3 Almacenamiento de Datos
**Estado Actual**: Usando archivos locales (`./data/`)

**ADVERTENCIA**: En producción, los archivos locales pueden perderse al reiniciar el servidor en plataformas como Heroku.

**Opciones**:

#### Solución Inmediata (OK para MVP):
- Usar almacenamiento persistente del hosting (Railway tiene volumes)
- Configurar backups automáticos de `./data/`

#### Solución Escalable (Recomendado para producción real):
```env
# Agregar a .env
SESSION_STORAGE_TYPE=redis
REDIS_URL=redis://tu-redis-url:6379

# O migrar a base de datos
DATABASE_URL=postgresql://user:pass@host:5432/botai
```

**Providers de Redis**:
- Upstash (Redis gratis, perfecto para esto)
- Redis Cloud (gratis hasta 30MB)

---

## 3. SEGURIDAD

### 3.1 Variables de Entorno
✅ **Completado**: `.env` está en `.gitignore`
⚠️ **Acción**: Nunca commitear tokens reales

### 3.2 HTTPS/SSL
⚠️ **Requerido para producción**
- WhatsApp API **REQUIERE** HTTPS para webhooks
- Vercel/Netlify proveen HTTPS automáticamente
- Para VPS: Usar Let's Encrypt + Certbot

### 3.3 CORS
⚠️ **Actualizar CORS_ORIGIN** en producción:
```env
CORS_ORIGIN=https://tu-dominio-real.com
```

**Archivo**: `server/index.ts:21`
```typescript
app.use(cors({ origin: process.env.CORS_ORIGIN }));
```

### 3.4 Rate Limiting
⚠️ **NO IMPLEMENTADO** - Recomendado agregar:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
});

app.use('/webhook', limiter);
```

### 3.5 Validación de Webhooks
✅ **Implementado**: Verificación de token en WhatsApp webhook
✅ **Implementado**: Validación de firma de Meta (pendiente activar)

---

## 4. MONITOREO Y LOGS

### 4.1 Logs Actuales
✅ **Implementado**: Sistema de logging con `botLogger`
- Logs de conversaciones
- Métricas de rendimiento
- Errores capturados

**Ubicación actual**: Logs en consola + archivos locales

### 4.2 Monitoreo en Producción (RECOMENDADO)
Opciones:

#### Opción A: Sentry (Gratis hasta 5k eventos/mes)
```bash
npm install @sentry/node
```

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### Opción B: LogTail / Better Stack
- Logs centralizados
- Búsqueda en tiempo real
- Alertas configurables

#### Opción C: Herramientas nativas del hosting
- Railway: Logs integrados
- Vercel: Analytics + Logs
- Heroku: Papertrail addon

---

## 5. CONFIGURACIÓN DE WHATSAPP WEBHOOK

### Paso 1: Desplegar Backend
1. Subir servidor a producción con URL pública HTTPS
2. Verificar que `/health` responde:
   ```bash
   curl https://tu-backend.com/health
   ```

### Paso 2: Configurar en Meta Developer Portal
1. Ir a https://developers.facebook.com
2. Seleccionar tu app de WhatsApp Business
3. Ir a "WhatsApp" → "Configuration"
4. Configurar Webhook:
   - **Callback URL**: `https://tu-backend.com/webhook/whatsapp`
   - **Verify Token**: El mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
5. Suscribir a eventos:
   - ✅ `messages`
   - ✅ `message_status` (opcional)

### Paso 3: Probar
```bash
# Enviar mensaje de prueba al número de WhatsApp Business
# Revisar logs del servidor:
curl https://tu-backend.com/api/logs | jq
```

---

## 6. RENDIMIENTO

### Bundle Size Actual
- **Total**: 503.63 kB (gzip: 150.89 kB)
- ⚠️ **Warning**: Chunk mayor a 500 kB

### Optimizaciones Recomendadas (Opcional):
```typescript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-flow': ['@xyflow/react'],
          'vendor': ['react', 'react-dom'],
        }
      }
    }
  }
}
```

**Impacto**: Bundle más pequeño, mejor carga inicial
**Prioridad**: Baja (funciona bien actualmente)

---

## 7. TESTING ANTES DE LANZAR

### Checklist de Pruebas Manuales:

#### Frontend:
- [ ] Crear nuevo flujo
- [ ] Agregar todos los tipos de nodos (Message, Question, Validation, etc.)
- [ ] Probar Undo/Redo (Ctrl+Z, Ctrl+Y)
- [ ] Probar Copy/Paste (Ctrl+C, Ctrl+V)
- [ ] Probar búsqueda de nodos (Ctrl+F)
- [ ] Cargar cada uno de los 5 templates
- [ ] Exportar flujo como PNG
- [ ] Verificar que el timer badge se ve bien
- [ ] Probar delay en nodos (1-300 segundos)
- [ ] Verificar validación de nodos (mensajes sin texto)
- [ ] Guardar y cargar flujo desde JSON
- [ ] Probar en diferentes navegadores (Chrome, Firefox, Safari)

#### Backend (con servidor corriendo):
```bash
# Health check
curl http://localhost:3000/health

# Stats
curl http://localhost:3000/api/stats

# Metrics
curl http://localhost:3000/api/metrics

# Active conversations
curl http://localhost:3000/api/conversations/active

# Simulate conversation
curl -X POST http://localhost:3000/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"flowId":"default-flow","contactId":"51918131082"}'

curl -X POST http://localhost:3000/api/simulate/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test_51918131082","message":"Hola"}'
```

#### Integración Bitrix24:
- [ ] Configurar `BITRIX24_WEBHOOK_URL` en .env
- [ ] Probar desde UI: Tab "Bitrix24" → "Probar Conexión"
- [ ] Buscar contacto real en Bitrix24
- [ ] Crear nodo de Validación con lookup de Bitrix24
- [ ] Verificar que los handles match/no_match/error funcionan

#### WhatsApp (Requiere configuración previa):
- [ ] Enviar mensaje de texto al bot
- [ ] Probar menú con botones
- [ ] Probar pregunta con validación
- [ ] Verificar que el delay funciona
- [ ] Probar flujo completo de principio a fin

---

## 8. DOCUMENTACIÓN PARA EL EQUIPO

### Archivos de Documentación:
✅ `README.md` - Instrucciones de instalación y desarrollo
✅ `CHANGELOG.md` - Historial de cambios
✅ `NEXT_STEPS.md` - Features completados y pendientes
✅ `PRODUCTION_CHECKLIST.md` - Este archivo

### Faltantes Recomendados:
- [ ] `DEPLOYMENT.md` - Guía paso a paso de despliegue
- [ ] `API_DOCS.md` - Documentación de endpoints del servidor
- [ ] `FLOW_STRUCTURE.md` - Explicación del formato JSON de flujos
- [ ] `TROUBLESHOOTING.md` - Problemas comunes y soluciones

---

## 9. COSTOS ESTIMADOS (Mensual)

### Opción Económica (Perfecto para MVP):
- **Frontend**: Vercel Free ($0)
- **Backend**: Railway Hobby ($5)
- **Redis**: Upstash Free ($0)
- **Monitoreo**: Sentry Free ($0)
- **Total**: **$5/mes**

### Opción Escalable (Para producción con tráfico):
- **Frontend**: Vercel Pro ($20)
- **Backend**: Railway Pro ($20-50 según uso)
- **Redis**: Redis Cloud Essentials ($10)
- **Base de Datos**: PostgreSQL Managed ($15)
- **Monitoreo**: Sentry Team ($29)
- **Total**: **$94-124/mes**

### Costos de WhatsApp Business API:
- **Meta**: Primeros 1,000 mensajes/mes GRATIS
- **Después**: $0.005-0.04 por mensaje según país
- **Estimado para Perú**: ~$0.01 por mensaje

---

## 10. PASOS INMEDIATOS PARA PRODUCCIÓN

### 🔴 CRÍTICO (Hacer antes de lanzar):
1. **Crear archivo .env con tokens reales**
   ```bash
   cp .env.example .env
   # Editar .env con valores reales
   ```

2. **Configurar WhatsApp Business API**
   - Crear app en Meta Developer Portal
   - Obtener tokens y Phone Number ID
   - Configurar número de teléfono de prueba

3. **Desplegar Backend a HTTPS**
   - Railway: Conectar repo → Auto-deploy
   - Configurar variables de entorno en Railway

4. **Configurar Webhook en Meta**
   - URL: `https://tu-backend.railway.app/webhook/whatsapp`
   - Verify Token: mismo que en .env

5. **Desplegar Frontend**
   - Vercel: Conectar repo → Auto-deploy
   - Configurar variable `VITE_API_URL` apuntando al backend

### 🟡 IMPORTANTE (Hacer en primera semana):
6. **Configurar Bitrix24 (si aplica)**
7. **Agregar rate limiting al servidor**
8. **Configurar Sentry para monitoreo de errores**
9. **Setup de backups automáticos de ./data/**
10. **Testing exhaustivo con usuarios reales**

### 🟢 RECOMENDADO (Próximas 2 semanas):
11. **Migrar sesiones a Redis**
12. **Agregar base de datos PostgreSQL**
13. **Implementar autenticación para el editor**
14. **Agregar roles y permisos**
15. **Crear documentación de usuario final**

---

## 11. CONTACTOS Y RECURSOS

### Documentación Oficial:
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp
- **Bitrix24 REST API**: https://training.bitrix24.com/rest_help/
- **React Flow**: https://reactflow.dev/
- **Vite**: https://vitejs.dev/

### Números de Prueba:
- **Test Number**: 51918131082 (mencionado en código)

### Endpoints del Backend:
```
GET  /health                           - Health check
GET  /api/stats                        - Estadísticas
GET  /api/metrics                      - Métricas detalladas
GET  /api/logs                         - Logs del sistema
GET  /api/conversations/active         - Conversaciones activas
POST /api/validate                     - Validar flujo
POST /api/simulate/start               - Simular inicio de conversación
POST /api/simulate/message             - Simular mensaje
POST /webhook/whatsapp                 - Webhook de WhatsApp
GET  /webhook/whatsapp?hub.* ...       - Verificación de webhook
```

---

## 12. CHECKLIST FINAL

### Pre-Launch:
- [ ] .env configurado con tokens reales
- [ ] Backend desplegado en HTTPS
- [ ] Frontend desplegado
- [ ] Webhook de WhatsApp configurado y verificado
- [ ] Bitrix24 conectado (si aplica)
- [ ] Rate limiting implementado
- [ ] Monitoreo de errores activo (Sentry)
- [ ] Testing completo realizado
- [ ] Backups configurados
- [ ] Documentación actualizada

### Post-Launch (Primera Semana):
- [ ] Monitorear logs diariamente
- [ ] Verificar métricas de rendimiento
- [ ] Recolectar feedback de usuarios
- [ ] Ajustar flows según uso real
- [ ] Optimizar tiempos de respuesta si es necesario

---

## Estado de Features

### ✅ Completado y Listo:
- Sistema de Canvas con React Flow
- Todos los tipos de nodos (Start, Message, Question, Validation, etc.)
- Sistema de Tabs (Canvas, Métricas, Bitrix24)
- Undo/Redo (Ctrl+Z, Ctrl+Y)
- Copy/Paste (Ctrl+C, Ctrl+V)
- Búsqueda de nodos (Ctrl+F)
- 5 Templates predefinidos
- Export to PNG
- Sistema de Delay/Timer por nodo
- Validación con keywords (AND/OR, contains/exact)
- Integración Bitrix24
- Panel de métricas con auto-refresh
- Backend Express completo
- Sistema de sesiones
- Runtime Engine
- Monitoreo y logging

### 🎯 Próximas Mejoras (Nice to Have):
- Dark Mode
- Multi-idioma
- Autenticación y roles
- Historial de versiones de flujos
- A/B Testing de flujos
- Analytics avanzados

---

**Última actualización**: 2025-10-28
**Autor**: Claude Code
**Branch**: claude/integrate-project-011CUXzfQm1VoYekL5VzfZNU
