/**
 * Genera reporte de performance en formato TOON
 * Uso: npx tsx performance-report-toon.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function generatePerformanceReport() {
  // Tiempo de respuesta promedio por asesor
  const responseTime = await pool.query(`
    SELECT
      u.name as asesor,
      AVG(
        CASE
          WHEN c.assigned_at IS NOT NULL AND c.updated_at IS NOT NULL
          THEN (c.updated_at - c.assigned_at) / 1000 / 60
        END
      ) as tiempoPromedioMin
    FROM crm_conversations c
    JOIN users u ON c.assigned_to = u.id
    WHERE c.assigned_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    GROUP BY u.id, u.name
    ORDER BY tiempoPromedioMin DESC
  `);

  // Tiempo en cola antes de asignación
  const queueTime = await pool.query(`
    SELECT
      q.name as cola,
      AVG(
        CASE
          WHEN c.queued_at IS NOT NULL AND c.assigned_at IS NOT NULL
          THEN (c.assigned_at - c.queued_at) / 1000 / 60
        END
      ) as tiempoEsperaMin,
      COUNT(*) as totalChats
    FROM crm_conversations c
    JOIN crm_queues q ON c.queue_id = q.id
    WHERE c.queued_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    GROUP BY q.id, q.name
    ORDER BY tiempoEsperaMin DESC
  `);

  // Tasa de cierre
  const closeRate = await pool.query(`
    SELECT
      u.name as asesor,
      COUNT(*) as totalChats,
      COUNT(CASE WHEN c.status = 'closed' THEN 1 END) as cerrados,
      ROUND(
        COUNT(CASE WHEN c.status = 'closed' THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0) * 100,
        2
      ) as tasaCierre
    FROM crm_conversations c
    JOIN users u ON c.assigned_to = u.id
    WHERE c.created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    GROUP BY u.id, u.name
    ORDER BY tasaCierre DESC
  `);

  console.log('='.repeat(80));
  console.log('⚡ REPORTE DE PERFORMANCE - FORMATO TOON');
  console.log('='.repeat(80));
  console.log('');

  const toonReport = `
reportePerformance:
  periodo: Últimos 7 días
  fecha: ${new Date().toISOString().split('T')[0]}
  sistema: FlowBuilder CRM

tiempoRespuestaPorAsesor[${responseTime.rows.length}]{asesor,tiempoPromedioMin}:
${responseTime.rows.map(r => `  ${r.asesor},${parseFloat(r.tiempopromediomin).toFixed(1)}`).join('\n')}

tiempoEsperaPorCola[${queueTime.rows.length}]{cola,tiempoEsperaMin,totalChats}:
${queueTime.rows.map(r => `  ${r.cola},${parseFloat(r.tiempoesperamin).toFixed(1)},${r.totalchats}`).join('\n')}

tasaCierrePorAsesor[${closeRate.rows.length}]{asesor,totalChats,cerrados,tasaCierre}:
${closeRate.rows.map(r => `  ${r.asesor},${r.totalchats},${r.cerrados},${r.tasacierre}%`).join('\n')}

metricasObjetivo:
  tiempoRespuestaIdeal: 5 min
  tiempoEsperaMaximo: 10 min
  tasaCierreMinima: 80%

prompt:
  Analiza este reporte de performance y:
  1. Identifica asesores con mejor/peor rendimiento
  2. Detecta colas con tiempos de espera excesivos
  3. Compara con métricas objetivo
  4. Sugiere acciones de mejora específicas
  5. Genera plan de capacitación si es necesario
`;

  console.log(toonReport);
  console.log('');
  console.log('='.repeat(80));

  await pool.end();
}

generatePerformanceReport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
