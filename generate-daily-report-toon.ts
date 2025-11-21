/**
 * Genera reporte diario en formato TOON para análisis con LLM
 * Uso: npx tsx generate-daily-report-toon.ts
 */

import { Pool } from 'pg';
import { stringify } from '@toon-format/toon';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function generateDailyReport() {
  const today = new Date().toISOString().split('T')[0];

  // Obtener datos del día
  const conversations = await pool.query(`
    SELECT
      phone,
      status,
      assigned_to,
      queue_id,
      created_at,
      updated_at
    FROM crm_conversations
    WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const messages = await pool.query(`
    SELECT
      conversation_id,
      direction,
      type,
      timestamp
    FROM crm_messages
    WHERE timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
  `);

  // Estadísticas por cola
  const queueStats = await pool.query(`
    SELECT
      q.name as cola,
      COUNT(CASE WHEN c.status = 'active' AND c.assigned_to IS NULL THEN 1 END) as enEspera,
      COUNT(CASE WHEN c.status = 'attending' THEN 1 END) as enAtencion,
      COUNT(CASE WHEN c.status = 'closed' AND c.updated_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000 THEN 1 END) as cerrados
    FROM crm_queues q
    LEFT JOIN crm_conversations c ON c.queue_id = q.id
    GROUP BY q.id, q.name
  `);

  // Estadísticas por asesor
  const advisorStats = await pool.query(`
    SELECT
      u.name as asesor,
      COUNT(CASE WHEN c.status = 'attending' THEN 1 END) as atendiendo,
      COUNT(CASE WHEN c.status = 'active' AND c.assigned_to = u.id THEN 1 END) as porTrabajar,
      COUNT(CASE WHEN c.status = 'closed' AND c.assigned_to = u.id AND c.updated_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000 THEN 1 END) as cerrados
    FROM users u
    LEFT JOIN crm_conversations c ON c.assigned_to = u.id
    WHERE u.role = 'advisor'
    GROUP BY u.id, u.name
  `);

  // Formato TOON
  console.log('='.repeat(80));
  console.log('📊 REPORTE DIARIO CRM - FORMATO TOON');
  console.log('='.repeat(80));
  console.log('');

  const toonReport = `
reporte:
  fecha: ${today}
  sistema: FlowBuilder CRM
  periodo: Últimas 24 horas
  generado: ${new Date().toISOString()}

resumen:
  conversacionesNuevas: ${conversations.rows.length}
  mensajesTotal: ${messages.rows.length}

estadisticasPorCola[${queueStats.rows.length}]{cola,enEspera,enAtencion,cerrados}:
${queueStats.rows.map(r => `  ${r.cola},${r.enespera},${r.enatencion},${r.cerrados}`).join('\n')}

estadisticasPorAsesor[${advisorStats.rows.length}]{asesor,atendiendo,porTrabajar,cerrados}:
${advisorStats.rows.map(r => `  ${r.asesor},${r.atendiendo},${r.portrabajar},${r.cerrados}`).join('\n')}

conversacionesRecientes[${Math.min(conversations.rows.length, 10)}]{phone,status,assignedTo,queueId}:
${conversations.rows.slice(0, 10).map(r =>
  `  ${r.phone},${r.status},${r.assigned_to || 'sin_asignar'},${r.queue_id || 'sin_cola'}`
).join('\n')}

prompt:
  Analiza este reporte y genera:
  1. Resumen ejecutivo de las últimas 24 horas
  2. Identificar problemas o patrones anormales
  3. Recomendaciones para mejorar métricas
  4. Alertas si hay algo crítico
`;

  console.log(toonReport);
  console.log('');
  console.log('='.repeat(80));
  console.log('💡 Copia este reporte y pégalo en ChatGPT/Claude para análisis');
  console.log('='.repeat(80));

  await pool.end();
}

generateDailyReport().catch(err => {
  console.error('Error generando reporte:', err);
  process.exit(1);
});
