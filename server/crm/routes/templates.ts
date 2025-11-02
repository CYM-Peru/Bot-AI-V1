import { Router } from "express";
import { fetchMessageTemplates, sendTemplateMessage, type WhatsAppTemplate } from "../../../src/api/whatsapp-sender";
import { getWhatsAppEnv } from "../../utils/env";
import fs from "fs/promises";
import path from "path";

export function createTemplatesRouter() {
  const router = Router();

  /**
   * GET /templates
   * Fetch available WhatsApp message templates for the configured WABA
   * Query params:
   *   - phoneNumberId: Optional. Filter templates by specific WhatsApp connection
   */
  router.get("/", async (req, res) => {
    try {
      const { phoneNumberId } = req.query;

      // Load connections to find the right access token
      const connectionsPath = path.join(process.cwd(), "data", "whatsapp-connections.json");
      let accessToken: string;
      let wabaId: string;

      if (phoneNumberId && typeof phoneNumberId === "string") {
        // Find specific connection by phoneNumberId
        try {
          const data = await fs.readFile(connectionsPath, "utf-8");
          const parsed = JSON.parse(data);
          // Search by phoneNumberId field (Meta's Phone Number ID)
          const connection = parsed.connections?.find((c: any) => c.phoneNumberId === phoneNumberId);

          if (connection && connection.accessToken) {
            accessToken = connection.accessToken;
            // For templates, we need the WABA ID (Business Account ID)
            wabaId = connection.wabaId || connection.phoneNumberId;
          } else {
            // Fallback to env config
            const config = getWhatsAppEnv();
            accessToken = config.accessToken;
            wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || config.phoneNumberId;
          }
        } catch (error) {
          console.error('[Templates] Error reading connections:', error);
          // Fallback to env config if file read fails
          const config = getWhatsAppEnv();
          accessToken = config.accessToken;
          wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || config.phoneNumberId;
        }
      } else {
        // Use env config (default)
        const config = getWhatsAppEnv();
        accessToken = config.accessToken;
        wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || config.phoneNumberId;
      }

      if (!wabaId || !accessToken) {
        res.status(400).json({
          error: "whatsapp_not_configured",
          message: "WhatsApp Business Account ID or Access Token not configured"
        });
        return;
      }

      const result = await fetchMessageTemplates(wabaId, accessToken);

      if (!result.ok) {
        res.status(500).json({
          error: "fetch_failed",
          message: "Failed to fetch templates from WhatsApp"
        });
        return;
      }

      res.json({ templates: result.templates });
    } catch (error) {
      console.error("[Templates] Error fetching templates:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * POST /send
   * Send a template message to a phone number
   */
  router.post("/send", async (req, res) => {
    try {
      const { phone, templateName, language = "es", components } = req.body;

      if (!phone || !templateName) {
        res.status(400).json({
          error: "missing_parameters",
          message: "phone and templateName are required"
        });
        return;
      }

      const config = getWhatsAppEnv();

      if (!config.accessToken || !config.phoneNumberId) {
        res.status(400).json({
          error: "whatsapp_not_configured",
          message: "WhatsApp not configured"
        });
        return;
      }

      const result = await sendTemplateMessage(
        config,
        phone,
        templateName,
        language,
        components
      );

      if (!result.ok) {
        res.status(result.status).json({
          error: "send_failed",
          message: "Failed to send template message",
          details: result.body
        });
        return;
      }

      res.json({ success: true, messageId: result.body });
    } catch (error) {
      console.error("[Templates] Error sending template:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return router;
}
