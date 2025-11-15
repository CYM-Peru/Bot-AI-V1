# 🛡️ CONFIGURACIÓN CRÍTICA DEL SISTEMA

**Última actualización:** 2025-11-12
**Propósito:** Documentar configuraciones críticas que NO deben cambiar sin autorización

---

## ⚠️ REGLAS DE ORO

1. **NUNCA cambiar** estas configuraciones sin autorización explícita
2. **SIEMPRE ejecutar** `/opt/flow-builder/scripts/validate-config.sh` después de cambios
3. **BACKUP automático** de configuraciones críticas cada día
4. **MONITOREO activo** de comportamiento del sistema

---

## 🚫 SISTEMA DE REBOTE (BOUNCE) - ELIMINADO

**Estado actual:** ELIMINADO COMPLETAMENTE
**Motivo:** No solicitado, redistribuye chats cada 10 minutos incorrectamente

### ✅ Verificaciones:
- `server/crm/bounce-service.ts` → NO DEBE EXISTIR (renombrado a `.REMOVED`)
- `server/crm/index.ts` → NO debe contener `bounceService.start()`
- `src/crm/types.ts` → Campos `bounceCount`, `lastBounceAt` eliminados de interfaz

### Código crítico eliminado:
```typescript
// ❌ NUNCA RESTAURAR ESTE CÓDIGO:
// bounceService.start()
// bounceCount?: number
// lastBounceAt?: number | null
```

---

## ✅ DISTRIBUCIÓN EQUITATIVA

**Ubicación:** `server/crm/advisor-presence.ts` (líneas 400-460)
**Método:** `redistributeRoundRobin()`

### Comportamiento correcto:
1. **Solo distribuye chats NUEVOS** (assignedTo === null)
2. **NUNCA quita** chats ya asignados a un asesor
3. Asigna al asesor con **menor carga actual**
4. Re-calcula balance después de cada asignación

### Código crítico que DEBE permanecer:
```typescript
// CRÍTICO: Solo distribuir chats sin asignar
const unassignedChats = chats.filter(chat => !chat.assignedTo);

// CRÍTICO: Nunca remover chats de asesores
// Only distribute chats that are NOT assigned yet (assignedTo === null)
```

### Flujo esperado:
- Ana conecta primera → Recibe TODOS los chats en espera
- Carlos conecta después → Recibe chats NUEVOS para balancear
- Sistema balancea naturalmente con el tiempo

---

## 🔄 REDISTRIBUCIÓN POR CAMBIO DE ESTADO

**Ubicación:** `server/routes/admin.ts` (líneas 666-731)
**Endpoint:** `POST /api/admin/advisors/:userId/status`

### Comportamiento correcto:

#### Cuando asesor cambia a "Refrigerio" o "Ocupado":
1. **Libera** chats que está atendiendo (status="attending")
2. **Reasigna INMEDIATAMENTE** a otros asesores disponibles
3. El asesor original **NUNCA recupera** esos chats

#### Cuando asesor se DESLOGUEA:
- Los chats **se quedan con él** (para continuidad al día siguiente)
- Solo redistribuye si cambia de ESTADO, no al desloguear

### Código crítico que DEBE permanecer:
```typescript
// CRÍTICO: Redistribución inmediata por cambio de estado
if (status?.action === "pause" || status?.action === "redirect") {
  const attendingConversations = advisorConversations.filter(
    conv => conv.status === "attending"
  );

  // Release y reasignar inmediatamente
  // Try to reassign IMMEDIATELY to other available advisors
  ...
}
```

### Flujo esperado:
- Ana tiene 5 chats → Va a refrigerio → Chats se reasignan a Carlos
- Ana regresa → Recibe chats NUEVOS (NO recupera los 5 de Carlos)

---

## 📊 CONFIGURACIÓN DE COLAS

**Ubicación:** Base de datos PostgreSQL, tabla `queues`
**Interfaz:** Configuración → Colas de Atención

### Modos de distribución:

#### 1. **least-busy** (RECOMENDADO) ⭐
- Nuevos chats van al asesor con menos carga actual
- Balanceo automático y equitativo
- **Este es el modo que debe usarse**

#### 2. round-robin
- Rotación circular entre asesores
- Alternativa aceptable

#### 3. manual
- Asesores deben aceptar chats manualmente
- Solo para casos especiales

### Verificación:
```sql
SELECT id, name, distribution_mode, assigned_advisors
FROM queues
WHERE active = true;
```

---

## 🗂️ ARCHIVOS CRÍTICOS

### NO MODIFICAR sin autorización:

1. `/opt/flow-builder/server/crm/advisor-presence.ts`
   - Líneas 400-460: redistributeRoundRobin()

2. `/opt/flow-builder/server/routes/admin.ts`
   - Líneas 666-731: Redistribución por cambio de estado

3. `/opt/flow-builder/src/crm/types.ts`
   - Interfaz Conversation

4. `/opt/flow-builder/server/crm/index.ts`
   - Inicialización del módulo CRM

### Archivos que NO deben existir:
- `server/crm/bounce-service.ts` (debe estar renombrado a `.REMOVED`)

---

## 🔍 VALIDACIÓN DIARIA

### Script de validación automática:
```bash
/opt/flow-builder/scripts/validate-config.sh
```

### Qué verifica:
1. ✅ Bounce service NO esté activo
2. ✅ Configuración de colas en BD
3. ✅ Código de distribución equitativa presente
4. ✅ Redistribución por estado presente
5. ✅ Servicio flowbuilder activo

### Ejecutar manualmente:
```bash
cd /opt/flow-builder
./scripts/validate-config.sh
```

### Ver reporte:
```bash
cat /opt/flow-builder/config-validation-report.txt
```

---

## 🆘 QUÉ HACER SI ALGO FALLA

### Si el script de validación reporta errores:

1. **Errores críticos (❌):**
   - DETENER cualquier operación
   - Revisar archivos mencionados en el reporte
   - Contactar al desarrollador inmediatamente

2. **Advertencias (⚠️):**
   - Sistema probablemente funcional
   - Revisar cuando sea posible
   - Monitorear comportamiento

### Restauración rápida:
```bash
# 1. Ver backup más reciente
ls -lt /opt/flow-builder/backups/config/ | head -5

# 2. Revisar qué cambió
git diff

# 3. Restaurar desde backup si es necesario
# (consultar con desarrollador)
```

---

## 📋 CHECKLIST DE SEGURIDAD

Antes de cualquier cambio en el sistema:

- [ ] Backup de configuración actual
- [ ] Ejecutar script de validación ANTES del cambio
- [ ] Realizar el cambio
- [ ] Ejecutar script de validación DESPUÉS del cambio
- [ ] Monitorear logs por 10 minutos
- [ ] Verificar comportamiento con asesoras

---

## 📞 CONTACTO

Si hay dudas sobre estas configuraciones, consultar con el desarrollador ANTES de hacer cambios.

**Recuerda:** Estos settings controlan cómo se distribuyen los chats entre asesoras. Cambios incorrectos pueden causar pérdida de chats o distribución injusta.
