/**
 * AI Agent Executor
 * Main orchestrator for the IA Agent with tool support
 */

import type { OpenAIClient, OpenAIAgentRequest, OpenAIAgentResponse } from './clients/openai';
import type { IncomingMessage, OutboundMessage } from '../../src/runtime/executor';
import type { ConversationSession } from '../../src/runtime/session';
import { ALL_AGENT_TOOLS } from './tools/definitions';
import { executeTools, type ToolExecutionContext } from './tools/executor';
import { readConfig } from '../routes/ia-agent-config';
import { registerKeywordUsage } from '../crm/keyword-usage-tracker';
import { registerCampaignTracking } from '../crm/campaign-tracker';

export interface AgentExecutorResult {
  responses: OutboundMessage[];
  shouldTransfer?: boolean;
  transferQueue?: string;
  shouldEnd?: boolean;
  variables?: Record<string, any>;
}

/**
 * Detect keywords in user message and track them
 */
async function detectAndTrackKeywords(
  message: string,
  conversationId: string,
  config: any
): Promise<Array<{ keyword: string; groupId: string; groupName: string }>> {
  try {
    // Normalize message: lowercase, trim, remove trailing punctuation
    const normalizedMessage = message.toLowerCase().trim().replace(/[.,;!?]+$/, '');

    // Detect keywords in message
    const detectedKeywords: Array<{ keyword: string; groupId: string; groupName: string }> = [];

    // ONLY track keywords from keywordTracking configuration (EXACT MATCH for metrics)
    if (config.keywordTracking && Array.isArray(config.keywordTracking.groups)) {
      config.keywordTracking.groups.forEach((group: any) => {
        if (group.enabled && Array.isArray(group.keywords)) {
          group.keywords.forEach((keyword: string) => {
            // Normalize keyword: lowercase, trim, remove trailing punctuation
            const normalizedKeyword = keyword.toLowerCase().trim().replace(/[.,;!?]+$/, '');

            // EXACT MATCH ONLY for metrics
            if (normalizedMessage === normalizedKeyword) {
              detectedKeywords.push({
                keyword: keyword, // Use original keyword for display
                groupId: group.id,
                groupName: group.name
              });
              console.log(`[Agent Keywords] ✅ EXACT MATCH: "${keyword}" in group "${group.name}"`);
            }
          });
        }
      });
    }

    // Register each detected keyword
    for (const { keyword, groupId, groupName } of detectedKeywords) {
      await registerKeywordUsage({
        flowId: 'ia-agent',
        flowName: 'Agente IA',
        nodeId: 'agent-root',
        keywordGroupId: groupId,
        keywordGroupLabel: groupName,
        matchedKeyword: keyword,
        customerPhone: '',  // Will be added from context if available
        conversationId: conversationId,
      });
    }

    if (detectedKeywords.length > 0) {
      console.log(`[Agent Keywords] Registered ${detectedKeywords.length} keywords for conversation ${conversationId}`);
    }

    return detectedKeywords;
  } catch (error) {
    console.error('[Agent Keywords] Error tracking keywords:', error);
    // Don't fail the conversation if keyword tracking fails
    return [];
  }
}

/**
 * Execute the AI Agent
 * This handles the full conversation flow with tool support
 */
export async function executeAgent(
  openaiClient: OpenAIClient,
  session: ConversationSession,
  message: IncomingMessage | null,
  metadata?: any  // WhatsApp message metadata with referral data
): Promise<AgentExecutorResult> {
  try {
    // Load agent configuration
    const config = await readConfig();

    console.log('[Agent] Executing agent for session:', session.id);

    // Get conversation history from session
    const conversationHistory: any[] = Array.isArray(session.variables?.agentConversationHistory)
      ? session.variables.agentConversationHistory
      : [];

    // Add user message to history
    const userMessage = message?.text || '';
    if (userMessage) {
      conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Check if this is the first message in conversation
      const isFirstMessage = conversationHistory.length === 1;

      // Detect and track keywords
      const detectedKeywords = await detectAndTrackKeywords(userMessage, session.id, config);

      // Register campaign tracking on first message
      if (isFirstMessage) {
        // Extract referral data from metadata if available
        const referralData = metadata?.referral;

        await registerCampaignTracking({
          conversationId: session.id,
          customerPhone: session.contactId || '',
          initialMessage: userMessage,
          detectedKeyword: detectedKeywords.length > 0 ? detectedKeywords[0].keyword : undefined,
          keywordGroupId: detectedKeywords.length > 0 ? detectedKeywords[0].groupId : undefined,
          keywordGroupName: detectedKeywords.length > 0 ? detectedKeywords[0].groupName : undefined,
          flowId: 'ia-agent',
          flowName: 'Agente IA',
          // Add referral data from WhatsApp Click-to-Ad
          referralSourceUrl: referralData?.source_url,
          referralSourceId: referralData?.source_id,
          referralSourceType: referralData?.source_type,
          referralHeadline: referralData?.headline,
          referralBody: referralData?.body,
          referralMediaType: referralData?.media_type,
          referralImageUrl: referralData?.image_url,
          referralVideoUrl: referralData?.video_url,
          referralThumbnailUrl: referralData?.thumbnail_url,
          ctwaClid: referralData?.ctwa_clid,
        });

        // Log referral data if present
        if (referralData) {
          console.log(`[Agent] 🎯 Referral data detected:`, {
            source_type: referralData.source_type,
            source_id: referralData.source_id,
            headline: referralData.headline,
            ctwa_clid: referralData.ctwa_clid,
          });
        }
      }
    }

    // Build messages for the AI
    const messages = [
      {
        role: 'system' as const,
        content: config.systemPrompt || 'Eres un asistente virtual útil.',
      },
      ...conversationHistory.slice(-config.advancedSettings?.conversationMemory?.maxMessages || 10),
    ];

    console.log('[Agent] Calling OpenAI with', messages.length, 'messages and', ALL_AGENT_TOOLS.length, 'tools');

    // Call OpenAI with tools
    const request: OpenAIAgentRequest = {
      provider: 'openai',
      model: config.model || 'gpt-4-turbo-preview',
      messages,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1000,
      tools: ALL_AGENT_TOOLS,
      tool_choice: 'auto',
    };

    let aiResponse: OpenAIAgentResponse = await openaiClient.completeWithTools(request);
    const responses: OutboundMessage[] = [];
    let shouldTransfer = false;
    let transferQueue: string | undefined;
    let shouldEnd = false;

    // Handle tool calls
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      console.log('[Agent] AI wants to call', aiResponse.toolCalls.length, 'tools');

      // Execute tools
      const toolContext: ToolExecutionContext = {
        phone: session.contactId || '',
        conversationId: session.id,
        config,
      };

      const toolResults = await executeTools(aiResponse.toolCalls, toolContext);

      // Add assistant message with tool calls to history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse.content || '',
        tool_calls: aiResponse.toolCalls,
      });

      // Add tool results to history
      for (let i = 0; i < aiResponse.toolCalls.length; i++) {
        const toolCall = aiResponse.toolCalls[i];
        const toolResult = toolResults[i];

        conversationHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(toolResult.result),
        });

        // Collect messages from tool execution
        if (toolResult.messages) {
          responses.push(...toolResult.messages);
        }

        // Check for transfer
        if (toolResult.shouldTransfer) {
          shouldTransfer = true;
          transferQueue = toolResult.transferQueue;
        }

        // Check for end
        if (toolResult.shouldEnd) {
          shouldEnd = true;
        }
      }

      // Call AI again with tool results to get final response
      console.log('[Agent] Calling OpenAI again with tool results');

      const followUpRequest: OpenAIAgentRequest = {
        provider: 'openai',
        model: config.model || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system' as const,
            content: config.systemPrompt || 'Eres un asistente virtual útil.',
          },
          ...conversationHistory.slice(-(config.advancedSettings?.conversationMemory?.maxMessages || 10) - 2),
        ],
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 1000,
      };

      aiResponse = await openaiClient.completeWithTools(followUpRequest);
    }

    // Add AI response to conversation history
    if (aiResponse.content) {
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse.content,
      });

      // Add final response
      responses.push({
        type: 'text',
        text: aiResponse.content,
      });
    }

    console.log('[Agent] Execution complete. Responses:', responses.length);
    console.log('[Agent] 🔍 DEBUG - Response details:');
    responses.forEach((resp, idx) => {
      if (resp.type === 'text') {
        console.log(`  [${idx}] TEXT: "${resp.text?.substring(0, 100)}${resp.text && resp.text.length > 100 ? '...' : ''}"`);
      } else {
        console.log(`  [${idx}] ${resp.type.toUpperCase()}`);
      }
    });

    return {
      responses,
      shouldTransfer,
      transferQueue,
      shouldEnd,
      variables: {
        ...session.variables,
        agentConversationHistory: conversationHistory,
        lastAgentResponse: aiResponse.content,
        agentInteractionCount: (typeof session.variables?.agentInteractionCount === 'number'
          ? session.variables.agentInteractionCount
          : 0) + 1,
      },
    };
  } catch (error) {
    console.error('[Agent] Error executing agent:', error);

    // Return fallback response
    const fallbackConfig = await readConfig();
    return {
      responses: [{
        type: 'text',
        text: fallbackConfig?.advancedSettings?.fallbackResponse || 'Lo siento, ocurrió un error. Déjame conectarte con un asesor.',
      }],
      shouldTransfer: true,
      transferQueue: fallbackConfig?.transferRules?.sales?.queueId || undefined,
    };
  }
}
