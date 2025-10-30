# Sistema de Logging Estructurado

## Overview

Se ha implementado un sistema de logging estructurado usando **Winston** para:
- ✅ Registro centralizado de eventos
- ✅ Logs en múltiples formatos (JSON para análisis, texto para desarrollo)
- ✅ Rotación automática de archivos
- ✅ Niveles de log configurables
- ✅ Manejo de excepciones y promesas rechazadas
- ✅ Metadata estructurada para análisis

## Arquitectura

### Componentes

```
server/
├── utils/
│   ├── logger.ts           # Configuración centralizada de Winston
│   └── file-logger.ts      # Wrapper para compatibilidad retroactiva
└── logs/                   # Directorio de logs (auto-creado)
    ├── combined.log        # Todos los logs
    ├── error.log           # Solo errores
    ├── exceptions.log      # Excepciones no capturadas
    ├── rejections.log      # Promise rejections no manejadas
    └── application-*.log   # Logs rotativos (producción)
```

## Niveles de Log

Winston usa los siguientes niveles (de mayor a menor prioridad):

| Nivel | Prioridad | Uso | Color |
|-------|-----------|-----|-------|
| `error` | 0 | Errores que requieren atención inmediata | Rojo |
| `warn` | 1 | Advertencias que deberían revisarse | Amarillo |
| `info` | 2 | Información general de operaciones | Verde |
| `http` | 3 | Requests HTTP y respuestas | Magenta |
| `debug` | 4 | Información detallada para debugging | Azul |

### Nivel por Ambiente

- **Development**: `debug` (muestra todo)
- **Production**: `info` (oculta debug)

## Uso

### Importar el Logger

```typescript
// Opción 1: Usar helpers de file-logger (recomendado para compatibilidad)
import { logError, logInfo, logWarn, logDebug } from "./utils/file-logger";

// Opción 2: Usar Winston directamente
import logger from "./utils/logger";
```

### Logging Básico

```typescript
import { logInfo, logError, logWarn, logDebug } from "./utils/file-logger";

// Info
logInfo("Server started successfully");

// Warning
logWarn("Rate limit approaching threshold");

// Error
logError("Failed to connect to database", error);

// Debug
logDebug("Processing user request");
```

### Logging con Metadata

```typescript
// Agregar contexto estructurado
logInfo("User logged in", {
  userId: "123",
  username: "john_doe",
  ip: "192.168.1.1",
  timestamp: Date.now()
});

// Error con metadata
logError("Payment processing failed", error, {
  orderId: "ORD-123",
  amount: 99.99,
  currency: "USD"
});
```

### Logging HTTP Requests

```typescript
import { logRequest } from "./utils/logger";

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logRequest(req, res.statusCode, duration);
  });

  next();
});
```

### Usando Winston Directamente

```typescript
import logger from "./utils/logger";

// Diferentes niveles
logger.error("Critical error occurred", { error: err });
logger.warn("Warning message", { data: someData });
logger.info("Info message");
logger.http("HTTP request", { method: "GET", url: "/api/users" });
logger.debug("Debug details", { variable: value });
```

## Transports

### Console Transport

**Ambiente**: Todos
**Formato**: Colorizado para lectura humana
**Ejemplo**:
```
2025-10-30 14:32:15 [info] Server running on port 3000
```

### File Transport (combined.log)

**Archivo**: `logs/combined.log`
**Contenido**: Todos los logs
**Formato**: JSON estructurado
**Rotación**: Máximo 5 archivos de 5MB

**Ejemplo**:
```json
{
  "level": "info",
  "message": "User logged in",
  "timestamp": "2025-10-30T14:32:15.123Z",
  "service": "bot-ai-v1",
  "userId": "123",
  "username": "john_doe"
}
```

### File Transport (error.log)

**Archivo**: `logs/error.log`
**Contenido**: Solo errores (level: error)
**Formato**: JSON con stack traces
**Rotación**: Máximo 5 archivos de 5MB

### Daily Rotate Transport (producción)

**Archivo**: `logs/application-2025-10-30.log`
**Ambiente**: Solo producción
**Rotación**: Diaria
**Retención**: 14 días
**Compresión**: Archivos antiguos se comprimen (gzip)

## Manejo de Excepciones

### Excepciones No Capturadas

Winston captura automáticamente excepciones no manejadas:

```typescript
// Esto se registrará en logs/exceptions.log
throw new Error("Unhandled exception!");
```

**Archivo**: `logs/exceptions.log`

### Promise Rejections

Winston captura rechazos de promesas no manejados:

```typescript
// Esto se registrará en logs/rejections.log
Promise.reject(new Error("Unhandled rejection!"));
```

**Archivo**: `logs/rejections.log`

## Ejemplos Prácticos

### Logging en Endpoints

```typescript
router.post("/api/users", async (req, res) => {
  try {
    logDebug("Creating new user", { body: req.body });

    const user = await createUser(req.body);

    logInfo("User created successfully", {
      userId: user.id,
      username: user.username
    });

    res.json({ success: true, user });
  } catch (error) {
    logError("Failed to create user", error, {
      body: req.body,
      ip: req.ip
    });

    res.status(500).json({ error: "Failed to create user" });
  }
});
```

### Logging en Servicios

```typescript
class WhatsAppService {
  async sendMessage(phoneNumber: string, message: string) {
    logDebug("Sending WhatsApp message", {
      component: "WhatsAppService",
      phoneNumber,
      messageLength: message.length
    });

    try {
      const result = await this.api.send(phoneNumber, message);

      logInfo("WhatsApp message sent", {
        component: "WhatsAppService",
        phoneNumber,
        messageId: result.id
      });

      return result;
    } catch (error) {
      logError("Failed to send WhatsApp message", error, {
        component: "WhatsAppService",
        phoneNumber
      });

      throw error;
    }
  }
}
```

### Logging en Middleware

```typescript
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      logWarn("Authentication failed: No token provided", {
        component: "Auth",
        ip: req.ip,
        path: req.path
      });

      return res.status(401).json({ error: "No token provided" });
    }

    const user = await verifyToken(token);

    logDebug("User authenticated", {
      component: "Auth",
      userId: user.id,
      path: req.path
    });

    req.user = user;
    next();
  } catch (error) {
    logError("Authentication error", error, {
      component: "Auth",
      ip: req.ip
    });

    res.status(401).json({ error: "Invalid token" });
  }
};
```

## Configuración Avanzada

### Variables de Entorno

```bash
# Nivel de log (desarrollo: debug, producción: info)
NODE_ENV=production

# Directorio de logs personalizado
LOGS_DIR=/var/log/bot-ai
```

### Personalizar Transports

Editar `server/utils/logger.ts`:

```typescript
// Agregar transport personalizado
logger.add(new winston.transports.MongoDB({
  db: process.env.MONGODB_URI,
  collection: "logs",
  level: "error"
}));

// Transport para Slack
logger.add(new winston.transports.Slack({
  webhookUrl: process.env.SLACK_WEBHOOK,
  level: "error"
}));
```

### Filtrar Logs Sensibles

```typescript
// Sanitizar antes de loggear
const sanitize = (data: any) => {
  const clean = { ...data };
  delete clean.password;
  delete clean.token;
  delete clean.apiKey;
  return clean;
};

logInfo("User data", sanitize(userData));
```

## Análisis de Logs

### Buscar Errores

```bash
# Ver últimos 50 errores
tail -n 50 logs/error.log

# Buscar errores específicos
grep "Failed to save flow" logs/error.log

# Ver logs en tiempo real
tail -f logs/combined.log
```

### Analizar Logs JSON

```bash
# Contar logs por nivel
jq -r '.level' logs/combined.log | sort | uniq -c

# Filtrar por timestamp
jq 'select(.timestamp > "2025-10-30T00:00:00Z")' logs/combined.log

# Buscar logs de un componente
jq 'select(.component == "WhatsApp")' logs/combined.log

# Extraer solo mensajes de error
jq -r 'select(.level == "error") | .message' logs/error.log
```

### Herramientas de Análisis

Recomendaciones para análisis avanzado:

1. **ELK Stack**: Elasticsearch + Logstash + Kibana
2. **Grafana Loki**: Logging agregado y visualización
3. **Datadog**: Monitoreo y alertas
4. **Winston Cloud Logging**: Google Cloud, AWS CloudWatch

## Mejores Prácticas

### ✅ DO

1. **Usa niveles apropiados**
   ```typescript
   // ✅ BIEN
   logError("Database connection failed", error);
   logWarn("Cache miss, using fallback");
   logInfo("User session started");
   logDebug("Processing step 3/5");
   ```

2. **Incluye metadata relevante**
   ```typescript
   // ✅ BIEN
   logInfo("Payment processed", {
     orderId: order.id,
     amount: order.total,
     currency: "USD",
     userId: user.id
   });
   ```

3. **Loggea acciones importantes**
   ```typescript
   // ✅ BIEN
   logInfo("User logged in", { userId, ip });
   logInfo("Flow executed", { flowId, sessionId });
   logWarn("Rate limit exceeded", { userId, endpoint });
   ```

4. **Captura errores con contexto**
   ```typescript
   // ✅ BIEN
   logError("Failed to process webhook", error, {
     webhookId: webhook.id,
     payload: sanitize(webhook.payload)
   });
   ```

5. **Usa componentes para organizar**
   ```typescript
   // ✅ BIEN
   logInfo("Message sent", {
     component: "WhatsApp",
     messageId: msg.id
   });
   ```

### ❌ DON'T

1. **No loggees datos sensibles**
   ```typescript
   // ❌ MAL
   logInfo("User login", { password: user.password });

   // ✅ BIEN
   logInfo("User login", { userId: user.id });
   ```

2. **No uses console.log directamente**
   ```typescript
   // ❌ MAL
   console.log("User created:", user);

   // ✅ BIEN
   logInfo("User created", { userId: user.id });
   ```

3. **No loggees en loops sin control**
   ```typescript
   // ❌ MAL
   items.forEach(item => {
     logDebug("Processing item", item); // Miles de logs
   });

   // ✅ BIEN
   logDebug("Processing items batch", { count: items.length });
   items.forEach(item => processItem(item));
   logInfo("Items processed", { count: items.length });
   ```

4. **No expongas stack traces completos al cliente**
   ```typescript
   // ❌ MAL
   res.status(500).json({ error: error.stack });

   // ✅ BIEN
   logError("Request failed", error);
   res.status(500).json({ error: "Internal server error" });
   ```

5. **No uses logger síncrono en producción**
   ```typescript
   // ❌ MAL - Bloquea el event loop
   fs.appendFileSync("debug.log", message);

   // ✅ BIEN - Winston maneja esto async
   logger.info(message);
   ```

## Monitoreo

### Métricas Recomendadas

- Número de errores por minuto/hora
- Errores por endpoint
- Tiempo de respuesta promedio (HTTP logs)
- Tasa de excepciones no capturadas
- Uso de disco para logs

### Alertas Sugeridas

```typescript
// Ejemplo: Alertar si hay muchos errores
let errorCount = 0;

logger.on("data", (log) => {
  if (log.level === "error") {
    errorCount++;

    if (errorCount > 100) {
      sendAlert("High error rate detected!");
      errorCount = 0; // Reset
    }
  }
});
```

## Rotación y Limpieza

### Rotación Automática

En producción, los logs rotan automáticamente:

- **Diario**: Nuevo archivo cada día
- **Tamaño**: Máximo 20MB por archivo
- **Retención**: 14 días
- **Compresión**: Archivos antiguos se comprimen

### Limpieza Manual

```bash
# Eliminar logs de más de 30 días
find logs/ -name "*.log" -mtime +30 -delete

# Comprimir logs antiguos
gzip logs/application-2025-10-*.log

# Ver tamaño de logs
du -sh logs/
```

## Troubleshooting

### Logs no se generan

1. Verificar que el directorio `logs/` exista
2. Verificar permisos de escritura
3. Revisar `logs/exceptions.log` para errores de Winston

### Logs muy grandes

1. Reducir nivel de log en producción (info en vez de debug)
2. Ajustar rotación (retener menos días)
3. Filtrar logs innecesarios

### Performance degradado

1. Usar async logging (Winston lo hace por defecto)
2. Evitar logging en loops intensivos
3. Considerar logging sampling (1 de cada N)

## Migración desde console.log

### Antes
```typescript
console.log("[Auth] User logged in:", username);
console.error("[ERROR] Failed to save:", error);
console.warn("Rate limit approaching");
```

### Después
```typescript
logInfo("User logged in", { component: "Auth", username });
logError("Failed to save", error);
logWarn("Rate limit approaching");
```

## Soporte

Para reportar problemas o agregar nuevos transports:
1. Revisar `server/utils/logger.ts`
2. Consultar [Winston docs](https://github.com/winstonjs/winston)
3. Abrir issue en el repositorio

---

**Última actualización:** 2025-10-30
