/**
 * AI Agent Tool Executor
 * Executes tool calls from the AI agent
 */

import type { OpenAIToolCall } from '../clients/openai';
import type { OutboundMessage } from '../../../src/runtime/executor';

export interface ToolExecutionContext {
  phone: string;
  conversationId?: string;
  config: any; // Agent configuration
}

export interface ToolExecutionResult {
  success: boolean;
  result: any;
  messages?: OutboundMessage[];
  shouldTransfer?: boolean;
  transferQueue?: string;
  shouldEnd?: boolean;
}

/**
 * Execute a single tool call
 */
export async function executeTool(
  toolCall: OpenAIToolCall,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  console.log(`[Agent Tool] Executing ${functionName} with args:`, args);

  switch (functionName) {
    case 'search_knowledge_base':
      return await executeSearchKnowledgeBase(args, context);

    case 'send_catalogs':
      return await executeSendCatalogs(args, context);

    case 'transfer_to_queue':
      return await executeTransferToQueue(args, context);

    case 'check_business_hours':
      return executeCheckBusinessHours(args, context);

    case 'save_lead_info':
      return await executeSaveLeadInfo(args, context);

    case 'extract_text_ocr':
      return await executeExtractTextOCR(args, context);

    case 'end_conversation':
      return executeEndConversation(args, context);

    default:
      console.error(`[Agent Tool] Unknown tool: ${functionName}`);
      return {
        success: false,
        result: { error: `Unknown tool: ${functionName}` }
      };
  }
}

/**
 * Tool: search_knowledge_base
 * Searches the knowledge base for specific information using RAG
 */
async function executeSearchKnowledgeBase(
  args: { query: string; category?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { query, category } = args;

  console.log(`[search_knowledge_base] Searching for: "${query}" in category: ${category || 'general'}`);

  try {
    // Import RAG service dynamically
    const { getRagService } = await import('../../ai/rag-service');
    const ragService = await getRagService();

    // Check if RAG is available
    if (!ragService.isProviderAvailable('openai')) {
      return {
        success: false,
        result: {
          error: 'RAG service not available',
          answer: 'No tengo acceso a la base de conocimiento en este momento. Déjame conectarte con un asesor.'
        }
      };
    }

    // Get knowledge base documents from config
    const knowledgeBase = context.config.integrations?.knowledgeBase;
    if (!knowledgeBase || !knowledgeBase.enabled || !knowledgeBase.documents || knowledgeBase.documents.length === 0) {
      console.log('[search_knowledge_base] Knowledge base not configured or empty');
      return {
        success: false,
        result: {
          error: 'Knowledge base not configured',
          answer: 'No tengo esa información disponible. ¿Te conecto con un asesor?'
        }
      };
    }

    // Load embeddings database
    const path = await import('path');
    const dbPath = path.join(process.cwd(), 'data', 'embeddings-db.json');

    let database;
    try {
      const { loadEmbeddingsDatabase, searchRelevantChunks } = await import('../rag-embeddings');
      database = await loadEmbeddingsDatabase(dbPath);
    } catch (error) {
      console.log('[search_knowledge_base] Error loading embeddings database:', error);
      return {
        success: false,
        result: {
          error: 'Base de datos de embeddings no disponible',
          answer: 'No tengo acceso a la información en este momento. ¿Te conecto con un asesor?'
        }
      };
    }

    // Check if database has embeddings
    if (!database || database.chunks.length === 0) {
      console.log('[search_knowledge_base] Embeddings database is empty');
      return {
        success: false,
        result: {
          error: 'Base de datos vacía',
          answer: 'La base de conocimiento aún no ha sido indexada. ¿Te conecto con un asesor?'
        }
      };
    }

    console.log(`[search_knowledge_base] Searching in ${database.chunks.length} chunks for: "${query}"`);

    // Perform semantic search
    const { searchRelevantChunks } = await import('../rag-embeddings');

    // Read API key from AI config
    const { readAIConfig } = await import('../../routes/ai-config');
    const aiConfig = await readAIConfig();
    const openaiKey = aiConfig?.openai?.apiKey;

    if (!openaiKey) {
      return {
        success: false,
        result: {
          error: 'OpenAI API key not available',
          answer: 'No puedo acceder a la base de conocimiento. ¿Te conecto con un asesor?'
        }
      };
    }

    try {
      // Search for relevant chunks (top 3)
      const relevantChunks = await searchRelevantChunks(query, database, openaiKey, 3);

      if (!relevantChunks || relevantChunks.length === 0) {
        // Calculate embedding cost even when no results found
        const queryTokens = Math.ceil(query.length / 4);
        const embeddingCostUsd = (queryTokens / 1_000_000) * 0.0001;

        // Log to database
        try {
          // @ts-ignore - pg types not available but runtime works fine
          const { Pool } = await import('pg');
          const pool = new Pool({
            host: 'localhost',
            port: 5432,
            database: 'flowbuilder_crm',
            user: 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
          });

          await pool.query(
            `INSERT INTO rag_usage (
              query, category, chunks_used, found,
              embedding_cost_usd, completion_cost_usd, total_cost_usd,
              conversation_id, customer_phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              query,
              category || 'general',
              0,
              false,
              embeddingCostUsd,
              0,
              embeddingCostUsd,
              context.conversationId || null,
              context.phone
            ]
          );

          await pool.end();
        } catch (dbError) {
          console.error('[search_knowledge_base] Error tracking usage (no results):', dbError);
        }

        return {
          success: true,
          result: {
            found: false,
            answer: `No encontré información específica sobre "${query}" en los catálogos. ¿Te conecto con un asesor para ayudarte mejor?`,
            source: 'knowledge_base',
            category: category || 'general',
            cost: {
              embedding: embeddingCostUsd,
              completion: 0,
              total: embeddingCostUsd
            }
          }
        };
      }

      // Build context from relevant chunks
      const ragContext = relevantChunks.map((chunk, idx) =>
        `[Fragmento ${idx + 1}]\n${chunk.content}`
      ).join('\n\n');

      // Use OpenAI to generate answer based on context
      const answerPrompt = `Basándote ÚNICAMENTE en la siguiente información de los catálogos de Azaleia, responde esta pregunta del cliente:

PREGUNTA: "${query}"

INFORMACIÓN DE LOS CATÁLOGOS:
${ragContext}

REGLAS IMPORTANTES:
- Solo usa información que esté EXPLÍCITAMENTE en los fragmentos
- Si no encuentras la información, di "No encontré esa información"
- Sé específico: cita precios, modelos, códigos de producto cuando estén disponibles
- Responde en español de Perú, de manera clara y concisa
- Si hay precios, menciónalos con el formato exacto (ej: "S/ 159.90")`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente que responde preguntas basándose SOLO en la información proporcionada.' },
            { role: 'user', content: answerPrompt }
          ],
          temperature: 0.3,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${await response.text()}`);
      }

      const data = await response.json();
      const answer = data.choices[0]?.message?.content || 'No pude generar una respuesta';

      console.log(`[search_knowledge_base] Found ${relevantChunks.length} relevant chunks`);
      console.log(`[search_knowledge_base] Answer: ${answer.substring(0, 100)}...`);

      // Calculate costs
      // Embedding cost: text-embedding-3-small = $0.0001 per 1M tokens
      const queryTokens = Math.ceil(query.length / 4); // Approximate tokens
      const embeddingCostUsd = (queryTokens / 1_000_000) * 0.0001;

      // Completion cost from OpenAI response
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      // gpt-4o-mini: $0.00015 per 1M input tokens, $0.0006 per 1M output tokens
      const completionCostUsd =
        (usage.prompt_tokens / 1_000_000) * 0.00015 +
        (usage.completion_tokens / 1_000_000) * 0.0006;

      const totalCostUsd = embeddingCostUsd + completionCostUsd;

      console.log(`[search_knowledge_base] Cost - Embedding: $${embeddingCostUsd.toFixed(6)}, Completion: $${completionCostUsd.toFixed(6)}, Total: $${totalCostUsd.toFixed(6)}`);

      // Save usage to database
      try {
        // @ts-ignore - pg types not available but runtime works fine
        const { Pool } = await import('pg');
        const pool = new Pool({
          host: 'localhost',
          port: 5432,
          database: 'flowbuilder_crm',
          user: 'postgres',
          password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
        });

        await pool.query(
          `INSERT INTO rag_usage (
            query, category, chunks_used, found,
            embedding_cost_usd, completion_cost_usd, total_cost_usd,
            conversation_id, customer_phone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            query,
            category || 'general',
            relevantChunks.length,
            true,
            embeddingCostUsd,
            completionCostUsd,
            totalCostUsd,
            context.conversationId || null,
            context.phone
          ]
        );

        await pool.end();
        console.log('[search_knowledge_base] Usage tracked to database');
      } catch (dbError) {
        console.error('[search_knowledge_base] Error tracking usage to database:', dbError);
        // Don't fail the request if logging fails
      }

      return {
        success: true,
        result: {
          found: true,
          answer,
          source: 'knowledge_base',
          category: category || 'general',
          chunksUsed: relevantChunks.length,
          cost: {
            embedding: embeddingCostUsd,
            completion: completionCostUsd,
            total: totalCostUsd
          }
        }
      };

    } catch (error) {
      console.error('[search_knowledge_base] Error during search:', error);
      return {
        success: false,
        result: {
          error: String(error),
          answer: 'Hubo un error al buscar en la base de conocimiento. ¿Te conecto con un asesor?'
        }
      };
    }

  } catch (error) {
    console.error('[search_knowledge_base] Error searching knowledge base:', error);
    return {
      success: false,
      result: {
        error: String(error),
        answer: 'Hubo un error al buscar en la base de conocimiento. Déjame conectarte con un asesor.'
      }
    };
  }
}

/**
 * Tool: send_catalogs
 * Sends PDF catalogs to the customer
 */
async function executeSendCatalogs(
  args: { with_prices: boolean; brands: string[]; customer_note?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { with_prices, brands, customer_note } = args;
  const messages: OutboundMessage[] = [];

  console.log(`[send_catalogs] Sending catalogs: with_prices=${with_prices}, brands=${brands.join(',')}`);

  // Load files from ia-agent-files.json
  const fs = await import('fs/promises');
  const path = await import('path');
  const filesConfigPath = path.join(process.cwd(), 'data', 'ia-agent-files.json');

  let files: any[] = [];
  try {
    const data = await fs.readFile(filesConfigPath, 'utf-8');
    const config = JSON.parse(data);
    files = config.files || [];
  } catch (error) {
    console.error('[send_catalogs] Error loading files:', error);
    // Fallback to old config-based catalogs if files don't exist
    return executeSendCatalogsLegacy(args, context);
  }

  // Filter enabled catalogs only
  let catalogsToSend = files.filter((f: any) =>
    f.category === 'catalog' && f.enabled
  );

  // Filter by with_prices if metadata is available
  if (catalogsToSend.some((c: any) => typeof c.metadata?.withPrices === 'boolean')) {
    catalogsToSend = catalogsToSend.filter((c: any) =>
      c.metadata?.withPrices === with_prices
    );
  }

  // Filter by brands if specified (and not 'all')
  if (!brands.includes('all') && brands.length > 0) {
    catalogsToSend = catalogsToSend.filter((c: any) =>
      brands.some(brand =>
        c.name.toLowerCase().includes(brand.toLowerCase()) ||
        c.metadata?.brand?.toLowerCase().includes(brand.toLowerCase()) ||
        c.tags?.some((tag: string) => tag.toLowerCase().includes(brand.toLowerCase()))
      )
    );
  }

  // Send each catalog as a media message
  for (const catalog of catalogsToSend) {
    messages.push({
      type: 'media',
      url: catalog.url,
      mediaType: 'file',
      filename: catalog.fileName,
    });
  }

  console.log(`[send_catalogs] Sending ${catalogsToSend.length} catalogs from dynamic files`);

  return {
    success: true,
    result: {
      catalogsSent: catalogsToSend.length,
      catalogs: catalogsToSend.map(c => c.name),
      withPrices: with_prices,
      customerNote: customer_note,
    },
    messages,
  };
}

/**
 * Legacy fallback for send_catalogs (uses old config format)
 */
async function executeSendCatalogsLegacy(
  args: { with_prices: boolean; brands: string[]; customer_note?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { with_prices, brands, customer_note } = args;
  const messages: OutboundMessage[] = [];

  console.log('[send_catalogs] Using legacy config-based catalogs');

  // Get catalogs from config
  const catalogs = context.config.catalogs || {};
  const catalogsToSend: any[] = [];

  // Determine which catalogs to send
  const brandList = brands.includes('all')
    ? ['azaleia_abierto', 'azaleia_cerrado', 'olympikus', 'tus_pasos']
    : brands;

  for (const brand of brandList) {
    const key = with_prices ? `${brand}_con_precios` : `${brand}_sin_precios`;
    const catalog = catalogs[key];

    if (catalog && catalog.enabled) {
      catalogsToSend.push(catalog);
    }
  }

  // Send each catalog as a media message
  for (const catalog of catalogsToSend) {
    messages.push({
      type: 'media',
      url: catalog.url,
      mediaType: 'file',
      filename: catalog.fileName,
    });
  }

  return {
    success: true,
    result: {
      catalogsSent: catalogsToSend.length,
      catalogs: catalogsToSend.map(c => c.name),
      withPrices: with_prices,
      customerNote: customer_note,
    },
    messages,
  };
}

/**
 * Tool: transfer_to_queue
 * Transfers customer to a specific queue
 */
async function executeTransferToQueue(
  args: { queue_type: 'sales' | 'support' | 'prospects'; reason: string; customer_info?: any },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { queue_type, reason, customer_info } = args;

  console.log(`[transfer_to_queue] Transferring to ${queue_type} queue: ${reason}`);

  // Get queue configuration - transferRules is now an array
  const transferRules = Array.isArray(context.config.transferRules)
    ? context.config.transferRules
    : [];

  const transferRule = transferRules.find((rule: any) => rule.id === queue_type);

  if (!transferRule || !transferRule.enabled) {
    return {
      success: false,
      result: { error: `Queue ${queue_type} is not configured or disabled` }
    };
  }

  const queueId = transferRule.queueId;

  // Save customer info to CRM if Bitrix24 is enabled
  if (context.config.integrations?.bitrix24?.enabled && customer_info) {
    await executeSaveLeadInfo(
      {
        phone: context.phone,
        ...customer_info,
        notes: `Transfer reason: ${reason}`,
      },
      context
    );
  }

  // Return transfer instruction WITHOUT static message - AI will generate unique response
  return {
    success: true,
    result: {
      queueId,
      queueName: transferRule.name,
      reason,
      customerInfo: customer_info,
      note: 'Transferencia completada. El agente debe generar un mensaje de despedida ÚNICO y DIFERENTE cada vez.'
    },
    shouldTransfer: true,
    transferQueue: queueId,
  };
}

/**
 * Tool: check_business_hours
 * Checks if we're in business hours
 */
function executeCheckBusinessHours(
  args: { queue_type: 'sales' | 'support' | 'prospects' },
  context: ToolExecutionContext
): ToolExecutionResult {
  const { queue_type } = args;

  // Get schedule for this queue type - transferRules is now an array
  const transferRules = Array.isArray(context.config.transferRules)
    ? context.config.transferRules
    : [];

  const transferRule = transferRules.find((rule: any) => rule.id === queue_type);
  if (!transferRule) {
    return {
      success: false,
      result: { isOpen: false, reason: 'Queue not configured' }
    };
  }

  const schedule = transferRule.schedule;
  const now = new Date();

  // Convert to Lima timezone (UTC-5)
  const limaOffset = -5 * 60; // minutes
  const localOffset = now.getTimezoneOffset();
  const limaTime = new Date(now.getTime() + (localOffset - limaOffset) * 60000);

  const currentDay = limaTime.getDay() === 0 ? 7 : limaTime.getDay(); // 1-7 (Monday-Sunday)
  const currentTime = `${String(limaTime.getHours()).padStart(2, '0')}:${String(limaTime.getMinutes()).padStart(2, '0')}`;

  const isOpenDay = schedule.days.includes(currentDay);
  const isOpenTime = currentTime >= schedule.startTime && currentTime < schedule.endTime;
  const isOpen = isOpenDay && isOpenTime;

  console.log(`[check_business_hours] Queue: ${queue_type}, Day: ${currentDay}, Time: ${currentTime}, Open: ${isOpen}`);

  // CAMBIO: Ya NO devolvemos mensaje estático, solo información para que la IA decida qué decir
  return {
    success: true,
    result: {
      isOpen,
      currentDay,
      currentTime,
      schedule: {
        days: schedule.days,
        hours: `${schedule.startTime}-${schedule.endTime}`,
      },
      // La IA usará esta info para generar su propia respuesta personalizada
      note: isOpen
        ? 'El equipo está disponible ahora'
        : 'El equipo no está disponible en este momento, pero la IA puede seguir ayudando'
    }
  };
}

/**
 * Tool: save_lead_info
 * Saves lead information to Bitrix24 CRM
 */
async function executeSaveLeadInfo(
  args: { phone: string; name?: string; location?: string; business_type?: string; interest?: string; notes?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  console.log(`[save_lead_info] Saving lead info for ${args.phone}`);

  // Check if Bitrix24 integration is enabled
  const bitrixConfig = context.config.integrations?.bitrix24;
  if (!bitrixConfig || !bitrixConfig.enabled) {
    console.log('[save_lead_info] Bitrix24 integration is disabled');
    return {
      success: true,
      result: { saved: false, reason: 'Bitrix24 integration disabled' }
    };
  }

  try {
    // Here you would integrate with your actual Bitrix24 client
    // For now, we'll just log it and return success
    // TODO: Integrate with actual Bitrix24 API

    console.log('[save_lead_info] Lead info:', args);

    return {
      success: true,
      result: {
        saved: true,
        leadInfo: args,
      }
    };
  } catch (error) {
    console.error('[save_lead_info] Error saving to Bitrix24:', error);
    return {
      success: false,
      result: { error: String(error) }
    };
  }
}

/**
 * Tool: extract_text_ocr
 * Extracts text from images/documents using Google Vision OCR
 */
async function executeExtractTextOCR(
  args: { image_url: string; document_type: string; purpose?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { image_url, document_type, purpose } = args;

  console.log(`[extract_text_ocr] Processing ${document_type}: ${image_url}`);
  if (purpose) {
    console.log(`[extract_text_ocr] Purpose: ${purpose}`);
  }

  try {
    // Import OCR service dynamically
    const { extractTextFromDocument } = await import('../ocr-service');

    // Extract text using Google Vision
    const ocrResult = await extractTextFromDocument(image_url);

    if (!ocrResult.success) {
      console.error('[extract_text_ocr] OCR failed:', ocrResult.error);
      return {
        success: false,
        result: {
          error: ocrResult.error || 'Failed to extract text from image',
          text: '',
        }
      };
    }

    const extractedText = ocrResult.text || '';
    console.log(`[extract_text_ocr] ✅ Extracted ${extractedText.length} characters`);

    // Provide context based on document type
    let contextualInfo = '';
    switch (document_type) {
      case 'dni':
        contextualInfo = 'Texto extraído del DNI. Busca el número de DNI (8 dígitos).';
        break;
      case 'ruc':
        contextualInfo = 'Texto extraído del RUC. Busca el número RUC (11 dígitos).';
        break;
      case 'voucher':
        contextualInfo = 'Texto extraído del voucher de pago. Busca número de operación, fecha, monto.';
        break;
      case 'factura':
        contextualInfo = 'Texto extraído de la factura. Busca número de factura, RUC, monto total.';
        break;
      case 'comprobante':
        contextualInfo = 'Texto extraído del comprobante. Busca datos relevantes como número, fecha, monto.';
        break;
      default:
        contextualInfo = 'Texto extraído del documento.';
    }

    return {
      success: true,
      result: {
        text: extractedText,
        document_type,
        context: contextualInfo,
        extracted_successfully: true,
      }
    };

  } catch (error: any) {
    console.error('[extract_text_ocr] Error:', error.message);
    return {
      success: false,
      result: {
        error: error.message || 'Unknown error during OCR processing',
        text: '',
      }
    };
  }
}

/**
 * Tool: end_conversation
 * Ends the conversation gracefully
 */
function executeEndConversation(
  args: { reason: string; customer_satisfied?: boolean },
  context: ToolExecutionContext
): ToolExecutionResult {
  const { reason, customer_satisfied } = args;

  console.log(`[end_conversation] Ending conversation: ${reason}, satisfied: ${customer_satisfied}`);

  return {
    success: true,
    result: {
      ended: true,
      reason,
      customerSatisfied: customer_satisfied ?? true,
    },
    shouldEnd: true,
  };
}

/**
 * Execute multiple tool calls in sequence
 */
export async function executeTools(
  toolCalls: OpenAIToolCall[],
  context: ToolExecutionContext
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall, context);
    results.push(result);
  }

  return results;
}
