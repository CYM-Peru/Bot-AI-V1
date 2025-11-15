/**
 * WhatsApp Status Updates Handler for Campaigns
 *
 * Processes WhatsApp webhooks for message status updates (delivered, read, failed)
 * and updates campaign metrics accordingly.
 */

import { campaignStorage } from './storage';

interface WhatsAppStatus {
  id: string; // message_id
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

export class CampaignWebhookHandler {
  /**
   * Process WhatsApp webhook for status updates
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
      console.error('[CampaignWebhook] Error processing webhook:', error);
    }
  }

  /**
   * Process status updates from WhatsApp
   */
  private processStatusUpdates(statuses: WhatsAppStatus[]): void {
    for (const status of statuses) {
      try {
        const messageId = status.id;
        const newStatus = status.status;
        const recipientPhone = status.recipient_id;

        console.log(`[CampaignWebhook] Status update: messageId=${messageId}, status=${newStatus}, phone=${recipientPhone}`);

        // Find which campaign this message belongs to
        const campaign = this.findCampaignByMessageId(messageId, recipientPhone);

        if (campaign) {
          console.log(`[CampaignWebhook] ✅ Found campaign: ${campaign.id} - Updating status to '${newStatus}'`);

          // Update campaign metrics
          campaignStorage.updateMessageStatus(
            campaign.id,
            recipientPhone,
            newStatus,
            {
              messageId: messageId,
              errorCode: status.errors?.[0]?.code,
              errorTitle: status.errors?.[0]?.title,
            }
          );
        } else {
          console.log(`[CampaignWebhook] ℹ️  Message ${messageId} not found in any campaign (might be regular CRM message)`);
        }
      } catch (error) {
        console.error('[CampaignWebhook] Error processing status:', error);
      }
    }
  }

  /**
   * Find campaign that contains a specific message ID and recipient phone
   */
  private findCampaignByMessageId(messageId: string, recipientPhone: string): { id: string } | null {
    try {
      const campaigns = campaignStorage.getAllCampaigns();

      for (const campaign of campaigns) {
        const metrics = campaignStorage.getCampaignMetrics(campaign.id);

        if (!metrics) continue;

        // Check if this campaign has this recipient
        const detail = metrics.details.find(d => {
          // Clean phone numbers for comparison (remove country code prefix if needed)
          const cleanRecipient = recipientPhone.replace(/^\+/, '');
          const cleanDetail = d.phone.replace(/^\+/, '');

          return cleanDetail === cleanRecipient ||
                 cleanDetail.endsWith(cleanRecipient) ||
                 cleanRecipient.endsWith(cleanDetail);
        });

        if (detail) {
          // Check if message ID matches
          if (detail.messageId === messageId) {
            return campaign;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[CampaignWebhook] Error finding campaign:', error);
      return null;
    }
  }
}

export const campaignWebhookHandler = new CampaignWebhookHandler();
