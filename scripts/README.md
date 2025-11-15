# 🛠️ Scripts de Mantenimiento

Esta carpeta contiene scripts para detectar y corregir errores comunes automáticamente.

## 📋 Scripts Disponibles

### 1. `pre-deploy-check.ts` - Verificación Pre-Despliegue
Detecta errores comunes antes del despliegue:
- ❌ Errores de compilación TypeScript
- ❌ Llamadas a métodos async sin `await`
- ⚠️ Acceso a propiedades potencialmente indefinidas

**Uso:**
```bash
npm run check
```

**Ejemplo de salida:**
```
🚀 Running pre-deployment checks...
✅ TypeScript compilation passed
❌ Found 60 missing await statements
⚠️  Found 89 potential issues
❌ Pre-deployment checks FAILED
```

---

### 2. `auto-fix-awaits.ts` - Corrección Automática de Awaits
Detecta y **corrige automáticamente**:
- ✅ Llamadas a métodos async sin `await`
- ✅ Funciones que necesitan ser `async` (route handlers, métodos de clase, funciones arrow)

**Uso:**
```bash
npm run check:fix
```

**Ejemplo de salida:**
```
🔧 Auto-fixing missing await statements...

📝 Fixed: server/crm/routes/conversations.ts
  ✅ Line 948: Added await for getConversationById()
  🔧 Line 947: Made route handler async
  ✅ Line 960: Added await for getConversationById()

📝 Fixed: server/crm/ws.ts
  ✅ Line 320: Added await for getConversationById()
  🔧 Line 313: Made method async

============================================================
✅ Fixed 46 missing await statements in 9 files
✅ Made 12 functions async
============================================================
```

---

### 3. `check-async-calls.sh` - Verificación Bash (Legacy)
Script bash para verificar llamadas async (reemplazado por `pre-deploy-check.ts`)

---

## 🔄 Integración con Build

El script `auto-fix-awaits.ts` se ejecuta **automáticamente** antes de cada build:

```json
{
  "scripts": {
    "prebuild": "npm run check:fix",
    "build": "tsc -b && vite build"
  }
}
```

Esto significa que **cada vez que ejecutas `npm run build`**:
1. Se detectan y corrigen errores de `await` automáticamente
2. Se verifica que TypeScript compile correctamente
3. Se construye el proyecto

---

## 🎯 Métodos Detectados

Los scripts detectan las siguientes llamadas que requieren `await`:

### PostgreSQL CRM Database:
- `listConversations()`
- `getAllConversations()`
- `getConversationById()`
- `getConversationByPhoneAndChannel()`
- `createConversation()`
- `updateConversationMeta()`
- `appendMessage()`
- `acceptConversation()`
- `assignConversation()`
- `archiveConversation()`
- `unarchiveConversation()`
- `deleteConversation()`
- `getMessages()`
- `deleteMessage()`
- `addAdvisorToAttendedBy()`
- `updateMessage()`
- `markAsRead()`
- `markConversationRead()`
- `releaseConversation()`
- `listMessages()`
- `getAttachment()`
- `linkAttachmentToMessage()`
- `updateMessageStatus()`

---

## 📝 Ejemplos de Corrección

### Ejemplo 1: Agregar await
**Antes:**
```typescript
const conversation = crmDb.getConversationById(id);
```

**Después (auto-corregido):**
```typescript
const conversation = await crmDb.getConversationById(id);
```

### Ejemplo 2: Hacer función async (Route handler)
**Antes:**
```typescript
router.post("/:id/release", (req, res) => {
  const conversation = await crmDb.getConversationById(req.params.id);
  // ...
});
```

**Después (auto-corregido):**
```typescript
router.post("/:id/release", async (req, res) => {
  const conversation = await crmDb.getConversationById(req.params.id);
  // ...
});
```

### Ejemplo 3: Hacer método async (Clase)
**Antes:**
```typescript
private handleReadCommand(client: ClientContext, payload: ReadPayload) {
  const conversation = await crmDb.getConversationById(payload.convId);
  // ...
}
```

**Después (auto-corregido):**
```typescript
private async handleReadCommand(client: ClientContext, payload: ReadPayload) {
  const conversation = await crmDb.getConversationById(payload.convId);
  // ...
}
```

---

## ⚠️ Notas Importantes

1. **Archivos excluidos**: Los scripts NO modifican `db-postgres.ts` ni `db.ts` (definiciones de los métodos)
2. **Comentarios**: Las líneas comentadas se ignoran
3. **Revisión manual**: Siempre revisa los cambios después de la corrección automática
4. **Tests**: Ejecuta tests después de aplicar correcciones: `npm test`

---

## 🚀 Workflow Recomendado

```bash
# 1. Detectar errores
npm run check

# 2. Corregir automáticamente
npm run check:fix

# 3. Revisar cambios
git diff

# 4. Ejecutar tests
npm test

# 5. Build final
npm run build
```

---

## 🔧 Personalización

Para agregar más métodos a la detección, edita el array `asyncMethods` en:
- `scripts/auto-fix-awaits.ts` (línea 10)
- `scripts/pre-deploy-check.ts` (línea 65)

```typescript
const asyncMethods = [
  'tuMetodoAsync',
  'otroMetodoAsync',
  // ...
];
```

---

## 📊 Estadísticas

En la última ejecución:
- ✅ **46 errores** detectados y corregidos automáticamente
- 📁 **9 archivos** modificados
- ⚡ **100% de éxito** en la corrección

---

**Creado:** 2025-11-08
**Última actualización:** 2025-11-08
