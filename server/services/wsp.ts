import { sendOutboundMessage } from "../crm/services/whatsapp";

export interface WspTestPayload {
  to: string;
  text: string;
}

export interface WspTestResult {
  ok: boolean;
  providerStatus: number;
  body: unknown;
  error?: string;
}

export async function sendWspTestMessage(payload: WspTestPayload): Promise<WspTestResult> {
  const phone = payload.to?.trim();
  const text = payload.text?.trim();
  if (!phone) {
    return { ok: false, providerStatus: 400, body: null, error: "missing_destination" };
  }
  if (!text) {
    return { ok: false, providerStatus: 400, body: null, error: "missing_text" };
  }

  const result = await sendOutboundMessage({ phone, text });
  if (!result.ok) {
    return {
      ok: false,
      providerStatus: result.status,
      body: result.body,
      error: result.error ?? (result.status === 412 ? "not_configured" : "provider_error"),
    };
  }

  return { ok: true, providerStatus: result.status, body: result.body ?? null };
}
