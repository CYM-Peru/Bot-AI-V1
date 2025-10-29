import type { Bitrix24Client, BitrixEntity } from "../../../src/integrations/bitrix24";
import type { Conversation } from "../models";
import { crmDb } from "../db";

export interface BitrixSyncResult {
  contactId: string | null;
  entityType?: "contact" | "lead";
  reason?: string;
}

export interface BitrixContactInfo {
  phone: string;
  name?: string;
  lastName?: string;
  // Campos personalizados que vienen de WhatsApp Meta
  profileName?: string;
}

export class BitrixService {
  constructor(private readonly client?: Bitrix24Client) {}

  get isAvailable() {
    return Boolean(this.client);
  }

  /**
   * Busca o crea una entidad en Bitrix24 basándose en el teléfono.
   * Primero busca en Contactos, si no existe, crea un Lead con los datos de Meta.
   */
  async upsertContactByPhone(phone: string, info?: BitrixContactInfo): Promise<BitrixSyncResult> {
    if (!this.client) {
      return { contactId: null, reason: "bitrix_not_configured" };
    }

    try {
      const sanitized = phone.replace(/[^+\d]/g, "");

      // 1. Buscar primero en contactos existentes
      const existingContact = await this.client.findContact({
        filter: { PHONE: sanitized },
        select: ["ID", "NAME", "LAST_NAME", "PHONE"],
      });
      if (existingContact?.ID) {
        return { contactId: existingContact.ID.toString(), entityType: "contact" };
      }

      // 2. Si no existe contacto, buscar en leads
      const existingLead = await this.client.findLead({
        filter: { PHONE: sanitized },
        select: ["ID", "TITLE", "NAME", "LAST_NAME", "PHONE"],
      });
      if (existingLead?.ID) {
        return { contactId: existingLead.ID.toString(), entityType: "lead" };
      }

      // 3. No existe, crear nuevo Lead con campos personalizados
      const leadFields = this.buildLeadFields(sanitized, info);
      const created = await this.client.createLead(leadFields);
      return { contactId: created, entityType: "lead" };
    } catch (error) {
      console.warn("[CRM][Bitrix] Unable to sync contact", error);
      return { contactId: null, reason: "bitrix_error" };
    }
  }

  /**
   * Construye los campos para crear un Lead con los datos de Meta/WhatsApp
   */
  private buildLeadFields(phone: string, info?: BitrixContactInfo): Record<string, any> {
    const fields: Record<string, any> = {
      PHONE: [{ VALUE: phone, VALUE_TYPE: "WORK" }],
    };

    // Usar el nombre del perfil de Meta si está disponible
    if (info?.profileName) {
      // Intentar separar nombre y apellido del profile name
      const nameParts = info.profileName.trim().split(/\s+/);
      if (nameParts.length > 1) {
        fields.NAME = nameParts[0];
        fields.LAST_NAME = nameParts.slice(1).join(" ");
      } else {
        fields.NAME = info.profileName;
      }
      fields.TITLE = `Lead ${info.profileName}`;
    } else if (info?.name) {
      fields.NAME = info.name;
      if (info.lastName) {
        fields.LAST_NAME = info.lastName;
      }
      fields.TITLE = `Lead ${info.name}`;
    } else {
      fields.TITLE = `Lead ${phone}`;
    }

    // Campos personalizados para Lead (Prospecto)
    // UF_CRM_1662413427 - Departamentos (lista)
    // Por ahora dejamos vacío, se puede rellenar después
    // fields.UF_CRM_1662413427 = null;

    return fields;
  }

  /**
   * Crear un contacto con campos personalizados
   */
  async createContactWithCustomFields(info: BitrixContactInfo): Promise<BitrixSyncResult> {
    if (!this.client) {
      return { contactId: null, reason: "bitrix_not_configured" };
    }

    try {
      const sanitized = info.phone.replace(/[^+\d]/g, "");
      const fields = this.buildContactFields(sanitized, info);
      const created = await this.client.createContact(fields);
      return { contactId: created, entityType: "contact" };
    } catch (error) {
      console.warn("[CRM][Bitrix] Unable to create contact", error);
      return { contactId: null, reason: "bitrix_error" };
    }
  }

  /**
   * Construye los campos para crear un Contact con campos personalizados
   */
  private buildContactFields(phone: string, info: BitrixContactInfo): Record<string, any> {
    const fields: Record<string, any> = {
      PHONE: [{ VALUE: phone, VALUE_TYPE: "WORK" }],
    };

    // Nombre y apellido
    if (info.profileName) {
      const nameParts = info.profileName.trim().split(/\s+/);
      if (nameParts.length > 1) {
        fields.NAME = nameParts[0];
        fields.LAST_NAME = nameParts.slice(1).join(" ");
      } else {
        fields.NAME = info.profileName;
      }
    } else {
      if (info.name) fields.NAME = info.name;
      if (info.lastName) fields.LAST_NAME = info.lastName;
    }

    // Campos personalizados de Contact
    // Por ahora dejamos los campos vacíos, se pueden rellenar después
    // UF_CRM_5DEAADAE301BB - N°documento (Cadena)
    // UF_CRM_1745466972 - direccion (Cadena)
    // UF_CRM_67D702957E80A - Tipo de contacto (Lista)
    // UF_CRM_68121FB2B841A - departamento (Lista)
    // UF_CRM_1745461823632 - Provincia (cadena)
    // UF_CRM_1745461836705 - Distrito (cadena)
    // UF_CRM_1715014786 - Líder (Cadena)
    // UF_CRM_1565801603901 - Stencil (lista)

    return fields;
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
