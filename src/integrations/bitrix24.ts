/**
 * Bitrix24 API Client
 *
 * Cliente para interactuar con Bitrix24 CRM API.
 * Documentación: https://dev.1c-bitrix.ru/rest_help/
 */

export interface Bitrix24Config {
  webhookUrl?: string;  // URL del webhook de Bitrix24 (opcional si se usa OAuth)
  // Ejemplo: https://tu-dominio.bitrix24.com/rest/1/abc123xyz/

  // OAuth configuration (alternativa al webhook)
  domain?: string;      // Dominio de Bitrix24 (ej: azaleia-peru.bitrix24.es)
  accessToken?: string; // Access token de OAuth

  // Callback para refrescar el token cuando expira
  onTokenRefresh?: () => Promise<string>; // Retorna el nuevo access_token
}

export interface BitrixEntity {
  ID: string;
  [key: string]: any;
}

export interface BitrixSearchParams {
  filter: Record<string, any>;
  select?: string[];
  limit?: number;
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
   * Obtener un contacto por ID con TODOS los campos personalizados
   */
  async getContact(id: string): Promise<BitrixEntity | null> {
    try {
      // No especificamos 'select' para obtener TODOS los campos del contacto
      // incluyendo campos personalizados (UF_CRM_*)
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
   * Crear un contacto
   */
  async createContact(fields: Record<string, any>): Promise<string | null> {
    try {
      const response = await this.callMethod("crm.contact.add", { fields });
      return response.result?.toString() ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error creating contact:", error);
      return null;
    }
  }

  /**
   * Actualizar un contacto
   */
  async updateContact(id: string, fields: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.contact.update", { id, fields });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error updating contact:", error);
      return false;
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
   * Crear una compañía
   */
  async createCompany(fields: Record<string, any>): Promise<string | null> {
    try {
      const response = await this.callMethod("crm.company.add", { fields });
      return response.result?.toString() ?? null;
    } catch (error) {
      console.error("[Bitrix24] Error creating company:", error);
      return null;
    }
  }

  /**
   * Actualizar una compañía
   */
  async updateCompany(id: string, fields: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.company.update", { id, fields });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error updating company:", error);
      return false;
    }
  }

  /**
   * Eliminar un lead
   */
  async deleteLead(id: string): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.lead.delete", { id });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error deleting lead:", error);
      return false;
    }
  }

  /**
   * Eliminar un contacto
   */
  async deleteContact(id: string): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.contact.delete", { id });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error deleting contact:", error);
      return false;
    }
  }

  /**
   * Eliminar un deal
   */
  async deleteDeal(id: string): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.deal.delete", { id });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error deleting deal:", error);
      return false;
    }
  }

  /**
   * Eliminar una compañía
   */
  async deleteCompany(id: string): Promise<boolean> {
    try {
      const response = await this.callMethod("crm.company.delete", { id });
      return response.result === true;
    } catch (error) {
      console.error("[Bitrix24] Error deleting company:", error);
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
   * Buscar múltiples entidades (genérico) - para operación SEARCH
   */
  async searchEntities(
    entityType: "lead" | "deal" | "contact" | "company",
    params: BitrixSearchParams
  ): Promise<BitrixEntity[]> {
    try {
      const method = `crm.${entityType}.list`;
      const response = await this.callMethod(method, params);
      return response.result ?? [];
    } catch (error) {
      console.error(`[Bitrix24] Error searching ${entityType}s:`, error);
      return [];
    }
  }

  /**
   * Crear una entidad en Bitrix24 (genérico)
   */
  async createEntity(
    entityType: "lead" | "deal" | "contact" | "company",
    fields: Record<string, any>
  ): Promise<string | null> {
    switch (entityType) {
      case "lead":
        return this.createLead(fields);
      case "deal":
        return this.createDeal(fields);
      case "contact":
        return this.createContact(fields);
      case "company":
        return this.createCompany(fields);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Actualizar una entidad en Bitrix24 (genérico)
   */
  async updateEntity(
    entityType: "lead" | "deal" | "contact" | "company",
    id: string,
    fields: Record<string, any>
  ): Promise<boolean> {
    switch (entityType) {
      case "lead":
        return this.updateLead(id, fields);
      case "deal":
        return this.updateDeal(id, fields);
      case "contact":
        return this.updateContact(id, fields);
      case "company":
        return this.updateCompany(id, fields);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Eliminar una entidad en Bitrix24 (genérico)
   */
  async deleteEntity(
    entityType: "lead" | "deal" | "contact" | "company",
    id: string
  ): Promise<boolean> {
    switch (entityType) {
      case "lead":
        return this.deleteLead(id);
      case "deal":
        return this.deleteDeal(id);
      case "contact":
        return this.deleteContact(id);
      case "company":
        return this.deleteCompany(id);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
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
   * Obtener lista de campos disponibles para un tipo de entidad
   */
  async getEntityFields(entityType: "lead" | "deal" | "contact" | "company"): Promise<Record<string, any>> {
    try {
      const method = `crm.${entityType}.fields`;
      const response = await this.callMethod(method);
      return response.result || {};
    } catch (error) {
      console.error(`[Bitrix24] Error getting ${entityType} fields:`, error);
      return {};
    }
  }

  /**
   * Obtener lista de usuarios de Bitrix24
   * Documentación: https://training.bitrix24.com/rest_help/users/user_get.php
   */
  async getUsers(params?: { filter?: Record<string, any>; select?: string[] }): Promise<BitrixEntity[]> {
    try {
      const response = await this.callMethod("user.get", {
        filter: params?.filter || {},
        select: params?.select || ["ID", "NAME", "LAST_NAME", "EMAIL", "PERSONAL_PHOTO", "WORK_POSITION"],
      });
      return response.result ?? [];
    } catch (error) {
      console.error("[Bitrix24] Error getting users:", error);
      return [];
    }
  }

  /**
   * Llamar a un método de la API de Bitrix24
   * Automáticamente refresca el token si expira (OAuth)
   */
  async callMethod(method: string, params: Record<string, any> = {}, retryCount = 0): Promise<any> {
    let url: string;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Determinar si usar webhook o OAuth
    if (this.config.webhookUrl) {
      // Modo webhook (legacy)
      url = `${this.config.webhookUrl}${method}.json`;
    } else if (this.config.domain && this.config.accessToken) {
      // Modo OAuth
      const baseUrl = this.config.domain.startsWith("http")
        ? this.config.domain
        : `https://${this.config.domain}`;
      url = `${baseUrl.replace(/\/$/, "")}/rest/${method}.json`;
      headers["Authorization"] = `Bearer ${this.config.accessToken}`;
    } else {
      throw new Error("Bitrix24Client: Se requiere webhookUrl o (domain + accessToken)");
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      // IMPORTANT: Read body first before checking status
      // This allows us to detect token errors and trigger refresh
      const data = await response.json();

      // Check for errors in response body
      if (data.error || !response.ok) {
        // Detectar si el error es de token expirado/inválido
        const isTokenError =
          response.status === 401 ||
          data.error === "expired_token" ||
          data.error === "invalid_token" ||
          data.error === "WRONG_AUTH_TYPE" ||
          data.error_description?.includes("expired") ||
          data.error_description?.includes("invalid");

        // Si es error de token, tenemos callback de refresh, y no hemos reintentado aún
        if (isTokenError && this.config.onTokenRefresh && retryCount === 0) {
          console.log(`[Bitrix24] Token expirado (${response.status}), refrescando automáticamente...`);

          try {
            // Llamar al callback para refrescar el token
            const newToken = await this.config.onTokenRefresh();

            // Actualizar el token en la configuración
            this.config.accessToken = newToken;

            console.log(`[Bitrix24] ✅ Token refrescado exitosamente, reintentando llamada...`);

            // Reintentar la llamada con el nuevo token (retryCount = 1)
            return await this.callMethod(method, params, retryCount + 1);
          } catch (refreshError) {
            console.error(`[Bitrix24] ❌ Error al refrescar token:`, refreshError);
            throw new Error(`Token refresh failed: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
          }
        }

        // If not a token error or refresh failed/unavailable, throw error
        if (data.error) {
          throw new Error(`Bitrix24 API error: ${data.error} - ${data.error_description}`);
        } else {
          throw new Error(`Bitrix24 API error: ${response.status} ${response.statusText}`);
        }
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

  async searchEntities(
    entityType: "lead" | "deal" | "contact" | "company",
    params: BitrixSearchParams
  ): Promise<BitrixEntity[]> {
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

    const limit = params.limit ?? 50;
    return filtered.slice(0, limit);
  }
}
