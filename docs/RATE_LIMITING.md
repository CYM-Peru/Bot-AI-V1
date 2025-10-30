# Rate Limiting Implementation

## Overview

Se ha implementado rate limiting en el servidor para proteger contra ataques de fuerza bruta y abuso de recursos.

## Configuración

### Tipos de Rate Limiters

El sistema utiliza diferentes limitadores según el tipo de endpoint:

#### 1. Auth Limiter (`authLimiter`)
**Aplicado a:** Endpoints de autenticación (login, cambio de contraseña)
- **Ventana:** 15 minutos
- **Límite:** 5 intentos por IP
- **Propósito:** Prevenir ataques de fuerza bruta en credenciales

**Endpoints protegidos:**
- `POST /api/auth/login`
- `POST /api/auth/change-password`

#### 2. API Limiter (`apiLimiter`)
**Aplicado a:** Endpoints generales de la API
- **Ventana:** 15 minutos
- **Límite:** 100 requests por IP
- **Propósito:** Prevenir abuso general de la API

**Endpoints protegidos:**
- Todas las rutas bajo `/api` (protegidas con autenticación)

#### 3. Webhook Limiter (`webhookLimiter`)
**Aplicado a:** Webhook de WhatsApp
- **Ventana:** 1 minuto
- **Límite:** 60 requests por minuto (promedio de 1/segundo)
- **Propósito:** Prevenir abuso del webhook sin bloquear tráfico legítimo de Meta

**Endpoints protegidos:**
- `ALL /api/meta/webhook`

#### 4. Flow Limiter (`flowLimiter`)
**Aplicado a:** Operaciones de creación/actualización de flujos
- **Ventana:** 15 minutos
- **Límite:** 30 operaciones por IP
- **Propósito:** Prevenir abuso de operaciones costosas en recursos

**Endpoints protegidos:**
- `POST /api/flows/:flowId`

## Respuestas de Rate Limit

Cuando se excede el límite, el servidor responde con:

```json
{
  "error": "Too many requests from this IP. Please try again later."
}
```

Status HTTP: `429 Too Many Requests`

## Headers de Rate Limit

El servidor incluye headers estándar con información del rate limit:

- `RateLimit-Limit`: Número máximo de requests permitidos
- `RateLimit-Remaining`: Número de requests restantes
- `RateLimit-Reset`: Timestamp cuando se resetea el contador

## Configuración Avanzada

Para modificar los límites, edita el archivo `/server/middleware/rate-limit.ts`:

```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Ajustar ventana de tiempo
  max: 5, // Ajustar número máximo de requests
  // ...
});
```

## Consideraciones de Producción

### IP Detrás de Proxies

✅ **YA CONFIGURADO**: El servidor está configurado con `app.set('trust proxy', 1)` para funcionar correctamente detrás de Nginx/load balancers.

Esto es **CRÍTICO** porque:
- Sin esto, todos los usuarios comparten el mismo límite (la IP del proxy)
- Con esto, cada usuario tiene su propio límite basado en su IP real
- Express lee correctamente el header `X-Forwarded-For`

**Configuración actual en `server/index.ts`:**
```typescript
app.set('trust proxy', 1);
```

**Importante**: Si tienes múltiples niveles de proxies, ajusta el número (ej: `2` para proxy + CDN).

### Rate Limiting Distribuido

La implementación actual usa almacenamiento en memoria. Para ambientes con múltiples instancias del servidor, considera usar un store externo:

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL
});

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client,
    prefix: 'rate_limit:',
  }),
  // ...
});
```

## Testing

Para verificar que el rate limiting funciona:

1. Hacer múltiples requests al endpoint de login:
```bash
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
  echo ""
done
```

2. Los primeros 5 deberían funcionar (401 si credenciales inválidas)
3. Del 6 en adelante deberían retornar 429

## Mantenimiento

- **Monitorear** logs de rate limit para detectar patrones de abuso
- **Ajustar** límites según necesidades de tráfico legítimo
- **Considerar** whitelist para IPs confiables si es necesario
