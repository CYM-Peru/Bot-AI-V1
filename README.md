# Flow Builder Multicanal — Bot AI V1

> Sistema completo de construcción de flujos conversacionales para WhatsApp con integración de Bitrix24 CRM, métricas en tiempo real y validaciones avanzadas.

---

## ⚠️ STACK TÉCNICO - LEER PRIMERO

**Base de datos:**
- ✅ **PostgreSQL** (`flowbuilder_crm`)
- ❌ **NO JSON** (archivos en `/data/*.json` son backups/legacy)

**Process Manager:**
- ✅ **systemd** (`systemctl restart flowbuilder`)
- ❌ **NO PM2** (`pm2 restart flowbuilder` no funciona)

**Comandos esenciales:**
```bash
# Reiniciar servicio
systemctl restart flowbuilder

# Ver logs
journalctl -u flowbuilder -f

# Acceder a PostgreSQL
PGPASSWORD=$POSTGRES_PASSWORD psql -U whatsapp_user -d flowbuilder_crm -h localhost
```

---

## 🚀 Características Principales

### 🎨 Editor Visual de Flujos
- **Canvas interactivo** con React Flow
- **Auto-fit** al cargar flujos (botón manual de centrado)
- **Menú contextual** con todas las acciones disponibles al crear conexiones
- **Paleta de colores pastel** para diferenciación visual de tipos de nodos
- **Panel de acciones vertical** organizado por categorías

### 📊 Monitoreo en Tiempo Real
- **Tab de Métricas** con auto-refresh (5 segundos)
  - Conversaciones activas
  - Total de conversaciones
  - Mensajes por minuto
  - Tiempo de respuesta promedio
  - Tasa de errores
  - Uptime del sistema
- **Historial de conversaciones** con duración y estado

### 🔗 Integración Bitrix24 CRM
- **Tab dedicado** para gestión de Bitrix24
- **Test de conexión** desde la UI
- **Búsqueda de contactos** por número de teléfono
- **ValidationNode** con búsqueda de campos en Bitrix24
- Soporte para leads, deals, contacts y companies

### 🧩 Tipos de Nodos Disponibles

#### Estructura
- **Start**: Nodo inicial del flujo (único por flujo)
- **Menu**: Menú con opciones numeradas

#### Mensajes
- **Message**: Mensaje de texto simple
- **Buttons**: Botones interactivos (max 3 para WhatsApp)
- **Question**: Captura de datos con validación
- **Ask**: Pregunta legacy (compatible con flujos antiguos)
- **Attachment**: Envío de archivos multimedia

#### Lógica
- **Validation**: Validación avanzada con keywords
  - Grupos de keywords (AND/OR)
  - Modos: contains o exact
  - Integración con campos de Bitrix24
  - Salidas: match, no_match, error
- **Condition**: Condiciones legacy (compatible con flujos antiguos)

#### Integraciones
- **Webhook OUT**: Llamada HTTP saliente
- **Webhook IN**: Recepción de webhook
- **Transfer**: Transferencia a agente humano
- **Scheduler**: Horarios de atención

#### Control
- **End**: Finalización del flujo

### ⏱️ Sistema de Delays
- **Delay configurable** por nodo (1-300 segundos)
- **Badge visual** ⏱️ en el canvas
- **Persistencia** en JSON
- Checkbox en Inspector para activar/desactivar

### 🎯 Backend Runtime

#### Características del Motor
- **RuntimeEngine** para ejecución de flujos
- **SessionStore** con persistencia en archivo o Redis
- **NodeExecutor** con soporte para todos los tipos de nodos
- **Simulator** para testing sin WhatsApp real
- **Logger y MetricsTracker** integrados

#### API Endpoints
```
POST /webhook/whatsapp          # Recibe mensajes de WhatsApp
GET  /api/stats                 # Estadísticas del bot
GET  /api/metrics               # Métricas detalladas
GET  /api/logs                  # Logs de eventos
POST /api/validate              # Valida un flujo
POST /api/simulate/start        # Inicia simulación
POST /api/simulate/message      # Envía mensaje en simulación
POST /api/bitrix/search         # Busca en Bitrix24
POST /api/bitrix/field          # Obtiene campo de Bitrix24
```

## 📦 Requisitos

- Node.js 18+
- npm 9+
- WhatsApp Business API (Cloud API v20.0)
- Bitrix24 webhook URL (opcional)

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

### Variables de Entorno

```env
# WhatsApp Cloud API (preferir WSP_*)
WSP_BASE_URL=https://graph.facebook.com
WSP_API_VERSION=v20.0
WSP_PHONE_NUMBER_ID=your_phone_number_id
WSP_ACCESS_TOKEN=your_access_token
WSP_VERIFY_TOKEN=your_verify_token
# Fallbacks legacy (opcional)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=

# Bitrix24
BITRIX24_WEBHOOK_URL=https://your-domain.bitrix24.com/rest/1/webhook_code/

# Session Storage
SESSION_STORAGE_TYPE=file  # o 'redis'
SESSION_STORAGE_PATH=./data/sessions

# Server
PORT=3000
NODE_ENV=production
```

## 🚀 Desarrollo

```bash
# Iniciar frontend (Vite dev server)
npm run dev

# Iniciar backend (Express server)
npm run dev:server

# En producción, ejecutar ambos:
npm run build
npm run start:server
```

Abrir http://localhost:5173 para el editor de flujos.

## 📦 Build de Producción

```bash
# Compilar TypeScript y bundle de Vite
npm run build

# Resultado:
# - Frontend: dist/ (HTML, CSS, JS)
# - Backend: dist/server/ (Node.js compilado)
```

## 🌐 CRM WS

La pasarela WebSocket del CRM se expone en `wss://<tu-dominio>/api/crm/ws` y funciona sobre el mismo servidor Express.

### Eventos soportados
- `welcome`: enviado por el servidor al conectar, incluye `clientId` y `serverTime`.
- `event`: notificaciones de negocio (`crm:msg:new`, `crm:msg:update`, `crm:conv:update`, `crm:typing`).
- `ack`: confirmaciones de lectura de eventos como `message` o `read`.
- `error`: respuesta cuando el payload no es válido.

### QA rápido — CRM + WebSocket + WSP

```bash
# Ejecuta todos los checks contra producción (usa BASE_URL opcional)
scripts/qa_wsp.sh

# Conectar por WebSocket manualmente
wscat -c wss://wsp.azaleia.com.pe/api/crm/ws
> {"type":"hello"}
< {"type":"welcome", ... }

# Enviar prueba WSP directa desde la UI del CRM (botón "Enviar" en el panel superior)
# o vía API
curl -fsS -X POST https://wsp.azaleia.com.pe/api/wsp/test \
  -H 'Content-Type: application/json' \
  -d '{"to":"51918131082","text":"Hola desde Builder"}'
```

El script reporta el estado de `/api/healthz`, `/api/wsp/test`, `/api/crm/health`, `/api/crm/conversations` y consulta `/api/connections/whatsapp/check` + `/api/connections/bitrix/check` para reflejar el estado que muestra el panel de Conexiones.

> ℹ️  La configuración de Nginx necesaria para el upgrade del WebSocket se documenta en `ops/nginx/crm-ws-snippet.conf`.

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Con coverage
npm run test:coverage
```

## 🎨 Paleta de Colores

El sistema utiliza una paleta pastel definida en CSS variables:

- `--pastel-mint`: #D6F5E5 (Start, Estructura)
- `--pastel-blue`: #DDEBFF (Integraciones)
- `--pastel-lilac`: #ECE3FF (Lógica, Validation)
- `--pastel-peach`: #FFE2D6 (Mensajes)
- `--pastel-yellow`: #FFF5CC (Question, Captura)
- `--pastel-teal`: #DFF7F5 (Alternativa)

## 📚 Documentación

- **[CHANGELOG.md](./CHANGELOG.md)**: Historial de cambios
- **[NEXT_STEPS.md](./NEXT_STEPS.md)**: Estado actual y próximos pasos
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Guía de despliegue
- **[NEW_FEATURES.md](./NEW_FEATURES.md)**: Documentación de características avanzadas

## 🏗️ Arquitectura

```
src/
├── App.tsx                    # Componente principal con editor
├── ReactFlowCanvas.tsx        # Canvas de flujos con React Flow
├── components/
│   ├── MetricsPanel.tsx       # Panel de métricas en tiempo real
│   ├── Bitrix24Panel.tsx      # Panel de integración Bitrix24
│   └── WhatsAppConfig.tsx     # Configuración de WhatsApp API
├── flow/
│   ├── types.ts               # Tipos TypeScript del flujo
│   ├── utils/flow.ts          # Utilidades para manejo de flujos
│   ├── components/nodes/      # Componentes visuales de nodos
│   │   ├── StartNode.tsx
│   │   ├── MessageNode.tsx
│   │   ├── QuestionNode.tsx
│   │   ├── ValidationNode.tsx
│   │   └── ...
│   └── adapters/
│       └── reactFlow.ts       # Adaptador para React Flow
├── runtime/
│   ├── engine.ts              # Motor de ejecución
│   ├── executor.ts            # Ejecutor de nodos
│   ├── simulator.ts           # Simulador de conversaciones
│   └── monitoring.ts          # Logger y métricas
├── integrations/
│   ├── whatsapp.ts            # Cliente de WhatsApp API
│   └── bitrix24.ts            # Cliente de Bitrix24 API
└── server/
    ├── index.ts               # Servidor Express
    ├── flow-provider.ts       # Proveedor de flujos
    ├── session-store.ts       # Almacenamiento de sesiones
    └── api-routes.ts          # Rutas de API REST
```

## 🔐 Seguridad

- Variables de entorno para credenciales sensibles
- Validación de webhook signatures de WhatsApp
- Rate limiting en endpoints públicos
- Sanitización de inputs de usuario
- No se almacenan tokens en el frontend

## 📊 Métricas y Monitoreo

El sistema incluye monitoreo completo:

- **BotLogger**: Registra todos los eventos
  - MESSAGE_RECEIVED, MESSAGE_SENT
  - NODE_EXECUTED, FLOW_COMPLETED
  - ERROR, VALIDATION_FAILED
  - SESSION_STARTED, SESSION_ENDED

- **MetricsTracker**: Calcula estadísticas en tiempo real
  - Conversaciones activas/totales
  - Mensajes por minuto
  - Tiempo de respuesta promedio
  - Tasa de errores
  - Uptime del sistema

## 🌐 Despliegue

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones detalladas de:
- Deploy en producción
- Configuración de WhatsApp Cloud API
- Setup de webhooks
- Configuración de Bitrix24
- Docker compose

## 🤝 Contribuir

1. Fork el proyecto
2. Crea un branch para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Notas Técnicas

- **React Flow v12** (@xyflow/react)
- **TypeScript 5.6** con strict mode
- **Vite 5.4** para build ultrarrápido
- **Tailwind CSS 3** para estilos
- **Express.js** para backend API
- **Vitest** para testing

## 📄 Licencia

Este proyecto es privado y confidencial.

---

**Última actualización**: 2025-11-16
**Versión**: 1.0.0
**Estado**: ✅ Listo para Producción

## 🔐 Conexiones reales (WhatsApp/Bitrix)

La sección **Conexiones** del panel permite configurar credenciales reales sin exponer secretos en el frontend:

- **WhatsApp Cloud API**
  - Guarda el *Phone Number ID*, número mostrado, *Access Token* y *Verify Token* mediante `POST /api/connections/whatsapp/save`.
  - Las credenciales se almacenan en `server/.secrets/whatsapp.json` (permisos `0600`).
  - El botón **Revisar estado** consulta Meta Graph (`GET /api/connections/whatsapp/check`) y solo muestra éxito si Meta responde `200`.
  - **Probar mensaje** envía un WhatsApp real con `POST /api/connections/whatsapp/test` reutilizando las credenciales guardadas.

- **Bitrix24**
  - `GET /api/bitrix/validate` usa los tokens guardados en `server/.secrets/bitrix-tokens.json` para llamar a `user.current` de Bitrix.
  - Si la sesión expira, la UI muestra el botón para obtener `GET /api/bitrix/oauth/url` y completar el flujo OAuth.

Además, el CRM expone métricas y conversaciones con rutas reales (`/api/crm/*`) y habilita el WebSocket seguro `wss:///api/crm/ws` protegido con `x-crm-key`.
