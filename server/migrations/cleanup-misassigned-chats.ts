/**
 * Cleanup Script: Return Misassigned Chats to Queue
 *
 * Returns chats assigned to advisors who are "Desconectado" or offline
 * back to the queue.
 *
 * Usage:
 *   POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx server/migrations/cleanup-misassigned-chats.ts
 */

import pg from 'pg';

const { Pool } = pg;

async function cleanupMisassignedChats() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'flowbuilder_crm',
    user: process.env.POSTGRES_USER || 'whatsapp_user',
    password: process.env.POSTGRES_PASSWORD,
    max: 5,
  });

  try {
    console.log('[Cleanup] 🔍 Buscando chats asignados incorrectamente...\n');

    // Find chats assigned to advisors with "Desconectado" status
    const result = await pool.query(`
      SELECT
        c.id as conversation_id,
        c.phone,
        u.name as asesor,
        s.name as estado,
        c.status as chat_status
      FROM crm_conversations c
      JOIN users u ON c.assigned_to = u.id
      LEFT JOIN crm_advisor_status_assignments sa ON u.id = sa.user_id
      LEFT JOIN crm_advisor_statuses s ON sa.status_id = s.id
      WHERE c.status IN ('active', 'attending')
        AND c.assigned_to IS NOT NULL
        AND (s.name = 'Desconectado' OR s.action = 'pause' OR s.action = 'redirect')
      ORDER BY u.name, c.phone
    `);

    if (result.rows.length === 0) {
      console.log('[Cleanup] ✅ No se encontraron chats asignados incorrectamente');
      await pool.end();
      return;
    }

    console.log(`[Cleanup] ⚠️  Encontrados ${result.rows.length} chat(s) asignados incorrectamente:\n`);

    // Group by advisor for display
    const byAdvisor = new Map<string, any[]>();
    for (const row of result.rows) {
      const list = byAdvisor.get(row.asesor) || [];
      list.push(row);
      byAdvisor.set(row.asesor, list);
    }

    for (const [asesor, chats] of byAdvisor.entries()) {
      console.log(`  📋 ${asesor}: ${chats.length} chat(s)`);
      for (const chat of chats) {
        console.log(`     - ${chat.phone} [${chat.chat_status}] (Estado: ${chat.estado})`);
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
        console.log(`[Cleanup] ✅ ${row.phone} devuelto a cola (era de ${row.asesor})`);
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
cleanupMisassignedChats()
  .then(() => {
    console.log('\n[Cleanup] 🎉 Limpieza completada exitosamente!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Cleanup] 💥 Limpieza falló:', error);
    process.exit(1);
  });
