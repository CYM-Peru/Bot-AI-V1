/**
 * Message Grouping Service
 *
 * Implements message batching/grouping for AI agents to prevent responding
 * to each individual message. Instead, waits for a timeout period and groups
 * all messages from a user before sending to the AI agent.
 *
 * Configuration: uses config.advancedSettings.messageGrouping.timeoutSeconds
 */

import type { WhatsAppMessage } from "../../src/api/whatsapp-webhook";
import { logDebug } from "../utils/file-logger";

interface PendingMessage {
  message: WhatsAppMessage;
  timestamp: number;
}

interface GroupingState {
  messages: PendingMessage[];
  timer: NodeJS.Timeout | null;
  isProcessing: boolean;
}

type ProcessCallback = (messages: WhatsAppMessage[]) => Promise<void>;

export class MessageGroupingService {
  private groupingStates: Map<string, GroupingState> = new Map();
  private timeoutSeconds: number;
  private enabled: boolean;

  constructor(timeoutSeconds: number = 6, enabled: boolean = true) {
    this.timeoutSeconds = timeoutSeconds;
    this.enabled = enabled;
    logDebug(`[MessageGrouping] Initialized with timeout: ${timeoutSeconds}s, enabled: ${enabled}`);
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(timeoutSeconds: number, enabled: boolean): void {
    this.timeoutSeconds = timeoutSeconds;
    this.enabled = enabled;
    logDebug(`[MessageGrouping] Config updated - timeout: ${timeoutSeconds}s, enabled: ${enabled}`);
  }

  /**
   * Add a message to the grouping queue for a conversation
   *
   * @param conversationId - Unique identifier for the conversation
   * @param message - WhatsApp message to group
   * @param processCallback - Function to call when timeout expires with all grouped messages
   */
  async addMessage(
    conversationId: string,
    message: WhatsAppMessage,
    processCallback: ProcessCallback
  ): Promise<void> {
    // If grouping is disabled, process immediately
    if (!this.enabled) {
      logDebug(`[MessageGrouping] Grouping disabled - processing message immediately`);
      await processCallback([message]);
      return;
    }

    // Get or create grouping state for this conversation
    let state = this.groupingStates.get(conversationId);

    if (!state) {
      state = {
        messages: [],
        timer: null,
        isProcessing: false,
      };
      this.groupingStates.set(conversationId, state);
      logDebug(`[MessageGrouping] Created new grouping state for conversation: ${conversationId}`);
    }

    // If already processing, queue message but don't reset timer
    if (state.isProcessing) {
      logDebug(`[MessageGrouping] Conversation ${conversationId} is processing - queueing message`);
      state.messages.push({
        message,
        timestamp: Date.now(),
      });
      return;
    }

    // Add message to pending queue
    state.messages.push({
      message,
      timestamp: Date.now(),
    });

    logDebug(`[MessageGrouping] Added message to conversation ${conversationId} - total pending: ${state.messages.length}`);

    // Clear existing timer if any
    if (state.timer) {
      clearTimeout(state.timer);
      logDebug(`[MessageGrouping] Reset timer for conversation ${conversationId}`);
    }

    // Set new timer
    state.timer = setTimeout(async () => {
      await this.processGroupedMessages(conversationId, processCallback);
    }, this.timeoutSeconds * 1000);

    logDebug(`[MessageGrouping] Timer set for ${this.timeoutSeconds}s - conversation: ${conversationId}`);
  }

  /**
   * Process all grouped messages for a conversation
   */
  private async processGroupedMessages(
    conversationId: string,
    processCallback: ProcessCallback
  ): Promise<void> {
    const state = this.groupingStates.get(conversationId);

    if (!state || state.messages.length === 0) {
      logDebug(`[MessageGrouping] No messages to process for conversation: ${conversationId}`);
      return;
    }

    // Mark as processing to prevent race conditions
    state.isProcessing = true;
    state.timer = null;

    // Get all pending messages
    const messagesToProcess = [...state.messages];
    const messageCount = messagesToProcess.length;

    // Clear pending messages
    state.messages = [];

    logDebug(`[MessageGrouping] ⚡ Processing ${messageCount} grouped messages for conversation: ${conversationId}`);

    try {
      // Extract just the WhatsApp messages
      const whatsappMessages = messagesToProcess.map(pm => pm.message);

      // Call the process callback with all grouped messages
      await processCallback(whatsappMessages);

      logDebug(`[MessageGrouping] ✅ Successfully processed ${messageCount} messages for conversation: ${conversationId}`);
    } catch (error) {
      console.error(`[MessageGrouping] Error processing grouped messages for ${conversationId}:`, error);
      throw error;
    } finally {
      // Reset processing state
      state.isProcessing = false;

      // If new messages arrived while processing, start a new timer
      if (state.messages.length > 0) {
        logDebug(`[MessageGrouping] New messages arrived during processing (${state.messages.length}) - starting new timer`);
        state.timer = setTimeout(async () => {
          await this.processGroupedMessages(conversationId, processCallback);
        }, this.timeoutSeconds * 1000);
      } else {
        // Clean up state if no more messages
        this.groupingStates.delete(conversationId);
        logDebug(`[MessageGrouping] Cleaned up state for conversation: ${conversationId}`);
      }
    }
  }

  /**
   * Get pending message count for a conversation
   */
  getPendingCount(conversationId: string): number {
    const state = this.groupingStates.get(conversationId);
    return state ? state.messages.length : 0;
  }

  /**
   * Check if a conversation is currently processing
   */
  isProcessing(conversationId: string): boolean {
    const state = this.groupingStates.get(conversationId);
    return state ? state.isProcessing : false;
  }

  /**
   * Force process messages immediately (useful for testing or manual triggers)
   */
  async forceProcess(
    conversationId: string,
    processCallback: ProcessCallback
  ): Promise<void> {
    const state = this.groupingStates.get(conversationId);

    if (!state) {
      logDebug(`[MessageGrouping] No state to force process for conversation: ${conversationId}`);
      return;
    }

    // Clear timer
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    // Process immediately
    await this.processGroupedMessages(conversationId, processCallback);
  }

  /**
   * Clear all pending messages for a conversation
   */
  clearConversation(conversationId: string): void {
    const state = this.groupingStates.get(conversationId);

    if (state) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
      this.groupingStates.delete(conversationId);
      logDebug(`[MessageGrouping] Cleared conversation: ${conversationId}`);
    }
  }

  /**
   * Get statistics about current grouping state
   */
  getStats(): {
    activeConversations: number;
    totalPendingMessages: number;
    processingConversations: number;
  } {
    let totalPending = 0;
    let processing = 0;

    for (const state of this.groupingStates.values()) {
      totalPending += state.messages.length;
      if (state.isProcessing) {
        processing++;
      }
    }

    return {
      activeConversations: this.groupingStates.size,
      totalPendingMessages: totalPending,
      processingConversations: processing,
    };
  }
}
