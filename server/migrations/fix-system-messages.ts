/**
 * Fix System Messages Script
 *
 * Agrega mensajes del sistema correctos indicando que los chats
 * fueron devueltos a cola, usando los timestamps originales
 *
 * Usage:
 *   POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx server/migrations/fix-system-messages.ts
 */

import pg from 'pg';

const { Pool } = pg;

// Timestamps cuando ocurrió la limpieza (21/11/2025 ~20:35)
const CLEANUP_TIMESTAMP = 1732236900000; // 21/11/2025 20:35:00 Lima time

async function fixSystemMessages() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'flowbuilder_crm',
    user: process.env.POSTGRES_USER || 'whatsapp_user',
    password: process.env.POSTGRES_PASSWORD,
    max: 5,
  });

  try {
    console.log('[Fix] 🔍 Agregando mensajes del sistema correctos...\n');

    // Get all conversations that were recently cleaned up
    const result = await pool.query(`
      SELECT
        c.id as conversation_id,
        c.phone
      FROM crm_conversations c
      WHERE c.phone IN (
        '51903341625', '51942633327', '51962251875', '51965903277',
        '51922480573', '51961991570', '51989042206', '51993316210', '51994292278',
        '51962821890', '51957652832',
        '51923209329', '51924272528', '51959479559', '51968349069',
        '51925468500'
      )
      ORDER BY c.phone
    `);

    console.log(`[Fix] 📋 Encontradas ${result.rows.length} conversaciones\n`);

    let messagesAdded = 0;

    for (const row of result.rows) {
      const { conversation_id, phone } = row;

      // Create system message indicating chat was returned to queue
      const messageId = `msg_${CLEANUP_TIMESTAMP}_${Math.random().toString(36).substr(2, 9)}`;

      await pool.query(`
        INSERT INTO crm_messages (
          id, conversation_id, direction, type, text, timestamp, status, created_at
        ) VALUES ($1, $2, 'outgoing', 'system', $3, $4, 'sent', $5)
      `, [
        messageId,
        conversation_id,
        `🔄 Chat devuelto a cola - Asesor sin sesión activa (Sistema corregido)`,
        CLEANUP_TIMESTAMP,
        CLEANUP_TIMESTAMP
      ]);

      console.log(`[Fix] ✅ ${phone} - Mensaje agregado (timestamp: ${new Date(CLEANUP_TIMESTAMP).toLocaleString('es-PE', { timeZone: 'America/Lima' })})`);
      messagesAdded++;
    }

    console.log(`\n[Fix] ✅ Total: ${messagesAdded} mensajes agregados`);

  } catch (error) {
    console.error('[Fix] ❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixSystemMessages()
  .then(() => {
    console.log('\n[Fix] 🎉 Mensajes corregidos exitosamente!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Fix] 💥 Error:', error);
    process.exit(1);
  });
