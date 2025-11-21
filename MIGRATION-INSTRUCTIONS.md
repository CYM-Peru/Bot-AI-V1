# 🌙 INSTRUCCIONES DE MIGRACIÓN NOCTURNA
## Fix de Duplicados en Métricas de Asesores

**Fecha de preparación:** 2025-11-19 11:30 AM
**Ejecutar:** Por la noche (horario recomendado: 2:00 AM - 4:00 AM)

---

## 📋 RESUMEN

**Problema actual:**
- Angela Custodio muestra 1,819 conversaciones (imposible)
- En realidad son ~10-20 conversaciones registradas 579 veces cada una
- Dashboard parpadea/se re-renderiza constantemente
- Métricas de todos los asesores están infladas

**Solución:**
- Eliminar ~4,500 registros duplicados
- Conservar solo 1 registro por conversación/asesor
- Crear constraint para prevenir duplicados futuros
- Modificar código para usar el nuevo constraint

**Tiempo:** 2-3 minutos de downtime

---

## ⚡ EJECUCIÓN RÁPIDA (Una sola línea)

```bash
/opt/flow-builder/scripts/migrate-fix-duplicates.sh
```

**Eso es todo!** El script es interactivo y te guiará paso a paso.

---

## 📖 PROCESO DETALLADO

### PASO 1: Conectarte al servidor

```bash
ssh usuario@tu-servidor
cd /opt/flow-builder
```

### PASO 2: Ejecutar migración

```bash
./scripts/migrate-fix-duplicates.sh
```

### PASO 3: Seguir las instrucciones en pantalla

El script te mostrará:
1. ✅ Estadísticas actuales (cuántos duplicados hay)
2. ⏸️  Detendrá el servidor
3. 💾 Creará backup automático
4. 🔧 Ejecutará migración SQL
5. ⚠️  **Te pedirá confirmación antes de aplicar cambios**
6. 🔄 Reiniciará el servidor
7. ✅ Verificará que todo salió bien

### PASO 4: Decisión crítica

Cuando veas:
```
=== ESTADÍSTICAS DESPUÉS DE LA LIMPIEZA ===
```

Si los números se ven bien, ejecuta:
```bash
sudo -u postgres psql -d flowbuilder_crm -c 'COMMIT;'
```

Si algo se ve mal, ejecuta:
```bash
sudo -u postgres psql -d flowbuilder_crm -c 'ROLLBACK;'
```

---

## 🔍 VERIFICACIÓN POST-MIGRACIÓN

### 1. Verificar que el servidor está corriendo

```bash
systemctl status flowbuilder
```

Debe decir: `active (running)`

### 2. Verificar métricas en la base de datos

```bash
PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -c "
SELECT
  u.name,
  COUNT(*) as conversaciones
FROM conversation_metrics cm
JOIN users u ON cm.advisor_id = u.id
WHERE cm.started_at >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000)
GROUP BY u.name
ORDER BY conversaciones DESC
LIMIT 10;
"
```

**Esperado:** Angela debería tener ~10-20 conversaciones (no 1,819)

### 3. Verificar dashboard web

1. Abrir navegador
2. Ir a: `https://tu-dominio/crm/dashboard`
3. Ver pestaña "Métricas de Asesores"
4. Verificar que Angela tiene ~10-20 conversaciones
5. Verificar que **NO hay parpadeo** al recargar

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Problema: "El servidor no inicia"

```bash
# Ver logs
sudo journalctl -u flowbuilder -n 50 --no-pager

# Intentar iniciar manualmente
sudo systemctl start flowbuilder
```

### Problema: "Los números se ven mal"

Si ejecutaste COMMIT pero los números se ven incorrectos:

1. Restaurar desde backup:
```bash
# Listar backups
ls -lh /root/backups-flowbuilder/pre-migration-metrics-*

# Restaurar (CAMBIA LA FECHA por tu backup)
sudo systemctl stop flowbuilder
sudo -u postgres psql -d flowbuilder_crm < /root/backups-flowbuilder/pre-migration-metrics-20251119-XXXXXX.sql
sudo systemctl start flowbuilder
```

### Problema: "Sigue habiendo duplicados"

```bash
# Verificar constraint único
PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -c "\d conversation_metrics"
```

Busca: `"unique_conversation_advisor" UNIQUE`

Si no existe, ejecuta:
```bash
sudo -u postgres psql -d flowbuilder_crm -c "
ALTER TABLE conversation_metrics
ADD CONSTRAINT unique_conversation_advisor
UNIQUE (conversation_id, advisor_id);
"
```

---

## 📊 ANTES vs DESPUÉS

### ANTES (Estado actual)
```
Angela Custodio: 1,819 conversaciones ❌
Total registros: ~4,850
Dashboard: Parpadea cada 30 segundos
Carga: Lenta (15+ segundos)
```

### DESPUÉS (Estado esperado)
```
Angela Custodio: ~15 conversaciones ✅
Total registros: ~300-400
Dashboard: No parpadea
Carga: Rápida (2-3 segundos)
```

---

## 🔐 ARCHIVOS MODIFICADOS

1. **SQL:**
   - `/opt/flow-builder/scripts/fix-duplicate-metrics.sql`

2. **Código:**
   - `/opt/flow-builder/server/crm/metrics-tracker-db.ts`
   - Línea 73: `ON CONFLICT (conversation_id, advisor_id)`

3. **Scripts:**
   - `/opt/flow-builder/scripts/migrate-fix-duplicates.sh`

---

## 📞 CONTACTO

Si tienes dudas o problemas durante la migración:
- **Antes de ejecutar:** Pregúntame lo que necesites
- **Durante la ejecución:** Sigue las instrucciones del script
- **Después:** Verifica los 3 puntos de "Verificación Post-Migración"

---

## ✅ CHECKLIST

Antes de ejecutar:
- [ ] Es horario de baja demanda (2-4 AM recomendado)
- [ ] Tienes acceso SSH al servidor
- [ ] Has leído estas instrucciones completas

Durante la ejecución:
- [ ] Revisar estadísticas "ANTES"
- [ ] Esperar a que muestre estadísticas "DESPUÉS"
- [ ] **Verificar que los números tienen sentido**
- [ ] Ejecutar COMMIT (si todo está bien)
- [ ] Esperar a que el servidor reinicie

Después de ejecutar:
- [ ] Servidor está `active (running)`
- [ ] Métricas en DB se ven correctas
- [ ] Dashboard web carga sin parpadear
- [ ] Angela tiene ~10-20 conversaciones (no 1,819)

---

**🌙 ¡Buena suerte con la migración nocturna!**
