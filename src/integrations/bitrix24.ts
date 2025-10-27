/**
 * Bitrix24 API Client
 *
 * Cliente para interactuar con Bitrix24 CRM API.
 * Documentación: https://dev.1c-bitrix.ru/rest_help/
 */

export interface Bitrix24Config {
  webhookUrl: string;  // URL del webhook de Bitrix24
  // Ejemplo: https://tu-dominio.bitrix24.com/rest/1/abc123xyz/
}

export interface BitrixEntity {
  ID: string;
  [key: string]: any;
}

export interface BitrixSearchParams {
  filter: Record<string, any>;
  select?: string[];
}

/**
 * Cliente de Bitrix24
 */
export class Bitrix24Client {
  private readonly config: Bitrix24Config;

  constructor(config: Bitrix24Config) {
    this.config = config;
  }

  /**
   * Buscar un lead por campo
   */
  async findLead(params: BitrixSearchParams): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.lead.list", params);
      return response.result?.[0] ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error finding lead:", error);
      return null;
    }
  }

  /**
   * Buscar un deal por campo
   */
  async findDeal(params: BitrixSearchParams): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.deal.list", params);
      return response.result?.[0] ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error finding deal:", error);
      return null;
    }
  }

  /**
   * Buscar un contacto por campo
   */
  async findContact(params: BitrixSearchParams): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.contact.list", params);
      return response.result?.[0] ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error finding contact:", error);
      return null;
    }
  }

  /**
   * Buscar una empresa por campo
   */
  async findCompany(params: BitrixSearchParams): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.company.list", params);
      return response.result?.[0] ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error finding company:", error);
      return null;
    }
  }

  /**
   * Obtener un lead por ID
   */
  async getLead(id: string): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.lead.get", { id });
      return response.result ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error getting lead:", error);
      return null;
    }
  }

  /**
   * Obtener un deal por ID
   */
  async getDeal(id: string): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.deal.get", { id });
      return response.result ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error getting deal:", error);
      return null;
    }
  }

  /**
   * Obtener un contacto por ID
   */
  async getContact(id: string): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.contact.get", { id });
      return response.result ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error getting contact:", error);
      return null;
    }
  }

  /**
   * Obtener una empresa por ID
   */
  async getCompany(id: string): Promise<BitrixEntity | null> {
    try {
      const response = await this.callMethod("crm.company.get", { id });
      return response.result ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error getting company:", error);
      return null;
    }
  }

  /**
   * Crear un lead
   */
  async createLead(fields: Record<string, any>): Promise<string | null> {
    try {
      const response = await this.callMethod("crm.lead.add", { fields });
      return response.result?.toString() ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error creating lead:", error);
      return null;
    }
  }

  /**
   * Actualizar un lead
   */
  async updateLead(id: string, fields: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.lead.update", { id, fields });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error updating lead:", error);
      return false;
    }
  }

  /**
   * Crear un deal
   */
  async createDeal(fields: Record<string, any>): Promise<string | null> {
    try {
      const response = await this.callMethod("crm.deal.add", { fields });
      return response.result?.toString() ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error creating deal:", error);
      return null;
    }
  }

  /**
   * Actualizar un deal
   */
  async updateDeal(id: string, fields: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.deal.update", { id, fields });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error updating deal:", error);
      return false;
    }
  }

  /**
   * Buscar entidad por tipo y parámetros
   */
  async findEntity(
    entityType: "lead" | "deal" | "contact" | "company",
    params: BitrixSearchParams
  ): Promise<BitrixEntity | null> {
    switch (entityType) {
      case "lead":
        return this.findLead(params);
      case "deal":
        return this.findDeal(params);
      case "contact":
        return this.findContact(params);
      case "company":
        return this.findCompany(params);
      default:
        return null;
    }
  }

  /**
   * Obtener valor de un campo de una entidad
   */
  async getFieldValue(
    entityType: "lead" | "deal" | "contact" | "company",
    identifier: { field: string; value: string },
    fieldName: string
  ): Promise<string | null> {
    try {
      const entity = await this.findEntity(entityType, {
        filter: { [identifier.field]: identifier.value },
        select: [fieldName, "ID"],
      });

      if (!entity) {
        return null;
      }

      const value = entity[fieldName];
      return value != null ? String(value) : null;
    } catch (error) {
      console.error("[Bitrix24] Error getting field value:", error);
      return null;
    }
  }

  /**
   * Llamar a un método de la API de Bitrix24
   */
  private async callMethod(method: string, params: Record<string, any> = {}): Promise<any> {
    const url = `${this.config.webhookUrl}${method}.json`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Bitrix24 API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Bitrix24 API error: ${data.error} - ${data.error_description}`);
      }

      return data;
    } catch (error) {
      console.error(`[Bitrix24] Error calling ${method}:`, error);
      throw error;
    }
  }
}

/**
 * Mock Bitrix24 Client para testing
 */
export class MockBitrix24Client extends Bitrix24Client {
  private mockData: Map<string, BitrixEntity[]> = new Map();

  constructor(config: Bitrix24Config) {
    super(config);
  }

  setMockData(entityType: string, data: BitrixEntity[]) {
    this.mockData.set(entityType, data);
  }

  async findEntity(
    entityType: "lead" | "deal" | "contact" | "company",
    params: BitrixSearchParams
  ): Promise<BitrixEntity | null> {
    const entities = this.mockData.get(entityType) ?? [];

    // Simple filter matching
    const filtered = entities.filter((entity) => {
      for (const [key, value] of Object.entries(params.filter)) {
        if (entity[key] !== value) {
          return false;
        }
      }
      return true;
    });

    return filtered[0] ?? null;
  }
}
