# Sistema de Manejo de Errores

## Overview

Se ha implementado un sistema centralizado de manejo de errores que proporciona:
- ✅ Respuestas de error consistentes
- ✅ Logging automático de todos los errores
- ✅ Clases de error tipadas por código HTTP
- ✅ Manejo de excepciones no capturadas
- ✅ Stack traces en desarrollo
- ✅ Metadata estructurada para debugging

## Arquitectura

### Componentes

```
server/
├── middleware/
│   └── error-handler.ts      # Middleware global de errores
└── utils/
    └── errors.ts              # Clases de error personalizadas
```

## Clases de Error

### AppError (Base)

Clase base para todos los errores de aplicación.

```typescript
class AppError extends Error {
  statusCode: number;        // Código HTTP
  errorCode?: string;        // Código de error personalizado
  isOperational: boolean;    // true = error esperado, false = bug
  metadata?: Record<string, any>; // Datos adicionales
}
```

### Errores Disponibles

| Clase | Status | Uso | Error Code |
|-------|--------|-----|------------|
| `BadRequestError` | 400 | Datos inválidos del cliente | `bad_request` |
| `UnauthorizedError` | 401 | Autenticación fallida/faltante | `unauthorized` |
| `ForbiddenError` | 403 | Falta de permisos | `forbidden` |
| `NotFoundError` | 404 | Recurso no encontrado | `not_found` |
| `ConflictError` | 409 | Conflicto (ej: duplicado) | `conflict` |
| `ValidationError` | 422 | Validación fallida | `validation_error` |
| `TooManyRequestsError` | 429 | Rate limit excedido | `too_many_requests` |
| `InternalServerError` | 500 | Error interno del servidor | `internal_error` |
| `ServiceUnavailableError` | 503 | Servicio temporalmente no disponible | `service_unavailable` |

## Uso

### Importar Errores

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  InternalServerError
} from "../utils/errors";
import { asyncHandler } from "../middleware/error-handler";
```

### Lanzar Errores

```typescript
// Error básico
throw new NotFoundError("User not found");

// Error con código personalizado
throw new UnauthorizedError(
  "Invalid credentials",
  "invalid_credentials"
);

// Error con metadata
throw new BadRequestError(
  "Invalid payment method",
  "invalid_payment",
  { method: "crypto", supported: ["card", "paypal"] }
);
```

### Usar asyncHandler

El `asyncHandler` envuelve rutas async para capturar errores automáticamente:

```typescript
// ❌ SIN asyncHandler - necesitas try/catch
router.post("/users", async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.json(user);
  } catch (error) {
    // Manejo manual de errores
    res.status(500).json({ error: "Failed" });
  }
});

// ✅ CON asyncHandler - errores capturados automáticamente
router.post("/users", asyncHandler(async (req, res) => {
  const user = await createUser(req.body);
  res.json(user);
}));
```

## Ejemplos Prácticos

### Autenticación

```typescript
router.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new BadRequestError(
      "Username and password required",
      "missing_credentials"
    );
  }

  const user = await findUser(username);

  if (!user) {
    throw new UnauthorizedError(
      "Invalid credentials",
      "invalid_credentials"
    );
  }

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    throw new UnauthorizedError(
      "Invalid credentials",
      "invalid_credentials"
    );
  }

  const token = generateToken(user);
  res.json({ token });
}));
```

### CRUD Operations

```typescript
// GET - Recurso no encontrado
router.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.id);

  if (!user) {
    throw new NotFoundError("User not found", "user_not_found");
  }

  res.json(user);
}));

// POST - Conflicto (duplicado)
router.post("/users", asyncHandler(async (req, res) => {
  const { email } = req.body;

  const existing = await db.getUserByEmail(email);

  if (existing) {
    throw new ConflictError(
      "Email already in use",
      "email_exists",
      { email }
    );
  }

  const user = await db.createUser(req.body);
  res.json(user);
}));

// PATCH - Validación
router.patch("/users/:id", asyncHandler(async (req, res) => {
  const { age } = req.body;

  if (age && age < 18) {
    throw new ValidationError(
      "User must be 18 or older",
      "age_validation",
      { minAge: 18, provided: age }
    );
  }

  const user = await db.updateUser(req.params.id, req.body);
  res.json(user);
}));

// DELETE - Permisos
router.delete("/users/:id", asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const targetId = req.params.id;

  if (currentUser.role !== "admin" && currentUser.id !== targetId) {
    throw new ForbiddenError(
      "Not authorized to delete this user",
      "insufficient_permissions"
    );
  }

  await db.deleteUser(targetId);
  res.json({ success: true });
}));
```

### Servicios Externos

```typescript
router.post("/send-email", asyncHandler(async (req, res) => {
  const { to, subject, body } = req.body;

  try {
    await emailService.send(to, subject, body);
    res.json({ success: true });
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      throw new ServiceUnavailableError(
        "Email service temporarily unavailable",
        "email_service_down"
      );
    }
    throw error; // Re-lanzar otros errores
  }
}));
```

### Rate Limiting

```typescript
router.post("/api/generate-report", asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const requests = await redis.get(`reports:${userId}`);

  if (requests >= 10) {
    throw new TooManyRequestsError(
      "Report generation limit exceeded",
      "rate_limit_exceeded",
      { limit: 10, reset: Date.now() + 3600000 }
    );
  }

  const report = await generateReport(req.body);
  await redis.incr(`reports:${userId}`);

  res.json(report);
}));
```

## Respuestas de Error

### Formato de Respuesta

```json
{
  "error": "error_code",
  "message": "Human readable message",
  "details": {
    "key": "value"
  },
  "stack": "Error stack (solo en desarrollo)"
}
```

### Ejemplos de Respuestas

#### 400 Bad Request
```json
{
  "error": "missing_credentials",
  "message": "Username and password required"
}
```

#### 401 Unauthorized
```json
{
  "error": "invalid_credentials",
  "message": "Invalid username or password"
}
```

#### 404 Not Found
```json
{
  "error": "user_not_found",
  "message": "User not found"
}
```

#### 409 Conflict
```json
{
  "error": "email_exists",
  "message": "Email already in use",
  "details": {
    "email": "user@example.com"
  }
}
```

#### 422 Validation Error
```json
{
  "error": "age_validation",
  "message": "User must be 18 or older",
  "details": {
    "minAge": 18,
    "provided": 15
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

## Middleware de Error Global

### Configuración

En `server/index.ts`:

```typescript
import {
  errorHandler,
  notFoundHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler
} from "./middleware/error-handler";

// Al inicio del archivo (antes de crear app)
setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

// Al final, después de todas las rutas
app.use(notFoundHandler);  // Maneja rutas no encontradas
app.use(errorHandler);     // Maneja todos los errores
```

### Funcionalidad

1. **Captura todos los errores** lanzados en rutas
2. **Extrae información** (status, código, mensaje)
3. **Loggea el error** con contexto (path, method, user)
4. **Formatea respuesta** JSON consistente
5. **Incluye stack** solo en desarrollo

## Logging de Errores

Todos los errores se loggean automáticamente con contexto:

```typescript
logError("Invalid credentials", error, {
  statusCode: 401,
  errorCode: "invalid_credentials",
  path: "/api/auth/login",
  method: "POST",
  ip: "192.168.1.1",
  userId: "123"
});
```

Los logs incluyen:
- Mensaje del error
- Stack trace completo
- Código HTTP
- Endpoint afectado
- IP del cliente
- ID del usuario (si está autenticado)
- Metadata adicional

## Manejo de Excepciones No Capturadas

### Unhandled Rejections

Promesas rechazadas sin `.catch()`:

```typescript
// Se loggea y el error se propaga
Promise.reject(new Error("Unhandled!"));
```

### Uncaught Exceptions

Excepciones que escapan el event loop:

```typescript
// Se loggea, y si no es operacional, la app se cierra
throw new Error("Critical bug!");
```

### Errores Operacionales vs Programáticos

- **Operacional** (`isOperational: true`): Error esperado (ej: usuario no encontrado)
  - Se loggea
  - La app continúa

- **Programático** (`isOperational: false`): Bug en el código
  - Se loggea
  - La app se cierra (`process.exit(1)`)

## Mejores Prácticas

### ✅ DO

1. **Usa asyncHandler para rutas async**
   ```typescript
   router.get("/users", asyncHandler(async (req, res) => {
     // ...
   }));
   ```

2. **Lanza errores específicos**
   ```typescript
   if (!user) {
     throw new NotFoundError("User not found", "user_not_found");
   }
   ```

3. **Incluye metadata útil**
   ```typescript
   throw new ValidationError("Invalid age", "age_validation", {
     minAge: 18,
     provided: req.body.age
   });
   ```

4. **Usa códigos de error descriptivos**
   ```typescript
   throw new UnauthorizedError(
     "Token expired",
     "token_expired"
   );
   ```

5. **No expongas detalles sensibles**
   ```typescript
   // ✅ BIEN
   throw new UnauthorizedError("Invalid credentials");

   // ❌ MAL
   throw new UnauthorizedError("Password incorrect for user@example.com");
   ```

### ❌ DON'T

1. **No uses try/catch innecesariamente**
   ```typescript
   // ❌ MAL
   router.get("/users", asyncHandler(async (req, res) => {
     try {
       const users = await db.getUsers();
       res.json(users);
     } catch (error) {
       throw error; // asyncHandler ya hace esto
     }
   }));

   // ✅ BIEN
   router.get("/users", asyncHandler(async (req, res) => {
     const users = await db.getUsers();
     res.json(users);
   }));
   ```

2. **No captures todos los errores genéricamente**
   ```typescript
   // ❌ MAL
   try {
     // ...
   } catch (error) {
     throw new InternalServerError(); // Pierde contexto
   }

   // ✅ BIEN
   try {
     await externalService.call();
   } catch (error) {
     if (error.code === "TIMEOUT") {
       throw new ServiceUnavailableError("Service timeout");
     }
     throw error; // Re-lanzar si no sabes manejarlo
   }
   ```

3. **No envíes respuestas después de lanzar error**
   ```typescript
   // ❌ MAL
   if (!user) {
     res.status(404).json({ error: "Not found" });
     throw new NotFoundError("User not found");
   }

   // ✅ BIEN
   if (!user) {
     throw new NotFoundError("User not found");
   }
   ```

4. **No uses códigos HTTP incorrectos**
   ```typescript
   // ❌ MAL - 500 es para errores de servidor, no validación
   throw new InternalServerError("Invalid email");

   // ✅ BIEN
   throw new ValidationError("Invalid email format");
   ```

## Testing

### Test de Errores

```typescript
import { describe, it, expect } from "vitest";
import { NotFoundError, UnauthorizedError } from "./utils/errors";

describe("Error Handling", () => {
  it("should throw NotFoundError with correct status", () => {
    const error = new NotFoundError("Resource not found");

    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe("not_found");
    expect(error.message).toBe("Resource not found");
    expect(error.isOperational).toBe(true);
  });

  it("should include metadata", () => {
    const error = new UnauthorizedError(
      "Invalid token",
      "token_invalid",
      { tokenId: "123" }
    );

    expect(error.metadata).toEqual({ tokenId: "123" });
  });
});
```

### Test de Rutas con Errores

```typescript
describe("GET /users/:id", () => {
  it("should return 404 when user not found", async () => {
    const res = await request(app)
      .get("/users/nonexistent")
      .expect(404);

    expect(res.body).toEqual({
      error: "user_not_found",
      message: "User not found"
    });
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app)
      .get("/users/123")
      .expect(401);

    expect(res.body.error).toBe("unauthorized");
  });
});
```

## Monitoreo

### Métricas Recomendadas

- Errores por endpoint
- Errores por código de estado
- Tasa de errores 5xx vs 4xx
- Errores más frecuentes
- Tiempo de respuesta en errores

### Alertas

Configurar alertas para:
- Alta tasa de errores 500 (>1% de requests)
- Excepciones no capturadas
- Servicios externos caídos (503)
- Rate limits excedidos frecuentemente

## Troubleshooting

### Errores no capturados

Si ves errores que no pasan por el error handler:
1. Verifica que uses `asyncHandler` en rutas async
2. Revisa que `errorHandler` esté al final de las rutas
3. Confirma que lances errores con `throw`, no `return`

### Stack traces faltantes

Si no ves stack traces en desarrollo:
1. Verifica `NODE_ENV=development`
2. Revisa que el error tenga `.stack`
3. Confirma que uses `Error.captureStackTrace`

### App crashea inesperadamente

Si la app se cierra en producción:
1. Revisa `logs/exceptions.log`
2. Verifica errores programáticos (bugs)
3. Marca errores operacionales como `isOperational: true`

## Soporte

Para reportar problemas o agregar nuevos tipos de error:
1. Revisar `server/utils/errors.ts`
2. Agregar nueva clase extendiendo `AppError`
3. Documentar en esta guía
4. Agregar tests

---

**Última actualización:** 2025-10-30
