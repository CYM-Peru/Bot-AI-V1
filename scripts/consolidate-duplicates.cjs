#!/usr/bin/env node

/**
 * Script para consolidar conversaciones duplicadas
 *
 * Estrategia:
 * 1. Encuentra conversaciones con mismo phone + channel_connection_id
 * 2. Para cada grupo de duplicados:
 *    - Mantiene la conversación MÁS ANTIGUA (menor created_at)
 *    - Mueve TODOS los mensajes de las duplicadas a la más antigua
 *    - Toma el status MÁS RECIENTE (de la que tiene last_message_at más reciente)
 *    - Toma assigned_to, queue_id de la conversación activa si existe
 *    - Elimina las conversaciones duplicadas
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'whatsapp_user',
  host: 'localhost',
  database: 'flowbuilder_crm',
  password: 'azaleia_pg_2025_secure',
  port: 5432,
});

async function consolidateDuplicates() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔍 Buscando conversaciones duplicadas...\n');

    // Encontrar duplicados
    const duplicatesQuery = `
      SELECT phone, channel_connection_id, COUNT(*) as count
      FROM crm_conversations
      WHERE phone IS NOT NULL
      GROUP BY phone, channel_connection_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const duplicatesResult = await client.query(duplicatesQuery);

    if (duplicatesResult.rows.length === 0) {
      console.log('✅ No se encontraron conversaciones duplicadas');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`📊 Encontrados ${duplicatesResult.rows.length} grupos de duplicados:\n`);

    for (const dup of duplicatesResult.rows) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📞 Teléfono: ${dup.phone}`);
      console.log(`📱 Canal: ${dup.channel_connection_id || 'NULL'}`);
      console.log(`🔢 Duplicados: ${dup.count}`);

      // Obtener todas las conversaciones duplicadas
      const convsQuery = `
        SELECT id, phone, ticket_number, status, created_at, last_message_at,
               assigned_to, queue_id, unread, channel_connection_id
        FROM crm_conversations
        WHERE phone = $1
          AND (channel_connection_id = $2 OR (channel_connection_id IS NULL AND $2 IS NULL))
        ORDER BY created_at ASC
      `;

      const convsResult = await client.query(convsQuery, [dup.phone, dup.channel_connection_id]);
      const conversations = convsResult.rows;

      // La conversación a mantener es la MÁS ANTIGUA
      const keepConv = conversations[0];
      const duplicateConvs = conversations.slice(1);

      const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const ts = parseInt(timestamp);
        return ts > 0 ? new Date(ts).toISOString() : 'N/A';
      };

      console.log(`\n✅ Mantener: #${keepConv.ticket_number || 'N/A'} (${keepConv.id})`);
      console.log(`   Created: ${formatDate(keepConv.created_at)}`);
      console.log(`   Status: ${keepConv.status}`);

      console.log(`\n🗑️  Consolidar ${duplicateConvs.length} duplicados:`);

      // Encontrar la conversación con status más relevante
      let mostRecentStatus = keepConv.status;
      let mostRecentAssigned = keepConv.assigned_to;
      let mostRecentQueue = keepConv.queue_id;
      let latestMessageAt = parseInt(keepConv.last_message_at) || 0;
      let totalUnread = parseInt(keepConv.unread) || 0;

      for (const conv of duplicateConvs) {
        console.log(`   - #${conv.ticket_number || 'N/A'} (${conv.id})`);
        console.log(`     Created: ${formatDate(conv.created_at)}`);
        console.log(`     Status: ${conv.status}`);

        const convLastMsg = parseInt(conv.last_message_at) || 0;
        if (convLastMsg > latestMessageAt) {
          latestMessageAt = convLastMsg;
          mostRecentStatus = conv.status;
          mostRecentAssigned = conv.assigned_to;
          mostRecentQueue = conv.queue_id;
        }

        totalUnread += parseInt(conv.unread) || 0;

        // Mover mensajes de esta conversación a la que se mantiene
        const moveMessagesResult = await client.query(`
          UPDATE crm_messages
          SET conversation_id = $1
          WHERE conversation_id = $2
        `, [keepConv.id, conv.id]);

        console.log(`     ↪ Movidos ${moveMessagesResult.rowCount} mensajes`);

        // Mover attachments
        const moveAttachmentsResult = await client.query(`
          UPDATE crm_attachments
          SET message_id = (
            SELECT m2.id
            FROM crm_messages m2
            WHERE m2.conversation_id = $1
            ORDER BY m2.timestamp DESC
            LIMIT 1
          )
          WHERE message_id IN (
            SELECT id FROM crm_messages WHERE conversation_id = $2
          )
        `, [keepConv.id, conv.id]);

        if (moveAttachmentsResult.rowCount > 0) {
          console.log(`     ↪ Movidos ${moveAttachmentsResult.rowCount} attachments`);
        }
      }

      // Actualizar la conversación que se mantiene con el status más reciente
      const updateResult = await client.query(`
        UPDATE crm_conversations
        SET status = $1,
            assigned_to = $2,
            queue_id = $3,
            unread = $4,
            last_message_at = $5,
            updated_at = $6
        WHERE id = $7
      `, [
        mostRecentStatus,
        mostRecentAssigned,
        mostRecentQueue,
        totalUnread,
        latestMessageAt,
        Date.now(),
        keepConv.id
      ]);

      console.log(`\n🔄 Conversación #${keepConv.ticket_number} actualizada:`);
      console.log(`   Status: ${mostRecentStatus}`);
      console.log(`   Assigned: ${mostRecentAssigned || 'none'}`);
      console.log(`   Queue: ${mostRecentQueue || 'none'}`);
      console.log(`   Unread: ${totalUnread}`);

      // Eliminar las conversaciones duplicadas
      for (const conv of duplicateConvs) {
        await client.query('DELETE FROM crm_conversations WHERE id = $1', [conv.id]);
        console.log(`   ✓ Eliminado duplicado #${conv.ticket_number}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n\n✅ Consolidación completada exitosamente\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la consolidación:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
consolidateDuplicates()
  .then(() => {
    console.log('✨ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
