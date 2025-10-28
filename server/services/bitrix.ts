import { getBitrixEnv } from "../utils/env";
import { httpRequest } from "../utils/http";

export interface BitrixCheckResult {
  ok: boolean;
  portal?: string;
  user?: { id: string; name?: string; lastName?: string } | null;
  reason?: string;
  status?: number;
}

export async function checkBitrixConnection(): Promise<BitrixCheckResult> {
  const env = getBitrixEnv();
  if (!env.webhookUrl) {
    return { ok: false, portal: env.portal, reason: "not_configured" };
  }

  try {
    const url = `${env.webhookUrl.replace(/\/+$/, "")}/user.current.json`;
    const response = await httpRequest<{ result?: { ID?: number; NAME?: string; LAST_NAME?: string } }>(url, {
      method: "POST",
      timeoutMs: 10000,
    });

    if (!response.ok) {
      return {
        ok: false,
        portal: env.portal,
        reason: response.status === 401 ? "not_authorized" : "provider_error",
        status: response.status,
      };
    }

    const user = response.body?.result;
    return {
      ok: true,
      portal: env.portal ?? null ?? undefined,
      user: user
        ? { id: String(user.ID ?? ""), name: user.NAME ?? undefined, lastName: user.LAST_NAME ?? undefined }
        : null,
    };
  } catch (error) {
    return { ok: false, portal: env.portal, reason: "network_error" };
  }
}
