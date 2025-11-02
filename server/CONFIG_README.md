# ⚠️ Configuración Protegida del Servidor

## Archivo de Configuración Crítica

**Ubicación:** `/opt/flow-builder/server/config.ts`

Este archivo contiene configuraciones críticas que **NO deben ser modificadas** sin autorización explícita del administrador del sistema.

## Configuraciones Protegidas

### 1. REQUEST_BODY_SIZE_LIMIT

**Valor actual:** `2500mb` (2.5 GB)

**Propósito:** Define el tamaño máximo permitido para el cuerpo de las peticiones HTTP (tanto JSON como URL-encoded).

**Por qué es crítico:**
- Los flujos complejos con muchos nodos pueden generar payloads muy grandes
- Un valor muy bajo causará errores `request entity too large` (HTTP 413)
- Los usuarios no podrán guardar sus flujos si el límite es insuficiente

**Historial de cambios:**
- 2025-10-31: Configurado a 2500mb para soportar flujos grandes

### Modificar esta configuración

Si necesitas modificar el límite de tamaño:

1. **Edita SOLO el archivo** `server/config.ts`
2. **NO modifiques** directamente `server/index.ts`
3. **Considera el impacto:**
   - ¿Hay flujos existentes que podrían exceder el nuevo límite?
   - ¿La configuración de nginx también necesita ajuste?
4. **Verifica la configuración de nginx:**
   - Archivo: `/etc/nginx/sites-enabled/000-wsp.azaleia.com.pe.conf`
   - Parámetro: `client_max_body_size`
   - Debe ser mayor o igual al límite de Express

## Protecciones Implementadas

### Validación en el inicio del servidor

Al arrancar el servidor, se ejecuta `validateConfig()` que:
- Verifica que el límite no sea menor a 2500mb
- Muestra advertencias en consola si detecta valores incorrectos
- No detiene el servidor, pero alerta fuertemente del problema

### Código protegido en index.ts

El archivo `server/index.ts` importa la configuración desde `config.ts`:

```typescript
import { REQUEST_BODY_SIZE_LIMIT, validateConfig } from "./config";

// Validación automática al inicio
validateConfig();

// Uso de la configuración protegida
app.use(express.json({ limit: REQUEST_BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_SIZE_LIMIT }));
```

## Verificación de la Configuración

Para verificar que la configuración está correcta:

```bash
# Ver el valor actual
grep "REQUEST_BODY_SIZE_LIMIT" /opt/flow-builder/server/config.ts

# Ver los logs del servidor al iniciar
pm2 logs bot-ai --lines 50
```

Si ves advertencias como esta en los logs, **la configuración necesita ser corregida**:

```
═════════════════════════════════════════════════════════════════════════════════
⚠️  ERROR CRÍTICO DE CONFIGURACIÓN ⚠️
═════════════════════════════════════════════════════════════════════════════════
El REQUEST_BODY_SIZE_LIMIT ha sido modificado a un valor inválido.
...
```

## Contacto

Para modificaciones a esta configuración, contacta al administrador del sistema.

**Última actualización:** 2025-10-31
