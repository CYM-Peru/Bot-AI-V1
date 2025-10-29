import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

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
    const response = await fetch(url);

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        res.json({
          ok: false,
          reason: 'invalid_token',
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
    const { phoneNumberId, displayNumber, accessToken, verifyToken } = req.body as Partial<WhatsAppCredentials>;

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

    console.log('[WhatsApp Save] Credentials updated successfully');
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
    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''), // Remove non-digits
      type: 'text',
      text: {
        body: text || 'Hola desde Builder',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[WhatsApp Test] API Error:', errorData);
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

export default router;
