/**
 * Webhook execution utilities
 * Maneja llamadas HTTP reales para webhooks OUT e IN
 */

export interface WebhookOutConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Array<{ k: string; v: string }>;
  body?: string;
}

export interface WebhookResponse {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  duration: number;
}

/**
 * Reemplaza variables {{variable}} en el string con valores del contexto
 */
function interpolateVariables(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const keys = varName.trim().split('.');
    let value: any = context;

    for (const key of keys) {
      value = value?.[key];
    }

    return value !== undefined ? String(value) : match;
  });
}

/**
 * Ejecuta un webhook OUT (llamada HTTP saliente)
 */
export async function executeWebhookOut(
  config: WebhookOutConfig,
  context: Record<string, any> = {}
): Promise<WebhookResponse> {
  const startTime = Date.now();

  try {
    // Interpolar variables en URL
    const url = interpolateVariables(config.url, context);

    // Construir headers
    const headers: Record<string, string> = {};
    for (const header of config.headers || []) {
      if (header.k && header.v) {
        headers[header.k] = interpolateVariables(header.v, context);
      }
    }

    // Interpolar variables en body
    let body: string | undefined;
    if (config.body && config.method !== 'GET') {
      body = interpolateVariables(config.body, context);
    }

    // Ejecutar request
    const response = await fetch(url, {
      method: config.method,
      headers,
      body: body && config.method !== 'GET' ? body : undefined,
    });

    const duration = Date.now() - startTime;

    // Parse response
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      success: response.ok,
      status: response.status,
      data,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error.message || 'Error desconocido',
      duration,
    };
  }
}

/**
 * Genera URL única para webhook IN
 */
export function generateWebhookInUrl(flowId: string, nodeId: string, secret?: string): string {
  const baseUrl = window.location.origin;
  const path = `/api/webhooks/${flowId}/${nodeId}`;

  if (secret) {
    return `${baseUrl}${path}?secret=${encodeURIComponent(secret)}`;
  }

  return `${baseUrl}${path}`;
}

/**
 * Valida el secret de un webhook IN
 */
export function validateWebhookSecret(providedSecret: string, expectedSecret?: string): boolean {
  if (!expectedSecret) {
    return true; // Sin secret configurado, permitir acceso
  }

  return providedSecret === expectedSecret;
}

/**
 * Función de testing para probar un webhook configurado
 */
export async function testWebhookOut(config: WebhookOutConfig): Promise<WebhookResponse> {
  // Contexto de prueba
  const testContext = {
    user: {
      id: 'test-user-123',
      name: 'Usuario de Prueba',
      phone: '+51999999999',
    },
    last_message: 'Mensaje de prueba',
    flow: {
      id: 'test-flow',
      node: 'test-node',
    },
    timestamp: new Date().toISOString(),
  };

  return executeWebhookOut(config, testContext);
}
