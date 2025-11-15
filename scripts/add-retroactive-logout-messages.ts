/**
 * Add retroactive logout messages for today's logouts
 * This script finds all logouts from November 11, 2025 and adds system messages
 * to the conversations that were assigned to those advisors
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
});

interface Logout {
  userId: string;
  userName: string;
  timestamp: Date;
}

async function main() {
  console.log('🔍 Buscando logouts del 11 de noviembre 2025...');

  // Get all logouts from November 11, 2025
  const logoutsResult = await pool.query(`
    SELECT user_id, user_name, timestamp
    FROM advisor_activity_logs
    WHERE event_type = 'logout'
      AND DATE(timestamp AT TIME ZONE 'America/Lima') = '2025-11-11'
    ORDER BY timestamp DESC
  `);

  const logouts: Logout[] = logoutsResult.rows.map(row => ({
    userId: row.user_id,
    userName: row.user_name,
    timestamp: new Date(row.timestamp),
  }));

  console.log(`✅ Encontrados ${logouts.length} logouts del 11 de noviembre`);

  let totalMessagesCreated = 0;

  for (const logout of logouts) {
    console.log(`\n👤 Procesando logout de ${logout.userName} a las ${logout.timestamp.toLocaleString('es-PE')}`);

    // Find conversations assigned to this advisor at the time (active or attending)
    const conversationsResult = await pool.query(`
      SELECT id, status
      FROM crm_conversations
      WHERE assigned_to = $1
        AND (status = 'active' OR status = 'attending')
    `, [logout.userId]);

    const conversations = conversationsResult.rows;

    if (conversations.length === 0) {
      console.log(`   ℹ️  No hay conversaciones asignadas a ${logout.userName}`);
      continue;
    }

    console.log(`   📋 Encontradas ${conversations.length} conversaciones asignadas`);

    // Format timestamp for Peru timezone
    const timestamp = logout.timestamp.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Lima'
    });

    // Create system message for each conversation
    for (const conversation of conversations) {
      // Check if logout message already exists
      const existingMessage = await pool.query(`
        SELECT id
        FROM crm_messages
        WHERE conversation_id = $1
          AND event_type = 'advisor_logout'
          AND sent_by = $2
        LIMIT 1
      `, [conversation.id, logout.userId]);

      if (existingMessage.rows.length > 0) {
        console.log(`   ⏭️  Ya existe mensaje de logout para conversación ${conversation.id}`);
        continue;
      }

      // Create system message
      const messageId = `msg-logout-${logout.userId}-${conversation.id}-${Date.now()}`;
      const messageText = `👋 ${logout.userName} cerró sesión (${timestamp})`;

      await pool.query(`
        INSERT INTO crm_messages (
          id,
          conversation_id,
          direction,
          type,
          text,
          status,
          timestamp,
          created_at,
          event_type,
          sent_by
        ) VALUES ($1, $2, 'outgoing', 'event', $3, 'sent', $4, $4, 'advisor_logout', $5)
      `, [
        messageId,
        conversation.id,
        messageText,
        logout.timestamp.getTime(),
        logout.userId
      ]);

      console.log(`   ✅ Mensaje creado para conversación ${conversation.id}`);
      totalMessagesCreated++;
    }
  }

  console.log(`\n🎉 Proceso completado: ${totalMessagesCreated} mensajes de logout creados`);
  await pool.end();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
