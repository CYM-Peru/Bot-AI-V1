/**
 * AI Reports Service
 * Genera reportes en formato TOON para análisis con IA
 */

import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

export interface AIReport {
  type: 'daily' | 'weekly' | 'performance' | 'problems';
  generatedAt: string;
  toonFormat: string;
  metadata: {
    period: string;
    totalChats: number;
    totalAdvisors: number;
  };
}

export class AIReportsService {
  /**
   * Generar reporte diario
   */
  async generateDailyReport(): Promise<AIReport> {
    const conversations = await pool.query(`
      SELECT
        phone,
        status,
        assigned_to,
        queue_id
      FROM crm_conversations
      WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
      ORDER BY created_at DESC
      LIMIT 50
    `);

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

    const advisorStats = await pool.query(`
      SELECT
        u.name as asesor,
        COUNT(CASE WHEN c.status = 'attending' THEN 1 END) as atendiendo,
        COUNT(CASE WHEN c.status = 'active' AND c.assigned_to = u.id THEN 1 END) as porTrabajar,
        COUNT(CASE WHEN c.status = 'closed' AND c.assigned_to = u.id AND c.updated_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000 THEN 1 END) as cerrados
      FROM users u
      LEFT JOIN crm_conversations c ON c.assigned_to = u.id
      WHERE u.role IN ('advisor', 'asesor')
      GROUP BY u.id, u.name
      HAVING COUNT(c.id) > 0
      ORDER BY COUNT(c.id) DESC
    `);

    const toonFormat = `
reporteDiario:
  fecha: ${new Date().toISOString().split('T')[0]}
  sistema: FlowBuilder CRM
  periodo: Últimas 24 horas

resumen:
  conversacionesNuevas: ${conversations.rows.length}
  totalEnSistema: ${conversations.rows.length}

estadisticasPorCola[${queueStats.rows.length}]{cola,enEspera,enAtencion,cerrados}:
${queueStats.rows.map(r => `  ${r.cola},${r.enespera},${r.enatencion},${r.cerrados}`).join('\n')}

estadisticasPorAsesor[${advisorStats.rows.length}]{asesor,atendiendo,porTrabajar,cerrados}:
${advisorStats.rows.map(r => `  ${r.asesor},${r.atendiendo},${r.portrabajar},${r.cerrados}`).join('\n')}

promptParaIA:
  Analiza este reporte diario y genera:
  1. Resumen ejecutivo de las últimas 24 horas
  2. Identificar problemas o patrones anormales
  3. Recomendaciones para mejorar métricas
  4. Alertas si hay algo crítico
`;

    return {
      type: 'daily',
      generatedAt: new Date().toISOString(),
      toonFormat: toonFormat.trim(),
      metadata: {
        period: 'Últimas 24 horas',
        totalChats: conversations.rows.length,
        totalAdvisors: advisorStats.rows.length,
      },
    };
  }

  /**
   * Generar reporte semanal
   */
  async generateWeeklyReport(): Promise<AIReport> {
    const dailyStats = await pool.query(`
      SELECT
        TO_CHAR(to_timestamp(created_at / 1000), 'Day') as dia,
        EXTRACT(DOW FROM to_timestamp(created_at / 1000)) as dia_num,
        COUNT(*) as total_chats,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as cerrados
      FROM crm_conversations
      WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
      GROUP BY dia, dia_num
      ORDER BY dia_num
    `);

    const advisorPerformance = await pool.query(`
      SELECT
        u.name as asesor,
        COUNT(*) as chats_asignados,
        COUNT(CASE WHEN c.status = 'closed' THEN 1 END) as cerrados,
        ROUND(
          COUNT(CASE WHEN c.status = 'closed' THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100,
          1
        ) as tasa_cierre_pct
      FROM users u
      LEFT JOIN crm_conversations c ON c.assigned_to = u.id
      WHERE u.role IN ('advisor', 'asesor')
        AND c.created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
      GROUP BY u.id, u.name
      HAVING COUNT(c.id) > 0
      ORDER BY chats_asignados DESC
    `);

    const queueMetrics = await pool.query(`
      SELECT
        q.name as cola,
        COUNT(*) as total_chats,
        ROUND(AVG((c.assigned_at - c.queued_at) / 1000 / 60), 1) as tiempo_espera_min
      FROM crm_queues q
      JOIN crm_conversations c ON c.queue_id = q.id
      WHERE c.created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
        AND c.queued_at IS NOT NULL
      GROUP BY q.id, q.name
      ORDER BY total_chats DESC
    `);

    const totalChats = dailyStats.rows.reduce((sum, r) => sum + parseInt(r.total_chats), 0);
    const totalCerrados = dailyStats.rows.reduce((sum, r) => sum + parseInt(r.cerrados), 0);

    const toonFormat = `
reporteSemanal:
  periodo: Últimos 7 días
  fecha: ${new Date().toISOString().split('T')[0]}
  sistema: FlowBuilder CRM

resumenSemana:
  totalChats: ${totalChats}
  chatsCerrados: ${totalCerrados}
  tasaCierreGeneral: ${((totalCerrados / totalChats) * 100).toFixed(1)}%

chatsPorDia[${dailyStats.rows.length}]{dia,totalChats,cerrados}:
${dailyStats.rows.map(r => `  ${r.dia.trim()},${r.total_chats},${r.cerrados}`).join('\n')}

performancePorAsesor[${advisorPerformance.rows.length}]{asesor,chatsAsignados,cerrados,tasaCierrePct}:
${advisorPerformance.rows.map(r => `  ${r.asesor},${r.chats_asignados},${r.cerrados},${r.tasa_cierre_pct}%`).join('\n')}

metricasPorCola[${queueMetrics.rows.length}]{cola,totalChats,tiempoEsperaMin}:
${queueMetrics.rows.map(r => `  ${r.cola},${r.total_chats},${r.tiempo_espera_min}`).join('\n')}

objetivosDeseados:
  tiempoRespuestaMaximo: 5 min
  tiempoEsperaMaximo: 10 min
  tasaCierreMinima: 80%

promptParaIA:
  Analiza este reporte semanal y genera:
  1. Resumen ejecutivo de la semana
  2. Identificar tendencias y patrones
  3. Asesores que necesitan capacitación
  4. Oportunidades de mejora específicas
  5. Recomendaciones priorizadas
  6. Predicción para próxima semana
`;

    return {
      type: 'weekly',
      generatedAt: new Date().toISOString(),
      toonFormat: toonFormat.trim(),
      metadata: {
        period: 'Últimos 7 días',
        totalChats,
        totalAdvisors: advisorPerformance.rows.length,
      },
    };
  }

  /**
   * Generar reporte de performance
   */
  async generatePerformanceReport(): Promise<AIReport> {
    const responseTime = await pool.query(`
      SELECT
        u.name as asesor,
        AVG(
          CASE
            WHEN c.assigned_at IS NOT NULL AND c.updated_at IS NOT NULL
            THEN (c.updated_at - c.assigned_at) / 1000 / 60
          END
        ) as tiempoPromedioMin,
        COUNT(*) as totalChats
      FROM crm_conversations c
      JOIN users u ON c.assigned_to = u.id
      WHERE c.assigned_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
      GROUP BY u.id, u.name
      ORDER BY tiempoPromedioMin DESC
    `);

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

    const toonFormat = `
reportePerformance:
  periodo: Últimos 7 días
  fecha: ${new Date().toISOString().split('T')[0]}
  sistema: FlowBuilder CRM

tiempoRespuestaPorAsesor[${responseTime.rows.length}]{asesor,tiempoPromedioMin,totalChats}:
${responseTime.rows.map(r => `  ${r.asesor},${parseFloat(r.tiempopromediomin || 0).toFixed(1)},${r.totalchats}`).join('\n')}

tiempoEsperaPorCola[${queueTime.rows.length}]{cola,tiempoEsperaMin,totalChats}:
${queueTime.rows.map(r => `  ${r.cola},${parseFloat(r.tiempoesperamin || 0).toFixed(1)},${r.totalchats}`).join('\n')}

tasaCierrePorAsesor[${closeRate.rows.length}]{asesor,totalChats,cerrados,tasaCierre}:
${closeRate.rows.map(r => `  ${r.asesor},${r.totalchats},${r.cerrados},${r.tasacierre}%`).join('\n')}

metricasObjetivo:
  tiempoRespuestaIdeal: 5 min
  tiempoEsperaMaximo: 10 min
  tasaCierreMinima: 80%

promptParaIA:
  Analiza este reporte de performance y:
  1. Identifica asesores con mejor/peor rendimiento
  2. Detecta colas con tiempos de espera excesivos
  3. Compara con métricas objetivo
  4. Sugiere acciones de mejora específicas
  5. Genera plan de capacitación si es necesario
`;

    return {
      type: 'performance',
      generatedAt: new Date().toISOString(),
      toonFormat: toonFormat.trim(),
      metadata: {
        period: 'Últimos 7 días',
        totalChats: responseTime.rows.reduce((sum, r) => sum + parseInt(r.totalchats), 0),
        totalAdvisors: responseTime.rows.length,
      },
    };
  }

  /**
   * Detectar problemas actuales
   */
  async generateProblemsReport(): Promise<AIReport> {
    const abandoned = await pool.query(`
      SELECT
        c.phone,
        q.name as cola,
        ROUND((EXTRACT(EPOCH FROM NOW()) * 1000 - c.queued_at) / 1000 / 60, 1) as minutosEsperando
      FROM crm_conversations c
      JOIN crm_queues q ON c.queue_id = q.id
      WHERE c.status = 'active'
        AND c.assigned_to IS NULL
        AND c.queued_at IS NOT NULL
        AND c.queued_at < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 minutes') * 1000
      ORDER BY minutosEsperando DESC
      LIMIT 20
    `);

    const slowResponse = await pool.query(`
      SELECT
        c.phone,
        u.name as asesor,
        q.name as cola,
        ROUND((c.updated_at - c.assigned_at) / 1000 / 60, 1) as tiempoRespuestaMin
      FROM crm_conversations c
      JOIN users u ON c.assigned_to = u.id
      JOIN crm_queues q ON c.queue_id = q.id
      WHERE c.assigned_at IS NOT NULL
        AND c.updated_at IS NOT NULL
        AND (c.updated_at - c.assigned_at) / 1000 / 60 > 60
        AND c.assigned_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
      ORDER BY tiempoRespuestaMin DESC
      LIMIT 20
    `);

    const highLoad = await pool.query(`
      SELECT
        u.name as asesor,
        COUNT(CASE WHEN c.status = 'attending' THEN 1 END) as atendiendo,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as pendientes,
        COUNT(*) as totalCarga
      FROM users u
      JOIN crm_conversations c ON c.assigned_to = u.id
      WHERE c.status IN ('active', 'attending')
      GROUP BY u.id, u.name
      ORDER BY totalCarga DESC
      LIMIT 10
    `);

    const toonFormat = `
reporteProblemas:
  fecha: ${new Date().toISOString().split('T')[0]}
  sistema: FlowBuilder CRM
  urgencia: ALTA

chatsAbandonados[${abandoned.rows.length}]{phone,cola,minutosEsperando}:
${abandoned.rows.length > 0 ? abandoned.rows.map(r => `  ${r.phone},${r.cola},${r.minutosesperando}`).join('\n') : '  (ninguno)'}

respuestasLentas[${slowResponse.rows.length}]{phone,asesor,cola,tiempoRespuestaMin}:
${slowResponse.rows.length > 0 ? slowResponse.rows.map(r => `  ${r.phone},${r.asesor},${r.cola},${r.tiemporespuestamin}`).join('\n') : '  (ninguno)'}

asesoresSobrecargados[${highLoad.rows.length}]{asesor,atendiendo,pendientes,totalCarga}:
${highLoad.rows.length > 0 ? highLoad.rows.map(r => `  ${r.asesor},${r.atendiendo},${r.pendientes},${r.totalcarga}`).join('\n') : '  (ninguno)'}

promptParaIA:
  URGENTE - Analiza estos problemas actuales y:
  1. Prioriza por severidad (crítico/alto/medio)
  2. Identifica causa raíz de cada problema
  3. Sugiere acciones INMEDIATAS
  4. Estima impacto en satisfacción del cliente
  5. Recomienda prevención futura
`;

    return {
      type: 'problems',
      generatedAt: new Date().toISOString(),
      toonFormat: toonFormat.trim(),
      metadata: {
        period: 'Ahora (tiempo real)',
        totalChats: abandoned.rows.length + slowResponse.rows.length,
        totalAdvisors: highLoad.rows.length,
      },
    };
  }
}

export const aiReportsService = new AIReportsService();
