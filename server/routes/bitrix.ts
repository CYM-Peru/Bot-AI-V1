import { Router } from "express";
import { getSecretsPath, readJsonFile } from "../utils/storage";
import { httpRequest } from "../utils/http";

interface BitrixTokens {
  access_token?: string;
  refresh_token?: string;
  domain?: string;
  member_id?: string;
  scope?: string | string[];
  expires?: number;
}

const TOKENS_PATH = getSecretsPath("bitrix-tokens.json");

function readTokens(): BitrixTokens | null {
  return readJsonFile<BitrixTokens>(TOKENS_PATH);
}

export function createBitrixRouter() {
  const router = Router();

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
