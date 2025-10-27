# Bot AI V1 - Deployment Guide

Esta guía te ayudará a desplegar tu bot de WhatsApp en producción.

## Tabla de Contenidos

1. [Configuración de WhatsApp Business API](#1-configuración-de-whatsapp-business-api)
2. [Instalación Local](#2-instalación-local)
3. [Configuración de Variables de Entorno](#3-configuración-de-variables-de-entorno)
4. [Ejecutar el Servidor](#4-ejecutar-el-servidor)
5. [Deployment con Docker](#5-deployment-con-docker)
6. [Configurar Webhook en Meta](#6-configurar-webhook-en-meta)
7. [Crear y Cargar Flows](#7-crear-y-cargar-flows)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Configuración de WhatsApp Business API

### Paso 1: Crear una App en Meta for Developers

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Haz clic en "My Apps" → "Create App"
3. Selecciona "Business" como tipo de app
4. Completa el formulario con:
   - App Name: `Bot AI WhatsApp`
   - App Contact Email: tu email
   - Business Portfolio: selecciona o crea uno

### Paso 2: Agregar WhatsApp Product

1. En tu app, ve a "Add Products"
2. Busca "WhatsApp" y haz clic en "Set Up"
3. Ve a "API Setup" en el menú izquierdo

### Paso 3: Obtener Credenciales

Necesitarás estos valores:

#### **Access Token** (Token de Acceso Temporal)
- En la sección "API Setup", copia el token temporal
- **⚠️ IMPORTANTE**: Este token expira en 24 horas
- Para producción, necesitas un [token permanente](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#1--acquire-an-access-token-using-a-system-user-or-facebook-login)

#### **Phone Number ID**
- En la sección "API Setup", verás "From: +1234567890"
- Haz clic en el menú desplegable
- Copia el "Phone number ID" (ejemplo: `123456789012345`)

#### **Verify Token** (Token de Verificación)
- Este lo creas tú mismo
- Puede ser cualquier string aleatorio
- Ejemplo: `mi_token_super_secreto_12345`
- Lo usarás para verificar el webhook

### Paso 4: Agregar un Número de Prueba

1. En "API Setup", verás una sección para agregar números de prueba
2. Haz clic en "Add phone number"
3. Ingresa tu número de WhatsApp (con código de país)
4. Verifica el código OTP que recibes

---

## 2. Instalación Local

```bash
# Clonar el repositorio (si aún no lo has hecho)
git clone <tu-repo>
cd Bot-AI-V1

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp .env.example .env
```

---

## 3. Configuración de Variables de Entorno

Edita el archivo `.env` con tus credenciales:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=mi_token_super_secreto_12345
WHATSAPP_API_VERSION=v20.0

# Default Flow Configuration
DEFAULT_FLOW_ID=default-flow

# Flow Storage
FLOW_STORAGE_TYPE=local
FLOW_STORAGE_PATH=./data/flows

# Session Storage
SESSION_STORAGE_TYPE=memory
```

---

## 4. Ejecutar el Servidor

### Modo Desarrollo (con hot-reload)

```bash
npm run dev:server
```

Verás algo como:

```
🚀 Server running on port 3000
📱 WhatsApp webhook: http://localhost:3000/webhook/whatsapp
🏥 Health check: http://localhost:3000/health

⚙️  Configuration:
   - Verify Token: ✓
   - Access Token: ✓
   - Phone Number ID: ✓
   - Default Flow ID: default-flow
```

### Modo Producción

```bash
# Build el servidor
npm run build:server

# Ejecutar en producción
npm run start:server
```

---

## 5. Deployment con Docker

### Opción A: Docker Compose (Recomendado)

```bash
# Crear archivo .env en la raíz del proyecto
cp .env.example .env

# Editar .env con tus credenciales

# Ejecutar con Docker Compose
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Opción B: Docker Manual

```bash
# Build la imagen
docker build -t bot-ai-whatsapp .

# Ejecutar el contenedor
docker run -d \
  -p 3000:3000 \
  -e WHATSAPP_ACCESS_TOKEN=tu_token \
  -e WHATSAPP_PHONE_NUMBER_ID=tu_phone_id \
  -e WHATSAPP_VERIFY_TOKEN=tu_verify_token \
  -v $(pwd)/data:/app/data \
  --name bot-ai \
  bot-ai-whatsapp
```

### Deployment en la Nube

#### Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init

# Agregar variables de entorno
railway variables set WHATSAPP_ACCESS_TOKEN=tu_token
railway variables set WHATSAPP_PHONE_NUMBER_ID=tu_phone_id
railway variables set WHATSAPP_VERIFY_TOKEN=tu_verify_token

# Deploy
railway up
```

#### Heroku

```bash
# Login a Heroku
heroku login

# Crear app
heroku create bot-ai-whatsapp

# Configurar variables
heroku config:set WHATSAPP_ACCESS_TOKEN=tu_token
heroku config:set WHATSAPP_PHONE_NUMBER_ID=tu_phone_id
heroku config:set WHATSAPP_VERIFY_TOKEN=tu_verify_token

# Deploy
git push heroku main
```

#### Render

1. Ve a [Render.com](https://render.com)
2. Conecta tu repositorio de GitHub
3. Crea un "Web Service"
4. Configura:
   - Build Command: `npm install && npm run build:server`
   - Start Command: `npm run start:server`
5. Agrega las variables de entorno en la sección "Environment"

---

## 6. Configurar Webhook en Meta

Una vez que tu servidor esté en línea con una URL pública (ej: `https://tu-servidor.com`):

### Paso 1: Configurar Webhook

1. Ve a tu app en [Meta for Developers](https://developers.facebook.com/)
2. Ve a WhatsApp → Configuration
3. En "Webhook", haz clic en "Edit"
4. Ingresa:
   - **Callback URL**: `https://tu-servidor.com/webhook/whatsapp`
   - **Verify Token**: El mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
5. Haz clic en "Verify and Save"

### Paso 2: Suscribirse a Eventos

En la misma sección "Webhook":

1. Haz clic en "Manage"
2. Suscríbete a estos campos:
   - ✅ `messages`
3. Haz clic en "Done"

### Paso 3: Verificar que Funciona

```bash
# En tu servidor, verás logs como:
[INFO] Webhook call received
[INFO] Processing message from +1234567890
[INFO] Sending text message
```

---

## 7. Crear y Cargar Flows

### Opción A: Usar el Builder Web (Frontend)

```bash
# Ejecutar el frontend
npm run dev

# Abre http://localhost:5173
# Crea tu flow visualmente
# El flow se guarda en localStorage
```

### Opción B: Crear Flow Manualmente

Crea un archivo `data/flows/default-flow.json`:

```json
{
  "version": 1,
  "id": "default-flow",
  "name": "Flujo de Bienvenida",
  "rootId": "start",
  "nodes": {
    "start": {
      "id": "start",
      "label": "Inicio",
      "type": "action",
      "action": {
        "kind": "message",
        "data": {
          "text": "¡Hola! Bienvenido a nuestro bot. ¿En qué puedo ayudarte?"
        }
      },
      "children": ["menu1"]
    },
    "menu1": {
      "id": "menu1",
      "label": "Menú Principal",
      "type": "menu",
      "description": "Selecciona una opción:",
      "menuOptions": [
        {
          "id": "opt1",
          "label": "Información",
          "value": "info",
          "targetId": "info"
        },
        {
          "id": "opt2",
          "label": "Soporte",
          "value": "soporte",
          "targetId": "support"
        },
        {
          "id": "opt3",
          "label": "Salir",
          "value": "salir",
          "targetId": "end"
        }
      ],
      "children": []
    },
    "info": {
      "id": "info",
      "label": "Información",
      "type": "action",
      "action": {
        "kind": "message",
        "data": {
          "text": "Aquí está la información que solicitaste..."
        }
      },
      "children": ["end"]
    },
    "support": {
      "id": "support",
      "label": "Soporte",
      "type": "action",
      "action": {
        "kind": "message",
        "data": {
          "text": "Te conectaremos con un agente..."
        }
      },
      "children": ["end"]
    },
    "end": {
      "id": "end",
      "label": "Fin",
      "type": "action",
      "action": {
        "kind": "end"
      },
      "children": []
    }
  }
}
```

### Opción C: Cargar Flow vía API

```bash
curl -X POST http://localhost:3000/api/flows/mi-flow \
  -H "Content-Type: application/json" \
  -d @data/flows/mi-flow.json
```

---

## 8. Troubleshooting

### Error: "Webhook verification failed"

**Causa**: El Verify Token no coincide

**Solución**:
1. Verifica que `WHATSAPP_VERIFY_TOKEN` en `.env` sea igual al token en Meta
2. Reinicia el servidor
3. Intenta verificar el webhook nuevamente

### Error: "Access token has expired"

**Causa**: El token temporal de Meta expiró (dura 24 horas)

**Solución**:
1. Ve a Meta for Developers → API Setup
2. Genera un nuevo token temporal
3. Actualiza `WHATSAPP_ACCESS_TOKEN` en `.env`
4. Reinicia el servidor
5. Para producción, crea un [token permanente](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#1--acquire-an-access-token-using-a-system-user-or-facebook-login)

### Error: "Flow not found"

**Causa**: El flow con ID `default-flow` no existe

**Solución**:
1. Crea el archivo `data/flows/default-flow.json`
2. O cambia `DEFAULT_FLOW_ID` en `.env` al ID de tu flow

### El bot no responde

**Checklist**:
1. ✅ ¿El servidor está corriendo? → `curl http://localhost:3000/health`
2. ✅ ¿El webhook está configurado? → Revisa Meta for Developers
3. ✅ ¿Estás enviando mensajes desde un número verificado? → Solo números agregados en API Setup pueden probar
4. ✅ ¿El flow existe? → `curl http://localhost:3000/api/flows/default-flow`
5. ✅ ¿Hay logs de error? → Revisa la consola del servidor

### Ver logs en tiempo real

```bash
# Local
npm run dev:server

# Docker
docker-compose logs -f

# Producción
tail -f logs/app.log
```

---

## Próximos Pasos

1. **Migrar a Base de Datos**: Reemplaza `LocalStorageFlowProvider` con `DatabaseFlowProvider`
2. **Sesiones Persistentes**: Reemplaza `InMemorySessionStore` con Redis o PostgreSQL
3. **Token Permanente**: Crea un System User en Meta Business Suite
4. **Monitoreo**: Agrega Sentry, DataDog, o similar
5. **Escalabilidad**: Considera usar AWS Lambda, Cloud Functions, o Kubernetes

---

## Recursos Útiles

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta Business Suite](https://business.facebook.com/)
- [Getting Started Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)

---

## Soporte

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica la configuración en Meta for Developers
3. Consulta la documentación oficial de WhatsApp
4. Abre un issue en el repositorio

¡Buena suerte con tu deployment! 🚀
