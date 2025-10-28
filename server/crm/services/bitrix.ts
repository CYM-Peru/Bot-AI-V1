import type { Bitrix24Client, BitrixEntity } from "../../../src/integrations/bitrix24";
import type { Conversation } from "../models";
import { crmDb } from "../db";

export interface BitrixSyncResult {
  contactId: string | null;
  reason?: string;
}

export class BitrixService {
  constructor(private readonly client?: Bitrix24Client) {}

  get isAvailable() {
    return Boolean(this.client);
  }

  async upsertContactByPhone(phone: string, hintName?: string): Promise<BitrixSyncResult> {
    if (!this.client) {
      return { contactId: null, reason: "bitrix_not_configured" };
    }

    try {
      const sanitized = phone.replace(/[^+\d]/g, "");
      const existing = await this.client.findContact({
        filter: { PHONE: sanitized },
        select: ["ID", "NAME", "LAST_NAME", "PHONE"],
      });
      if (existing?.ID) {
        return { contactId: existing.ID.toString() };
      }

      const created = await this.client.createLead({
        TITLE: hintName ? `Lead ${hintName}` : `Lead ${sanitized}`,
        PHONE: [{ VALUE: sanitized, VALUE_TYPE: "WORK" }],
      });
      return { contactId: created };
    } catch (error) {
      console.warn("[CRM][Bitrix] Unable to sync contact", error);
      return { contactId: null, reason: "bitrix_error" };
    }
  }

  attachConversation(conv: Conversation, bitrixId: string | null) {
    crmDb.updateConversationMeta(conv.id, { bitrixId });
  }

  async fetchContact(bitrixId: string): Promise<BitrixEntity | null> {
    if (!this.client) return null;
    try {
      return await this.client.getContact(bitrixId);
    } catch (error) {
      console.warn("[CRM][Bitrix] Unable to fetch contact", error);
      return null;
    }
  }

  async lookupByPhone(phone: string): Promise<BitrixEntity | null> {
    if (!this.client) return null;
    try {
      const sanitized = phone.replace(/[^+\d]/g, "");
      return await this.client.findContact({
        filter: { PHONE: sanitized },
        select: ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL"],
      });
    } catch (error) {
      console.warn("[CRM][Bitrix] lookup error", error);
      return null;
    }
  }
}

export function createBitrixService(client?: Bitrix24Client) {
  return new BitrixService(client);
}
