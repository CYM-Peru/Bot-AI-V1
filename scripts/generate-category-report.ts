/**
 * Generador de Informe de Categorización de Chats
 *
 * Este script analiza:
 * - Distribución de conversaciones por categoría
 * - Estado de las reglas de categorización
 * - Inconsistencias entre categorías guardadas y categorías computadas
 * - Recomendaciones para refactorización
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

interface CategoryStats {
  category: string | null;
  total: number;
  active: number;
  attending: number;
  closed: number;
  archived: number;
}

interface QueueStats {
  queueId: string;
  queueName: string;
  total: number;
  active: number;
}

async function generateReport() {
  console.log('🔍 Generando informe de categorización de chats...\n');

  const report: string[] = [];
  report.push('# 📊 INFORME DE CATEGORIZACIÓN DE CHATS');
  report.push(`Fecha: ${new Date().toLocaleString('es-PE')}\n`);
  report.push('---\n');

  // 1. ESTADÍSTICAS GENERALES
  report.push('## 1. ESTADÍSTICAS GENERALES\n');

  const totalResult = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'attending' THEN 1 END) as attending,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
      COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
      COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned,
      COUNT(CASE WHEN assigned_to_advisor IS NOT NULL THEN 1 END) as assigned_advisor,
      COUNT(CASE WHEN queue_id IS NOT NULL THEN 1 END) as in_queue,
      COUNT(CASE WHEN campaign_id IS NOT NULL THEN 1 END) as from_campaign,
      COUNT(CASE WHEN bot_flow_id IS NOT NULL THEN 1 END) as with_bot
    FROM crm_conversations
  `);

  const stats = totalResult.rows[0];
  report.push('### Total de Conversaciones');
  report.push(`- **Total**: ${stats.total}`);
  report.push(`- **Activas**: ${stats.active} (${((stats.active/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **En atención**: ${stats.attending} (${((stats.attending/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **Cerradas**: ${stats.closed} (${((stats.closed/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **Archivadas**: ${stats.archived} (${((stats.archived/stats.total)*100).toFixed(1)}%)\n`);

  report.push('### Asignación');
  report.push(`- **Asignadas (assigned_to)**: ${stats.assigned} (${((stats.assigned/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **Asignadas a asesor (assigned_to_advisor)**: ${stats.assigned_advisor} (${((stats.assigned_advisor/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **En cola (queue_id)**: ${stats.in_queue} (${((stats.in_queue/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **De campaña**: ${stats.from_campaign} (${((stats.from_campaign/stats.total)*100).toFixed(1)}%)`);
  report.push(`- **Con bot activo**: ${stats.with_bot} (${((stats.with_bot/stats.total)*100).toFixed(1)}%)\n`);

  // 2. CATEGORÍAS ACTUALES (campo category en DB)
  report.push('## 2. CATEGORÍAS GUARDADAS EN DB (campo `category`)\n');

  const categoryResult = await pool.query<CategoryStats>(`
    SELECT
      category,
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'attending' THEN 1 END) as attending,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
      COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived
    FROM crm_conversations
    GROUP BY category
    ORDER BY total DESC
  `);

  report.push('| Categoría | Total | Active | Attending | Closed | Archived |');
  report.push('|-----------|-------|--------|-----------|--------|----------|');

  for (const row of categoryResult.rows) {
    const cat = row.category || '(sin categoría)';
    report.push(`| ${cat} | ${row.total} | ${row.active} | ${row.attending} | ${row.closed} | ${row.archived} |`);
  }
  report.push('');

  // 3. CATEGORÍAS DEFINIDAS EN SISTEMA
  report.push('## 3. CATEGORÍAS DEFINIDAS EN TABLA `crm_categories`\n');

  const definedCategoriesResult = await pool.query(`
    SELECT id, name, description, icon, color, "order"
    FROM crm_categories
    ORDER BY "order"
  `);

  report.push('| ID | Nombre | Descripción | Icono | Color | Orden |');
  report.push('|----|--------|-------------|-------|-------|-------|');

  for (const cat of definedCategoriesResult.rows) {
    report.push(`| ${cat.id} | ${cat.name} | ${cat.description} | ${cat.icon} | ${cat.color} | ${cat.order} |`);
  }
  report.push('');

  // 4. INCONSISTENCIAS
  report.push('## 4. ⚠️ PROBLEMAS DETECTADOS\n');

  // 4.1 Categorías huérfanas (no existen en crm_categories)
  const orphanedResult = await pool.query(`
    SELECT DISTINCT category, COUNT(*) as count
    FROM crm_conversations
    WHERE category IS NOT NULL
      AND category NOT IN (SELECT id FROM crm_categories)
    GROUP BY category
    ORDER BY count DESC
  `);

  if (orphanedResult.rows.length > 0) {
    report.push('### 4.1 Categorías Huérfanas (no existen en `crm_categories`)');
    report.push('');
    report.push('Estas categorías están siendo usadas pero NO existen en la tabla de categorías:');
    report.push('');
    for (const row of orphanedResult.rows) {
      report.push(`- **\`${row.category}\`**: ${row.count} conversaciones`);
    }
    report.push('');
  }

  // 4.2 Conversaciones sin categoría
  const noCategoryCount = categoryResult.rows.find(r => r.category === null)?.total || 0;
  report.push(`### 4.2 Conversaciones sin categoría: **${noCategoryCount}** (${((noCategoryCount/stats.total)*100).toFixed(1)}%)`);
  report.push('');

  // 5. DISTRIBUCIÓN POR COLAS
  report.push('## 5. DISTRIBUCIÓN POR COLAS\n');

  const queueStatsResult = await pool.query<QueueStats>(`
    SELECT
      c.queue_id as "queueId",
      COALESCE(q.name, c.queue_id) as "queueName",
      COUNT(*) as total,
      COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active
    FROM crm_conversations c
    LEFT JOIN crm_queues q ON c.queue_id = q.id
    WHERE c.queue_id IS NOT NULL
    GROUP BY c.queue_id, q.name
    ORDER BY total DESC
  `);

  report.push('| Cola | Total | Activas |');
  report.push('|------|-------|---------|');

  for (const row of queueStatsResult.rows) {
    report.push(`| ${row.queueName} | ${row.total} | ${row.active} |`);
  }
  report.push('');

  // 6. USO DE BOTS
  report.push('## 6. USO DE BOTS\n');

  const botStatsResult = await pool.query(`
    SELECT
      bot_flow_id,
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active
    FROM crm_conversations
    WHERE bot_flow_id IS NOT NULL
    GROUP BY bot_flow_id
    ORDER BY total DESC
  `);

  if (botStatsResult.rows.length > 0) {
    report.push('| Bot Flow ID | Total | Activas |');
    report.push('|-------------|-------|---------|');

    for (const row of botStatsResult.rows) {
      report.push(`| ${row.bot_flow_id} | ${row.total} | ${row.active} |`);
    }
    report.push('');
  } else {
    report.push('_No hay conversaciones con bot activo actualmente._\n');
  }

  // 7. TENDENCIAS (últimos 30 días)
  report.push('## 7. TENDENCIAS DE CATEGORIZACIÓN (últimos 30 días)\n');

  const trendsResult = await pool.query(`
    SELECT
      DATE(to_timestamp(created_at/1000)) as date,
      category,
      COUNT(*) as count
    FROM crm_conversations
    WHERE created_at > EXTRACT(epoch FROM NOW() - INTERVAL '30 days')::bigint * 1000
    GROUP BY DATE(to_timestamp(created_at/1000)), category
    ORDER BY date DESC, count DESC
    LIMIT 30
  `);

  report.push('| Fecha | Categoría | Count |');
  report.push('|-------|-----------|-------|');

  for (const row of trendsResult.rows) {
    const cat = row.category || '(sin categoría)';
    report.push(`| ${row.date} | ${cat} | ${row.count} |`);
  }
  report.push('');

  // 8. REGLAS DE CATEGORIZACIÓN ACTUALES
  report.push('## 8. REGLAS DE CATEGORIZACIÓN ACTUALES\n');
  report.push('Según el archivo `shared/conversation-rules.ts`:\n');
  report.push('### Prioridades:');
  report.push('1. **MASIVOS**: `campaignId` presente Y `status = closed`');
  report.push('2. **EN_COLA_BOT**: `status = active` Y (`assignedTo = null` O `assignedTo = bot`)');
  report.push('3. **POR_TRABAJAR**: `status = active` Y `assignedTo != null` Y `assignedTo != bot`');
  report.push('4. **TRABAJANDO**: `status = attending`');
  report.push('5. **FINALIZADOS**: (`status = archived` O `status = closed`) Y NO tiene `campaignId`\n');
  report.push('⚠️ **NOTA IMPORTANTE**: Estas reglas se aplican dinámicamente en el frontend, pero el campo `category` en la base de datos contiene valores antiguos/desactualizados.\n');

  // GUARDAR REPORTE
  const reportContent = report.join('\n');
  const reportPath = path.join(process.cwd(), 'INFORME-CATEGORIZACION-CHATS.md');
  await fs.writeFile(reportPath, reportContent, 'utf-8');

  console.log(reportContent);
  console.log(`\n✅ Informe generado: ${reportPath}`);

  await pool.end();
}

generateReport().catch(console.error);
