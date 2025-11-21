/**
 * AI Agent Tool Definitions
 * Defines all available tools/functions for the IA Agent
 */

import type { OpenAITool } from '../clients/openai';

/**
 * Tool: Send Catalogs
 * Sends PDF catalogs to the customer
 */
export const SEND_CATALOGS_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'send_catalogs',
    description: 'Envía catálogos PDF al cliente. Usa esta herramienta cuando el cliente solicite catálogos, precios, o información sobre productos. IMPORTANTE: Siempre pregunta al cliente si quiere catálogos CON o SIN precios antes de llamar esta función.',
    parameters: {
      type: 'object',
      properties: {
        with_prices: {
          type: 'boolean',
          description: 'true si el cliente quiere catálogos CON precios, false si los quiere SIN precios'
        },
        brands: {
          type: 'array',
          description: 'Marcas de catálogos a enviar. Si el cliente no especifica, envía todas.',
          items: {
            type: 'string',
            enum: ['azaleia_abierto', 'azaleia_cerrado', 'olympikus', 'tus_pasos', 'all']
          }
        },
        customer_note: {
          type: 'string',
          description: 'Nota opcional sobre qué tipo de cliente es o qué necesita (para analytics)'
        }
      },
      required: ['with_prices', 'brands']
    }
  }
};

/**
 * Tool: Transfer to Queue
 * Transfers the customer to a human agent in a specific queue
 */
export const TRANSFER_TO_QUEUE_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'transfer_to_queue',
    description: 'Transfiere al cliente a un asesor humano en una cola específica. El cliente quedará en espera y será atendido cuando haya asesores disponibles. Usa esta herramienta cuando: 1) El cliente quiera CREAR/MODIFICAR/ANULAR un pedido (usar queue_type="sales"), 2) El cliente tenga problemas/reclamos/garantías/consultas que NO sean pedidos (usar queue_type="support"), 3) El cliente muestre interés en SER PROMOTORA (usar queue_type="prospects"). IMPORTANTE: Puedes transferir en CUALQUIER momento, incluso fuera de horario - el cliente quedará en cola y será atendido cuando el asesor esté disponible.',
    parameters: {
      type: 'object',
      properties: {
        queue_type: {
          type: 'string',
          enum: ['sales', 'support', 'prospects'],
          description: 'Tipo de cola: "sales" para ventas/pedidos/cotizaciones (Counter), "support" para soporte/reclamos/garantías (ATC), "prospects" para personas interesadas en ser promotoras (Prospectos)'
        },
        reason: {
          type: 'string',
          description: 'Razón de la transferencia (qué necesita el cliente)'
        },
        customer_info: {
          type: 'object',
          description: 'Información del cliente recopilada durante la conversación',
          properties: {
            name: {
              type: 'string',
              description: 'Nombre del cliente'
            },
            location: {
              type: 'string',
              description: 'Ciudad o ubicación del cliente'
            },
            business_type: {
              type: 'string',
              description: 'Tipo de negocio (tienda física, catálogo, online, etc.)'
            },
            estimated_quantity: {
              type: 'string',
              description: 'Cantidad aproximada de pares que necesita'
            },
            interest: {
              type: 'string',
              description: 'En qué está interesado el cliente'
            }
          }
        }
      },
      required: ['queue_type', 'reason']
    }
  }
};

/**
 * Tool: Check Business Hours
 * Checks if we're currently within business hours for transfers
 */
export const CHECK_BUSINESS_HOURS_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'check_business_hours',
    description: 'Verifica si estamos en horario de atención para poder transferir a un asesor humano. Usa esta herramienta ANTES de intentar transferir al cliente. El horario es Lunes a Sábado 9:00-18:00 (hora de Lima).',
    parameters: {
      type: 'object',
      properties: {
        queue_type: {
          type: 'string',
          enum: ['sales', 'support', 'prospects'],
          description: 'Tipo de cola para verificar el horario específico'
        }
      },
      required: ['queue_type']
    }
  }
};

/**
 * Tool: Save Lead Information
 * Saves lead/customer information to Bitrix24 CRM
 */
export const SAVE_LEAD_INFO_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'save_lead_info',
    description: 'Guarda información del cliente/lead en el CRM (Bitrix24). Usa esta herramienta cuando hayas recopilado información valiosa del cliente que debe guardarse.',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Número de teléfono del cliente'
        },
        name: {
          type: 'string',
          description: 'Nombre del cliente'
        },
        location: {
          type: 'string',
          description: 'Ciudad o ubicación'
        },
        business_type: {
          type: 'string',
          description: 'Tipo de negocio'
        },
        interest: {
          type: 'string',
          description: 'En qué está interesado'
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales sobre la conversación'
        }
      },
      required: ['phone']
    }
  }
};

/**
 * Tool: End Conversation
 * Ends the conversation gracefully
 */
export const END_CONVERSATION_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'end_conversation',
    description: 'Termina la conversación de forma apropiada. Usa esta herramienta cuando: 1) El cliente se despide (dice "adiós", "gracias", "ya está", etc.), 2) Ya respondiste todas las preguntas del cliente y no hay más nada que hacer, 3) El cliente indica que no necesita nada más. IMPORTANTE: Siempre despídete amablemente ANTES de llamar esta función.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Razón por la que termina la conversación (ej: "cliente se despidió", "consulta resuelta", "no necesita más ayuda")'
        },
        customer_satisfied: {
          type: 'boolean',
          description: 'true si el cliente parece satisfecho con la atención, false si no'
        }
      },
      required: ['reason']
    }
  }
};

/**
 * Tool: Search Knowledge Base
 * Searches the knowledge base for specific information
 */
export const SEARCH_KNOWLEDGE_BASE_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'search_knowledge_base',
    description: 'Busca información específica en los catálogos y documentos de Azaleia. USA ESTA HERRAMIENTA cuando el cliente pregunte por: precios de productos específicos, características de modelos, políticas detalladas, stock, promociones específicas, o cualquier información que necesite consultar los catálogos. IMPORTANTE: Siempre usa esta herramienta ANTES de decir "no sé" o transferir por falta de información.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La pregunta o búsqueda específica. Ejemplos: "precio de GINNY-545", "zapatillas Olympikus con grafeno", "política de cambios", "premio pasa y gana 500 soles"'
        },
        category: {
          type: 'string',
          enum: ['productos', 'precios', 'politicas', 'promociones', 'general'],
          description: 'Categoría de la búsqueda para mejorar los resultados'
        }
      },
      required: ['query']
    }
  }
};

/**
 * Tool: Extract Text from Image (OCR)
 * Extracts text from images/documents using Google Vision OCR
 */
export const EXTRACT_TEXT_OCR_TOOL: OpenAITool = {
  type: 'function',
  function: {
    name: 'extract_text_ocr',
    description: 'Extrae texto de imágenes de documentos usando OCR (reconocimiento óptico de caracteres). USA ESTA HERRAMIENTA cuando el cliente envíe: DNI, RUC, comprobantes, facturas, vouchers de pago, documentos escaneados, o cualquier imagen con texto que necesite ser leído. IMPORTANTE: Esta herramienta es SOLO para extraer texto de documentos, NO para analizar productos. Para productos usa la capacidad de Vision integrada.',
    parameters: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'URL de la imagen del documento a procesar'
        },
        document_type: {
          type: 'string',
          enum: ['dni', 'ruc', 'voucher', 'factura', 'comprobante', 'documento_general'],
          description: 'Tipo de documento para optimizar el procesamiento'
        },
        purpose: {
          type: 'string',
          description: 'Para qué necesitas el texto extraído (ej: "verificar número de DNI", "obtener número de operación del voucher")'
        }
      },
      required: ['image_url', 'document_type']
    }
  }
};

/**
 * All available tools for the agent
 */
export const ALL_AGENT_TOOLS: OpenAITool[] = [
  SEARCH_KNOWLEDGE_BASE_TOOL,
  SEND_CATALOGS_TOOL,
  TRANSFER_TO_QUEUE_TOOL,
  CHECK_BUSINESS_HOURS_TOOL,
  SAVE_LEAD_INFO_TOOL,
  EXTRACT_TEXT_OCR_TOOL,
  END_CONVERSATION_TOOL,
];
