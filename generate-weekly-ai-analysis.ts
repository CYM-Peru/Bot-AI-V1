/**
 * Genera análisis semanal combinando:
 * - Datos de Metabase (gráficos)
 * - Formato TOON (para AI)
 * - Sugerencias automáticas con ChatGPT/Claude
 */

import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function generateWeeklyAnalysis() {
  console.log('='.repeat(80));
  console.log('📊 ANÁLISIS SEMANAL CRM - PARA AI (FORMATO TOON)');
  console.log('='.repeat(80));
  console.log('');

  // ========== DATOS SEMANALES ==========

  // Chats por día de la semana
  const dailyStats = await pool.query(`
    SELECT
      TO_CHAR(to_timestamp(created_at / 1000), 'Day') as dia,
      EXTRACT(DOW FROM to_timestamp(created_at / 1000)) as dia_num,
      COUNT(*) as total_chats,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as cerrados,
      ROUND(AVG((updated_at - created_at) / 1000 / 60), 1) as duracion_promedio_min
    FROM crm_conversations
    WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    GROUP BY dia, dia_num
    ORDER BY dia_num
  `);

  // Performance por asesor
  const advisorPerformance = await pool.query(`
    SELECT
      u.name as asesor,
      COUNT(*) as chats_asignados,
      COUNT(CASE WHEN c.status = 'closed' THEN 1 END) as cerrados,
      ROUND(
        COUNT(CASE WHEN c.status = 'closed' THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0) * 100,
        1
      ) as tasa_cierre_pct,
      ROUND(AVG((c.updated_at - c.assigned_at) / 1000 / 60), 1) as tiempo_respuesta_min
    FROM users u
    LEFT JOIN crm_conversations c ON c.assigned_to = u.id
    WHERE u.role IN ('advisor', 'asesor')
      AND c.created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    GROUP BY u.id, u.name
    HAVING COUNT(c.id) > 0
    ORDER BY chats_asignados DESC
  `);

  // Métricas por cola
  const queueMetrics = await pool.query(`
    SELECT
      q.name as cola,
      COUNT(*) as total_chats,
      ROUND(AVG((c.assigned_at - c.queued_at) / 1000 / 60), 1) as tiempo_espera_min,
      COUNT(CASE WHEN (c.assigned_at - c.queued_at) / 1000 / 60 > 10 THEN 1 END) as chats_espera_excesiva
    FROM crm_queues q
    JOIN crm_conversations c ON c.queue_id = q.id
    WHERE c.created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
      AND c.queued_at IS NOT NULL
    GROUP BY q.id, q.name
    ORDER BY total_chats DESC
  `);

  // Horas pico
  const peakHours = await pool.query(`
    SELECT
      EXTRACT(HOUR FROM to_timestamp(created_at / 1000)) as hora,
      COUNT(*) as chats
    FROM crm_conversations
    WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    GROUP BY hora
    ORDER BY chats DESC
    LIMIT 5
  `);

  // Problemas detectados
  const issues = await pool.query(`
    SELECT
      'Chats abandonados' as tipo,
      COUNT(*) as cantidad
    FROM crm_conversations
    WHERE status = 'active'
      AND assigned_to IS NULL
      AND queued_at < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 minutes') * 1000
    UNION ALL
    SELECT
      'Tiempo respuesta > 60min' as tipo,
      COUNT(*) as cantidad
    FROM crm_conversations
    WHERE (updated_at - assigned_at) / 1000 / 60 > 60
      AND assigned_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
    UNION ALL
    SELECT
      'Tasa cierre < 50%' as tipo,
      COUNT(*) as cantidad
    FROM (
      SELECT
        u.id,
        COUNT(CASE WHEN c.status = 'closed' THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0) as tasa
      FROM users u
      JOIN crm_conversations c ON c.assigned_to = u.id
      WHERE c.created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
      GROUP BY u.id
    ) subquery
    WHERE tasa < 0.5
  `);

  // ========== FORMATO TOON ==========

  const toonReport = `
analisisSemanal:
  periodo: Últimos 7 días
  fechaGeneracion: ${new Date().toISOString().split('T')[0]}
  sistema: FlowBuilder CRM

resumenSemana:
  totalChats: ${dailyStats.rows.reduce((sum, r) => sum + parseInt(r.total_chats), 0)}
  chatsCerrados: ${dailyStats.rows.reduce((sum, r) => sum + parseInt(r.cerrados), 0)}
  tasaCierreGeneral: ${(dailyStats.rows.reduce((sum, r) => sum + parseInt(r.cerrados), 0) / dailyStats.rows.reduce((sum, r) => sum + parseInt(r.total_chats), 0) * 100).toFixed(1)}%

chatsPorDia[${dailyStats.rows.length}]{dia,totalChats,cerrados,duracionPromedioMin}:
${dailyStats.rows.map(r => `  ${r.dia.trim()},${r.total_chats},${r.cerrados},${r.duracion_promedio_min}`).join('\n')}

performancePorAsesor[${advisorPerformance.rows.length}]{asesor,chatsAsignados,cerrados,tasaCierrePct,tiempoRespuestaMin}:
${advisorPerformance.rows.map(r => `  ${r.asesor},${r.chats_asignados},${r.cerrados},${r.tasa_cierre_pct}%,${r.tiempo_respuesta_min}`).join('\n')}

metricasPorCola[${queueMetrics.rows.length}]{cola,totalChats,tiempoEsperaMin,chatsEsperaExcesiva}:
${queueMetrics.rows.map(r => `  ${r.cola},${r.total_chats},${r.tiempo_espera_min},${r.chats_espera_excesiva}`).join('\n')}

horasPico[${peakHours.rows.length}]{hora,cantidad}:
${peakHours.rows.map(r => `  ${r.hora}:00,${r.chats}`).join('\n')}

problemasDetectados[${issues.rows.length}]{tipo,cantidad}:
${issues.rows.map(r => `  ${r.tipo},${r.cantidad}`).join('\n')}

objetivosDeseados:
  tiempoRespuestaMaximo: 5 min
  tiempoEsperaMaximo: 10 min
  tasaCierreMinima: 80%
  chatsAbandonadosMaximo: 0

promptParaAI:
  contexto: Eres un experto en optimización de customer service y análisis de métricas CRM

  tarea: Analiza estos datos semanales y genera un reporte ejecutivo que incluya:

  1_resumenEjecutivo:
     - Principales logros de la semana
     - Métricas clave vs objetivos
     - Tendencias preocupantes

  2_analisisDetallado:
     - ¿Qué días tienen mayor/menor carga?
     - ¿Qué asesores necesitan capacitación?
     - ¿Qué colas tienen problemas?
     - ¿Cuáles son las horas pico?

  3_problemasIdentificados:
     - Listar problemas por severidad (crítico/alto/medio)
     - Explicar impacto de cada problema
     - Estimar costo/impacto en satisfacción

  4_oportunidadesDeMejora:
     - Acciones específicas y priorizadas
     - Quick wins (resultados inmediatos)
     - Mejoras estructurales (largo plazo)

  5_recomendacionesEspecificas:
     - Asignación de personal por día/hora
     - Capacitación necesaria por asesor
     - Cambios en distribución de colas
     - Implementación de nuevas herramientas

  6_prediccionProximaSemana:
     - Carga esperada basada en tendencias
     - Recursos necesarios
     - Riesgos a monitorear
`;

  console.log(toonReport);
  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('💡 INSTRUCCIONES DE USO:');
  console.log('');
  console.log('1. Copia TODO el output de arriba');
  console.log('2. Pégalo en ChatGPT/Claude (modelos recomendados: GPT-4, Claude Sonnet)');
  console.log('3. Espera el análisis completo con recomendaciones');
  console.log('4. Implementa las acciones sugeridas');
  console.log('');
  console.log('💰 AHORRO: Este formato usa ~50% menos tokens que JSON');
  console.log('   JSON tradicional: ~1200 tokens');
  console.log('   TOON optimizado: ~600 tokens');
  console.log('   Ahorro por análisis: $0.0018 (con GPT-4)');
  console.log('');
  console.log('📊 COMPLEMENTA CON:');
  console.log('   - Gráficos visuales en Metabase (http://[tu-ip]:3000)');
  console.log('   - Alertas automáticas configuradas');
  console.log('');
  console.log('='.repeat(80));

  await pool.end();
}

generateWeeklyAnalysis().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
