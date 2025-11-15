/**
 * PostgreSQL Sync Layer
 * Hooks into existing crmDb to sync to PostgreSQL
 */

import { crmDb } from './db';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  max: 20,
});

// Hook into createConversation
const originalCreateConversation = crmDb.createConversation.bind(crmDb);
crmDb.createConversation = function(...args) {
  const conv = originalCreateConversation(...args);

  // Sync to PostgreSQL asynchronously (don't block - use setImmediate for next tick)
  setImmediate(async () => {
    try {
      await pool.query(`
        INSERT INTO crm_conversations (
          id, phone, contact_name, avatar_url, last_message_at, unread, status,
          channel, channel_connection_id, phone_number_id, display_number,
          attended_by, ticket_number, active_advisors, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          phone = EXCLUDED.phone,
          last_message_at = EXCLUDED.last_message_at,
          updated_at = EXCLUDED.updated_at
      `, [
        conv.id, conv.phone, conv.contactName, conv.avatarUrl, conv.lastMessageAt,
        conv.unread, conv.status, conv.channel, conv.channelConnectionId,
        conv.phoneNumberId, conv.displayNumber, JSON.stringify(conv.attendedBy || []),
        conv.ticketNumber, JSON.stringify(conv.activeAdvisors || []),
        Date.now(), Date.now()
      ]);
    } catch (err) {
      console.error('[Sync] Error syncing conversation:', err);
    }
  });

  return conv;
};

// Hook into appendMessage
const originalAppendMessage = crmDb.appendMessage.bind(crmDb);
crmDb.appendMessage = function(...args) {
  const message = originalAppendMessage(...args);

  // Sync to PostgreSQL asynchronously
  const now = Date.now();
  pool.query(`
    INSERT INTO crm_messages (
      id, conversation_id, direction, type, text, media_url,
      media_thumb, replied_to_id, status, timestamp, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO NOTHING
  `, [
    message.id, message.convId, message.direction, message.type,
    message.text, message.mediaUrl, message.mediaThumb, message.repliedToId,
    message.status, message.createdAt || now, now
  ]).catch(err => console.error('[Sync] Error syncing message:', err));

  return message;
};

// Hook into storeAttachment - CRITICAL FIX for attachments not showing
const originalStoreAttachment = crmDb.storeAttachment.bind(crmDb);
crmDb.storeAttachment = function(...args) {
  const attachment = originalStoreAttachment(...args);

  // Sync to PostgreSQL asynchronously
  setImmediate(async () => {
    try {
      let type = 'document';
      if (attachment.mime.startsWith('image/')) type = 'image';
      else if (attachment.mime.startsWith('audio/')) type = 'audio';
      else if (attachment.mime.startsWith('video/')) type = 'video';

      await pool.query(`
        INSERT INTO crm_attachments (
          id, message_id, type, url, thumbnail, filename, mimetype, size, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          message_id = EXCLUDED.message_id,
          url = EXCLUDED.url,
          thumbnail = EXCLUDED.thumbnail
      `, [
        attachment.id,
        attachment.msgId,
        type,
        attachment.url,
        attachment.thumbUrl,
        attachment.filename,
        attachment.mime,
        attachment.size,
        attachment.createdAt
      ]);
    } catch (err) {
      console.error('[Sync] Error syncing attachment:', err);
    }
  });

  return attachment;
};

console.log('[PostgreSQL Sync] Hooks installed successfully');

export { crmDb };
