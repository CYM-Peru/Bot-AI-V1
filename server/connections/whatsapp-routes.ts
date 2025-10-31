import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ProxyAgent } from 'undici';
import { reloadWhatsAppHandler } from '../whatsapp-handler-manager';
import { WhatsAppConnectionManager } from './whatsapp-manager';

const router = Router();

// Helper to get fetch options with proxy if configured
function getFetchOptions(): RequestInit {
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (httpsProxy) {
    const dispatcher = new ProxyAgent(httpsProxy);
    return { dispatcher } as RequestInit;
  }
  return {};
}

// Path to store credentials (same as .env but managed through API)
const ENV_PATH = path.join(process.cwd(), '.env');

interface WhatsAppCredentials {
  phoneNumberId: string;
  displayNumber?: string;
  accessToken: string;
  verifyToken?: string;
}

interface WhatsAppCheckResponse {
  ok: boolean;
  phoneNumberId?: string | null;
  displayNumber?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  reason?: string | null;
  status?: number | null;
  details?: {
    baseUrl: string;
    apiVersion: string;
    hasAccessToken: boolean;
    hasVerifyToken: boolean;
  } | null;
}

/**
 * GET /api/connections/whatsapp/check
 * Check WhatsApp connection status by querying Meta Graph API
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    // Check if credentials are configured
    if (!accessToken || !phoneNumberId) {
      res.json({
        ok: false,
        reason: 'not_configured',
        details: {
          baseUrl: `https://graph.facebook.com/${apiVersion}`,
          apiVersion,
          hasAccessToken: Boolean(accessToken),
          hasVerifyToken: Boolean(verifyToken),
        },
      } as WhatsAppCheckResponse);
      return;
    }

    // Query Meta Graph API to verify phone number
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?access_token=${accessToken}`;
    const response = await fetch(url, getFetchOptions());

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        // Log the error details from Facebook API
        const errorBody = await response.json().catch(() => ({}));
        console.error('[WhatsApp Check] Facebook API Error:', JSON.stringify(errorBody, null, 2));

        res.json({
          ok: false,
          reason: 'invalid_token',
          status,
          details: {
            baseUrl: `https://graph.facebook.com/${apiVersion}`,
            apiVersion,
            hasAccessToken: Boolean(accessToken),
            hasVerifyToken: Boolean(verifyToken),
            error: errorBody,
          },
        } as WhatsAppCheckResponse);
        return;
      }

      res.json({
        ok: false,
        reason: 'provider_error',
        status,
        details: {
          baseUrl: `https://graph.facebook.com/${apiVersion}`,
          apiVersion,
          hasAccessToken: Boolean(accessToken),
          hasVerifyToken: Boolean(verifyToken),
        },
      } as WhatsAppCheckResponse);
      return;
    }

    const data = await response.json() as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
    };

    res.json({
      ok: true,
      phoneNumberId,
      displayNumber: data.display_phone_number || null,
      displayPhoneNumber: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
      details: {
        baseUrl: `https://graph.facebook.com/${apiVersion}`,
        apiVersion,
        hasAccessToken: Boolean(accessToken),
        hasVerifyToken: Boolean(verifyToken),
      },
    } as WhatsAppCheckResponse);
  } catch (error) {
    console.error('[WhatsApp Check] Error:', error);
    res.json({
      ok: false,
      reason: 'network_error',
      details: null,
    } as WhatsAppCheckResponse);
  }
});

/**
 * POST /api/connections/whatsapp/save
 * Save WhatsApp credentials to .env file
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { phoneNumberId, displayNumber, accessToken, verifyToken, apiVersion } = req.body as Partial<WhatsAppCredentials> & { apiVersion?: string };

    if (!phoneNumberId || !accessToken) {
      res.status(400).json({ ok: false, reason: 'missing_required_fields' });
      return;
    }

    // Read current .env file
    let envContent = '';
    try {
      envContent = await fs.readFile(ENV_PATH, 'utf-8');
    } catch (error) {
      // File doesn't exist, start with empty content
      envContent = '';
    }

    // Parse .env content into a map
    const envMap = new Map<string, string>();
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        envMap.set(key.trim(), valueParts.join('=').trim());
      }
    });

    // Update credentials
    envMap.set('WHATSAPP_ACCESS_TOKEN', accessToken);
    envMap.set('WHATSAPP_PHONE_NUMBER_ID', phoneNumberId);
    if (verifyToken) {
      envMap.set('WHATSAPP_VERIFY_TOKEN', verifyToken);
    }
    if (apiVersion) {
      envMap.set('WHATSAPP_API_VERSION', apiVersion);
    }

    // Rebuild .env content
    const newEnvContent = Array.from(envMap.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write back to .env
    await fs.writeFile(ENV_PATH, newEnvContent + '\n', 'utf-8');

    // Update process.env in current process
    process.env.WHATSAPP_ACCESS_TOKEN = accessToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = phoneNumberId;
    if (verifyToken) {
      process.env.WHATSAPP_VERIFY_TOKEN = verifyToken;
    }
    if (apiVersion) {
      process.env.WHATSAPP_API_VERSION = apiVersion;
    }

    console.log('[WhatsApp Save] Credentials updated successfully');

    // Reload WhatsApp handler with new credentials (hot-reload without server restart)
    const reloaded = reloadWhatsAppHandler();
    if (!reloaded) {
      console.warn('[WhatsApp Save] Handler reload failed - restart server to apply changes');
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[WhatsApp Save] Error:', error);
    res.status(500).json({ ok: false, reason: 'save_error' });
  }
});

/**
 * POST /api/connections/whatsapp/test
 * Send a test message to verify WhatsApp connection
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { to, text } = req.body as { to?: string; text?: string };

    if (!to) {
      res.status(400).json({ ok: false, reason: 'missing_recipient' });
      return;
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    if (!accessToken || !phoneNumberId) {
      res.status(400).json({ ok: false, reason: 'not_configured' });
      return;
    }

    // Send message via WhatsApp Cloud API
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    // Use template message (hello_world) since text messages require active conversation
    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''), // Remove non-digits
      type: 'template',
      template: {
        name: 'hello_world',
        language: {
          code: 'en_US',
        },
      },
    };

    const response = await fetch(url, {
      ...getFetchOptions(),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[WhatsApp Test] API Error:', JSON.stringify(errorData, null, 2));
      console.error('[WhatsApp Test] Status:', response.status);
      console.error('[WhatsApp Test] URL:', url);
      res.status(response.status).json({
        ok: false,
        reason: 'provider_error',
        details: errorData,
      });
      return;
    }

    const data = await response.json() as {
      messages?: Array<{ id: string }>;
    };

    const messageId = data.messages?.[0]?.id;

    console.log('[WhatsApp Test] Message sent successfully:', messageId);
    res.json({
      ok: true,
      id: messageId || null,
    });
  } catch (error) {
    console.error('[WhatsApp Test] Error:', error);
    res.status(500).json({ ok: false, reason: 'network_error' });
  }
});

/**
 * ============================================
 * MULTI-CONNECTION MANAGEMENT ENDPOINTS
 * ============================================
 */

/**
 * GET /api/connections/whatsapp/list
 * List all WhatsApp connections
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const connections = await WhatsAppConnectionManager.listConnections();
    res.json({ ok: true, connections });
  } catch (error) {
    console.error('[WhatsApp List] Error:', error);
    res.status(500).json({ ok: false, reason: 'list_error', error: String(error) });
  }
});

/**
 * POST /api/connections/whatsapp
 * Create a new WhatsApp connection
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { alias, phoneNumberId, displayNumber, accessToken, verifyToken, isActive } = req.body;

    // Validate required fields
    if (!alias || !phoneNumberId || !accessToken) {
      res.status(400).json({
        ok: false,
        reason: 'missing_required_fields',
        required: ['alias', 'phoneNumberId', 'accessToken'],
      });
      return;
    }

    // Create connection
    const connection = await WhatsAppConnectionManager.createConnection({
      alias,
      phoneNumberId,
      displayNumber: displayNumber || null,
      accessToken,
      verifyToken: verifyToken || null,
      isActive: isActive ?? true,
    });

    console.log(`[WhatsApp Create] New connection created: ${connection.alias} (${connection.id})`);
    res.json({ ok: true, connection });
  } catch (error) {
    console.error('[WhatsApp Create] Error:', error);
    const errorMessage = String(error);

    // Check if it's a duplicate phoneNumberId error
    if (errorMessage.includes('already exists')) {
      res.status(409).json({ ok: false, reason: 'duplicate_phone_number_id', error: errorMessage });
      return;
    }

    res.status(500).json({ ok: false, reason: 'create_error', error: errorMessage });
  }
});

/**
 * PUT /api/connections/whatsapp/:id
 * Update an existing WhatsApp connection
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { alias, phoneNumberId, displayNumber, accessToken, verifyToken, isActive } = req.body;

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (alias !== undefined) updateData.alias = alias;
    if (phoneNumberId !== undefined) updateData.phoneNumberId = phoneNumberId;
    if (displayNumber !== undefined) updateData.displayNumber = displayNumber;
    if (accessToken !== undefined) updateData.accessToken = accessToken;
    if (verifyToken !== undefined) updateData.verifyToken = verifyToken;
    if (isActive !== undefined) updateData.isActive = isActive;

    const connection = await WhatsAppConnectionManager.updateConnection(id, updateData);

    if (!connection) {
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }

    console.log(`[WhatsApp Update] Connection updated: ${connection.alias} (${connection.id})`);
    res.json({ ok: true, connection });
  } catch (error) {
    console.error('[WhatsApp Update] Error:', error);
    const errorMessage = String(error);

    // Check if it's a duplicate phoneNumberId error
    if (errorMessage.includes('already exists')) {
      res.status(409).json({ ok: false, reason: 'duplicate_phone_number_id', error: errorMessage });
      return;
    }

    res.status(500).json({ ok: false, reason: 'update_error', error: errorMessage });
  }
});

/**
 * DELETE /api/connections/whatsapp/:id
 * Delete a WhatsApp connection
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await WhatsAppConnectionManager.deleteConnection(id);

    if (!deleted) {
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }

    console.log(`[WhatsApp Delete] Connection deleted: ${id}`);
    res.json({ ok: true });
  } catch (error) {
    console.error('[WhatsApp Delete] Error:', error);
    res.status(500).json({ ok: false, reason: 'delete_error', error: String(error) });
  }
});

/**
 * GET /api/connections/whatsapp/:id/verify
 * Verify a specific WhatsApp connection with Meta Graph API
 */
router.get('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get connection
    const connection = await WhatsAppConnectionManager.getConnection(id);

    if (!connection) {
      res.status(404).json({ ok: false, reason: 'not_found' });
      return;
    }

    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    // Query Meta Graph API to verify phone number
    const url = `https://graph.facebook.com/${apiVersion}/${connection.phoneNumberId}?access_token=${connection.accessToken}`;
    const response = await fetch(url, getFetchOptions());

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response.json().catch(() => ({}));
      console.error(`[WhatsApp Verify] Facebook API Error for ${connection.alias}:`, JSON.stringify(errorBody, null, 2));

      res.json({
        ok: false,
        reason: status === 401 || status === 403 ? 'invalid_token' : 'provider_error',
        status,
        connection: {
          id: connection.id,
          alias: connection.alias,
          phoneNumberId: connection.phoneNumberId,
          displayNumber: connection.displayNumber,
        },
        error: errorBody,
      });
      return;
    }

    const data = await response.json() as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
    };

    res.json({
      ok: true,
      connection: {
        id: connection.id,
        alias: connection.alias,
        phoneNumberId: connection.phoneNumberId,
        displayNumber: data.display_phone_number || connection.displayNumber,
        verifiedName: data.verified_name || null,
      },
    });
  } catch (error) {
    console.error('[WhatsApp Verify] Error:', error);
    res.status(500).json({ ok: false, reason: 'network_error', error: String(error) });
  }
});

export default router;
