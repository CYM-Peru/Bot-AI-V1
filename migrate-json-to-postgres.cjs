const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

// Convertir camelCase a snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

async function migrate() {
  console.log('🚀 Iniciando migración JSON → PostgreSQL...\n');

  // Leer JSON
  const jsonData = JSON.parse(fs.readFileSync('/opt/flow-builder/data/crm.json', 'utf8'));
  console.log(`📊 Total conversaciones en JSON: ${jsonData.conversations.length}`);

  // Obtener conversaciones existentes en PostgreSQL
  const result = await pool.query('SELECT id FROM crm_conversations');
  const existingIds = new Set(result.rows.map(r => r.id));
  console.log(`📊 Total conversaciones en PostgreSQL: ${existingIds.size}\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const conv of jsonData.conversations) {
    try {
      const exists = existingIds.has(conv.id);

      if (exists) {
        // ACTUALIZAR solo los campos nuevos (category, is_favorite, metadata)
        await pool.query(
          `UPDATE crm_conversations
           SET category = $1,
               is_favorite = $2,
               metadata = $3,
               updated_at = $4
           WHERE id = $5`,
          [
            conv.category || null,
            conv.isFavorite || false,
            conv.metadata ? JSON.stringify(conv.metadata) : null,
            Date.now(),
            conv.id
          ]
        );
        updated++;

        if (conv.category === 'desconocido' && updated <= 5) {
          console.log(`✏️  Actualizado: ${conv.phone} → category: "desconocido"`);
        }
      } else {
        // INSERTAR conversación nueva (no debería haber muchas)
        await pool.query(
          `INSERT INTO crm_conversations (
            id, phone, contact_name, bitrix_id, bitrix_document,
            avatar_url, last_message_at, last_message_preview, unread,
            status, assigned_to, assigned_at, queued_at, queue_id,
            channel, channel_connection_id, phone_number_id, display_number,
            attended_by, ticket_number, bot_started_at, bot_flow_id,
            read_at, transferred_from, transferred_at, active_advisors,
            category, is_favorite, metadata, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, $14,
            $15, $16, $17, $18,
            $19, $20, $21, $22,
            $23, $24, $25, $26,
            $27, $28, $29, $30, $31
          )`,
          [
            conv.id,
            conv.phone,
            conv.contactName || null,
            conv.bitrixId || null,
            conv.bitrixDocument ? JSON.stringify(conv.bitrixDocument) : null,
            conv.avatarUrl || null,
            conv.lastMessageAt || null,
            conv.lastMessagePreview || null,
            conv.unread || 0,
            conv.status || 'active',
            conv.assignedTo || null,
            conv.assignedAt || null,
            conv.queuedAt || null,
            conv.queueId || null,
            conv.channel || 'whatsapp',
            conv.channelConnectionId || null,
            conv.phoneNumberId || null,
            conv.displayNumber || null,
            conv.attendedBy ? JSON.stringify(conv.attendedBy) : '[]',
            conv.ticketNumber || null,
            conv.botStartedAt || null,
            conv.botFlowId || null,
            conv.readAt || null,
            conv.transferredFrom || null,
            conv.transferredAt || null,
            conv.activeAdvisors ? JSON.stringify(conv.activeAdvisors) : '[]',
            conv.category || null,
            conv.isFavorite || false,
            conv.metadata ? JSON.stringify(conv.metadata) : null,
            Date.now(),
            Date.now()
          ]
        );
        inserted++;
        console.log(`➕ Insertado: ${conv.phone}`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error en ${conv.phone}:`, error.message);
    }
  }

  console.log('\n✅ MIGRACIÓN COMPLETADA:');
  console.log(`   📝 Conversaciones actualizadas: ${updated}`);
  console.log(`   ➕ Conversaciones insertadas: ${inserted}`);
  console.log(`   ❌ Errores: ${errors}`);

  // Verificar que se migró category correctamente
  const categoryResult = await pool.query(
    "SELECT COUNT(*) as count FROM crm_conversations WHERE category = 'desconocido'"
  );
  console.log(`\n🎯 Verificación:`);
  console.log(`   Conversaciones con category='desconocido': ${categoryResult.rows[0].count}`);

  await pool.end();
}

migrate().catch(console.error);
