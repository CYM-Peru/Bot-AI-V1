import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

interface CRMData {
  conversations: any[];
  messages: any[];
  attachments: any[];
  lastTicketNumber: number;
}

async function migrateData() {
  console.log('🚀 Iniciando migración de datos JSON a PostgreSQL...\n');

  try {
    // Leer datos del JSON
    const jsonPath = path.join(process.cwd(), 'data', 'crm.json');
    console.log(`📖 Leyendo datos de: ${jsonPath}`);

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const data: CRMData = JSON.parse(rawData);

    console.log(`\n📊 Datos encontrados:`);
    console.log(`   - Conversaciones: ${data.conversations?.length || 0}`);
    console.log(`   - Mensajes: ${data.messages?.length || 0}`);
    console.log(`   - Attachments: ${data.attachments?.length || 0}`);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Migrar conversaciones
      console.log(`\n💬 Migrando conversaciones...`);
      let convCount = 0;

      for (const conv of data.conversations || []) {
        await client.query(`
          INSERT INTO crm_conversations (
            id, phone, contact_name, bitrix_id, bitrix_document, avatar_url,
            last_message_at, last_message_preview, unread, status,
            assigned_to, assigned_at, queued_at, queue_id, channel,
            channel_connection_id, phone_number_id, display_number,
            attended_by, ticket_number, bot_started_at, bot_flow_id,
            read_at, transferred_from, transferred_at, active_advisors,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26,
            COALESCE($27, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
            COALESCE($28, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
          ) ON CONFLICT (id) DO NOTHING
        `, [
          conv.id,
          conv.phone,
          conv.contactName,
          conv.bitrixId,
          conv.bitrixDocument ? JSON.stringify(conv.bitrixDocument) : null,
          conv.avatarUrl,
          conv.lastMessageAt,
          conv.lastMessagePreview,
          conv.unread || 0,
          conv.status || 'active',
          conv.assignedTo,
          conv.assignedAt,
          conv.queuedAt,
          conv.queueId,
          conv.channel || 'whatsapp',
          conv.channelConnectionId,
          conv.phoneNumberId,
          conv.displayNumber,
          conv.attendedBy ? JSON.stringify(conv.attendedBy) : '[]',
          conv.ticketNumber,
          conv.botStartedAt,
          conv.botFlowId,
          conv.readAt,
          conv.transferredFrom,
          conv.transferredAt,
          conv.activeAdvisors ? JSON.stringify(conv.activeAdvisors) : '[]',
          null, // created_at (usará default)
          null  // updated_at (usará default)
        ]);
        convCount++;

        if (convCount % 10 === 0) {
          process.stdout.write(`\r   ✅ ${convCount}/${data.conversations.length} conversaciones migradas`);
        }
      }
      console.log(`\n   ✅ ${convCount} conversaciones migradas`);

      // Migrar mensajes
      console.log(`\n📨 Migrando mensajes...`);
      let msgCount = 0;
      let skippedMsg = 0;

      for (const msg of data.messages || []) {
        // Skip messages without conversation_id (field is 'convId' in JSON)
        if (!msg.convId) {
          skippedMsg++;
          continue;
        }

        await client.query(`
          INSERT INTO crm_messages (
            id, conversation_id, direction, type, text, media_url,
            media_thumb, replied_to_id, status, timestamp, metadata, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            COALESCE($12, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
          ) ON CONFLICT (id) DO NOTHING
        `, [
          msg.id,
          msg.convId,  // Changed from conversationId to convId
          msg.direction,
          msg.type || 'text',
          msg.text,
          msg.mediaUrl,
          msg.mediaThumb,
          msg.repliedToId,
          msg.status || 'sent',
          msg.createdAt || Date.now(),  // Changed from timestamp to createdAt
          msg.providerMetadata ? JSON.stringify(msg.providerMetadata) : null,  // Changed from metadata
          null  // created_at (usará default)
        ]);
        msgCount++;

        if (msgCount % 50 === 0) {
          process.stdout.write(`\r   ✅ ${msgCount}/${data.messages.length} mensajes migrados`);
        }
      }
      console.log(`\n   ✅ ${msgCount} mensajes migrados`);
      if (skippedMsg > 0) {
        console.log(`   ⚠️  ${skippedMsg} mensajes omitidos (sin conversationId)`);
      }

      // Migrar attachments
      console.log(`\n📎 Migrando attachments...`);
      let attCount = 0;
      let skippedAtt = 0;

      for (const att of data.attachments || []) {
        // Skip attachments without messageId
        if (!att.messageId) {
          skippedAtt++;
          continue;
        }

        await client.query(`
          INSERT INTO crm_attachments (
            id, message_id, type, url, thumbnail, filename, mimetype, size, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            COALESCE($9, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
          ) ON CONFLICT (id) DO NOTHING
        `, [
          att.id,
          att.messageId,
          att.type,
          att.url,
          att.thumbnail,
          att.filename,
          att.mimetype,
          att.size,
          null  // created_at (usará default)
        ]);
        attCount++;
      }
      console.log(`   ✅ ${attCount} attachments migrados`);
      if (skippedAtt > 0) {
        console.log(`   ⚠️  ${skippedAtt} attachments omitidos (sin messageId)`);
      }

      await client.query('COMMIT');

      console.log(`\n🎉 ¡Migración completada exitosamente!`);
      console.log(`\n📊 Resumen:`);
      console.log(`   - Conversaciones: ${convCount}`);
      console.log(`   - Mensajes: ${msgCount}`);
      console.log(`   - Attachments: ${attCount}`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateData();
