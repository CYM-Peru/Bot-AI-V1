import { Router } from "express";
import { getSecretsPath, readJsonFile, writeJsonFile } from "../utils/storage";
import { httpRequest } from "../utils/http";
import { BITRIX_CONTACT_FIELDS, BITRIX_LEAD_FIELDS } from "../crm/bitrix-fields.config";

interface BitrixTokens {
  access_token?: string;
  refresh_token?: string;
  domain?: string;
  member_id?: string;
  scope?: string | string[];
  expires?: number;
}

const TOKENS_PATH = getSecretsPath("bitrix-tokens.json");

// CONFIGURACIÓN OAUTH - REEMPLAZAR CON TUS CREDENCIALES DE BITRIX24
const BITRIX_CLIENT_ID = process.env.BITRIX_CLIENT_ID || "local.68fa6333819168.83214192";
const BITRIX_CLIENT_SECRET = process.env.BITRIX_CLIENT_SECRET || "Gu5W5R3ms1SOWX6V3eQvO3GiB6RNjfXYEgnPwUxnm9qFdIjKjB";
const BITRIX_REDIRECT_URI = process.env.BITRIX_REDIRECT_URI || "https://wsp.azaleia.com.pe/api/bitrix/oauth/callback";

export function readTokens(): BitrixTokens | null {
  return readJsonFile<BitrixTokens>(TOKENS_PATH);
}

function saveTokens(tokens: BitrixTokens): void {
  writeJsonFile(TOKENS_PATH, tokens);
}

/**
 * Refresh Bitrix24 access token using refresh_token
 * @throws Error if refresh fails or credentials are missing
 */
export async function refreshBitrixTokens(): Promise<void> {
  const tokens = readTokens();

  if (!tokens?.refresh_token) {
    throw new Error("No refresh_token available. Please re-authorize the Bitrix24 app.");
  }

  if (!BITRIX_CLIENT_ID || !BITRIX_CLIENT_SECRET) {
    throw new Error("Missing BITRIX_CLIENT_ID or BITRIX_CLIENT_SECRET in environment");
  }

  const tokenUrl = `https://oauth.bitrix.info/oauth/token/?` +
    `grant_type=refresh_token&` +
    `client_id=${encodeURIComponent(BITRIX_CLIENT_ID)}&` +
    `client_secret=${encodeURIComponent(BITRIX_CLIENT_SECRET)}&` +
    `refresh_token=${encodeURIComponent(tokens.refresh_token)}`;

  const response = await httpRequest<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>(tokenUrl, {
    method: "GET",
    timeoutMs: 15000,
  });

  if (!response.ok || !response.body?.access_token) {
    throw new Error(`Token refresh failed: ${response.status} - ${JSON.stringify(response.body)}`);
  }

  // Merge with existing tokens
  const updatedTokens: BitrixTokens = {
    ...tokens,
    access_token: response.body.access_token,
    refresh_token: response.body.refresh_token || tokens.refresh_token,
    expires: response.body.expires_in ? Date.now() + response.body.expires_in * 1000 : undefined,
    scope: response.body.scope || tokens.scope,
  };

  saveTokens(updatedTokens);
  console.log(`[Bitrix] Tokens refreshed successfully. Expires in: ${response.body.expires_in}s`);
}

export function createBitrixRouter() {
  const router = Router();

  /**
   * GET /api/bitrix/oauth/url
   * Genera la URL de autorización OAuth de Bitrix24
   */
  router.get("/oauth/url", (_req, res) => {
    try {
      const tokens = readTokens();
      const domain = tokens?.domain || "azaleia-peru.bitrix24.es";

      const authUrl = `https://${domain}/oauth/authorize/?` +
        `client_id=${BITRIX_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(BITRIX_REDIRECT_URI)}&` +
        `scope=crm,user,im,imopenlines,placement,bizproc,task,lists,disk`;

      res.json({ url: authUrl });
    } catch (error) {
      console.error("[Bitrix] Error generating OAuth URL:", error);
      res.status(500).json({ error: "failed_to_generate_url" });
    }
  });

  /**
   * GET /api/bitrix/oauth/callback?code=XXX&domain=YYY
   * Callback de OAuth de Bitrix24
   */
  router.get("/oauth/callback", async (req, res) => {
    try {
      const { code, domain } = req.query;

      if (!code || !domain) {
        res.status(400).json({ error: "missing_code_or_domain" });
        return;
      }

      // Intercambiar código por tokens
      // IMPORTANTE: Bitrix24 Cloud usa oauth.bitrix.info para token exchange
      const tokenUrl = `https://oauth.bitrix.info/oauth/token/?` +
        `grant_type=authorization_code&` +
        `client_id=${BITRIX_CLIENT_ID}&` +
        `client_secret=${BITRIX_CLIENT_SECRET}&` +
        `code=${code}&` +
        `redirect_uri=${encodeURIComponent(BITRIX_REDIRECT_URI)}`;

      const response = await httpRequest<{
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        member_id?: string;
      }>(tokenUrl, {
        method: "GET",
        timeoutMs: 15000,
      });

      if (!response.ok || !response.body?.access_token) {
        console.error("[Bitrix] OAuth token exchange failed:", response.status, response.body);
        res.status(400).json({ error: "token_exchange_failed" });
        return;
      }

      // Guardar tokens
      const tokens: BitrixTokens = {
        access_token: response.body.access_token,
        refresh_token: response.body.refresh_token,
        domain: String(domain),
        member_id: response.body.member_id,
        scope: response.body.scope,
        expires: response.body.expires_in ? Date.now() + response.body.expires_in * 1000 : undefined,
      };

      saveTokens(tokens);

      // Redirigir al frontend con éxito
      res.redirect("/?bitrix_auth=success");
    } catch (error) {
      console.error("[Bitrix] OAuth callback error:", error);
      res.redirect("/?bitrix_auth=error");
    }
  });

  /**
   * GET /api/bitrix/fields
   * Lista campos disponibles de Bitrix24 (Contact y Lead)
   */
  router.get("/fields", (_req, res) => {
    try {
      res.json({
        contact: {
          standard: {
            NAME: "Nombre",
            LAST_NAME: "Apellidos",
            PHONE: "Teléfono",
            EMAIL: "Email",
          },
          custom: {
            [BITRIX_CONTACT_FIELDS.DOCUMENTO]: "N° Documento",
            [BITRIX_CONTACT_FIELDS.DIRECCION]: "Dirección",
            [BITRIX_CONTACT_FIELDS.TIPO_CONTACTO]: "Tipo de Contacto",
            [BITRIX_CONTACT_FIELDS.DEPARTAMENTO]: "Departamento",
            [BITRIX_CONTACT_FIELDS.PROVINCIA]: "Provincia",
            [BITRIX_CONTACT_FIELDS.DISTRITO]: "Distrito",
            [BITRIX_CONTACT_FIELDS.LIDER]: "Líder",
            [BITRIX_CONTACT_FIELDS.STENCIL]: "Stencil",
          },
        },
        lead: {
          standard: {
            TITLE: "Título",
            NAME: "Nombre",
            LAST_NAME: "Apellidos",
            PHONE: "Teléfono",
          },
          custom: {
            [BITRIX_LEAD_FIELDS.DEPARTAMENTOS]: "Departamentos",
          },
        },
      });
    } catch (error) {
      console.error("[Bitrix] Error getting fields:", error);
      res.status(500).json({ error: "failed_to_get_fields" });
    }
  });

  router.get("/validate", async (_req, res) => {
    const tokens = readTokens();
    if (!tokens?.access_token || !tokens.domain) {
      res.json({ ok: false, reason: "not_authorized" });
      return;
    }

    const baseUrl = tokens.domain.startsWith("http") ? tokens.domain : `https://${tokens.domain}`;
    const endpoint = `${baseUrl.replace(/\/$/, "")}/rest/user.current.json`;

    try {
      const response = await httpRequest<{ result?: { ID?: number; NAME?: string; LAST_NAME?: string } }>(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        timeoutMs: 10000,
        retries: 1,
      });

      if (!response.ok) {
        const reason = response.status === 401 ? "not_authorized" : "provider_error";
        res.json({ ok: false, reason, status: response.status, portal: tokens.domain });
        return;
      }

      const user = response.body?.result;
      const scopes = Array.isArray(tokens.scope)
        ? tokens.scope
        : typeof tokens.scope === "string"
        ? tokens.scope.split(/[,\s]+/).filter(Boolean)
        : [];

      res.json({
        ok: true,
        portal: tokens.domain,
        user: user
          ? { id: String(user.ID ?? ""), name: user.NAME ?? null, lastName: user.LAST_NAME ?? null }
          : null,
        scopes,
      });
    } catch (error) {
      console.error("[Bitrix] validate failed", error instanceof Error ? error.message : error);
      res.status(500).json({ ok: false, reason: "network_error" });
    }
  });

  return router;
}
