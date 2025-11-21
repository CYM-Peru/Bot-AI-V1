# 📊 INFORME DE CATEGORIZACIÓN DE CHATS
Fecha: 17/11/2025, 7:10:21 p. m.

---

## 1. ESTADÍSTICAS GENERALES

### Total de Conversaciones
- **Total**: 1305
- **Activas**: 18 (1.4%)
- **En atención**: 0 (0.0%)
- **Cerradas**: 16 (1.2%)
- **Archivadas**: 1271 (97.4%)

### Asignación
- **Asignadas (assigned_to)**: 534 (40.9%)
- **Asignadas a asesor (assigned_to_advisor)**: 15 (1.1%)
- **En cola (queue_id)**: 1233 (94.5%)
- **De campaña**: 10 (0.8%)
- **Con bot activo**: 30 (2.3%)

## 2. CATEGORÍAS GUARDADAS EN DB (campo `category`)

| Categoría | Total | Active | Attending | Closed | Archived |
|-----------|-------|--------|-----------|--------|----------|
| mass_send | 675 | 4 | 0 | 0 | 671 |
| (sin categoría) | 609 | 14 | 0 | 14 | 581 |
| desconocido | 12 | 0 | 0 | 0 | 12 |
| atendiendo | 6 | 0 | 0 | 0 | 6 |
| masivos | 3 | 0 | 0 | 2 | 1 |

## 3. CATEGORÍAS DEFINIDAS EN TABLA `crm_categories`

| ID | Nombre | Descripción | Icono | Color | Orden |
|----|--------|-------------|-------|-------|-------|
| cat-masivos | Masivos | Chats que recibieron campaña masiva | megaphone | #EF4444 | 1 |
| cat-en-cola-bot | En cola / Bot | Chats en cola o con bot sin asesor asignado | clock | #F59E0B | 2 |
| cat-por-trabajar | Por trabajar | Chats asignados esperando aceptación | inbox | #3B82F6 | 3 |
| cat-trabajando | Trabajando | Chats aceptados en atención activa | message-circle | #10B981 | 4 |
| cat-finalizados | Finalizados | Chats cerrados o archivados | archive | #6B7280 | 5 |

## 4. ⚠️ PROBLEMAS DETECTADOS

### 4.1 Categorías Huérfanas (no existen en `crm_categories`)

Estas categorías están siendo usadas pero NO existen en la tabla de categorías:

- **`mass_send`**: 675 conversaciones
- **`desconocido`**: 12 conversaciones
- **`atendiendo`**: 6 conversaciones
- **`masivos`**: 3 conversaciones

### 4.2 Conversaciones sin categoría: **609** (46.7%)

## 5. DISTRIBUCIÓN POR COLAS

| Cola | Total | Activas |
|------|-------|---------|
| Counter | 772 | 3 |
| ATC | 320 | 13 |
| Prospectos | 138 | 1 |
| queue-1762356569837 | 3 | 0 |

## 6. USO DE BOTS

| Bot Flow ID | Total | Activas |
|-------------|-------|---------|
| promotoras-v2-mw7rpy | 29 | 0 |
| prospectos-v2 | 1 | 0 |

## 7. TENDENCIAS DE CATEGORIZACIÓN (últimos 30 días)

| Fecha | Categoría | Count |
|-------|-----------|-------|
| Mon Nov 17 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 67 |
| Sun Nov 16 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 40 |
| Sat Nov 15 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 61 |
| Fri Nov 14 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 55 |
| Thu Nov 13 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 44 |
| Wed Nov 12 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 18 |
| Wed Nov 12 2025 00:00:00 GMT-0500 (Peru Standard Time) | masivos | 3 |
| Tue Nov 11 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 31 |
| Mon Nov 10 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 47 |
| Sun Nov 09 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 14 |
| Sat Nov 08 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 31 |
| Sat Nov 08 2025 00:00:00 GMT-0500 (Peru Standard Time) | mass_send | 3 |
| Fri Nov 07 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 27 |
| Fri Nov 07 2025 00:00:00 GMT-0500 (Peru Standard Time) | mass_send | 17 |
| Thu Nov 06 2025 00:00:00 GMT-0500 (Peru Standard Time) | mass_send | 655 |
| Thu Nov 06 2025 00:00:00 GMT-0500 (Peru Standard Time) | (sin categoría) | 174 |
| Thu Nov 06 2025 00:00:00 GMT-0500 (Peru Standard Time) | desconocido | 12 |
| Thu Nov 06 2025 00:00:00 GMT-0500 (Peru Standard Time) | atendiendo | 6 |

## 8. REGLAS DE CATEGORIZACIÓN ACTUALES

Según el archivo `shared/conversation-rules.ts`:

### Prioridades:
1. **MASIVOS**: `campaignId` presente Y `status = closed`
2. **EN_COLA_BOT**: `status = active` Y (`assignedTo = null` O `assignedTo = bot`)
3. **POR_TRABAJAR**: `status = active` Y `assignedTo != null` Y `assignedTo != bot`
4. **TRABAJANDO**: `status = attending`
5. **FINALIZADOS**: (`status = archived` O `status = closed`) Y NO tiene `campaignId`

⚠️ **NOTA IMPORTANTE**: Estas reglas se aplican dinámicamente en el frontend, pero el campo `category` en la base de datos contiene valores antiguos/desactualizados.
