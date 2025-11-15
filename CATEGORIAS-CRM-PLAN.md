# Plan de Implementación: Sistema de 5 Categorías para CRM

**Fecha de coordinación:** 2025-11-09
**Estado:** Planificado - NO IMPLEMENTADO AÚN

## Estructura de Categorías (Orden de Pestañas)

### 1. MASIVOS 🔴
**Visibilidad:** Solo Admin y Supervisor
**Color:** Rojo mate (#EF4444 o similar)
**Icono:** broadcast / megaphone
**Descripción:** Chats que recibieron campaña masiva

**Lógica:**
- Chats que tienen `campaignId` != null
- Estado: `closed` (permanecen cerrados después de envío)
- Si el cliente responde: el chat sale de MASIVOS y sigue flujo normal (bot/cola)

### 2. EN COLA / BOT 🟡
**Visibilidad:** Todos
**Color:** Amarillo/naranja mate (#F59E0B o similar)
**Icono:** clock / users
**Descripción:** Chats en cola o con bot

**Lógica:**
- Chats sin asesor asignado (`assignedTo` == null)
- Puede estar en cola (`queueId` != null) o con bot
- Status: `active`

### 3. POR TRABAJAR 🔵
**Visibilidad:** Todos
**Color:** Azul mate (ya tiene: #3B82F6)
**Icono:** inbox
**Descripción:** Chats asignados esperando aceptación

**Lógica:**
- Chats CON asesor asignado (`assignedTo` != null)
- Pero NO aceptados todavía (`status` == "active")
- Asesor debe aceptar para mover a "Trabajando"

### 4. TRABAJANDO 🟢
**Visibilidad:** Todos
**Color:** Verde mate (ya tiene: #10B981)
**Icono:** message-circle
**Descripción:** Chats aceptados en atención

**Lógica:**
- Chats aceptados por asesor (`status` == "attending")
- Asesor asignado (`assignedTo` != null)
- En atención activa

### 5. FINALIZADOS ⚫
**Visibilidad:** Todos
**Color:** Gris mate (ya tiene: #6B7280)
**Icono:** archive
**Descripción:** Chats cerrados o archivados

**Lógica:**
- Status: `closed` o `archived`
- NO son de campaña masiva (esos van a MASIVOS)

---

## Reglas Importantes

### ✅ Un chat solo puede estar en UNA categoría a la vez

**Prioridad de categorización (de mayor a menor):**
1. Si tiene `campaignId` Y está cerrado → **MASIVOS**
2. Si no tiene asesor asignado → **EN COLA / BOT**
3. Si tiene asesor pero no aceptó → **POR TRABAJAR**
4. Si asesor aceptó → **TRABAJANDO**
5. Si está cerrado/archivado (sin campaignId) → **FINALIZADOS**

### 📤 Envío de Campañas Masivas

**Validaciones necesarias:**
- ✅ Solo enviar a contactos con chat CERRADO
- ❌ NO enviar si el contacto tiene chat ACTIVO (status != "closed")
- ✅ Crear campo `campaignId` en la conversación al enviar
- ✅ Chat permanece cerrado después del envío
- ✅ Si cliente responde: chat se abre normalmente y sigue flujo bot/cola

---

## Campos de Base de Datos

### Campo nuevo requerido: `campaignId`

```typescript
interface Conversation {
  // ... campos existentes ...
  campaignId?: string;  // ID de la campaña masiva (si aplica)
}
```

**Uso:**
- `null` o `undefined`: Chat normal
- `"campaign-123"`: Chat creado/enviado desde campaña masiva

---

## Implementación Técnica

### 1. Backend - Base de Datos
- [ ] Agregar campo `campaignId` al schema de PostgreSQL
- [ ] Migración para agregar columna (nullable)

### 2. Backend - Campañas
- [ ] Modificar endpoint de envío de campañas
- [ ] Validar que chat NO esté activo antes de enviar
- [ ] Asignar `campaignId` al crear/actualizar conversación

### 3. Backend - Categorías
- [ ] Actualizar `/opt/flow-builder/data/admin/categories.json`
- [ ] Agregar categorías "MASIVOS" y "EN COLA / BOT"
- [ ] Modificar "POR TRABAJAR" para nueva lógica

### 4. Frontend - Filtros
- [ ] Actualizar lógica de filtrado en `ConversationList.tsx`
- [ ] Implementar filtro de visibilidad (MASIVOS solo admin/supervisor)
- [ ] Actualizar contadores por categoría

### 5. Frontend - UI
- [ ] Actualizar colores a tonos mate
- [ ] Agregar iconos nuevos
- [ ] Mostrar/ocultar pestaña MASIVOS según rol

---

## Notas Adicionales

- **Colores mate:** Usar tonos menos brillantes/saturados para mejor visualización
- **Rol actual del usuario:** Verificar `user.role === "admin" || user.role === "supervisor"` para mostrar MASIVOS
- **Backward compatibility:** Chats existentes sin `campaignId` funcionan normal
- **Testing:** Probar con campaña real antes de producción

---

## Estado de Implementación

**Fecha:** 2025-11-09
**Implementado:** ❌ NO
**Próximos pasos:** Esperar aprobación final y comenzar implementación

---

## Estado Actual del Sistema (9 Nov 2025 - 18:30)

### Conversaciones Totales
- **Total:** 937 conversaciones
- **Activas:** 45 (sin cerrar/archivar)
- **Finalizadas:** 892 (closed + archived)

### Distribución Actual por Estado
**EN COLA / BOT:** 34 chats (sin asesor asignado)
- Cola ATC: 14 chats
- Sin cola (bot): 12 chats
- Cola Reclamos: 8 chats

**POR TRABAJAR:** 11 chats (asignados, no aceptados)
- TODOS asignados a Angela (user-1761954617719)
- TODOS en cola Reclamos (queue-1762356569837)

**TRABAJANDO:** 0 chats

**FINALIZADOS:** 892 chats

---

## ⚠️ PROBLEMA CRÍTICO DETECTADO

### Número 961842916 sin cola correcta
**Situación:**
- El número **+51 961 842 916** ("Promotoras catálogos") está configurado para ir a cola **Counter**
- Pero los chats existentes están en **Reclamos** o **sin cola**
- Los chats nuevos desde el sábado 6 PM NO tienen cola asignada (están con bot en el limbo)

**Chats afectados:**
- 19 chats activos en cola Reclamos (deberían estar en Counter)
- 12 chats sin cola (deberían estar en Counter)

**Causa:** Cuando se cambia la cola de un número, los chats existentes NO se actualizan automáticamente.

**Solución pendiente:** Mover todos los chats del número 961842916 a la cola Counter

---

## 📊 Chats en Ventana de 24h (Hasta Mañana 11 AM)

**Total:** 7 chats activos sin asignar que pueden responderse sin plantilla

| Teléfono | Número Destino | Cola | Último Mensaje | Horas Restantes |
|----------|---------------|------|----------------|-----------------|
| 51943860949 | 961842916 | Sin cola | Hoy 18:21 | 16.6h ✅ |
| 51972195947 | 5116193636 | ATC | Hoy 17:42 | 17.3h ✅ |
| 51948003892 | 961842916 | Sin cola | Hoy 14:43 | 20.3h ✅ |
| 59174326765 | 961842916 | Sin cola | Hoy 13:56 | 21.1h ✅ |
| 51994927038 | 966748784 | ATC | Hoy 13:09 | 21.8h ✅ |
| 51922878706 | 5116193636 | ATC | Hoy 12:13 | 22.8h ✅ |
| 51975002601 | 961842916 | Sin cola | Hoy 11:46 | 23.2h ⚠️ |

**Nota:** Los otros 27 chats activos sin asignar ya están fuera de ventana y requieren plantillas.

---

## 📝 Mensajes del Sistema - Estandarización

### Mensajes Actuales a Reemplazar

**PROBLEMA:** Inconsistencia total en mensajes de asignación (10+ variantes diferentes)
- 🎯 Chat nuevo - Asignado automáticamente a: Rosario
- 🎯 Conversación asignada automáticamente a: Angela
- 🎯 Asignado automáticamente a: Ana
- ✅ Asignado automáticamente a asesor ATC
- etc...

### ✅ Mensajes Estandarizados Aprobados

#### 1. Asignación a Asesor Específico
```
🎯 Asignado automáticamente a [Nombre Asesor]
```
Ejemplo: `🎯 Asignado automáticamente a Ana Ortíz`

#### 2. Chat en Cola (Sin Asesor Aún)
```
⏳ En cola [Nombre Cola] - Esperando asignación
```
Ejemplo: `⏳ En cola ATC - Esperando asignación`

#### 3. Asesor Acepta
```
✅ [Nombre Asesor] aceptó la conversación
```

#### 4. Asesor Cierra
```
📁 Conversación cerrada por [Nombre Asesor]
```

#### 5. Transferencia Entre Asesores
```
🔀 [Origen] transfirió a [Destino]
```

#### 6. Bot Transfiere a Cola
```
🤖 Bot derivó a cola [Nombre Cola]
```

#### 7. Cierre por Ventana 24h
```
🗄️ Chat cerrado automáticamente - Ventana de 24h expirada
```
*Cuando cliente inactivo > 24 horas*

#### 8. Bot Cierra (Opción del Cliente)
```
🤖 Conversación cerrada por el bot
```
*Cuando cliente selecciona opción de cierre en menú*

#### 9. Cierre por Inactividad en Menú
```
⏱️ Chat cerrado - Cliente no respondió al menú
```

---

## ✅ Funciones NO Solicitadas - YA ELIMINADAS

### 1. Cliente Recurrente (RE-ASIGNACIÓN AUTOMÁTICA)
- **Estado:** ❌ ELIMINADO
- Mensaje viejo: "🔄 Cliente recurrente - Re-asignado automáticamente a: [Asesor]"
- Solo existe en archivos `.backup`
- **No requiere acción**

### 2. Limpieza Programada del Sistema
- **Estado:** ❌ ELIMINADO
- Mensaje viejo: "✅ Conversación cerrada automáticamente por limpieza del sistema"
- No existe en código actual
- **No requiere acción**

---

## Configuración de Colas

### Cola Counter (queue-1761859362582)
**Asesores:** Ana, Martha, Carlos
**Número asignado:** +51 961 842 916 ("Promotoras catálogos")
**Modo:** Round Robin

### Cola ATC (queue-1761859343408)
**Asesores:** Rosario, Angela
**Número asignado:** +51 1 6193636 ("General")
**Modo:** Round Robin

### Cola Prospectos (queue-1762287006531)
**Asesores:** Carlos
**Número asignado:** +51 966748784 ("Prospectos catálogos")
**Modo:** Round Robin

### Cola Reclamos (queue-1762356569837)
**Asesores:** Rosario, Angela
**Número asignado:** Ninguno (provisional/catálogo)
**Modo:** Round Robin

---

**IMPORTANTE:** Esta es la coordinación acordada. NO modificar sin consultar primero.
