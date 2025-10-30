# Environment Variables Configuration

## Overview

Este documento describe todas las variables de entorno necesarias para configurar y ejecutar Bot-AI-V1 de manera segura.

## Configuración Rápida

1. **Copiar el archivo de ejemplo**
   ```bash
   cp .env.example .env
   ```

2. **Editar el archivo .env** con tus valores
   ```bash
   nano .env  # o usa tu editor favorito
   ```

3. **Generar JWT Secret seguro**
   ```bash
   openssl rand -base64 32
   ```

4. **Iniciar la aplicación**
   ```bash
   npm run dev
   ```

## Variables de Entorno

### 🔧 Server Configuration

#### PORT
- **Descripción**: Puerto donde correrá el servidor
- **Tipo**: Number (1-65535)
- **Default**: `3000`
- **Requerido**: No
- **Ejemplo**: `PORT=3000`

#### NODE_ENV
- **Descripción**: Ambiente de ejecución
- **Tipo**: String (`development` | `production` | `test`)
- **Default**: `development`
- **Requerido**: No
- **Ejemplo**: `NODE_ENV=production`
- **Nota**: En producción se activan validaciones adicionales de seguridad

### 🔐 JWT Authentication

#### JWT_SECRET
- **Descripción**: Clave secreta para firmar tokens JWT
- **Tipo**: String (mínimo 32 caracteres)
- **Default**: ⚠️ Inseguro en producción
- **Requerido**: ✅ **SÍ en producción**
- **Ejemplo**: `JWT_SECRET=tu-clave-super-secreta-de-al-menos-32-caracteres`
- **Generación**:
  ```bash
  # Generar clave segura
  openssl rand -base64 32
  ```
- **⚠️ IMPORTANTE**: NUNCA uses el valor por defecto en producción
- **Seguridad**: La aplicación se negará a iniciar en producción si:
  - El secret no está configurado
  - Es el valor por defecto
  - Tiene menos de 32 caracteres

#### JWT_EXPIRES_IN
- **Descripción**: Tiempo de expiración de tokens JWT
- **Tipo**: String (formato: `1d`, `7d`, `24h`, `3600s`)
- **Default**: `7d`
- **Requerido**: No
- **Ejemplo**: `JWT_EXPIRES_IN=7d`

### 📱 WhatsApp Cloud API

#### WSP_BASE_URL
- **Descripción**: URL base de la API de WhatsApp
- **Tipo**: String (URL válida)
- **Default**: `https://graph.facebook.com`
- **Requerido**: No
- **Ejemplo**: `WSP_BASE_URL=https://graph.facebook.com`

#### WSP_API_VERSION
- **Descripción**: Versión de la API de WhatsApp
- **Tipo**: String
- **Default**: `v20.0`
- **Requerido**: No
- **Ejemplo**: `WSP_API_VERSION=v20.0`

#### WSP_PHONE_NUMBER_ID
- **Descripción**: ID del número de teléfono de WhatsApp Business
- **Tipo**: String
- **Default**: Ninguno
- **Requerido**: Sí (para funcionalidad WhatsApp)
- **Ejemplo**: `WSP_PHONE_NUMBER_ID=123456789012345`
- **Dónde obtener**: Meta Business Manager → WhatsApp → Números de teléfono

#### WSP_ACCESS_TOKEN
- **Descripción**: Token de acceso de WhatsApp Business API
- **Tipo**: String
- **Default**: Ninguno
- **Requerido**: Sí (para funcionalidad WhatsApp)
- **Ejemplo**: `WSP_ACCESS_TOKEN=EAABsC...`
- **Dónde obtener**: Meta Business Manager → System Users → Tokens
- **⚠️ SEGURIDAD**: Este token da acceso completo a tu WhatsApp Business

#### WSP_VERIFY_TOKEN
- **Descripción**: Token de verificación para webhooks de WhatsApp
- **Tipo**: String
- **Default**: Ninguno
- **Requerido**: Sí (para webhooks)
- **Ejemplo**: `WSP_VERIFY_TOKEN=mi-token-verificacion-seguro-123`
- **Nota**: Puedes usar cualquier string aleatorio seguro

#### Variables Legacy (Retrocompatibilidad)
También se soportan las siguientes variables por compatibilidad:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_API_VERSION`

**Nota**: Las variables `WSP_*` tienen prioridad sobre las `WHATSAPP_*`

### 🌊 Flow Configuration

#### DEFAULT_FLOW_ID
- **Descripción**: ID del flujo que se usará para nuevas conversaciones
- **Tipo**: String
- **Default**: `default-flow`
- **Requerido**: No
- **Ejemplo**: `DEFAULT_FLOW_ID=welcome-flow`

#### FLOW_STORAGE_TYPE
- **Descripción**: Tipo de almacenamiento para flujos
- **Tipo**: String (`local` | `database`)
- **Default**: `local`
- **Requerido**: No
- **Ejemplo**: `FLOW_STORAGE_TYPE=local`

#### FLOW_STORAGE_PATH
- **Descripción**: Ruta para almacenamiento local de flujos
- **Tipo**: String (path)
- **Default**: `./data/flows`
- **Requerido**: No (si FLOW_STORAGE_TYPE=local)
- **Ejemplo**: `FLOW_STORAGE_PATH=./data/flows`

### 💾 Session Configuration

#### SESSION_STORAGE_TYPE
- **Descripción**: Tipo de almacenamiento para sesiones
- **Tipo**: String (`memory` | `file` | `redis`)
- **Default**: `file`
- **Requerido**: No
- **Ejemplo**: `SESSION_STORAGE_TYPE=file`
- **Notas**:
  - `memory`: Rápido pero se pierde al reiniciar
  - `file`: Persistente en disco
  - `redis`: Requiere Redis configurado

#### SESSION_STORAGE_PATH
- **Descripción**: Ruta para almacenamiento de sesiones en archivo
- **Tipo**: String (path)
- **Default**: `./data/sessions`
- **Requerido**: No (si SESSION_STORAGE_TYPE=file)
- **Ejemplo**: `SESSION_STORAGE_PATH=./data/sessions`

### 🗄️ Database Configuration

#### DATABASE_URL
- **Descripción**: URL de conexión a la base de datos
- **Tipo**: String (PostgreSQL connection string)
- **Default**: Ninguno
- **Requerido**: Sí (si usando database storage)
- **Ejemplo**: `DATABASE_URL=postgresql://user:password@localhost:5432/bot_ai`

#### DATABASE_POOL_SIZE
- **Descripción**: Tamaño del pool de conexiones
- **Tipo**: Number
- **Default**: `10`
- **Requerido**: No
- **Ejemplo**: `DATABASE_POOL_SIZE=20`

### 📝 Logging Configuration

#### LOG_LEVEL
- **Descripción**: Nivel de logging
- **Tipo**: String (`error` | `warn` | `info` | `http` | `debug`)
- **Default**: `info`
- **Requerido**: No
- **Ejemplo**: `LOG_LEVEL=debug`
- **Recomendación**: `debug` en development, `info` en production

#### LOGS_DIR
- **Descripción**: Directorio personalizado para logs
- **Tipo**: String (path absoluto)
- **Default**: `./logs`
- **Requerido**: No
- **Ejemplo**: `LOGS_DIR=/var/log/bot-ai`

### 📁 Storage Directories

#### BACKEND_SECRETS_DIR
- **Descripción**: Directorio para archivos de secretos
- **Tipo**: String (path absoluto)
- **Default**: `./server/.secrets`
- **Requerido**: No
- **Ejemplo**: `BACKEND_SECRETS_DIR=/etc/bot-ai/secrets`
- **Permisos**: El directorio debe tener permisos restrictivos (700)

#### BACKEND_DATA_DIR
- **Descripción**: Directorio para datos de la aplicación
- **Tipo**: String (path absoluto)
- **Default**: `./server/.data`
- **Requerido**: No
- **Ejemplo**: `BACKEND_DATA_DIR=/var/lib/bot-ai/data`

### 🪝 Webhook Configuration

#### WEBHOOK_TIMEOUT_MS
- **Descripción**: Timeout para webhooks en milisegundos
- **Tipo**: Number
- **Default**: `10000` (10 segundos)
- **Requerido**: No
- **Ejemplo**: `WEBHOOK_TIMEOUT_MS=15000`

### 🔒 Security & CORS

#### CORS_ORIGIN
- **Descripción**: Orígenes permitidos para CORS
- **Tipo**: String (separado por comas)
- **Default**: `http://localhost:5173`
- **Requerido**: No
- **Ejemplo**: `CORS_ORIGIN=https://mi-dominio.com,https://app.mi-dominio.com`

#### TRUST_PROXY
- **Descripción**: Confiar en headers de proxy (nginx/load balancer)
- **Tipo**: Boolean (`0` | `1` | `true` | `false`)
- **Default**: `1`
- **Requerido**: **SÍ** si estás detrás de nginx/proxy
- **Ejemplo**: `TRUST_PROXY=1`
- **⚠️ CRÍTICO**: Debe ser `1` si usas nginx o load balancer para que rate limiting funcione correctamente

### 🔗 Bitrix24 Integration (Opcional)

#### BITRIX24_WEBHOOK_URL
- **Descripción**: URL del webhook de Bitrix24
- **Tipo**: String (URL)
- **Default**: Ninguno
- **Requerido**: No (opcional)
- **Ejemplo**: `BITRIX24_WEBHOOK_URL=https://mi-empresa.bitrix24.com/rest/1/abc123/`
- **Dónde obtener**: Bitrix24 → Configuración → Integraciones → Webhook entrante

#### BITRIX_CLIENT_ID
- **Descripción**: Client ID de la aplicación OAuth de Bitrix24
- **Tipo**: String
- **Default**: Ninguno
- **Requerido**: No (si usas OAuth)
- **Ejemplo**: `BITRIX_CLIENT_ID=local.abc123.xyz`

#### BITRIX_CLIENT_SECRET
- **Descripción**: Client Secret de la aplicación OAuth de Bitrix24
- **Tipo**: String
- **Default**: Ninguno
- **Requerido**: No (si usas OAuth)
- **Ejemplo**: `BITRIX_CLIENT_SECRET=abc123xyz789`

#### BITRIX_REDIRECT_URI
- **Descripción**: URI de redirección para OAuth de Bitrix24
- **Tipo**: String (URL)
- **Default**: `http://localhost:3000/api/bitrix/oauth/callback`
- **Requerido**: No
- **Ejemplo**: `BITRIX_REDIRECT_URI=https://mi-dominio.com/api/bitrix/oauth/callback`

### ⚡ Redis (Opcional)

#### REDIS_URL
- **Descripción**: URL de conexión a Redis
- **Tipo**: String (redis:// URL)
- **Default**: Ninguno
- **Requerido**: Sí (si SESSION_STORAGE_TYPE=redis)
- **Ejemplo**: `REDIS_URL=redis://localhost:6379`

#### REDIS_PASSWORD
- **Descripción**: Contraseña de Redis
- **Tipo**: String
- **Default**: Ninguno
- **Requerido**: No (si Redis requiere auth)
- **Ejemplo**: `REDIS_PASSWORD=tu-password-redis`

### 📧 Email (Opcional - Para futuras implementaciones)

#### SMTP_HOST
- **Ejemplo**: `SMTP_HOST=smtp.gmail.com`

#### SMTP_PORT
- **Ejemplo**: `SMTP_PORT=587`

#### SMTP_USER
- **Ejemplo**: `SMTP_USER=tu-email@gmail.com`

#### SMTP_PASSWORD
- **Ejemplo**: `SMTP_PASSWORD=tu-password-app`

#### SMTP_FROM
- **Ejemplo**: `SMTP_FROM=noreply@mi-dominio.com`

## Validación de Variables

La aplicación valida automáticamente las variables de entorno al iniciar:

### ✅ Variables Validadas

1. **Formato correcto** (URLs, números, enums)
2. **Valores requeridos** presentes (según ambiente)
3. **Longitud mínima** de secretos
4. **Rangos válidos** de números

### ❌ Errores Comunes

#### Error: JWT_SECRET requerido en producción
```
Environment validation failed:
  - JWT_SECRET must be at least 32 characters long in production
```

**Solución**:
```bash
# Generar secret seguro
openssl rand -base64 32

# Agregar a .env
JWT_SECRET=el-secret-generado-aqui
```

#### Error: PORT inválido
```
Environment validation failed:
  - PORT must be a number between 1 and 65535
```

**Solución**:
```bash
PORT=3000  # Usar número válido
```

#### Error: NODE_ENV inválido
```
Environment validation failed:
  - NODE_ENV must be one of: development, production, test
```

**Solución**:
```bash
NODE_ENV=production  # Usar valor válido
```

## Ambientes

### Development (.env.development)

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# JWT (OK usar valor simple en dev)
JWT_SECRET=dev-secret-not-for-production

# WhatsApp (opcional en dev)
WSP_PHONE_NUMBER_ID=
WSP_ACCESS_TOKEN=
WSP_VERIFY_TOKEN=

# Storage local
FLOW_STORAGE_TYPE=local
SESSION_STORAGE_TYPE=file
```

### Production (.env.production)

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# JWT - CRÍTICO: Cambiar obligatoriamente
JWT_SECRET=tu-secret-super-seguro-de-minimo-32-caracteres-generado-con-openssl

# WhatsApp - REQUERIDO
WSP_PHONE_NUMBER_ID=tu-phone-number-id
WSP_ACCESS_TOKEN=tu-access-token-real
WSP_VERIFY_TOKEN=tu-verify-token-seguro

# Seguridad
TRUST_PROXY=1

# Storage en producción
BACKEND_SECRETS_DIR=/etc/bot-ai/secrets
BACKEND_DATA_DIR=/var/lib/bot-ai/data
LOGS_DIR=/var/log/bot-ai

# Base de datos (si usas)
# DATABASE_URL=postgresql://user:pass@localhost:5432/botai

# CORS
CORS_ORIGIN=https://tu-dominio.com
```

## Seguridad

### ✅ Buenas Prácticas

1. **NUNCA comitear .env** al repositorio
   ```bash
   # Asegúrate que está en .gitignore
   echo ".env" >> .gitignore
   ```

2. **Usar secretos fuertes**
   ```bash
   # Generar JWT secret
   openssl rand -base64 32

   # Generar verify token
   openssl rand -hex 32
   ```

3. **Rotar secretos regularmente**
   - JWT_SECRET: Cada 6 meses o si se compromete
   - WhatsApp tokens: Según política de Meta
   - Bitrix tokens: Según expiren

4. **Permisos de archivos**
   ```bash
   # .env debe ser legible solo por el owner
   chmod 600 .env

   # Directorio de secrets
   chmod 700 server/.secrets
   ```

5. **Variables por ambiente**
   - Development: `.env.development`
   - Production: `.env.production`
   - Usar diferentes valores para cada ambiente

### ❌ Qué NO Hacer

1. ❌ No usar valores por defecto en producción
2. ❌ No compartir .env por email/slack
3. ❌ No comitear .env al repositorio
4. ❌ No reutilizar secretos entre proyectos
5. ❌ No loggear valores de secretos

## Deployment

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

# Las variables se pasan en runtime
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  bot-ai:
    build: .
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    volumes:
      - ./secrets:/etc/bot-ai/secrets:ro
      - ./data:/var/lib/bot-ai/data
      - ./logs:/var/log/bot-ai
```

### PM2

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'bot-ai',
    script: 'npm',
    args: 'run dev:server',
    env: {
      NODE_ENV: 'production',
      // Otras variables...
    },
    env_file: '.env.production'
  }]
};
```

### Systemd

```ini
# /etc/systemd/system/bot-ai.service
[Unit]
Description=Bot AI V1
After=network.target

[Service]
Type=simple
User=botai
WorkingDirectory=/opt/bot-ai
EnvironmentFile=/opt/bot-ai/.env.production
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Aplicación no inicia

1. **Revisar logs de validación**
   ```bash
   npm start 2>&1 | grep -A 20 "Environment validation"
   ```

2. **Verificar que existe .env**
   ```bash
   ls -la .env
   ```

3. **Verificar sintaxis de .env**
   ```bash
   # No debe haber espacios alrededor del =
   # ❌ MAL: PORT = 3000
   # ✅ BIEN: PORT=3000
   ```

### Variables no se cargan

1. **Verificar que dotenv se carga**
   ```typescript
   // Debe estar al inicio de server/index.ts
   import dotenv from "dotenv";
   dotenv.config();
   ```

2. **Verificar el path del .env**
   ```bash
   # .env debe estar en la raíz del proyecto
   ls -la .env
   ```

### WhatsApp no funciona

1. **Verificar credenciales**
   ```bash
   # Ver qué variables están configuradas (sin mostrar valores)
   printenv | grep WSP_
   ```

2. **Verificar en logs**
   ```bash
   tail -f logs/combined.log | grep WhatsApp
   ```

## Referencias

- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [12-Factor App Methodology](https://12factor.net/config)
- [OWASP Environment Variables](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Última actualización:** 2025-10-30
