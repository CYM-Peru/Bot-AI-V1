import { Router } from 'express';
import { campaignStorage } from './storage';
import type { Campaign } from './models';
import { sendTemplateMessage } from '../../src/api/whatsapp-sender';
import { getWhatsAppEnv } from '../utils/env';
import { crmDb } from '../crm/db';
import { promises as fs } from 'fs';
import path from 'path';
import { requireSupervisor } from '../middleware/roles';

export function createCampaignsRouter() {
  const router = Router();

  /**
   * POST /campaigns
   * Create a new campaign
   */
  router.post('/', requireSupervisor, (req, res) => {
    try {
      const { name, whatsappNumberId, templateName, language, recipients, variables, scheduledAt, throttleRate } = req.body;

      if (!name || !whatsappNumberId || !templateName || !recipients || !Array.isArray(recipients)) {
        res.status(400).json({
          error: 'invalid_params',
          message: 'Missing required fields: name, whatsappNumberId, templateName, recipients',
        });
        return;
      }

      // Validate and clean phone numbers
      const cleanedRecipients = recipients
        .map((phone: string) => phone.trim().replace(/\D/g, ''))
        .filter((phone: string) => phone.length >= 9 && phone.length <= 15);

      if (cleanedRecipients.length === 0) {
        res.status(400).json({
          error: 'no_valid_recipients',
          message: 'No valid phone numbers found',
        });
        return;
      }

      // Limit to 1000 recipients per campaign
      if (cleanedRecipients.length > 1000) {
        res.status(400).json({
          error: 'too_many_recipients',
          message: 'Maximum 1000 recipients per campaign',
        });
        return;
      }

      const campaign: Campaign = {
        id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        whatsappNumberId,
        templateName,
        language: language || 'es', // Default to Spanish if not specified
        recipients: cleanedRecipients,
        variables: variables || undefined,
        scheduledAt: scheduledAt ? parseInt(scheduledAt, 10) : undefined,
        status: scheduledAt ? 'scheduled' : 'draft',
        createdAt: Date.now(),
        createdBy: req.user?.userId || 'unknown',
        throttleRate: throttleRate || 60, // 60 messages per minute (safe limit)
      };

      const created = campaignStorage.createCampaign(campaign);

      res.json({ campaign: created });
    } catch (error) {
      console.error('[Campaigns] Error creating campaign:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /campaigns
   * Get all campaigns
   */
  router.get('/', (req, res) => {
    try {
      const campaigns = campaignStorage.getAllCampaigns();
      res.json({ campaigns });
    } catch (error) {
      console.error('[Campaigns] Error fetching campaigns:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /campaigns/:id
   * Get a specific campaign
   */
  router.get('/:id', (req, res) => {
    try {
      const campaign = campaignStorage.getCampaign(req.params.id);
      if (!campaign) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ campaign });
    } catch (error) {
      console.error('[Campaigns] Error fetching campaign:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /campaigns/:id/send
   * Start sending a campaign
   */
  router.post('/:id/send', async (req, res) => {
    try {
      const campaign = campaignStorage.getCampaign(req.params.id);
      if (!campaign) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        res.status(400).json({
          error: 'invalid_status',
          message: `Campaign is already ${campaign.status}`,
        });
        return;
      }

      // Update status to sending
      campaignStorage.updateCampaignStatus(campaign.id, 'sending');

      // Start sending in background (don't await)
      sendCampaignMessages(campaign).catch(error => {
        console.error(`[Campaigns] Error sending campaign ${campaign.id}:`, error);
        campaignStorage.updateCampaignStatus(campaign.id, 'failed');
      });

      res.json({ success: true, message: 'Campaign sending started' });
    } catch (error) {
      console.error('[Campaigns] Error starting campaign:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /campaigns/:id
   * Delete a campaign
   */
  router.delete('/:id', requireSupervisor, (req, res) => {
    try {
      const deleted = campaignStorage.deleteCampaign(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[Campaigns] Error deleting campaign:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /campaigns/:id/metrics
   * Get campaign metrics
   */
  router.get('/:id/metrics', (req, res) => {
    try {
      const metrics = campaignStorage.getCampaignMetrics(req.params.id);
      if (!metrics) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ metrics });
    } catch (error) {
      console.error('[Campaigns] Error fetching metrics:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /campaigns/metrics/all
   * Get all campaign metrics
   */
  router.get('/metrics/all', (req, res) => {
    try {
      const allMetrics = campaignStorage.getAllMetrics();
      res.json({ metrics: allMetrics });
    } catch (error) {
      console.error('[Campaigns] Error fetching all metrics:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

/**
 * Get WhatsApp API config for a specific phoneNumberId
 */
async function getWhatsAppConfigForCampaign(phoneNumberId: string): Promise<any> {
  try {
    const connectionsPath = path.join(process.cwd(), "data", "whatsapp-connections.json");
    const data = await fs.readFile(connectionsPath, "utf-8");
    const parsed = JSON.parse(data);
    const connection = parsed.connections?.find((c: any) => c.phoneNumberId === phoneNumberId);

    if (connection && connection.accessToken) {
      const baseEnv = getWhatsAppEnv();
      return {
        accessToken: connection.accessToken,
        phoneNumberId: connection.phoneNumberId,
        apiVersion: baseEnv.apiVersion || "v20.0",
        baseUrl: baseEnv.baseUrl || "https://graph.facebook.com",
      };
    }
  } catch (error) {
    console.error(`[Campaigns] Error loading WhatsApp config for ${phoneNumberId}:`, error);
  }

  // Fallback to default config
  const fallback = getWhatsAppEnv();
  fallback.phoneNumberId = phoneNumberId;
  return fallback;
}

/**
 * Send campaign messages with throttling
 */
async function sendCampaignMessages(campaign: Campaign): Promise<void> {
  const delayMs = (60 * 1000) / campaign.throttleRate; // milliseconds between messages

  console.log(`[Campaigns] Starting campaign ${campaign.id}: ${campaign.recipients.length} recipients at ${campaign.throttleRate} msg/min`);

  // CRITICAL: Get correct WhatsApp config for this phoneNumberId
  const config = await getWhatsAppConfigForCampaign(campaign.whatsappNumberId);

  if (!config.accessToken) {
    console.error(`[Campaigns] No access token found for phoneNumberId: ${campaign.whatsappNumberId}`);
    campaignStorage.updateCampaignStatus(campaign.id, 'failed');
    return;
  }

  console.log(`[Campaigns] Using phoneNumberId: ${config.phoneNumberId} with valid access token`);

  for (let i = 0; i < campaign.recipients.length; i++) {
    const phone = campaign.recipients[i];

    try {
      // Send template message
      const result = await sendTemplateMessage(
        config,
        phone,
        campaign.templateName,
        campaign.language || 'es', // Use campaign language or default to Spanish
        campaign.variables || []
      );

      if (result.ok) {
        campaignStorage.updateMessageStatus(campaign.id, phone, 'sent');
        console.log(`[Campaigns] Sent to ${phone} (${i + 1}/${campaign.recipients.length})`);

        // Register message in CRM
        try {
          let conversation = crmDb.getConversationByPhoneAndChannel(phone, 'whatsapp', campaign.whatsappNumberId);
          if (!conversation) {
            conversation = crmDb.createConversation(phone, 'whatsapp', campaign.whatsappNumberId);
          }

          // Append outgoing template message to CRM
          crmDb.appendMessage({
            convId: conversation.id,
            direction: 'outgoing',
            type: 'text',
            text: `📢 Plantilla: ${campaign.templateName}`,
            mediaUrl: null,
            mediaThumb: null,
            repliedToId: null,
            status: 'sent',
            providerMetadata: {
              campaign_id: campaign.id,
              template_name: campaign.templateName,
            },
          });

          console.log(`[Campaigns] Message registered in CRM for ${phone}`);
        } catch (crmError) {
          console.error(`[Campaigns] Failed to register message in CRM for ${phone}:`, crmError);
        }
      } else {
        campaignStorage.updateMessageStatus(campaign.id, phone, 'failed', {
          failReason: `Error ${result.status}`,
        });
        console.error(`[Campaigns] Failed to send to ${phone}: Status ${result.status}`);
      }
    } catch (error) {
      campaignStorage.updateMessageStatus(campaign.id, phone, 'failed', {
        failReason: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`[Campaigns] Error sending to ${phone}:`, error);
    }

    // Throttle: wait before sending next message
    if (i < campaign.recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Mark campaign as completed
  campaignStorage.updateCampaignStatus(campaign.id, 'completed');
  console.log(`[Campaigns] Campaign ${campaign.id} completed`);
}
