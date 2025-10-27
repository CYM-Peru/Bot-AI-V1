# 🚀 Nuevas Funcionalidades - Bot AI V1

Esta guía documenta todas las nuevas funcionalidades agregadas al sistema.

---

## 📋 Tabla de Contenidos

1. [Nodos Condicionales](#1-nodos-condicionales)
2. [Integración con Bitrix24](#2-integración-con-bitrix24)
3. [Sistema de Simulación](#3-sistema-de-simulación)
4. [Validación de Flujos](#4-validación-de-flujos)
5. [Logs y Monitoreo](#5-logs-y-monitoreo)
6. [Sesiones Persistentes](#6-sesiones-persistentes)
7. [API Endpoints](#7-api-endpoints)

---

## 1. Nodos Condicionales

### ¿Qué son?

Los nodos condicionales permiten que el bot tome decisiones basadas en:
- Palabras clave en el mensaje del usuario
- Valores de variables guardadas
- Datos de Bitrix24 CRM
- Comparaciones numéricas y de texto

### Operadores Disponibles

```typescript
- equals           // Igual a
- not_equals       // Diferente de
- contains         // Contiene
- not_contains     // No contiene
- starts_with      // Empieza con
- ends_with        // Termina con
- matches_regex    // Coincide con regex
- greater_than     // Mayor que (números)
- less_than        // Menor que (números)
- is_empty         // Está vacío
- is_not_empty     // No está vacío
```

### Ejemplo: Palabras Clave

```json
{
  "id": "detectar_intencion",
  "label": "Detectar Intención",
  "type": "action",
  "action": {
    "kind": "condition",
    "data": {
      "matchMode": "any",
      "rules": [
        {
          "id": "rule_ayuda",
          "source": "keyword",
          "keywords": ["ayuda", "help", "soporte"],
          "caseSensitive": false,
          "targetId": "nodo_ayuda"
        },
        {
          "id": "rule_compra",
          "source": "keyword",
          "keywords": ["comprar", "precio", "vender"],
          "caseSensitive": false,
          "targetId": "nodo_ventas"
        }
      ],
      "defaultTargetId": "nodo_default"
    }
  }
}
```

### Ejemplo: Comparar Variables

```json
{
  "rules": [
    {
      "id": "rule_edad",
      "source": "variable",
      "sourceValue": "edad",
      "operator": "greater_than",
      "compareValue": "18",
      "targetId": "nodo_adulto"
    }
  ]
}
```

---

## 2. Integración con Bitrix24

### Configuración

1. Obtén tu Webhook URL de Bitrix24:
   - Ve a Bitrix24 → Configuración → Integraciones
   - Crea un "Incoming Webhook"
   - Copia la URL (ej: `https://tu-dominio.bitrix24.com/rest/1/abc123xyz/`)

2. Agrega la URL a tu `.env`:
   ```bash
   BITRIX24_WEBHOOK_URL=https://tu-dominio.bitrix24.com/rest/1/abc123xyz/
   ```

### Validar Datos de Bitrix24 en Condiciones

```json
{
  "id": "verificar_vip",
  "action": {
    "kind": "condition",
    "data": {
      "rules": [
        {
          "id": "rule_vip",
          "source": "bitrix_field",
          "sourceValue": "contact.UF_CRM_VIP",
          "operator": "equals",
          "compareValue": "1",
          "targetId": "nodo_vip"
        }
      ],
      "bitrixConfig": {
        "entityType": "contact",
        "identifierField": "PHONE",
        "fieldsToCheck": ["UF_CRM_VIP", "STATUS_ID"]
      }
    }
  }
}
```

### API de Bitrix24 Disponible

```typescript
// Cliente de Bitrix24
import { Bitrix24Client } from "./src/integrations/bitrix24";

const client = new Bitrix24Client({
  webhookUrl: "https://tu-dominio.bitrix24.com/rest/1/abc123xyz/"
});

// Buscar lead
const lead = await client.findLead({
  filter: { PHONE: "+51999999999" },
  select: ["ID", "TITLE", "STATUS_ID"]
});

// Crear lead
const leadId = await client.createLead({
  TITLE: "Nuevo Lead desde WhatsApp",
  PHONE: [{ VALUE: "+51999999999", VALUE_TYPE: "WORK" }],
  SOURCE_ID: "WEB"
});

// Actualizar lead
await client.updateLead(leadId, {
  STATUS_ID: "IN_PROCESS"
});
```

---

## 3. Sistema de Simulación

### ¿Para qué sirve?

El simulador te permite **probar tu flujo sin enviar mensajes reales a WhatsApp**. Ideal para:
- Verificar que el flujo funciona correctamente
- Probar condiciones y lógica
- Detectar errores antes de publicar

### Uso vía API

#### 1. Iniciar Simulación

```bash
curl -X POST http://localhost:3000/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"flowId": "mi-flow"}'
```

Respuesta:
```json
{
  "success": true,
  "state": {
    "sessionId": "sim_12345",
    "flowId": "mi-flow",
    "messages": [...],
    "currentNodeId": "start",
    "ended": false
  }
}
```

#### 2. Enviar Mensaje

```bash
curl -X POST http://localhost:3000/api/simulate/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sim_12345",
    "text": "Hola"
  }'
```

#### 3. Hacer Clic en Botón

```bash
curl -X POST http://localhost:3000/api/simulate/click \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sim_12345",
    "buttonId": "btn_1",
    "buttonText": "Opción 1"
  }'
```

#### 4. Reiniciar Simulación

```bash
curl -X POST http://localhost:3000/api/simulate/reset \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "sim_12345"}'
```

### Uso Programático

```typescript
import { ConversationSimulator } from "./src/runtime/simulator";

const simulator = new ConversationSimulator({ flowProvider });

// Iniciar
await simulator.start("mi-flow");

// Enviar mensajes
await simulator.sendText("Hola");
await simulator.sendText("Quiero información");

// Obtener mensajes
const messages = simulator.getMessages();

// Obtener variables
const variables = simulator.getVariables();
```

---

## 4. Validación de Flujos

### ¿Qué valida?

El sistema de validación verifica:
- ✓ Todos los nodos tienen configuración completa
- ✓ No hay nodos huérfanos (sin conexiones)
- ✓ No hay loops infinitos
- ✓ Webhooks tienen URLs válidas
- ✓ Botones no exceden límites de canal
- ✓ Mensajes no están vacíos
- ✓ Todas las conexiones apuntan a nodos existentes

### Uso vía API

```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d @mi-flow.json
```

Respuesta:
```json
{
  "valid": false,
  "errors": [
    {
      "level": "error",
      "nodeId": "node_1",
      "code": "EMPTY_MESSAGE",
      "message": "El mensaje 'Bienvenida' está vacío",
      "fix": "Escribe un mensaje para enviar"
    }
  ],
  "warnings": [
    {
      "level": "warning",
      "nodeId": "node_2",
      "code": "TOO_MANY_BUTTONS",
      "message": "El nodo 'Menu' tiene 5 botones, pero WhatsApp solo soporta 3",
      "fix": "Reduce el número de botones a 3 o menos"
    }
  ]
}
```

### Uso Programático

```typescript
import { validateFlow } from "./src/flow/validation";

const result = validateFlow(myFlow);

if (!result.valid) {
  console.log("Errores encontrados:");
  result.errors.forEach(error => {
    console.log(`- [${error.nodeId}] ${error.message}`);
    console.log(`  Fix: ${error.fix}`);
  });
}
```

---

## 5. Logs y Monitoreo

### Tipos de Logs

```typescript
- conversation_started  // Conversación iniciada
- conversation_ended    // Conversación finalizada
- message_received      // Mensaje recibido del usuario
- message_sent          // Mensaje enviado al usuario
- node_executed         // Nodo ejecutado
- webhook_called        // Webhook ejecutado
- webhook_error         // Error en webhook
- condition_evaluated   // Condición evaluada
- error                 // Error general
- system                // Mensaje del sistema
```

### Ver Logs

#### Por API:

```bash
# Todos los logs
curl http://localhost:3000/api/logs

# Filtrar por sesión
curl http://localhost:3000/api/logs?sessionId=whatsapp_51999999999

# Filtrar por tipo
curl http://localhost:3000/api/logs?type=error

# Últimos 100 logs
curl http://localhost:3000/api/logs?limit=100
```

#### Programáticamente:

```typescript
import { botLogger } from "./src/runtime/monitoring";

// Obtener logs
const logs = botLogger.getLogs({
  level: "error",
  sessionId: "whatsapp_51999999999",
  limit: 100
});

// Registrar eventos
botLogger.info("Usuario conectado", { userId: "123" });
botLogger.warn("Respuesta lenta", { duration: 5000 });
botLogger.error("Error procesando mensaje", new Error("Timeout"));
```

### Estadísticas

```bash
curl http://localhost:3000/api/stats
```

Respuesta:
```json
{
  "activeConversations": 5,
  "totalConversations": 125,
  "messagesPerMinute": 12,
  "averageResponseTime": 234,
  "errorRate": 0.02,
  "uptime": 3600
}
```

### Métricas de Conversaciones

```bash
# Todas las métricas
curl http://localhost:3000/api/metrics

# Métrica específica
curl http://localhost:3000/api/metrics?sessionId=whatsapp_51999999999
```

Respuesta:
```json
{
  "sessionId": "whatsapp_51999999999",
  "flowId": "mi-flow",
  "startedAt": "2025-10-27T10:30:00Z",
  "endedAt": "2025-10-27T10:35:00Z",
  "duration": 300000,
  "messagesReceived": 5,
  "messagesSent": 8,
  "nodesExecuted": 12,
  "webhooksCalled": 2,
  "errors": 0,
  "status": "ended"
}
```

---

## 6. Sesiones Persistentes

### Tipos de Almacenamiento

1. **Memory** (por defecto) - No persistente, se pierde al reiniciar
2. **File** - Guarda sesiones en archivos JSON
3. **Redis** - Alta disponibilidad, recomendado para producción

### Configuración

En `.env`:

```bash
# Opción 1: Archivos
SESSION_STORAGE_TYPE=file
SESSION_STORAGE_PATH=./data/sessions

# Opción 2: Redis (requiere Redis instalado)
SESSION_STORAGE_TYPE=redis
REDIS_URL=redis://localhost:6379
```

### Características

- ✓ Sesiones persisten entre reinicios del servidor
- ✓ Los usuarios pueden retomar conversaciones
- ✓ Historial de mensajes completo
- ✓ Variables guardadas
- ✓ Estado de navegación del flujo

### API de Sesiones

```bash
# Obtener sesión
curl http://localhost:3000/api/sessions/whatsapp_51999999999

# Eliminar sesión
curl -X DELETE http://localhost:3000/api/sessions/whatsapp_51999999999
```

---

## 7. API Endpoints

### Resumen de Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| **Flows** |
| POST | `/api/flows/:flowId` | Crear/actualizar flujo |
| GET | `/api/flows/:flowId` | Obtener flujo |
| GET | `/api/flows` | Listar todos los flujos |
| POST | `/api/validate` | Validar flujo |
| **Simulación** |
| POST | `/api/simulate/start` | Iniciar simulación |
| POST | `/api/simulate/message` | Enviar mensaje |
| POST | `/api/simulate/click` | Hacer clic en botón |
| POST | `/api/simulate/reset` | Reiniciar simulación |
| **Monitoreo** |
| GET | `/api/logs` | Obtener logs |
| GET | `/api/stats` | Obtener estadísticas |
| GET | `/api/metrics` | Obtener métricas |
| GET | `/api/conversations/active` | Conversaciones activas |
| **Sesiones** |
| GET | `/api/sessions/:sessionId` | Obtener sesión |
| DELETE | `/api/sessions/:sessionId` | Eliminar sesión |
| **Bitrix24** |
| POST | `/api/bitrix/search` | Buscar entidad |
| POST | `/api/bitrix/field` | Obtener campo |
| POST | `/api/bitrix/leads` | Crear lead |
| PUT | `/api/bitrix/leads/:leadId` | Actualizar lead |

---

## 🎯 Ejemplos de Uso

### Ejemplo 1: Bot con Detección de Palabras Clave

```json
{
  "nodes": {
    "start": {
      "action": {
        "kind": "condition",
        "data": {
          "rules": [
            {
              "source": "keyword",
              "keywords": ["hola", "buenos días", "hi"],
              "targetId": "saludo"
            },
            {
              "source": "keyword",
              "keywords": ["adiós", "chau", "bye"],
              "targetId": "despedida"
            }
          ],
          "defaultTargetId": "no_entendido"
        }
      }
    }
  }
}
```

### Ejemplo 2: Validar Edad

```json
{
  "nodes": {
    "check_edad": {
      "action": {
        "kind": "condition",
        "data": {
          "rules": [
            {
              "source": "variable",
              "sourceValue": "edad",
              "operator": "greater_than",
              "compareValue": "18",
              "targetId": "adulto"
            }
          ],
          "defaultTargetId": "menor"
        }
      }
    }
  }
}
```

### Ejemplo 3: Verificar Cliente VIP en Bitrix24

```json
{
  "nodes": {
    "check_vip": {
      "action": {
        "kind": "condition",
        "data": {
          "rules": [
            {
              "source": "bitrix_field",
              "sourceValue": "contact.UF_CRM_VIP",
              "operator": "equals",
              "compareValue": "1",
              "targetId": "vip_path"
            }
          ],
          "defaultTargetId": "normal_path",
          "bitrixConfig": {
            "entityType": "contact",
            "identifierField": "PHONE",
            "fieldsToCheck": ["UF_CRM_VIP"]
          }
        }
      }
    }
  }
}
```

---

## 🔧 Troubleshooting

### Error: "Bitrix24 API error"

**Causa**: La URL del webhook de Bitrix24 es incorrecta o no tiene permisos.

**Solución**:
1. Verifica que `BITRIX24_WEBHOOK_URL` en `.env` sea correcta
2. Asegúrate de que el webhook tenga permisos para CRM
3. Prueba la URL manualmente: `curl https://tu-dominio.bitrix24.com/rest/1/abc123xyz/crm.lead.list.json`

### Error: "Condition node missing configuration"

**Causa**: El nodo de condición no tiene reglas definidas.

**Solución**: Agrega al menos una regla al nodo de condición:
```json
{
  "action": {
    "kind": "condition",
    "data": {
      "rules": [{ /* tu regla aquí */ }]
    }
  }
}
```

### Logs no aparecen

**Solución**: Los logs se guardan en memoria. Para verlos:
```bash
curl http://localhost:3000/api/logs
```

---

## 📚 Recursos Adicionales

- [Bitrix24 REST API Docs](https://dev.1c-bitrix.ru/rest_help/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Deployment Guide](./DEPLOYMENT.md)

---

¡Listo! Con estas funcionalidades tu bot ahora es mucho más potente y flexible 🚀
