import { Router } from "express";
import { fetchMessageTemplates, sendTemplateMessage, type WhatsAppTemplate } from "../../../src/api/whatsapp-sender";
import { getWhatsAppEnv } from "../../utils/env";

export function createTemplatesRouter() {
  const router = Router();

  /**
   * GET /templates
   * Fetch available WhatsApp message templates for the configured WABA
   */
  router.get("/", async (_req, res) => {
    try {
      const config = getWhatsAppEnv();

      // WABA ID is typically stored as an environment variable
      // For now, we'll extract it from the phone number ID or use a dedicated env var
      const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || config.phoneNumberId;

      if (!wabaId || !config.accessToken) {
        res.status(400).json({
          error: "whatsapp_not_configured",
          message: "WhatsApp Business Account ID or Access Token not configured"
        });
        return;
      }

      const result = await fetchMessageTemplates(wabaId, config.accessToken);

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
