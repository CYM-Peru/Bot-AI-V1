# Sistema de Validación y Sanitización de Inputs

## Overview

Se ha implementado un sistema robusto de validación de inputs usando **Zod** para prevenir:
- ✅ Inyecciones SQL/NoSQL
- ✅ Cross-Site Scripting (XSS)
- ✅ Datos malformados
- ✅ Tipos incorrectos
- ✅ Valores fuera de rango

## Arquitectura

### Componentes

```
server/
├── middleware/
│   └── validation.ts          # Middleware genérico de validación
└── validation/
    ├── auth.schemas.ts        # Schemas para autenticación
    └── flow.schemas.ts        # Schemas para flujos
```

## Uso del Middleware

### Validación Básica

```typescript
import { validate } from "./middleware/validation";
import { loginSchema } from "./validation/auth.schemas";

router.post("/login", validate(loginSchema), async (req, res) => {
  // req.body ya está validado y sanitizado
  const { username, password } = req.body;
  // ...
});
```

### Validar Múltiples Partes del Request

```typescript
const schema = {
  body: z.object({ name: z.string() }),
  params: z.object({ id: z.string() }),
  query: z.object({ page: z.number() }),
};

router.post("/items/:id", validate(schema), handler);
```

## Schemas Disponibles

### Autenticación (`auth.schemas.ts`)

#### Login
```typescript
POST /api/auth/login
Body: {
  username: string (3-30 chars, alfanumérico),
  password: string (6-100 chars)
}
```

#### Cambio de Contraseña
```typescript
POST /api/auth/change-password
Body: {
  currentPassword: string (6-100 chars),
  newPassword: string (6-100 chars)
}
```

#### Actualizar Perfil
```typescript
PATCH /api/auth/profile
Body: {
  name?: string (sanitizado),
  email?: string (formato válido)
}
```

### Flujos (`flow.schemas.ts`)

#### Guardar Flow
```typescript
POST /api/flows/:flowId
Params: {
  flowId: string (alfanumérico con guiones)
}
Body: {
  id: string,
  name: string (1-100 chars, sanitizado),
  nodes: array,
  edges: array,
  description?: string (max 500 chars),
  version?: string,
  tags?: string[]
}
```

#### Obtener Flow
```typescript
GET /api/flows/:flowId
Params: {
  flowId: string (alfanumérico con guiones)
}
```

## Sanitización Automática

### Strings
El `sanitizeString` remueve automáticamente:
- Tags HTML (`<`, `>`)
- URLs javascript: (`javascript:`)
- Event handlers (`onclick=`, `onerror=`, etc)

```typescript
Input:  "<script>alert('xss')</script>Hello"
Output: "scriptalert('xss')/scriptHello"
```

### Emails
- Convierte a minúsculas
- Valida formato RFC 5322
- Previene emails mal formados

### Usernames
- Solo permite: letras, números, guiones y guiones bajos
- Longitud: 3-30 caracteres
- Case-sensitive

### Passwords
- Longitud mínima: 6 caracteres
- Longitud máxima: 100 caracteres
- Sin restricciones de complejidad (puede agregarse)

## Respuestas de Error

### Validación Fallida (400)

```json
{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": [
    {
      "field": "username",
      "message": "Username must be at least 3 characters",
      "code": "too_small"
    },
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_string"
    }
  ]
}
```

### Error Interno (500)

```json
{
  "error": "internal_error",
  "message": "Validation failed"
}
```

## Crear Nuevos Schemas

### 1. Definir el Schema

```typescript
// server/validation/myfeature.schemas.ts
import { z } from "zod";
import { sanitizeString } from "../middleware/validation";

export const createItemSchema = z.object({
  body: z.object({
    name: sanitizeString.min(1, "Name is required").max(100),
    price: z.number().positive("Price must be positive"),
    category: z.enum(["food", "tech", "other"]),
  }),
});
```

### 2. Aplicar al Endpoint

```typescript
import { validate } from "./middleware/validation";
import { createItemSchema } from "./validation/myfeature.schemas";

router.post("/items", validate(createItemSchema), async (req, res) => {
  // Los datos ya están validados
  const { name, price, category } = req.body;
  // ...
});
```

## Validaciones Comunes

### Números
```typescript
z.number()
  .int("Must be integer")
  .positive("Must be positive")
  .min(1, "Min value is 1")
  .max(100, "Max value is 100")
```

### Strings
```typescript
z.string()
  .min(3, "Too short")
  .max(50, "Too long")
  .regex(/^[a-z]+$/, "Only lowercase letters")
  .email("Invalid email")
  .url("Invalid URL")
  .uuid("Invalid UUID")
```

### Enums
```typescript
z.enum(["admin", "user", "guest"], {
  errorMap: () => ({ message: "Invalid role" })
})
```

### Arrays
```typescript
z.array(z.string())
  .min(1, "At least one item required")
  .max(10, "Max 10 items")
```

### Objetos Anidados
```typescript
z.object({
  user: z.object({
    name: z.string(),
    age: z.number()
  }),
  settings: z.object({
    theme: z.enum(["light", "dark"])
  })
})
```

### Opcionales
```typescript
z.object({
  name: z.string(),              // Requerido
  email: z.string().optional(),  // Opcional
  age: z.number().nullable(),    // Puede ser null
})
```

### Validaciones Personalizadas
```typescript
z.string()
  .refine((val) => val.length > 0, {
    message: "Cannot be empty"
  })
  .refine(async (val) => await checkUnique(val), {
    message: "Must be unique"
  })
```

## Mejores Prácticas

### ✅ DO

1. **Siempre valida inputs de usuario**
   ```typescript
   router.post("/api/items", validate(schema), handler);
   ```

2. **Usa sanitizeString para texto libre**
   ```typescript
   const nameSchema = sanitizeString.min(1).max(100);
   ```

3. **Sé específico con mensajes de error**
   ```typescript
   z.string().min(3, "El nombre debe tener al menos 3 caracteres")
   ```

4. **Valida tipos de datos**
   ```typescript
   z.number().int().positive()  // No solo z.number()
   ```

5. **Limita tamaños de arrays**
   ```typescript
   z.array(z.string()).max(100)  // Previene DoS
   ```

### ❌ DON'T

1. **No confíes en validación del frontend**
   ```typescript
   // ❌ MAL
   const { email } = req.body; // Sin validar

   // ✅ BIEN
   router.post("/api/user", validate(schema), handler);
   ```

2. **No uses regex complejos sin testear**
   ```typescript
   // ❌ MAL - propenso a ReDoS
   z.string().regex(/^(a+)+$/)

   // ✅ BIEN
   z.string().regex(/^[a-zA-Z0-9_-]+$/)
   ```

3. **No expongas detalles internos en errores**
   ```typescript
   // ❌ MAL
   res.status(400).json({ error: error.stack })

   // ✅ BIEN
   res.status(400).json({ error: "validation_error", details })
   ```

## Testing

### Test de Validación

```typescript
import { describe, it, expect } from "vitest";
import { loginSchema } from "./auth.schemas";

describe("Login Schema", () => {
  it("should accept valid credentials", () => {
    const result = loginSchema.body.safeParse({
      username: "testuser",
      password: "password123"
    });
    expect(result.success).toBe(true);
  });

  it("should reject short username", () => {
    const result = loginSchema.body.safeParse({
      username: "ab",
      password: "password123"
    });
    expect(result.success).toBe(false);
  });
});
```

## Monitoreo

### Logs de Validación

Los errores de validación se registran automáticamente:

```
[Validation] Unexpected error: <details>
```

### Métricas Recomendadas

- Número de errores de validación por endpoint
- Campos que fallan con más frecuencia
- Tipos de errores más comunes

## Seguridad

### Prevención de Ataques

#### XSS (Cross-Site Scripting)
```typescript
// Entrada: <script>alert('xss')</script>
// Salida: scriptalert('xss')/script
sanitizeString.parse(input);
```

#### SQL Injection
```typescript
// Entrada: "admin' OR '1'='1"
// Salida: Error de validación (contiene caracteres inválidos)
usernameSchema.parse(input);
```

#### NoSQL Injection
```typescript
// Entrada: { $gt: "" }
// Salida: Error de validación (esperaba string, recibió object)
z.string().parse(input);
```

#### Path Traversal
```typescript
// Entrada: "../../../etc/passwd"
// Salida: Error de validación (contiene caracteres inválidos)
flowIdSchema.parse(input);
```

## Extensiones Futuras

### Posibles Mejoras

1. **Validación más estricta de passwords**
   - Requerir mayúsculas, minúsculas, números
   - Verificar contra diccionario de passwords comunes
   - Validar similitud con username

2. **Rate limiting por validación fallida**
   - Limitar intentos con datos inválidos
   - Prevenir ataques de fuerza bruta en validación

3. **Logs estructurados**
   - Integrar con sistema de logging
   - Alertas automáticas para patrones sospechosos

4. **Validación de archivos**
   - Tipo MIME real (no solo extensión)
   - Tamaño máximo
   - Escaneo de virus

5. **Sanitización más agresiva**
   - HTML sanitizer completo (DOMPurify)
   - Markdown sanitizer
   - SQL escape automático

## Soporte

Para agregar nuevas validaciones o reportar problemas:
1. Crear schema en `/server/validation/`
2. Aplicar middleware a endpoint
3. Documentar aquí
4. Agregar tests

---

**Última actualización:** 2025-10-30
