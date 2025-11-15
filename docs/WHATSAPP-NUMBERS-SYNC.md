# Sincronización de Números de WhatsApp

## 🎯 Problema que Resuelve

Cuando agregas un nuevo número de WhatsApp en el sistema, hay **DOS lugares** donde debe estar configurado:

1. **`/opt/flow-builder/data/whatsapp-connections.json`**
   - Para RECIBIR mensajes de WhatsApp
   - Se configura manualmente o via UI

2. **Base de datos `crm_whatsapp_numbers`**
   - Para ASIGNAR conversaciones a colas automáticamente
   - Se sincroniza con este script

## ⚠️ Síntoma del Problema

Si un número NO está en la base de datos:
- ❌ Los mensajes llegan pero NO se asignan a ninguna cola
- ❌ Los asesores no reciben las conversaciones automáticamente
- ❌ Las conversaciones quedan "huérfanas" sin cola

## ✅ Solución Automática

### Ejecutar Manualmente

Cuando agregues un nuevo número de WhatsApp:

```bash
cd /opt/flow-builder
POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx scripts/sync-whatsapp-numbers.ts
```

El script automáticamente:
- ✅ Lee todos los números de `whatsapp-connections.json`
- ✅ Los registra en la base de datos con sus IDs correctos de Meta
- ✅ Actualiza IDs incorrectos (como los `wsp-xxxxx`)
- ✅ Muestra un resumen y advierte si faltan colas

### Configurar Ejecución Automática

Para que se ejecute automáticamente cada hora:

```bash
# Editar crontab
crontab -e

# Agregar esta línea:
0 * * * * cd /opt/flow-builder && POSTGRES_PASSWORD=azaleia_pg_2025_secure /usr/local/bin/npx tsx scripts/sync-whatsapp-numbers.ts >> /var/log/whatsapp-sync.log 2>&1
```

## 📋 Proceso Completo al Agregar un Número

### Paso 1: Agregar en Meta (Facebook Business)
1. Ir a WhatsApp Business Manager
2. Agregar nuevo número de teléfono
3. Verificar el número
4. Obtener el `Phone Number ID` y `Access Token`

### Paso 2: Registrar en el Sistema
Opción A - **Via Interfaz Web** (Recomendado):
1. Ir a Configuración → Conexiones WhatsApp
2. Agregar nueva conexión
3. Ingresar: Alias, Phone Number ID, Display Number, Access Token

Opción B - **Manual** (Editar JSON):
```bash
nano /opt/flow-builder/data/whatsapp-connections.json
```

Agregar:
```json
{
  "id": "uuid-generado",
  "alias": "Nombre Descriptivo",
  "phoneNumberId": "ID_DE_META",  ← IMPORTANTE: ID correcto de Meta
  "displayNumber": "+51 XXX XXX XXX",
  "accessToken": "TOKEN_DE_META",
  "verifyToken": "tu_verify_token",
  "wabaId": "ID_WABA",
  "isActive": true,
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000
}
```

### Paso 3: Sincronizar con Base de Datos
```bash
cd /opt/flow-builder
POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx scripts/sync-whatsapp-numbers.ts
```

### Paso 4: Asignar Cola
Via SQL:
```sql
UPDATE crm_whatsapp_numbers
SET queue_id = 'ID_DE_LA_COLA'
WHERE number_id = 'PHONE_NUMBER_ID_DE_META';
```

O via interfaz web (cuando esté disponible).

## 🔍 Verificar Configuración

### Ver todos los números registrados:
```bash
PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -c "
SELECT
  number_id,
  phone_number,
  display_name,
  (SELECT name FROM crm_queues WHERE id = queue_id) as queue_name
FROM crm_whatsapp_numbers
ORDER BY created_at;
"
```

### Ver números sin cola asignada:
```bash
PGPASSWORD=azaleia_pg_2025_secure psql -h localhost -U whatsapp_user -d flowbuilder_crm -c "
SELECT number_id, phone_number, display_name
FROM crm_whatsapp_numbers
WHERE queue_id IS NULL;
"
```

## ❗ Errores Comunes

### Error: "Los mensajes llegan pero no se asignan a cola"
**Causa:** El número no está registrado en `crm_whatsapp_numbers`
**Solución:** Ejecutar el script de sincronización

### Error: "duplicate key value violates unique constraint"
**Causa:** Intentas registrar un `phoneNumberId` que ya existe
**Solución:** Elimina el duplicado o actualiza el existente

### Error: IDs tipo "wsp-xxxxx" en lugar del ID de Meta
**Causa:** Registraste el número manualmente con ID generado
**Solución:** El script de sincronización los corrige automáticamente

## 🎯 Mejores Prácticas

1. ✅ **SIEMPRE usa el `phoneNumberId` de Meta** (no IDs personalizados)
2. ✅ **Ejecuta el script de sincronización** después de agregar números
3. ✅ **Asigna una cola** a cada número inmediatamente
4. ✅ **Verifica con el script** que todo esté correcto
5. ✅ **Configura el cron job** para sincronización automática

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs: `/var/log/whatsapp-sync.log`
2. Ejecuta el script manualmente para ver errores
3. Verifica que el número esté en `whatsapp-connections.json`
4. Verifica que tengas el `phoneNumberId` correcto de Meta
