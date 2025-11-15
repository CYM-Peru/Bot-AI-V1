/**
 * CRM Status Updates Handler
 *
 * Processes WhatsApp webhooks for message status updates (delivered, read, failed)
 * and updates CRM message status + emits real-time updates via WebSocket
 */

import { crmDb } from './db';
import type { CrmRealtimeManager } from './ws';
import { logDebug, logError } from '../utils/file-logger';

interface WhatsAppStatus {
  id: string; // whatsapp_message_id
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        statuses?: WhatsAppStatus[];
      };
      field: string;
    }>;
  }>;
}

export class CrmStatusWebhookHandler {
  constructor(private socketManager: CrmRealtimeManager) {}

  /**
   * Process WhatsApp webhook for CRM message status updates
   */
  processWebhook(payload: WhatsAppWebhookPayload): void {
    try {
      if (!payload.entry || payload.entry.length === 0) {
        return;
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const statuses = change.value?.statuses;

          if (statuses && statuses.length > 0) {
            this.processStatusUpdates(statuses);
          }
        }
      }
    } catch (error) {
      logError('[CRM Status Webhook] Error processing webhook:', error);
    }
  }

  /**
   * Process status updates from WhatsApp for CRM messages
   */
  private async processStatusUpdates(statuses: WhatsAppStatus[]): Promise<void> {
    for (const status of statuses) {
      try {
        const whatsappMessageId = status.id;
        const newStatus = status.status;
        const recipientPhone = status.recipient_id;

        logDebug(`[CRM Status] Update: whatsappMessageId=${whatsappMessageId}, status=${newStatus}, phone=${recipientPhone}`);

        // Find message in CRM by whatsapp_message_id in providerMetadata
        const message = await this.findMessageByWhatsAppId(whatsappMessageId);

        if (message) {
          logDebug(`[CRM Status] ✅ Found message: ${message.id} - Updating to '${newStatus}'`);

          // Update message status in database
          const providerMetadata = {
            ...(message.providerMetadata || {}),
            whatsapp_message_id: whatsappMessageId,
            status_timestamp: status.timestamp,
          };

          if (status.errors && status.errors.length > 0) {
            providerMetadata.error_code = status.errors[0].code;
            providerMetadata.error_title = status.errors[0].title;
          }

          await crmDb.updateMessageStatus(message.id, newStatus, providerMetadata);

          // Get attachment if message has one
          let attachment = null;
          if (message.mediaUrl) {
            // Extract attachment ID from URL pattern: /api/crm/attachments/:id
            const match = message.mediaUrl.match(/\/attachments\/([^\/]+)/);
            if (match) {
              const attachmentId = match[1];
              attachment = await crmDb.getAttachment(attachmentId);
            }
          }

          // Emit real-time update via WebSocket
          const updatedMessage = { ...message, status: newStatus };
          this.socketManager.emitMessageUpdate({
            message: updatedMessage,
            attachment
          });

          logDebug(`[CRM Status] ✅ Emitted WebSocket update for message ${message.id}`);
        } else {
          logDebug(`[CRM Status] ℹ️  WhatsApp message ${whatsappMessageId} not found in CRM (might be campaign/bot message)`);
        }
      } catch (error) {
        logError('[CRM Status] Error processing status:', error);
      }
    }
  }

  /**
   * Find CRM message by WhatsApp message ID
   */
  private async findMessageByWhatsAppId(whatsappMessageId: string): Promise<any | null> {
    try {
      // Query PostgreSQL for message with this whatsapp_message_id in metadata
      const { Pool } = await import('pg');
      const pool = new Pool({
        user: process.env.POSTGRES_USER || 'whatsapp_user',
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DB || 'flowbuilder_crm',
        password: process.env.POSTGRES_PASSWORD,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
      });

      try {
        const result = await pool.query(
          `SELECT id, conversation_id, direction, type, text, media_url, media_thumb,
                  replied_to_id, status, timestamp, metadata, sent_by, created_at
           FROM crm_messages
           WHERE direction = 'outgoing'
           AND metadata->>'whatsapp_message_id' = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [whatsappMessageId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          return {
            id: row.id,
            convId: row.conversation_id,
            direction: row.direction,
            type: row.type,
            text: row.text,
            mediaUrl: row.media_url,
            mediaThumb: row.media_thumb,
            repliedToId: row.replied_to_id,
            status: row.status,
            createdAt: parseInt(row.created_at),
            providerMetadata: row.metadata || null,
            sentBy: row.sent_by,
          };
        }

        return null;
      } finally {
        await pool.end();
      }
    } catch (error) {
      logError('[CRM Status] Error finding message by WhatsApp ID:', error);
      return null;
    }
  }
}
