import { getSecretsPath, readJsonFile, writeJsonFile } from "../utils/storage";

const WHATSAPP_SECRETS_PATH = getSecretsPath("whatsapp.json");

export interface WhatsAppSecretsPayload {
  phoneNumberId: string;
  displayNumber?: string;
  accessToken: string;
  verifyToken?: string;
}

export interface WhatsAppStoredSecrets extends WhatsAppSecretsPayload {}

export function saveWhatsAppSecrets(payload: WhatsAppSecretsPayload) {
  writeJsonFile(
    WHATSAPP_SECRETS_PATH,
    {
      phoneNumberId: payload.phoneNumberId,
      displayNumber: payload.displayNumber ?? null,
      accessToken: payload.accessToken,
      verifyToken: payload.verifyToken ?? null,
      updatedAt: new Date().toISOString(),
    },
    0o600,
  );
}

export function readWhatsAppSecrets(): WhatsAppStoredSecrets | null {
  const file = readJsonFile<WhatsAppStoredSecrets & { updatedAt?: string | null }>(WHATSAPP_SECRETS_PATH);
  if (!file) return null;
  return {
    phoneNumberId: file.phoneNumberId,
    displayNumber: file.displayNumber ?? undefined,
    accessToken: file.accessToken,
    verifyToken: file.verifyToken ?? undefined,
  };
}
