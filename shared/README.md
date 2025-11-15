# 📋 Reglas Compartidas del Sistema

## ¿Qué es esta carpeta?

Esta carpeta contiene **LÓGICA COMPARTIDA** entre el backend y el frontend.

## 🎯 Objetivo

**Evitar desincronización** entre cómo el backend procesa datos y cómo el frontend los muestra.

## 📁 Archivos

### `conversation-rules.ts`

**ÚNICA FUENTE DE VERDAD** para la lógica de categorización de conversaciones.

#### Funciones disponibles:

1. **`getConversationCategory(conv)`**
   - Determina en qué categoría va una conversación
   - Categorías: `MASIVOS`, `EN_COLA_BOT`, `POR_TRABAJAR`, `TRABAJANDO`, `FINALIZADOS`
   - **Usado por:**
     - Frontend: `src/crm/ConversationList.tsx` (para mostrar categorías)
     - Backend: Puede usarse en reportes/estadísticas

2. **`isBotActive(conv)`**
   - Verifica si el bot está atendiendo activamente
   - Retorna `true` si: `status='active'` + `assignedTo='bot'` + `botFlowId != null`

3. **`isInQueue(conv)`**
   - Verifica si está en cola sin asignar
   - Retorna `true` si: `status='active'` + sin `assignedTo` + sin `botFlowId`

4. **`isAssignedToHuman(conv)`**
   - Verifica si tiene asesor humano asignado
   - Retorna `true` si: `assignedTo != null` y `assignedTo != 'bot'`

5. **`canBeAutoAssigned(conv)`**
   - Verifica si QueueDistributor puede asignar
   - Retorna `true` si: `status='active'` + sin `assignedTo` + sin `botFlowId`
   - **Usado por:**
     - Backend: `server/queue-distributor.ts` (filtro de conversaciones)

6. **`canBotTakeControl(conv)`**
   - Verifica si el bot puede tomar control
   - Retorna `true` si: está archivado O (activo sin asesor humano)
   - **Usado por:**
     - Backend: `server/index.ts` (en resolveFlow)

## ⚠️ REGLAS IMPORTANTES

### ❌ NO HACER:

```typescript
// ❌ MAL: Duplicar lógica en otros archivos
if (conv.status === 'active' && !conv.assignedTo) {
  // Esta lógica ya existe en conversation-rules.ts
}
```

### ✅ HACER:

```typescript
// ✅ BIEN: Importar y usar función compartida
import { isInQueue } from '../shared/conversation-rules';

if (isInQueue(conv)) {
  // Usar función compartida
}
```

## 🔄 Flujo de Trabajo

### Cuando necesitas agregar/modificar lógica de categorización:

1. **Paso 1**: Modificar `/shared/conversation-rules.ts`
2. **Paso 2**: Verificar que backend use la función actualizada
3. **Paso 3**: Verificar que frontend use la función actualizada
4. **Paso 4**: Compilar y probar

### Ejemplo de cambio correcto:

**Antes (MALO - lógica duplicada):**
```typescript
// server/index.ts
if (conv.assignedTo && conv.assignedTo !== 'bot') { ... }

// src/crm/ConversationList.tsx
if (conv.assignedTo && conv.assignedTo !== 'bot') { ... }
```

**Después (BIEN - función compartida):**
```typescript
// shared/conversation-rules.ts
export function isAssignedToHuman(conv) {
  return conv.assignedTo !== null && conv.assignedTo !== 'bot';
}

// server/index.ts
import { isAssignedToHuman } from '../shared/conversation-rules';
if (isAssignedToHuman(conv)) { ... }

// src/crm/ConversationList.tsx
import { isAssignedToHuman } from '../../shared/conversation-rules';
if (isAssignedToHuman(conv)) { ... }
```

## 📊 Dónde se usa actualmente:

### Backend:
- `server/index.ts` (línea ~344): `canBotTakeControl()`
- `server/queue-distributor.ts` (línea ~103): `canBeAutoAssigned()`

### Frontend:
- `src/crm/ConversationList.tsx` (línea ~491): `getConversationCategory()`

## 🚨 Beneficios:

1. ✅ **Sincronización garantizada**: Backend y frontend usan la misma lógica
2. ✅ **Mantenimiento fácil**: Cambiar en un solo lugar
3. ✅ **Menos bugs**: No más desincronizaciones
4. ✅ **Código DRY**: Don't Repeat Yourself

## 📝 Notas:

- Este archivo es TypeScript puro (sin dependencias de React o Express)
- Puede ser importado tanto en frontend como en backend
- Todas las funciones son puras (sin efectos secundarios)
- Bien documentadas con comentarios JSDoc
