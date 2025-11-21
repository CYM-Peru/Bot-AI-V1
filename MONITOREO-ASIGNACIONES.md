# 📊 Guía de Monitoreo - Servicios de Asignación

## 🎯 Dos Servicios en Paralelo

### 🔵 QueueDistributor (VIEJO)
- **Estrategia:** Polling cada 10 segundos
- **Ventaja:** Respaldo - asigna chats si el nuevo falla
- **Desventaja:** Ineficiente, puede tener race conditions

### 🟢 QueueAssignmentService (NUEVO)
- **Estrategia:** Event-driven (reactivo)
- **Ventaja:** Instantáneo, eficiente, sin race conditions
- **Desventaja:** Más complejo

---

## 🔍 Cómo Distinguir en los Logs

### QueueDistributor (VIEJO)

**Patrón típico - cada 10 segundos:**
```
Nov 21 01:50:07 [QueueDistributor] 🎯 Distribuyendo chats...
Nov 21 01:50:07 [QueueDistributor] ⚠️  Cola "ATC": 4 chats esperando, pero no hay asesores disponibles
Nov 21 01:50:17 [QueueDistributor] 🎯 Distribuyendo chats...
Nov 21 01:50:17 [QueueDistributor] ⚠️  Cola "ATC": 4 chats esperando, pero no hay asesores disponibles
```

**Cuando asigna un chat:**
```
[QueueDistributor] ✅ Chat 51949842450 asignado a Carlos (ATC)
```

### QueueAssignmentService (NUEVO)

**Cuando un chat entra a cola (evento onChatQueued):**
```
[QueueAssignment] 📥 Chat conv-123 entró a cola queue-456
[QueueAssignment] ✅ Chat 51949842450 → Carlos (chat_queued)
```

**Cuando un asesor se loguea (evento onAdvisorOnline):**
```
[AdvisorPresence] 🔄 user-123 came online - triggering event-driven assignment
[QueueAssignment] 👤 Asesor user-123 está ONLINE - buscando chats pendientes
[QueueAssignment] 📊 Cola "ATC": 4 chats pendientes para user-123
[QueueAssignment] ✅ Chat 51949842450 → Carlos (advisor_online)
```

**Cuando NO puede asignar (sin asesores online):**
```
[QueueAssignment] ⚠️  No hay asesores ONLINE disponibles en cola ATC
```

**Cuando falla (ERROR):**
```
[QueueAssignment] ❌ Error en onChatQueued: [mensaje de error]
[QueueAssignment] ❌ Error asignando conv-123: [mensaje de error]
```

---

## 🚨 Señales de que el NUEVO servicio FALLÓ

### ❌ Señal 1: Errores en logs
```bash
sudo journalctl -u flowbuilder -n 500 | grep "QueueAssignment.*❌"
```
Si ves resultados → **El nuevo servicio está fallando**

### ❌ Señal 2: Bot transfiere pero no hay evento
**Esperado:**
```
[BotTimeoutScheduler] 🤖⏱️ Bot timeout exceeded - transferring to queue ATC
[QueueAssignment] 📥 Chat conv-123 entró a cola queue-456
```

**Si falla:**
```
[BotTimeoutScheduler] 🤖⏱️ Bot timeout exceeded - transferring to queue ATC
(... no hay log de QueueAssignment ...)
[QueueDistributor] ✅ Chat asignado...  ← El viejo lo asignó
```

### ❌ Señal 3: Asesor se loguea pero no hay evento
**Esperado:**
```
[AdvisorPresence] 🔄 user-123 came online - triggering event-driven assignment
[QueueAssignment] 👤 Asesor user-123 está ONLINE - buscando chats pendientes
```

**Si falla:**
```
[AdvisorPresence] 🔄 user-123 came online - triggering event-driven assignment
(... no hay log de QueueAssignment ...)
```

### ❌ Señal 4: Chats sin asignar con asesores online

```bash
# Ver chats sin asignar
PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -c "
SELECT COUNT(*) FROM crm_conversations
WHERE status='active' AND assigned_to IS NULL AND queue_id IS NOT NULL AND bot_flow_id IS NULL;"

# Verificar si hay asesores online
npx tsx check-online-advisors.ts
```

Si hay chats sin asignar Y hay asesores online → **Problema**

### ❌ Señal 5: QueueDistributor asigna en lugar del nuevo

```bash
# Ver últimas asignaciones
sudo journalctl -u flowbuilder --since "10 minutes ago" | grep "asignado"
```

Si ves `[QueueDistributor] ✅ Chat asignado` pero debería haber sido el nuevo → **Problema**

---

## 🛠️ Comandos Útiles

### 1. Monitor completo (análisis de última hora)
```bash
npx tsx monitor-assignment-services.ts 60
```

### 2. Ver logs en tiempo real (solo asignaciones)
```bash
sudo journalctl -u flowbuilder -f | grep -E "QueueAssignment|QueueDistributor"
```

### 3. Ver solo errores del nuevo servicio
```bash
sudo journalctl -u flowbuilder -n 1000 | grep "QueueAssignment.*❌"
```

### 4. Ver solo asignaciones exitosas (últimos 30 min)
```bash
sudo journalctl -u flowbuilder --since "30 minutes ago" | grep "✅.*asignado\|✅.*→"
```

### 5. Contar asignaciones por servicio (última hora)
```bash
echo "QueueDistributor:"
sudo journalctl -u flowbuilder --since "1 hour ago" | grep -c "QueueDistributor.*✅.*asignado"
echo "QueueAssignmentService:"
sudo journalctl -u flowbuilder --since "1 hour ago" | grep -c "QueueAssignment.*✅.*→"
```

### 6. Ver eventos onChatQueued (últimos 30 min)
```bash
sudo journalctl -u flowbuilder --since "30 minutes ago" | grep "📥 Chat.*entró a cola"
```

### 7. Ver eventos onAdvisorOnline (últimos 30 min)
```bash
sudo journalctl -u flowbuilder --since "30 minutes ago" | grep "👤 Asesor.*ONLINE"
```

### 8. Verificar estado actual de asesores
```bash
npx tsx check-online-advisors.ts
```

---

## ✅ Lo que DEBERÍAS ver en producción (funcionamiento normal)

### Escenario 1: No hay asesores online
```
[QueueDistributor] ⚠️  Cola "ATC": 4 chats esperando, pero no hay asesores disponibles
[QueueDistributor] ⚠️  Cola "Counter": 3 chats esperando, pero no hay asesores disponibles
(repite cada 10s)
```
**Estado:** NORMAL - Ambos servicios detectan que no hay asesores

### Escenario 2: Asesor se loguea
```
[AdvisorPresence] 🔄 user-123 came online - triggering event-driven assignment
[QueueAssignment] 👤 Asesor user-123 está ONLINE - buscando chats pendientes
[QueueAssignment] 📊 Cola "ATC": 4 chats pendientes para user-123
[QueueAssignment] ✅ Chat 51949842450 → Carlos (advisor_online)
[QueueAssignment] ✅ Chat 51952393110 → Carlos (advisor_online)
[QueueAssignment] ✅ Chat 51953947978 → Carlos (advisor_online)
[QueueAssignment] ✅ Chat 51906508666 → Carlos (advisor_online)
```
**Estado:** PERFECTO - El nuevo servicio asignó TODOS los chats instantáneamente

### Escenario 3: Bot transfiere chat a cola
```
[BotTimeoutScheduler] 🤖⏱️ Bot timeout exceeded - transferring to queue ATC
[QueueAssignment] 📥 Chat conv-123 entró a cola queue-ATC
[QueueAssignment] ✅ Chat 51949842450 → Carlos (chat_queued)
```
**Estado:** PERFECTO - El nuevo servicio asignó instantáneamente

---

## 🔴 Lo que NO deberías ver (problemas)

### ❌ Error 1: Excepción en QueueAssignment
```
[QueueAssignment] ❌ Error en onChatQueued: TypeError: Cannot read property 'id' of undefined
```
**Acción:** Revisar código, hay un bug

### ❌ Error 2: Bot transfiere pero QueueDistributor asigna
```
[BotTimeoutScheduler] 🤖⏱️ Bot timeout exceeded - transferring to queue ATC
(10 segundos después...)
[QueueDistributor] ✅ Chat 51949842450 asignado a Carlos
```
**Problema:** El nuevo NO se activó, el viejo lo asignó después

### ❌ Error 3: No hay trigger de eventos
```
[AdvisorPresence] 🔄 user-123 came online - triggering event-driven assignment
(... silencio, no hay logs de QueueAssignment ...)
```
**Problema:** La integración en advisor-presence.ts no está funcionando

---

## 📋 Checklist Diario

- [ ] Ejecutar `npx tsx monitor-assignment-services.ts 1440` (últimas 24h)
- [ ] Verificar que NO hay errores `❌` en QueueAssignment
- [ ] Confirmar que las asignaciones son del NUEVO servicio (no del viejo)
- [ ] Verificar que cuando un asesor se loguea, ve eventos `👤 Asesor está ONLINE`
- [ ] Confirmar que cuando bot transfiere, ve eventos `📥 Chat entró a cola`

---

## 🎯 Cuándo deshabilitar el QueueDistributor

**Deshabilitar el viejo SOLO cuando:**
1. ✅ Monitor muestra 0 errores en QueueAssignment (última 48h)
2. ✅ Todas las asignaciones son del NUEVO servicio
3. ✅ Eventos onChatQueued y onAdvisorOnline funcionan correctamente
4. ✅ No hay chats quedando sin asignar cuando hay asesores online

**Comando para deshabilitar:**
```typescript
// Comentar líneas 305-310 en /opt/flow-builder/server/index.ts
// const queueDistributor = new QueueDistributor(crmSocketManager);
// queueDistributor.start(10000);
```

Luego: `sudo systemctl restart flowbuilder`
