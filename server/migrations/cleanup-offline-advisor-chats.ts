/**
 * Cleanup Script: Return Chats Assigned to Offline Advisors
 *
 * Returns ALL chats assigned to advisors who are NOT currently online
 * (don't have an active session), regardless of their status.
 *
 * This fixes the issue where chats were assigned based on STATUS
 * but without checking if the advisor was actually ONLINE.
 *
 * Usage:
 *   POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx server/migrations/cleanup-offline-advisor-chats.ts
 */

import pg from 'pg';

const { Pool } = pg;

async function cleanupOfflineAdvisorChats() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'flowbuilder_crm',
    user: process.env.POSTGRES_USER || 'whatsapp_user',
    password: process.env.POSTGRES_PASSWORD,
    max: 5,
  });

  try {
    console.log('[Cleanup] 🔍 Buscando chats asignados a asesores offline...\n');

    // Find chats assigned to advisors who DON'T have an active session
    const result = await pool.query(`
      SELECT
        c.id as conversation_id,
        c.phone,
        u.name as asesor,
        u.id as asesor_id,
        s.name as estado,
        c.status as chat_status,
        to_timestamp(c.assigned_at/1000) AT TIME ZONE 'America/Lima' as asignado_en,
        (SELECT COUNT(*) FROM advisor_sessions asess
         WHERE asess.advisor_id = u.id
           AND asess.end_time IS NULL) as sesiones_activas
      FROM crm_conversations c
      JOIN users u ON c.assigned_to = u.id
      LEFT JOIN crm_advisor_status_assignments sa ON u.id = sa.user_id
      LEFT JOIN crm_advisor_statuses s ON sa.status_id = s.id
      WHERE c.status IN ('active', 'attending')
        AND c.assigned_to IS NOT NULL
        AND c.assigned_to != 'bot'
        AND u.role IN ('asesor', 'teleoperadora', 'supervisor')
        AND NOT EXISTS (
          SELECT 1 FROM advisor_sessions asess
          WHERE asess.advisor_id = u.id
            AND asess.end_time IS NULL
        )
      ORDER BY u.name, c.phone
    `);

    if (result.rows.length === 0) {
      console.log('[Cleanup] ✅ No se encontraron chats asignados a asesores offline');
      await pool.end();
      return;
    }

    console.log(`[Cleanup] ⚠️  Encontrados ${result.rows.length} chat(s) asignados a asesores SIN SESIÓN ACTIVA:\n`);

    // Group by advisor for display
    const byAdvisor = new Map<string, any[]>();
    for (const row of result.rows) {
      const list = byAdvisor.get(row.asesor) || [];
      list.push(row);
      byAdvisor.set(row.asesor, list);
    }

    for (const [asesor, chats] of byAdvisor.entries()) {
      const estado = chats[0].estado || 'SIN ESTADO';
      console.log(`  📋 ${asesor} (Estado: ${estado}, Sesiones: ${chats[0].sesiones_activas})`);
      for (const chat of chats) {
        console.log(`     - ${chat.phone} [${chat.chat_status}] asignado ${chat.asignado_en}`);
      }
    }

    console.log('');
    console.log('[Cleanup] 🔄 Devolviendo chats a la cola...\n');

    // Return chats to queue
    let returned = 0;
    for (const row of result.rows) {
      try {
        await pool.query(
          `UPDATE crm_conversations
           SET assigned_to = NULL, assigned_at = NULL
           WHERE id = $1`,
          [row.conversation_id]
        );
        console.log(`[Cleanup] ✅ ${row.phone} devuelto a cola (era de ${row.asesor} - OFFLINE)`);
        returned++;
      } catch (error) {
        console.error(`[Cleanup] ❌ Error devolviendo ${row.phone}:`, error);
      }
    }

    console.log('');
    console.log(`[Cleanup] ✅ Devueltos ${returned}/${result.rows.length} chat(s) a la cola`);

  } catch (error) {
    console.error('[Cleanup] ❌ Error durante limpieza:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupOfflineAdvisorChats()
  .then(() => {
    console.log('\n[Cleanup] 🎉 Limpieza completada exitosamente!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Cleanup] 💥 Limpieza falló:', error);
    process.exit(1);
  });
