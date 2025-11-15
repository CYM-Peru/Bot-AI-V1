import { Router } from "express";
import { getSecretsPath, readJsonFile } from "../../utils/storage";
import { decryptObject } from "../../utils/encryption";

interface BitrixTokens {
  access_token?: string;
  refresh_token?: string;
  domain?: string;
  member_id?: string;
  scope?: string | string[];
  expires?: number;
}

const TOKENS_PATH = getSecretsPath("bitrix-tokens.json");
const SENSITIVE_FIELDS: (keyof BitrixTokens)[] = ['access_token', 'refresh_token'];

function readTokens(): BitrixTokens | null {
  const encrypted = readJsonFile<BitrixTokens>(TOKENS_PATH);
  if (!encrypted) return null;
  return decryptObject(encrypted, SENSITIVE_FIELDS);
}

export function createBitrixConnectionsRouter() {
  const router = Router();

  router.get("/check", (_req, res) => {
    const tokens = readTokens();

    if (!tokens?.access_token || !tokens.domain) {
      res.json({ ok: false, reason: "not_configured" });
      return;
    }

    res.json({
      ok: true,
      portal: tokens.domain,
      hasRefreshToken: Boolean(tokens.refresh_token),
      scope: tokens.scope ?? null,
    });
  });

  return router;
}
