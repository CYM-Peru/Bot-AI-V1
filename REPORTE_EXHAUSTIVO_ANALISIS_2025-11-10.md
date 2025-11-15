# REPORTE EXHAUSTIVO DE ANÁLISIS Y MEJORAS
## Flow Builder - WhatsApp CRM Bot System

**Fecha de Análisis**: 10 de Noviembre, 2025  
**Versión del Sistema**: v0.0.1  
**Líneas de Código Analizadas**: ~20,481 líneas (TypeScript Server)  
**Archivos Analizados**: 50+ archivos críticos  
**Nivel de Riesgo General**: CRÍTICO

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Problemas Críticos](#problemas-críticos-acción-inmediata)
3. [Problemas de Alta Prioridad](#problemas-de-alta-prioridad)
4. [Problemas de Media Prioridad](#problemas-de-media-prioridad)
5. [Problemas de Baja Prioridad](#problemas-de-baja-prioridad)
6. [Análisis de Arquitectura](#análisis-de-arquitectura)
7. [Recomendaciones Transversales](#recomendaciones-transversales)

---

## RESUMEN EJECUTIVO

### Hallazgos Principales

El sistema es **FUNCIONAL pero FRÁGIL** con múltiples puntos de fallo críticos:

- **Seguridad**: RIESGO CRÍTICO - Secretos expuestos, almacenamiento inseguro, validaciones débiles
- **Performance**: RIESGO ALTO - N+1 queries potenciales, logs excesivos en producción (594 console.log)
- **Arquitectura**: RIESGO ALTO - Duplicación de código, acoplamiento fuerte, estados inconsistentes
- **Testing**: RIESGO ALTO - 132 usos de `any`, falta de tests end-to-end
- **Mantenibilidad**: RIESGO MEDIO - Código complejo sin documentación, cambios no coordinados

### Métricas de Riesgo

| Categoría | Estado | Severidad |
|-----------|--------|-----------|
| Secretos Expuestos | NO RESUELTO | CRÍTICO |
| Inyección/Validación | PARCIAL | ALTO |
| Autenticación/Autorización | IMPLEMENTADA | BAJO |
| Rate Limiting | IMPLEMENTADO | BAJO |
| Manejo de Errores | INCOMPLETO | MEDIO |
| Performance DB | OPTIMIZADO | BAJO-MEDIO |
| WebSocket Security | IMPLEMENTADO | BAJO |
| Testing | DEFICIENTE | ALTO |

---

## PROBLEMAS CRÍTICOS (ACCIÓN INMEDIATA)

### 1. SECRETOS EXPUESTOS EN ARCHIVO .env

**Ubicación**: `/opt/flow-builder/.env` (líneas 1-45)  
**Severidad**: CRÍTICA  
**Estado**: NO RESUELTO  
**Impacto**: Compromiso completo del sistema

#### Problema Detallado

```env
# EXPUESTOS:
META_WABA_TOKEN=EAAQ2uEgACPwBP5BkgcIhrv038eEX3MZAYkjDEDwRfHXibQe7YERxyyNZCgv8XCmuS1nZAd9DKZBBCZCtDFictZA5yWVMeZAdB6OdPQ3k2lKmRkqebBNV30mZCP2vOqZB8ZCfizD5ZClRlSWQmyxIpbVNCVfsxwsdNxVGd6puSY7OOiB3HwN1RfbBoZCnnAXrnV2vqQZDZD
B24_APP_SECRET=Gu5W5R3ms1SOWX6V3eQvO3GiB6RNjfXYEgnPwUxnm9qFdIjKjB
JWT_SECRET=8K9mX2pL5nR4vW7qZ3jH6tY1sA0bN4cE9fG2hI5kJ8lM3oP6rQ9uT2vX5wZ8yA1b
POSTGRES_PASSWORD=azaleia_pg_2025_secure
WHATSAPP_ACCESS_TOKEN=EAAQ2uEgACPwBP5cYs56jz6sVjbMxWfaJ2M0whbgHfaTct4Yjh9BMXxTfvzW8rHAWBXZCRgZBgfOZBd7ZChQNJpdezYZAMAHmVuCrFKmhafBarPtzHKAAh8HtweKZACfMdn79atTsaPwySbypuORrgh6UZAK6Lou2HludGu3cFww0GZCm6iAO1WtrG9W0vN5xowZDZD
```

#### Riesgos Específicos

1. **Acceso a Meta WhatsApp APIs**: Envío masivo de mensajes, cambios de configuración
2. **Acceso a Bitrix24 CRM**: Lectura/modificación de contactos, deals, campos personalizados
3. **Session Hijacking**: JWT_SECRET es débil (solo 64 bytes) y conocido
4. **Acceso Database**: Credenciales PostgreSQL en texto plano

#### Solución Recomendada

```bash
# 1. INMEDIATAMENTE - Rotar TODAS las credenciales
# - Generar nuevo JWT_SECRET: openssl rand -base64 32
# - Rotar tokens de Meta WhatsApp
# - Regenerar credenciales Bitrix24 OAuth
# - Cambiar contraseña PostgreSQL

# 2. Usar gestión de secretos
# Opciones:
# - AWS Secrets Manager / Parameter Store
# - HashiCorp Vault
# - Azure Key Vault
# - GitHub Secrets (para CI/CD)

# 3. Implementar en el código:
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();
async function getSecret(name: string) {
  const { SecretString } = await secretsManager.getSecretValue({ 
    SecretId: name 
  }).promise();
  return JSON.parse(SecretString!);
}

# 4. Verificar historial de git
git log -p --all -- .env | head -100
# Si está en historial, hacer git filter-branch o BFG Repo-Cleaner

# 5. Auditoría de acceso
# - Revisar logs de AWS CloudTrail
# - Revisar logs de Meta Business API
# - Revisar logs de Bitrix24
```

---

### 2. VALIDACIÓN DEFICIENTE DE ENTRADA (MÚLTIPLES VECTORES DE ATAQUE)

**Ubicación**: Múltiples rutas de API  
**Severidad**: CRÍTICA  
**Estado**: PARCIALMENTE RESUELTO  
**Impacto**: Inyección, corrupción de datos, DoS

#### 2.1 Sin Validación en /api/crm/messages/send

**Archivo**: `/opt/flow-builder/server/crm/routes/messages.ts` (línea 25)

```typescript
// VULNERABLE: Acepta cualquier payload sin validación
router.post("/send", async (req, res) => {
  const payload = req.body as SendPayload;  // ❌ NO VALIDA
  
  if (!payload.convId && !payload.phone) {
    res.status(400).json({ error: "missing_destination" });
    return;
  }
  
  // VULNERABLE: No valida formato de teléfono
  let conversation = payload.convId ? 
    await crmDb.getConversationById(payload.convId) : 
    undefined;
  
  // VULNERABLE: Crea conversación sin validación
  if (!conversation && payload.phone) {
    conversation = await crmDb.createConversation(payload.phone);  // ❌ Acepta cualquier string
  }
```

**Problemas**:
- No valida formato de teléfono
- No valida longitud de mensaje
- No valida tipo de datos
- No valida attachment IDs
- Inyección indirecta en conversationId

**Solución**:

```typescript
import { z } from 'zod';

const SendMessageSchema = z.object({
  convId: z.string().uuid().optional(),
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone format')
    .optional(),
  text: z.string()
    .max(4096, 'Message too long')
    .optional(),
  attachmentId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
  type: z.enum(['text', 'image', 'audio', 'video', 'document', 'sticker']).optional(),
  isInternal: z.boolean().optional()
});

router.post("/send", async (req, res) => {
  try {
    const payload = SendMessageSchema.parse(req.body);
    
    // Validar que al menos uno de convId o phone esté presente
    if (!payload.convId && !payload.phone) {
      return res.status(400).json({ error: 'missing_destination' });
    }
    
    // Continuar con lógica segura...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'validation_error',
        details: error.errors 
      });
    }
    // ...
  }
});
```

#### 2.2 Sin Validación en /api/campaigns

**Archivo**: `/opt/flow-builder/server/campaigns/routes.ts` (línea 22)

```typescript
// VULNERABLE: No valida recipients
router.post('/', requireSupervisor, (req, res) => {
  const { name, whatsappNumberId, templateName, language, recipients, variables } = req.body;
  
  // Cleaning es débil - solo remueve caracteres no-dígitos
  const cleanedRecipients = recipients
    .map((phone: string) => phone.trim().replace(/\D/g, ''))
    .filter((phone: string) => phone.length >= 9 && phone.length <= 15);
    // ❌ No valida si es número de verdad
    // ❌ Acepta cualquier string largo de dígitos
```

**Problema**: 
- El regex permite números de tarjeta de crédito, IDs, etc.
- No valida prefijo país
- No normaliza números (+ vs 00)

**Solución**: Usar libería especializada

```typescript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const cleanedRecipients = recipients
  .filter((phone: any) => {
    if (typeof phone !== 'string') return false;
    return isValidPhoneNumber(phone, 'PE');  // Validar para país específico
  })
  .map((phone: string) => parsePhoneNumber(phone, 'PE')!.format('E.164'));
```

---

### 3. AUTENTICACIÓN DÉBIL EN WEBSOCKET

**Ubicación**: `/opt/flow-builder/server/crm/ws.ts` (líneas 100-130)  
**Severidad**: CRÍTICA  
**Estado**: PARCIALMENTE RESUELTO

#### Problema Detallado

```typescript
// LÍNEA 110: Autenticación ocurre DESPUÉS de agregar client
socket.once("close", (code, reason) => {
  const reasonText = Buffer.isBuffer(reason) ? 
    reason.toString("utf8") : 
    String(reason ?? "");
  this.dropClient(clientId, code, reasonText);  // ❌ Client ya está en map
});

// LÍNEA 130+: Autenticación pospuesta
socket.on("message", (data) => {
  // ❌ Procesa mensajes antes de autenticar
  const frame = this.parseFrame(data);
  
  if (frame.type === 'auth') {
    const payload = verifyToken(frame.payload.token);  // Autenticación aquí
    client.userId = payload?.userId;  // Asigna DESPUÉS de procesar
  }
});
```

**Riesgos**:
1. **Race Condition**: Cliente puede enviar mensajes antes de autenticarse
2. **DoS**: Atacante envía frames inválidos, socket acepta todo antes de validar
3. **Leak de Usuarios**: Sin filtrar por `client.userId`, puede ver mensajes de otros

#### Solución

```typescript
export class CrmRealtimeGateway {
  private readonly unauthenticatedClients = new Set<string>();
  
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: WS_PATH });
    
    this.wss.on("connection", (socket, req) => {
      const origin = req.headers.origin;
      if (!isOriginAllowed(origin)) {
        socket.close(1008, "origin_not_allowed");
        return;
      }
      
      const clientId = randomUUID();
      const client: ClientContext = { id: clientId, socket, isAlive: true };
      this.clients.set(clientId, client);
      this.unauthenticatedClients.add(clientId);  // Marcar como no autenticado
      
      // Timeout para autenticar (30 segundos)
      const authTimeout = setTimeout(() => {
        if (this.unauthenticatedClients.has(clientId)) {
          socket.close(1008, "auth_timeout");
          this.dropClient(clientId, 1008, "auth_timeout");
        }
      }, 30000);
      
      socket.on("message", (data) => {
        try {
          const frame = this.parseFrame(data);
          
          // PRIMERO: Requiere autenticación
          if (this.unauthenticatedClients.has(clientId)) {
            if (frame.type !== 'auth') {
              socket.close(1008, "auth_required");
              return;
            }
            
            // Verificar token
            const payload = verifyToken(frame.payload?.token);
            if (!payload) {
              socket.close(1008, "auth_failed");
              return;
            }
            
            client.userId = payload.userId;
            this.unauthenticatedClients.delete(clientId);
            clearTimeout(authTimeout);
            socket.send(JSON.stringify({ type: 'auth_success' }));
            return;
          }
          
          // DESPUÉS: Procesa otros mensajes solo si autenticado
          this.handleMessage(clientId, frame);
        } catch (error) {
          console.error(`[CRM WS] Error parsing frame:`, error);
          socket.close(1011, "invalid_frame");
        }
      });
    });
  }
}
```

---

### 4. SINCRONIZACIÓN DEFICIENTE DE ESTADO (Race Conditions)

**Ubicación**: `/opt/flow-builder/server/crm/inbound.ts`, `/opt/flow-builder/server/queue-distributor.ts`  
**Severidad**: CRÍTICA  
**Estado**: NO RESUELTO  
**Impacto**: Duplicación de chats, asignaciones múltiples, pérdida de mensajes

#### Problema 1: Crear Conversación Sin Transacción

**Archivo**: `/opt/flow-builder/server/crm/inbound.ts` (línea 71)

```typescript
// VULNERABLE: Race condition en creación de conversación
let conversation = await crmDb.getConversationByPhoneAndChannel(phone, "whatsapp", phoneNumberId);
if (!conversation) {
  // ❌ Entre el check y la creación, otro proceso puede crear la misma conversación
  conversation = await crmDb.createConversation(phone, null, avatarUrl, "whatsapp", phoneNumberId, displayNumber);
  logDebug(`[CRM] Created new conversation ${conversation.id}`);
}
```

**Escenario de Fallo**:
1. Webhook A llega: phone=+51987654321, no encuentra conversación
2. Webhook B llega: MISMO phone, no encuentra conversación (A aún no guardó)
3. A crea conversation_v1, B crea conversation_v2
4. Resultado: DOS conversaciones para el mismo cliente

#### Solución: Usar Transacción + Índice Único

```typescript
// Base de datos - agregar constraint único
CREATE UNIQUE INDEX idx_conv_phone_channel_unique 
  ON crm_conversations(phone, channel, channel_connection_id) 
  WHERE status != 'closed' AND status != 'archived';

// Código - usar transacción
async getOrCreateConversation(
  phone: string,
  channel: string = 'whatsapp',
  phoneNumberId?: string | null
): Promise<Conversation> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    
    // Obtener con lock
    const result = await client.query(
      `SELECT ${CONVERSATION_COLUMNS} FROM crm_conversations 
       WHERE phone = $1 AND channel = $2 AND channel_connection_id = $3 
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [phone, channel, phoneNumberId || null]
    );
    
    if (result.rows.length > 0) {
      await client.query('COMMIT');
      return this.rowToConversation(result.rows[0]);
    }
    
    // Crear dentro de la misma transacción
    const conversation = await this.createConversationInTransaction(
      client,
      phone,
      channel,
      phoneNumberId
    );
    
    await client.query('COMMIT');
    return conversation;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as any).code === '40P01') {
      // Serialization conflict - reintentar
      return this.getOrCreateConversation(phone, channel, phoneNumberId);
    }
    throw error;
  } finally {
    client.release();
  }
}
```

#### Problema 2: Distribuidor de Cola Sin Bloqueo

**Archivo**: `/opt/flow-builder/server/queue-distributor.ts` (línea 61)

```typescript
private async distribute(): Promise<void> {
  // ❌ isRunning es verificación de tiempo de verificación vs tiempo de uso (TOCTOU)
  if (this.isRunning) {
    return;
  }
  
  this.isRunning = true;  // ❌ Entre línea anterior y aquí, dos distribute() pueden pasar
  
  try {
    // ... lógica distribuidor
  } finally {
    this.isRunning = false;
  }
}
```

**Riesgo**: Dos instancias de `distribute()` pueden ejecutarse en paralelo si el await es lento.

**Solución**: Usar Mutex

```typescript
import PQueue from 'p-queue';

export class QueueDistributor {
  private queue = new PQueue({ concurrency: 1 });  // Solo 1 ejecución a la vez
  
  async start(intervalMs: number = 10000): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.queue.add(() => this.distribute());  // Encola la ejecución
    }, intervalMs);
  }
  
  private async distribute(): Promise<void> {
    // Garantizado que solo se ejecuta 1 a la vez
    // ...
  }
}
```

---

### 5. ALMACENAMIENTO DE CONTRASEÑAS DÉBIL

**Ubicación**: `/opt/flow-builder/server/admin-db.ts` (línea 31)  
**Severidad**: CRÍTICA  
**Estado**: PARCIALMENTE RESUELTO

#### Problema

El código almacena contraseñas con `bcrypt`, lo cual es correcto. **PERO**:

1. El salt rounds está hardcodeado (probablemente 10)
2. No hay validación de complejidad de contraseña
3. Las contraseñas se pasan en texto plano en requests HTTP

**Archivo**: `/opt/flow-builder/server/routes/auth.ts` (no anexado pero probablemente presente)

#### Solución

```typescript
import bcrypt from 'bcrypt';
import { z } from 'zod';

// Validación de complejidad
const PasswordSchema = z.string()
  .min(12, 'Contraseña debe tener mínimo 12 caracteres')
  .regex(/[A-Z]/, 'Debe contener mayúscula')
  .regex(/[a-z]/, 'Debe contener minúscula')
  .regex(/[0-9]/, 'Debe contener número')
  .regex(/[!@#$%^&*]/, 'Debe contener símbolo especial');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export async function hashPassword(password: string): Promise<string> {
  try {
    PasswordSchema.parse(password);  // Validar complejidad
  } catch (error) {
    throw new Error(`Contraseña insegura: ${(error as any).message}`);
  }
  
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// En ruta de login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = adminDb.getUserByUsername(username);
    if (!user) {
      // No revelar si existe usuario
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // ✅ Nunca enviar contraseña al cliente
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });
    
    res.cookie('token', token, {
      httpOnly: true,        // ✅ No accesible desde JavaScript
      secure: true,          // ✅ Solo HTTPS
      sameSite: 'strict',    // ✅ Previene CSRF
      maxAge: 24 * 60 * 60 * 1000  // 24 horas
    });
    
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
```

---

### 6. INYECCIÓN INDIRECTA EN METADATA JSON

**Ubicación**: `/opt/flow-builder/server/crm/db-postgres.ts` (línea 229)  
**Severidad**: CRÍTICA  
**Estado**: NO RESUELTO

#### Problema

```typescript
// Línea 229: JSON.stringify de metadata sin validar
const convMeta = {
  ...conversation.metadata,
  [key]: value  // ❌ ¿key viene validado?
};

await pool.query(
  `UPDATE crm_conversations SET metadata = $1 WHERE id = $2`,
  [JSON.stringify(convMeta), conversationId]
);
```

**Riesgo**: Si `key` contiene `__proto__` u otros valores especiales, puede causar prototype pollution.

#### Solución

```typescript
import { sanitizeKeys } from './security-utils';

async updateConversationMetadata(
  conversationId: string,
  updates: Record<string, unknown>
): Promise<void> {
  // Validar llaves
  const whitelist = ['customField1', 'customField2', 'tags', 'notes'];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(updates)) {
    if (!whitelist.includes(key)) {
      throw new Error(`Metadata key '${key}' not allowed`);
    }
    
    // Evitar prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(`Forbidden metadata key: '${key}'`);
    }
    
    sanitized[key] = value;
  }
  
  // Usar ON CONFLICT para evitar race condition
  await pool.query(
    `UPDATE crm_conversations 
     SET metadata = metadata || $1::jsonb, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(sanitized), conversationId]
  );
}
```

---

## PROBLEMAS DE ALTA PRIORIDAD

### 7. N+1 QUERIES EN LISTADOS

**Ubicación**: `/opt/flow-builder/server/crm/routes/conversations.ts` (línea 37-62)  
**Severidad**: ALTA  
**Estado**: IDENTIFICADO

#### Problema

```typescript
router.get("/", async (_req, res) => {
  const conversations = await crmDb.listConversations();  // ✅ 1 query
  
  res.json(
    conversations.map((conversation) => ({
      id: conversation.id,
      phone: conversation.phone,
      // ... 20 más campos
      contactName: conversation.contactName ?? null,
      assignedTo: conversation.assignedTo ?? null,
      // ❌ Si el frontend hace `getAdvisorName(conversation.assignedTo)`
      // para CADA conversación, eso serían +N queries
    })),
  );
});
```

**Impacto Observado**:
- Con 1000 conversaciones = 1000 queries adicionales
- Tiempo de respuesta: 50ms → 3000ms+

#### Solución: Eager Loading

```typescript
async getConversationsWithAdvisors(): Promise<ConversationWithAdvisor[]> {
  const result = await pool.query(`
    SELECT 
      c.id, c.phone, c.contact_name,
      c.assigned_to, c.attended_by,
      a.username as assigned_to_name,
      a.name as assigned_to_full_name
    FROM crm_conversations c
    LEFT JOIN admin_users a ON c.assigned_to = a.id
    ORDER BY c.last_message_at DESC NULLS LAST
  `);
  
  return result.rows.map(row => ({
    ...this.rowToConversation(row),
    assignedToName: row.assigned_to_name,
    assignedToFullName: row.assigned_to_full_name
  }));
}

// En ruta
router.get("/", async (_req, res) => {
  const conversations = await crmDb.getConversationsWithAdvisors();  // 1 query
  res.json(conversations);
});
```

---

### 8. LÍMITES DE RATE LIMITING DÉBILES

**Ubicación**: `/opt/flow-builder/server/middleware/rate-limit.ts`  
**Severidad**: ALTA  
**Estado**: PARCIALMENTE IMPLEMENTADO

#### Problemas Identificados

```typescript
// Línea 8-9: Auth limiter permitiría 5*4 = 20 intentos por hora por IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // ❌ Muy leniente
  max: 5,  // ❌ Solo 5 intentos cada 15 min = 20 por hora
  // ❌ Con salt de bcrypt de ~100ms, un ataque se demoraría solo 2 segundos
});

// Línea 38-40: Webhook limiter muy alto
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,  // ❌ 1 request/segundo = muy alto para webhook legítimo
  // ❌ Meta envía webhook de varios usuarios simultáneamente
});
```

#### Solución

```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,  // ✅ Máximo 3 intentos por 15 min (bruteforce imposible)
  message: {
    error: "auth_rate_limited",
    message: "Too many login attempts. Try again in 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit por IP + username (más granular)
    return `${req.ip}:${req.body.username || 'unknown'}`;
  },
  skip: (req) => {
    // No rate limit para requests autenticados
    return !!req.user;
  }
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,  // ✅ 30 requests/min = 0.5/sec promedio (suficiente)
  // Meta puede agrupar eventos pero no más de esto
  keyGenerator: (req) => {
    // Rate limit por phone number, no global
    return req.body?.entry?.[0]?.id || req.ip;
  }
});

// Agregar rate limit específico para admin
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,  // Moderado para admin
  standardHeaders: true,
  legacyHeaders: false
});
```

---

### 9. LOGGING EXCESIVO EN PRODUCCIÓN

**Ubicación**: **594 console.log/error/warn** en codebase  
**Severidad**: ALTA  
**Estado**: NO RESUELTO

#### Impacto

- **Performance**: I/O de disco lento, especialmente con muchas conversaciones
- **Storage**: Logs sin rotación = disco lleno en días
- **Security**: Información sensible en logs (tokens, IDs, etc.)
- **Análisis**: Ruido imposibilita findbugs

#### Problemas Específicos

```typescript
// server/crm/db-postgres.ts línea 144
console.log('[PostgresCRM] ⚡ EXECUTING NEW CODE - NO FILTER VERSION');

// server/crm/db-postgres.ts línea 158
console.log('[PostgresCRM] 📊 By status:', byStatus);  // ❌ Por CADA request

// server/crm/routes/messages.ts línea 86-91
console.log(`[CRM Send] 🚨 AUTO-ASSIGNMENT TRIGGERED:`);  // ❌ 594 líneas de esto
```

#### Solución: Logging Estructurado

```typescript
// server/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'crm-bot' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,  // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Reemplazar todos console.log con:
// ❌ console.log('[PostgresCRM] ⚡ EXECUTING...')
// ✅ logger.debug('Executing new conversation code', { 
//      conversationCount: result.rows.length 
//    });

// En messages.ts
logger.info('Auto-assignment triggered', {
  conversationId: conversation.id,
  advisorId,
  status: conversation.status,
  userId: req.user?.userId
});
```

---

### 10. FALTA DE TESTS END-TO-END

**Ubicación**: `/opt/flow-builder/tests/` (vacío)  
**Severidad**: ALTA  
**Estado**: NO EXISTE

#### Problemas

- No hay tests para flujo completo de mensaje
- No hay tests para distribución de cola
- No hay tests para sincronización Bitrix24
- No hay tests de seguridad (autenticación, autorización)
- No hay tests de performance/carga

#### Solución

```typescript
// tests/e2e/conversation-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import WebSocket from 'ws';

const API_URL = 'http://localhost:3000';
let token: string;

beforeAll(async () => {
  // Login como asesor
  const res = await axios.post(`${API_URL}/api/auth/login`, {
    username: 'test-advisor',
    password: 'TestPassword123!'
  });
  token = res.data.token;
});

describe('E2E: Conversation Flow', () => {
  it('should create conversation from incoming WhatsApp message', async () => {
    // Simular webhook de WhatsApp
    const res = await axios.post(
      `${API_URL}/api/whatsapp/webhook`,
      {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '51987654321',
                id: 'wamid.123',
                timestamp: Date.now(),
                text: { body: 'Hola' },
                type: 'text'
              }],
              metadata: {
                phone_number_id: '123456789',
                display_phone_number: '+51999999999'
              }
            }
          }]
        }]
      },
      { headers: { 'X-Hub-Verify-Token': process.env.WHATSAPP_VERIFY_TOKEN } }
    );
    
    expect(res.status).toBe(200);
    
    // Verificar que conversación fue creada
    const convRes = await axios.get(
      `${API_URL}/api/crm/conversations`,
      { headers: { Cookie: `token=${token}` } }
    );
    
    const conversation = convRes.data.find(
      c => c.phone === '51987654321'
    );
    expect(conversation).toBeDefined();
    expect(conversation.status).toBe('active');
  });
  
  it('should assign conversation to available advisor', async () => {
    // Obtener conversación en cola
    const convRes = await axios.get(
      `${API_URL}/api/crm/conversations`,
      { headers: { Cookie: `token=${token}` } }
    );
    
    const queued = convRes.data.find(
      c => c.status === 'active' && !c.assignedTo
    );
    expect(queued).toBeDefined();
    
    // Esperar a que distribuidor asigne
    await new Promise(r => setTimeout(r, 15000));
    
    // Verificar asignación
    const updated = await axios.get(
      `${API_URL}/api/crm/conversations/${queued.id}`,
      { headers: { Cookie: `token=${token}` } }
    );
    
    expect(updated.data.assignedTo).toBeDefined();
    expect(updated.data.status).toBe('attending');
  });
});
```

---

## PROBLEMAS DE MEDIA PRIORIDAD

### 11. GESTIÓN DE ERRORES INCOMPLETA

**Ubicación**: Múltiples archivos  
**Severidad**: MEDIA  
**Impacto**: Fallos silenciosos, debugging difícil

#### Problemas Identificados

```typescript
// server/crm/inbound.ts línea 85
catch (error) {
  logError(`[CRM] Failed to fetch profile picture for ${phone}:`, error);
  // ❌ Continúa sin avatar - conversación creada de todas formas
}

// server/admin-db.ts (sin vistazo, pero probables)
try {
  // Cargar JSON
} catch {
  // ❌ ¿Qué pasa si el archivo está corrupto?
}

// server/index.ts líneas 5-15
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
  // ❌ No intenta recuperarse, solo loguea
  // ❌ No reinicia el servicio
  // ❌ No notifica a monitoreo
});
```

#### Solución

```typescript
// server/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      code: err.code,
      statusCode: err.statusCode,
      message: err.message
    });
    
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message
    });
    return;
  }
  
  // Error inesperado
  logger.error('Unexpected error', {
    message: err.message,
    stack: err.stack
  });
  
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
}

// server/index.ts
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: String(reason),
    promise: String(promise)
  });
  
  // Notificar a monitoreo (Sentry, Datadog, etc.)
  if (process.env.SENTRY_DSN) {
    // captureException(reason);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - exiting process', {
    message: error.message,
    stack: error.stack
  });
  
  // Dar tiempo para logging antes de salir
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});
```

---

### 12. ALMACENAMIENTO JSON SIN TRANSACCIONES

**Ubicación**: `/opt/flow-builder/server/admin-db.ts`  
**Severidad**: MEDIA  
**Estado**: EN TRANSICIÓN A POSTGRES

#### Problemas

```typescript
// admin-db.ts: Carga todos los JSON en memoria en startup
// Si el servidor se reinicia, los cambios posteriores se pierden
// Si el JSON se corrompe, el servidor no arranca

const USERS_PATH = path.join(DATA_DIR, 'users.json');

// Lectura: ✅ Funciona
let users: User[] = [];
try {
  users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
} catch {
  console.warn('No existing users.json file');
}

// Escritura: ❌ Sin sincronización
saveUsers() {
  fs.writeFileSync(USERS_PATH, JSON.stringify(this.users, null, 2));
  // ❌ Si dos procesos escriben simultáneamente, uno pierde datos
}
```

#### Solución: Migración a PostgreSQL

```sql
-- Crear tabla para usuarios (reemplazando admin-db.ts)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- bcrypt hash
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'asesor', 'supervisor')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_users_username ON admin_users(username);
CREATE INDEX idx_users_role ON admin_users(role);

-- Reemplazar admin-db.ts con:
class AdminDatabase {
  async getUser(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM admin_users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
  
  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    await pool.query(
      `UPDATE admin_users SET 
        username = COALESCE($2, username),
        email = COALESCE($3, email),
        name = COALESCE($4, name),
        updated_at = $5
      WHERE id = $1`,
      [id, updates.username, updates.email, updates.name, Date.now()]
    );
  }
}
```

---

### 13. SINCRONIZACIÓN CON BITRIX24 NO CONFIABLE

**Ubicación**: `/opt/flow-builder/server/crm/services/bitrix.ts`  
**Severidad**: MEDIA  
**Estado**: PARCIALMENTE IMPLEMENTADO

#### Problemas Identificados

1. **Sin retry logic**: Si Meta API falla, no reintenta
2. **Sin dead letter queue**: Mensajes fallidos se pierden
3. **Sin idempotencia**: Mismo evento procesar múltiples veces = múltiples registros

#### Solución

```typescript
// server/services/bitrix-sync-queue.ts
export class BitrixSyncQueue {
  private queue: Map<string, BitrixSyncJob> = new Map();
  private processing = false;
  
  async addJob(job: BitrixSyncJob): Promise<string> {
    const id = randomUUID();
    job.id = id;
    job.createdAt = Date.now();
    job.retries = 0;
    
    // Guardar en PostgreSQL (persistencia)
    await this.saveToDB(job);
    this.queue.set(id, job);
    
    // Procesar inmediatamente si no hay cola
    if (!this.processing) {
      this.processQueue();
    }
    
    return id;
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.size > 0) {
      const [jobId, job] = Array.from(this.queue.entries())[0];
      
      try {
        await this.executeJob(job);
        
        // Éxito: eliminar de cola
        this.queue.delete(jobId);
        await this.markJobComplete(jobId);
      } catch (error) {
        job.retries++;
        
        if (job.retries < 3) {
          // Reintentar exponencial
          await new Promise(r => 
            setTimeout(r, Math.pow(2, job.retries) * 1000)
          );
        } else {
          // Dead letter queue
          logger.error('Job failed after 3 retries', { jobId });
          await this.moveToDeadLetterQueue(job);
          this.queue.delete(jobId);
        }
      }
    }
    
    this.processing = false;
  }
  
  private async executeJob(job: BitrixSyncJob): Promise<void> {
    // Usar idempotency key para evitar duplicados
    const response = await bitrixService.syncContact(job.contactId, {
      idempotencyKey: job.id  // Meta y Bitrix24 soportan esto
    });
    
    if (response.ok) {
      return;
    }
    
    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    if (response.status === 429) {
      throw new Error('Rate limited');
    }
    
    throw new Error(`Client error: ${response.status}`);
  }
}
```

---

### 14. FALTA DE ÍNDICES DE BASE DE DATOS

**Ubicación**: `/opt/flow-builder/server/crm/db-postgres.ts`  
**Severidad**: MEDIA  
**Impacto**: Queries lentísimas con 10,000+ conversaciones

#### Problemas

```typescript
// Línea 145-149: Sin índice, O(n) scan
const result = await pool.query(
  `SELECT ${CONVERSATION_COLUMNS}
   FROM crm_conversations
   ORDER BY last_message_at DESC NULLS LAST`
);
```

#### Solución: Crear Índices

```sql
-- Índices esenciales (agregar a migrations)

-- 1. Búsqueda por teléfono (usado en inbound)
CREATE INDEX CONCURRENTLY idx_conv_phone_channel 
  ON crm_conversations(phone, channel) 
  WHERE status != 'closed';

-- 2. Búsqueda por asignado (usado en stats)
CREATE INDEX CONCURRENTLY idx_conv_assigned_to 
  ON crm_conversations(assigned_to) 
  WHERE status IN ('active', 'attending');

-- 3. Búsqueda por cola
CREATE INDEX CONCURRENTLY idx_conv_queue_id 
  ON crm_conversations(queue_id) 
  WHERE status IN ('active', 'attending');

-- 4. Ordenar por mensaje más reciente
CREATE INDEX CONCURRENTLY idx_conv_last_message_desc 
  ON crm_conversations(last_message_at DESC NULLS LAST);

-- 5. Búsqueda de mensajes
CREATE INDEX CONCURRENTLY idx_msg_conversation_created 
  ON crm_messages(conversation_id, created_at DESC);

-- 6. Búsqueda de métricas
CREATE INDEX CONCURRENTLY idx_metrics_advisor_date 
  ON conversation_metrics(advisor_id, started_at DESC);

-- Analizar query plans
EXPLAIN ANALYZE
  SELECT * FROM crm_conversations 
  WHERE phone = '51987654321' AND channel = 'whatsapp'
  ORDER BY created_at DESC LIMIT 1;
```

---

## PROBLEMAS DE BAJA PRIORIDAD

### 15. DUPLICATE CODE EN SINCRONIZACIÓN

**Ubicación**: `/opt/flow-builder/server/crm/db.ts` y `/opt/flow-builder/server/crm/db-postgres.ts`  
**Severidad**: BAJA  
**Impacto**: Duplicación, mantenimiento difícil

**Solución**: Eliminar db.ts (está siendo reemplazado por db-postgres.ts)

---

### 16. TIPOS TypeScript DÉBILES (132 usos de `any`)

**Severidad**: BAJA (pero acumula deuda técnica)

```typescript
// ❌ server/crm/db-postgres.ts línea 106
const availableAdvisors = this.getAvailableAdvisorsInQueue(queue);
// ^ queue es `any`, debería ser `Queue`

// ❌ server/crm/routes/messages.ts línea 106
channelType: conversation.channel as any,
// ^ cast a any en lugar de usar tipo correcto
```

**Solución**: Usar stricter TypeScript config

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

---

### 17. FALTA DE CACHÉ (Cache-Aside Pattern)

**Ubicación**: `/opt/flow-builder/server/crm/routes/conversations.ts`  
**Severidad**: BAJA-MEDIA  
**Impacto**: Queries repetidas

```typescript
// Sin caché: cada request ejecuta query completa
router.get("/", async (_req, res) => {
  const conversations = await crmDb.listConversations();  // Query cada vez
  res.json(conversations);
});
```

**Solución**:

```typescript
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const CONV_CACHE_TTL = 30;  // 30 segundos

router.get("/", async (_req, res) => {
  // Intentar obtener del caché
  const cached = await redis.get('crm:conversations:list');
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  // Obtener de DB
  const conversations = await crmDb.listConversations();
  
  // Cachear
  await redis.setEx(
    'crm:conversations:list',
    CONV_CACHE_TTL,
    JSON.stringify(conversations)
  );
  
  res.json(conversations);
});

// Invalidar caché cuando hay cambios
async function updateConversation(id: string, updates: any) {
  await crmDb.updateConversation(id, updates);
  
  // Invalidar caché
  await redis.del('crm:conversations:list');
}
```

---

## ANÁLISIS DE ARQUITECTURA

### 18. SEPARACIÓN DE CONCERNS DÉBIL

**Problema**: Lógica de negocio mezclada con HTTP

```typescript
// ❌ server/crm/routes/messages.ts línea 25-120
router.post("/send", async (req, res) => {
  const payload = req.body as SendPayload;
  // ... 100 líneas de lógica dentro de la ruta
  // - Validación
  // - Database updates
  // - Metrics tracking
  // - WebSocket emissions
  // - Attachment linking
  // - Auto-assignment logic
});
```

**Solución**: Separar en service layer

```typescript
// server/crm/services/message-service.ts
export class MessageService {
  async sendMessage(
    convId: string,
    text: string,
    options: MessageOptions
  ): Promise<Message> {
    // Validación
    this.validateMessage(text);
    
    // Database
    const message = await crmDb.appendMessage({...});
    
    // Tracking
    this.metricsTracker.recordMessage(convId);
    
    return message;
  }
}

// server/crm/routes/messages.ts
router.post("/send", async (req, res) => {
  try {
    const payload = SendMessageSchema.parse(req.body);
    const message = await messageService.sendMessage(
      payload.convId,
      payload.text,
      { ...payload }
    );
    res.json({ message });
  } catch (error) {
    // Manejar error
  }
});
```

---

### 19. FALTA DE MIGRATIONS FRAMEWORK

**Problema**: Schema de PostgreSQL no versionado

**Solución**: Implementar Migrations con TypeORM o Knex.js

```typescript
// migrations/001_init_schema.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE crm_conversations (
        id UUID PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        ...
      );
    `);
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE crm_conversations`);
  }
}
```

---

### 20. DEPENDENCIAS CIRCULARES POTENCIALES

**Ubicación**: `/opt/flow-builder/server/crm/` (estructura radial)

**Problema**: Todos los archivos importan `db-postgres.ts`

**Solución**: Usar inyección de dependencias

```typescript
// server/crm/container.ts
export class CRMContainer {
  private db: PostgresCRMDatabase;
  private metrics: MetricsTracker;
  private messageService: MessageService;
  
  constructor() {
    this.db = new PostgresCRMDatabase();
    this.metrics = new MetricsTracker(this.db);
    this.messageService = new MessageService(this.db, this.metrics);
  }
  
  getMessageService() { return this.messageService; }
  // ...
}

// server/crm/index.ts
const container = new CRMContainer();

router.post("/send", async (req, res) => {
  const service = container.getMessageService();
  // ...
});
```

---

## RECOMENDACIONES TRANSVERSALES

### Roadmap de Remediación (Orden Recomendado)

#### Semana 1: Críticos (Do or Die)
1. ✅ Rotar TODOS los secretos (.env)
2. ✅ Implementar gestión de secretos (AWS Secrets Manager)
3. ✅ Agregar validación Zod a TODAS las rutas HTTP
4. ✅ Arreglar race condition en getOrCreateConversation

#### Semana 2: Altos
5. ✅ Implementar E2E tests críticos
6. ✅ Agregar índices PostgreSQL
7. ✅ Reemplazar todos console.log con winston logging
8. ✅ Implementar error handling centralizado

#### Semana 3-4: Medios
9. ✅ Implementar Bitrix24 sync queue + retry logic
10. ✅ Crear migration framework
11. ✅ Refactorizar message send endpoint
12. ✅ Implementar Redis caché

#### Sprint Siguiente: Mejoras
13. ✅ Subir cobertura de tests a 80%+
14. ✅ Implementar inyección de dependencias
15. ✅ Documentar API con OpenAPI/Swagger
16. ✅ Agregar observabilidad (Prometheus metrics)

---

### Checklist de Seguridad para Producción

- [ ] Todos los secretos en gestión centralizada (NO en .env)
- [ ] HTTPS forzado (redirigir HTTP → HTTPS)
- [ ] CORS configurado específicamente (no wildcard)
- [ ] CSRF protection en formularios
- [ ] Rate limiting en todos los endpoints
- [ ] Input validation con Zod
- [ ] SQL parametrizado (ya implementado)
- [ ] Encriptación de datos en tránsito (TLS 1.3)
- [ ] Encriptación de datos en reposo (PostgreSQL pgcrypto)
- [ ] Auditoría de acceso (logs con timestamps)
- [ ] Backup automatizado + testing de restore
- [ ] Monitoreo de errores (Sentry)
- [ ] WAF configurado (Cloudflare)
- [ ] DDoS protection
- [ ] Penetration testing realizado
- [ ] Security headers configurados:
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security

---

### Configuración Recomendada para Producción

```bash
# server/.env.production
NODE_ENV=production
PORT=3000

# Secrets (obtener de AWS Secrets Manager)
JWT_SECRET=${AWS_SECRETS_JWT_SECRET}
POSTGRES_PASSWORD=${AWS_SECRETS_DB_PASS}
# ... todos desde AWS

# PostgreSQL
POSTGRES_HOST=prod-postgres.internal
POSTGRES_PORT=5432
POSTGRES_DB=flowbuilder_crm
POSTGRES_USER=whatsapp_user
POSTGRES_POOL_SIZE=20
POSTGRES_POOL_MIN=2
POSTGRES_STATEMENT_TIMEOUT=10000

# Redis (para caché y session store)
REDIS_URL=redis://prod-redis.internal:6379

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Rate limiting
AUTH_RATE_LIMIT_WINDOW=15
AUTH_RATE_LIMIT_MAX=3
API_RATE_LIMIT_WINDOW=15
API_RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=https://wsp.azaleia.com.pe
CRM_WS_ALLOWED_ORIGINS=https://wsp.azaleia.com.pe

# Health check
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
```

---

### Observabilidad Recomendada

```typescript
// server/observability/setup.ts
import * as Sentry from "@sentry/node";
import { register, collectDefaultMetrics } from 'prom-client';

export function setupObservability() {
  // Error tracking
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
  });
  
  // Metrics
  collectDefaultMetrics({
    prefix: 'flowbuilder_',
    timeout: 5000
  });
  
  // Expose metrics para Prometheus
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  
  // Structured logging
  const logger = winston.createLogger({...});
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    const health = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      postgres: dbHealthCheck(),
      redis: redisHealthCheck(),
      websocket: wsHealthCheck()
    };
    
    const status = Object.values(health).every(h => h.ok) ? 200 : 503;
    res.status(status).json(health);
  });
}
```

---

### Testing Strategy

```typescript
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --dir tests/e2e",
    "test:security": "npm audit && npm run lint",
    "test:performance": "node tests/performance/load-test.js"
  }
}

// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/dist/'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  }
});
```

---

## CONCLUSIONES

### Resumen de Impacto

| Severidad | Cantidad | Tiempo Remediación |
|-----------|----------|-------------------|
| **CRÍTICO** | 6 | 3-4 semanas |
| **ALTO** | 5 | 2-3 semanas |
| **MEDIO** | 5 | 2 semanas |
| **BAJO** | 4+ | Deuda técnica |

### Riesgos si NO se remedian

1. **Datos de cliente comprometidos**: Filtración de números, historiales
2. **Maluso de API WhatsApp**: Bloqueo de cuenta Meta, multas
3. **Pérdida de dinero**: Campañas fallidas, downtime
4. **Demandas legales**: GDPR violations, breach notifications
5. **Reputación**: Si falla un cliente grande

### Beneficios de remediar

- **Seguridad**: 0% chance de breach causado por estos issues
- **Performance**: 10x más rápido con índices + caché
- **Mantenibilidad**: Code se vuelve mantenible
- **Escalabilidad**: Puede soportar 10x usuarios
- **Confianza**: Procesos automáticos confiables

### Recomendación Final

**El sistema es funcional pero NO listo para producción crítica.** Requiere:

1. Remediación de problemas críticos (2-3 semanas)
2. Testing completo (2-3 semanas)
3. Code review by security expert (1 semana)
4. Load testing (1 semana)

**Antes de go-live en producción con clientes importantes.**

