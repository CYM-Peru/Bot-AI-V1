import {
  type AskActionData,
  type ButtonOption,
  type ConditionRule,
  type Flow,
  type FlowNode,
  type MenuOption,
} from "../flow/types";
import { getAskData, getButtonsData, getConditionData, getMenuOptions, getSchedulerData } from "../flow/utils/flow";
import { isInWindow, nextOpening } from "../flow/scheduler";
import type { ConversationSession } from "./session";
import type { Bitrix24Client } from "../integrations/bitrix24";
import { botLogger } from "./monitoring";
import { replaceVariables } from "../../server/utils/variables";
import { saveMenuOptionSelection } from "../../server/menu-analytics-db";

// Keyword tracking global handler (set by server)
let keywordUsageHandler: ((data: any) => void) | null = null;
export function setKeywordUsageHandler(handler: (data: any) => void) {
  keywordUsageHandler = handler;
}

export type IncomingMessageType = "text" | "button" | "media" | "unknown";

export interface IncomingMessage {
  type: IncomingMessageType;
  text?: string;
  payload?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  filename?: string;
  raw?: Record<string, unknown>;
}

export type OutboundMessage =
  | { type: "text"; text: string }
  | { type: "buttons"; text: string; buttons: ButtonOption[]; moreTargetId?: string | null }
  | { type: "menu"; text: string; options: MenuOption[]; isPlainText?: boolean }
  | { type: "media"; url: string; mediaType: string; caption?: string; filename?: string }
  | { type: "system"; payload: Record<string, unknown> };

export interface ExecutionOptions {
  now?: Date;
}

export interface ExecutionResult {
  responses: OutboundMessage[];
  nextNodeId: string | null;
  awaitingUserInput: boolean;
  variables?: Record<string, string>;
  ended?: boolean;
  shouldTransfer?: boolean;
  transferQueue?: string;
}

export interface WebhookCallConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface WebhookCallResult {
  ok: boolean;
  status: number;
  response?: unknown;
}

export interface WebhookDispatcher {
  callWebhook(config: WebhookCallConfig, context: { flow: Flow; node: FlowNode; session: ConversationSession }): Promise<WebhookCallResult>;
}

export interface TimerScheduler {
  scheduleTimer(
    sessionId: string,
    flowId: string,
    contactId: string,
    channel: string,
    nextNodeId: string,
    nodeId: string,
    delaySeconds: number
  ): Promise<string>;
}

export interface ExecutorDependencies {
  webhookDispatcher?: WebhookDispatcher;
  bitrix24Client?: Bitrix24Client;
  timerScheduler?: TimerScheduler;
}

export class NodeExecutor {
  private readonly webhookDispatcher?: WebhookDispatcher;
  private readonly bitrix24Client?: Bitrix24Client;
  private readonly timerScheduler?: TimerScheduler;

  constructor(dependencies: ExecutorDependencies = {}) {
    this.webhookDispatcher = dependencies.webhookDispatcher;
    this.bitrix24Client = dependencies.bitrix24Client;
    this.timerScheduler = dependencies.timerScheduler;
  }

  async execute(
    flow: Flow,
    node: FlowNode,
    session: ConversationSession,
    message: IncomingMessage | null,
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    if (node.type === "menu") {
      return await this.executeMenu(node, message, session, false);
    }
    if (node.type === "simple-menu") {
      return await this.executeMenu(node, message, session, true);
    }
    if (node.type === "text-menu") {
      return await this.executeTextMenu(node, message, session);
    }

    const actionKind = node.action?.kind;
    switch (actionKind) {
      case "message":
        return await this.executeMessageNode(node, session);
      case "buttons":
        return await this.executeButtonsNode(node, message, session);
      case "attachment":
        return await this.executeAttachmentNode(node, session);
      case "ask":
        return this.executeAskNode(node, message);
      case "condition":
        return this.executeConditionNode(node, message, session);
      case "validation":
        return await this.executeValidationNode(node, message, session, flow);
      case "validation_bitrix":
        return await this.executeValidationBitrixNode(node, message, session);
      case "scheduler":
        return this.executeSchedulerNode(flow, node, options.now ?? new Date());
      case "webhook_out":
        return this.executeWebhookNode(flow, node, session);
      case "transfer":
        return this.executeTransferNode(node);
      case "handoff":
        return this.executeHandoffNode(node);
      case "ia_rag":
        return await this.executeIaRagNode(node, message, session);
      case "ia_agent":
        return await this.executeIaAgentNode(node, message, session);
      case "tool":
        return this.executeToolNode(node, session);
      case "delay":
        return this.executeDelayNode(flow, node, session, message);
      case "bitrix_create":
        return await this.executeBitrixCrmNode(node, session);
      case "bitrix_crm":
        return await this.executeBitrixCrmNode(node, session);
      case "webhook_in":
        return this.executeWebhookInNode(node, session);
      case "start":
        // Start node just passes to next node without any response
        return { responses: [], nextNodeId: this.nextChild(node), awaitingUserInput: false };
      case "end": {
        console.log('🏁 [End] Ending conversation flow', { nodeId: node.id, nodeLabel: node.label });
        const endMessage = node.action?.data?.message || node.action?.data?.note;
        const responses: OutboundMessage[] = [];

        // Send optional goodbye message if configured
        if (endMessage && typeof endMessage === 'string' && endMessage.trim()) {
          responses.push({
            type: "text",
            text: endMessage,
          });
        }

        // Add system message for logging
        responses.push({
          type: "system",
          payload: {
            level: "info",
            message: "Flow ended",
            nodeId: node.id,
            action: "end",
          },
        });

        return { responses, nextNodeId: null, awaitingUserInput: false, ended: true };
      }
      default:
        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "warn",
                message: `Unhandled action kind ${String(actionKind ?? "unknown")}`,
                nodeId: node.id,
              },
            },
          ],
          nextNodeId: this.nextChild(node),
          awaitingUserInput: false,
        };
    }
  }

  private async executeMessageNode(node: FlowNode, session: ConversationSession): Promise<ExecutionResult> {
    const text = typeof node.action?.data?.text === "string" ? node.action?.data?.text : node.description ?? node.label;

    // Replace variables in message text
    const processedText = await this.replaceMessageVariables(text, session);

    console.log(`[Executor] ⚡ MESSAGE NODE EXECUTED: "${processedText.substring(0, 50)}..."`, {
      nodeId: node.id,
      fullText: processedText
    });

    return {
      responses: [{ type: "text", text: processedText }],
      nextNodeId: this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private async executeButtonsNode(node: FlowNode, message: IncomingMessage | null, session: ConversationSession): Promise<ExecutionResult> {
    const data = getButtonsData(node);
    const prompt =
      typeof node.action?.data?.text === "string"
        ? node.action.data.text
        : node.description ?? "Selecciona una opción:";

    // Replace variables in prompt text
    const processedPrompt = await this.replaceMessageVariables(prompt, session);

    if (!data) {
      return {
        responses: [{ type: "text", text: processedPrompt }],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }
    if (!message) {
      // CRITICAL FIX: Stay on the SAME buttons node, don't advance to first child
      // The buttons node needs to wait for user selection before routing to target
      return {
        responses: [{ type: "buttons", text: processedPrompt, buttons: data.items, moreTargetId: data.moreTargetId }],
        nextNodeId: node.id,  // Stay on current buttons node, NOT this.nextChild(node)
        awaitingUserInput: true,
      };
    }

    const selected = this.findMatchingOption(message, data.items);
    if (!selected) {
      // Use custom message if configured, otherwise use default
      const invalidMessage = data.customMessage || "No pude reconocer tu respuesta. Por favor selecciona un botón de la lista.";
      const processedInvalidMessage = await this.replaceMessageVariables(invalidMessage, session);

      return {
        responses: [
          {
            type: "text",
            text: processedInvalidMessage,
          },
          { type: "buttons", text: processedPrompt, buttons: data.items, moreTargetId: data.moreTargetId },
        ],
        nextNodeId: node.id,
        awaitingUserInput: true,
      };
    }

    // Track button click
    botLogger.log({
      level: "info",
      type: "button_clicked",
      nodeId: node.id,
      message: `Botón clickeado: ${selected.label}`,
      metadata: {
        optionId: selected.id,
        label: selected.label,
        value: selected.value,
      },
    });

    return {
      responses: [],
      nextNodeId: selected.targetId ?? this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private async executeAttachmentNode(node: FlowNode, session: ConversationSession): Promise<ExecutionResult> {
    const data = node.action?.data ?? {};
    const url = typeof data.url === "string" ? data.url : "";
    const mediaType = typeof data.mediaType === "string" ? data.mediaType : data.type ?? "file";
    let caption = typeof data.caption === "string" ? data.caption : undefined;
    const filename = typeof data.fileName === "string" ? data.fileName : undefined;

    // Replace variables in caption if present
    if (caption) {
      caption = await this.replaceMessageVariables(caption, session);
    }

    if (!url) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Attachment node missing URL", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }
    return {
      responses: [{ type: "media", url, mediaType, caption, filename }],
      nextNodeId: this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private executeAskNode(node: FlowNode, message: IncomingMessage | null): ExecutionResult {
    const data = getAskData(node);
    if (!data) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Ask node missing configuration", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    if (!message) {
      return {
        responses: [{ type: "text", text: data.questionText }],
        nextNodeId: this.nextChild(node) ?? data.answerTargetId,
        awaitingUserInput: true,
      };
    }

    const validationResult = this.validateAskResponse(data, message);
    if (!validationResult.valid) {
      const retryText = data.retryMessage ?? "Respuesta inválida";
      return {
        responses: [{ type: "text", text: retryText }],
        nextNodeId: data.invalidTargetId ?? node.id,
        awaitingUserInput: data.invalidTargetId == null,
      };
    }

    const nextNodeId = data.answerTargetId ?? this.nextChild(node);
    return {
      responses: [],
      nextNodeId,
      awaitingUserInput: false,
      variables: { [data.varName]: validationResult.value ?? "" },
    };
  }

  private async executeMenu(node: FlowNode, message: IncomingMessage | null, session: ConversationSession, isPlainText: boolean = false): Promise<ExecutionResult> {
    const options = getMenuOptions(node);
    // Use node.menuType to determine if menu should be plain text or interactive
    const usePlainText = node.menuType === "text" || isPlainText;

    if (!message) {
      const text = node.description ?? node.label ?? "Selecciona una opción";

      // Replace variables in menu text
      const processedText = await this.replaceMessageVariables(text, session);

      // CRITICAL FIX: Stay on the SAME menu node, don't advance to first child
      // The menu node needs to wait for user selection before routing to target
      console.log(`[Executor] ⚡ MENU NODE SENDING (NO INPUT): nodeId=${node.id}, awaitingUserInput=TRUE, nextNodeId=${node.id}, isPlainText=${usePlainText}, menuType=${node.menuType}`);
      return {
        responses: [{ type: "menu", text: processedText, options, isPlainText: usePlainText }],
        nextNodeId: node.id,  // Stay on current menu node, NOT this.nextChild(node)
        awaitingUserInput: true,
      };
    }

    const selected = this.findMatchingOption(message, options);
    if (!selected) {
      // Use custom message if configured, otherwise use default
      const invalidMessage = node.customMessage || "No pude reconocer tu respuesta. Por favor elige una de las opciones listadas.";
      const processedInvalidMessage = await this.replaceMessageVariables(invalidMessage, session);

      return {
        responses: [
          {
            type: "text",
            text: processedInvalidMessage,
          },
        ],
        nextNodeId: node.id,
        awaitingUserInput: true,
      };
    }

    // Track menu option selection
    botLogger.log({
      level: "info",
      type: "menu_option_selected",
      nodeId: node.id,
      message: `Opción seleccionada: ${selected.label}`,
      metadata: {
        optionId: selected.id,
        label: selected.label,
        value: selected.value ?? selected.label,
      },
    });

    // Save to PostgreSQL for persistent analytics
    saveMenuOptionSelection({
      sessionId: session.id,
      nodeId: node.id,
      optionId: selected.id,
      optionLabel: selected.label,
      metadata: {
        value: selected.value ?? selected.label,
        targetId: selected.targetId,
      },
    }).catch(err => {
      console.error('[Executor] Failed to save menu option to DB:', err);
    });

    return {
      responses: [],
      nextNodeId: selected.targetId ?? null,
      awaitingUserInput: false,
    };
  }

  private async executeTextMenu(node: FlowNode, message: IncomingMessage | null, session: ConversationSession): Promise<ExecutionResult> {
    const options = getMenuOptions(node);

    if (!message) {
      // Build plain text message with numbered options
      let text = node.description ?? node.label ?? "Selecciona una opción";
      text = await this.replaceMessageVariables(text, session);

      // Add numbered options
      text += "\n\n";
      options.forEach((opt, idx) => {
        text += `${idx + 1}. ${opt.label}\n`;
      });

      console.log(`[Executor] ⚡ TEXT-MENU NODE SENDING: nodeId=${node.id}, text="${text}"`);
      return {
        responses: [{ type: "text", text }],
        nextNodeId: node.id,
        awaitingUserInput: true,
      };
    }

    // User responded - find matching option by number or text
    const selected = this.findMatchingOption(message, options);
    if (!selected) {
      const invalidMessage = node.customMessage || "No pude reconocer tu respuesta. Por favor digita el número de la opción.";
      const processedInvalidMessage = await this.replaceMessageVariables(invalidMessage, session);

      return {
        responses: [{ type: "text", text: processedInvalidMessage }],
        nextNodeId: node.id,
        awaitingUserInput: true,
      };
    }

    // Track selection
    botLogger.log({
      level: "info",
      type: "text_menu_option_selected",
      nodeId: node.id,
      message: `Opción seleccionada: ${selected.label}`,
      metadata: {
        optionId: selected.id,
        label: selected.label,
        value: selected.value ?? selected.label,
      },
    });

    // Save to PostgreSQL for persistent analytics
    saveMenuOptionSelection({
      sessionId: session.id,
      nodeId: node.id,
      optionId: selected.id,
      optionLabel: selected.label,
      metadata: {
        value: selected.value ?? selected.label,
        targetId: selected.targetId,
        menuType: 'text',
      },
    }).catch(err => {
      console.error('[Executor] Failed to save text menu option to DB:', err);
    });

    return {
      responses: [],
      nextNodeId: selected.targetId ?? null,
      awaitingUserInput: false,
    };
  }

  private executeSchedulerNode(flow: Flow, node: FlowNode, now: Date): ExecutionResult {
    const data = getSchedulerData(node);
    if (!data) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Scheduler node missing configuration", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    if (data.mode === "bitrix") {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "info", message: "Bitrix schedule delegation", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    if (!data.custom) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Scheduler node missing custom schedule", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    const isOpen = isInWindow(now, data.custom);
    const targetId = isOpen ? data.inWindowTargetId : data.outOfWindowTargetId;

    // No generate automatic messages - let the target node handle messaging
    return {
      responses: [],
      nextNodeId: targetId ?? this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private async executeWebhookNode(flow: Flow, node: FlowNode, session: ConversationSession): Promise<ExecutionResult> {
    const config = this.extractWebhookConfig(node);
    if (!config) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Webhook node missing configuration", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    if (!this.webhookDispatcher) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "warn",
              message: "Webhook dispatcher not configured. Request was skipped.",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: config.onSuccessTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    try {
      const result = await this.webhookDispatcher.callWebhook(config, { flow, node, session });
      const nextNodeId = result.ok
        ? config.onSuccessTargetId ?? this.nextChild(node)
        : config.onErrorTargetId ?? config.onSuccessTargetId ?? this.nextChild(node);
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: result.ok ? "info" : "error",
              message: result.ok ? "Webhook ejecutado correctamente" : "El webhook devolvió un error",
              status: result.status,
              nodeId: node.id,
              response: result.response,
            },
          },
        ],
        nextNodeId,
        awaitingUserInput: false,
      };
    } catch (error) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: error instanceof Error ? error.message : "Error ejecutando webhook",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: config.onErrorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }
  }

  private extractWebhookConfig(
    node: FlowNode,
  ): (WebhookCallConfig & { onSuccessTargetId?: string | null; onErrorTargetId?: string | null }) | null {
    const data = node.action?.data;
    if (!data || typeof data !== "object") return null;
    const url = typeof data.url === "string" ? data.url : undefined;
    if (!url) return null;
    return {
      url,
      method: typeof data.method === "string" ? data.method : "POST",
      headers: typeof data.headers === "object" && data.headers ? (data.headers as Record<string, string>) : undefined,
      body: data.body,
      timeoutMs: typeof data.timeoutMs === "number" ? data.timeoutMs : undefined,
      onSuccessTargetId:
        typeof data.onSuccessTargetId === "string" ? data.onSuccessTargetId : (node.children[0] ?? null),
      onErrorTargetId: typeof data.onErrorTargetId === "string" ? data.onErrorTargetId : null,
    };
  }

  private nextChild(node: FlowNode): string | null {
    return node.children.length > 0 ? node.children[0] ?? null : null;
  }

  private findMatchingOption(message: IncomingMessage, options: MenuOption[] | ButtonOption[]): MenuOption | ButtonOption | null {
    const normalizedText = message.text?.trim().toLowerCase();
    const payload = message.payload?.trim();
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const label = option.label?.toLowerCase();
      if (payload) {
        if (option.value && payload === option.value) {
          return option;
        }
        if (option.id && payload === option.id) {
          return option;
        }
      }
      if (normalizedText && option.value && normalizedText === option.value.toLowerCase()) {
        return option;
      }
      if (normalizedText && option.id && normalizedText === option.id.toLowerCase()) {
        return option;
      }
      if (normalizedText && label && normalizedText === label) {
        return option;
      }
      if (normalizedText && normalizedText === String(index + 1)) {
        return option;
      }
    }
    return null;
  }

  private validateAskResponse(data: AskActionData, message: IncomingMessage): { valid: boolean; value?: string } {
    const text = message.text ?? message.payload ?? "";
    if (!text) {
      return { valid: false };
    }

    switch (data.varType) {
      case "number": {
        const parsed = Number(text.replace(/,/g, "."));
        if (Number.isNaN(parsed)) {
          return { valid: false };
        }
        return { valid: true, value: String(parsed) };
      }
      case "option": {
        const options =
          data.validation.type === "options" && Array.isArray(data.validation.options)
            ? data.validation.options
            : [];
        const normalized = text.trim().toLowerCase();
        const matched = options.find((option) => option.trim().toLowerCase() === normalized);
        return matched ? { valid: true, value: matched } : { valid: false };
      }
      default:
        break;
    }

    if (data.validation.type === "regex" && data.validation.pattern) {
      try {
        const regex = new RegExp(data.validation.pattern);
        if (!regex.test(text)) {
          return { valid: false };
        }
      } catch (error) {
        return { valid: false };
      }
    }

    if (data.validation.type === "options" && data.validation.options) {
      const normalized = text.trim().toLowerCase();
      const matched = data.validation.options.find((option) => option.trim().toLowerCase() === normalized);
      if (!matched) {
        return { valid: false };
      }
    }

    return { valid: true, value: text };
  }

  private async executeConditionNode(
    node: FlowNode,
    message: IncomingMessage | null,
    session: ConversationSession
  ): Promise<ExecutionResult> {
    const data = getConditionData(node);

    if (!data || !data.rules || data.rules.length === 0) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Condition node missing configuration", nodeId: node.id },
          },
        ],
        nextNodeId: data?.defaultTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    // Evaluate all rules
    const ruleResults = await Promise.all(
      data.rules.map((rule) => this.evaluateConditionRule(rule, message, session))
    );

    // Determine if conditions are met based on matchMode
    let conditionMet: number | null = null;

    if (data.matchMode === "all") {
      // All rules must be true
      conditionMet = ruleResults.every((result) => result.matched) ? 0 : null;
    } else {
      // Any rule can be true (default)
      conditionMet = ruleResults.findIndex((result) => result.matched);
      if (conditionMet === -1) {
        conditionMet = null;
      }
    }

    if (conditionMet !== null && data.rules[conditionMet]?.targetId) {
      return {
        responses: [],
        nextNodeId: data.rules[conditionMet].targetId ?? null,
        awaitingUserInput: false,
      };
    }

    // No condition met, go to default target
    return {
      responses: [],
      nextNodeId: data.defaultTargetId ?? this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private async evaluateConditionRule(
    rule: ConditionRule,
    message: IncomingMessage | null,
    session: ConversationSession
  ): Promise<{ matched: boolean; value?: string }> {
    let sourceValue: string | null = null;

    // Get source value based on source type
    switch (rule.source) {
      case "user_message":
        sourceValue = message?.text ?? message?.payload ?? "";
        break;

      case "variable":
        if (rule.sourceValue) {
          sourceValue = session.variables[rule.sourceValue] ?? "";
        }
        break;

      case "bitrix_field":
        if (this.bitrix24Client && rule.sourceValue) {
          try {
            // Extract entity type and field from sourceValue
            // Format: "entityType.field" (e.g., "lead.STATUS_ID")
            const [entityType, fieldName] = rule.sourceValue.split(".");

            if (entityType && fieldName) {
              // Get identifier from session (usually phone number)
              const identifier = session.contactId;

              const value = await this.bitrix24Client.getFieldValue(
                entityType as "lead" | "deal" | "contact" | "company",
                { field: "PHONE", value: identifier },
                fieldName
              );

              sourceValue = value ?? "";
            }
          } catch (error) {
            console.error("[Condition] Error getting Bitrix field:", error);
            sourceValue = "";
          }
        }
        break;

      case "keyword":
        sourceValue = message?.text ?? "";
        break;

      default:
        sourceValue = "";
    }

    // Handle keyword matching
    if (rule.source === "keyword" && rule.keywords && rule.keywords.length > 0) {
      const text = (sourceValue ?? "").trim();
      const normalizedText = rule.caseSensitive ? text : text.toLowerCase();
      const mode = rule.keywordMode || "contains";  // Default to 'contains' for backward compatibility

      for (const keyword of rule.keywords) {
        const normalizedKeyword = rule.caseSensitive ? keyword : keyword.toLowerCase();

        // Check based on mode
        if (mode === "exact") {
          // Exact match: full text must equal the keyword
          if (normalizedText === normalizedKeyword) {
            return { matched: true, value: sourceValue ?? "" };
          }
        } else {
          // Contains mode: keyword can appear anywhere in text
          if (normalizedText.includes(normalizedKeyword)) {
            return { matched: true, value: sourceValue ?? "" };
          }
        }
      }

      return { matched: false };
    }

    // Evaluate operator
    return this.evaluateOperator(rule.operator, sourceValue ?? "", rule.compareValue ?? "");
  }

  private evaluateOperator(
    operator: string,
    sourceValue: string,
    compareValue: string
  ): { matched: boolean; value?: string } {
    const source = sourceValue.trim();
    const compare = compareValue.trim();

    switch (operator) {
      case "equals":
        return { matched: source === compare, value: source };

      case "not_equals":
        return { matched: source !== compare, value: source };

      case "contains":
        return { matched: source.toLowerCase().includes(compare.toLowerCase()), value: source };

      case "not_contains":
        return { matched: !source.toLowerCase().includes(compare.toLowerCase()), value: source };

      case "starts_with":
        return { matched: source.toLowerCase().startsWith(compare.toLowerCase()), value: source };

      case "ends_with":
        return { matched: source.toLowerCase().endsWith(compare.toLowerCase()), value: source };

      case "matches_regex":
        try {
          const regex = new RegExp(compare);
          return { matched: regex.test(source), value: source };
        } catch (error) {
          console.error("[Condition] Invalid regex:", compare);
          return { matched: false };
        }

      case "greater_than": {
        const sourceNum = parseFloat(source);
        const compareNum = parseFloat(compare);
        return {
          matched: !isNaN(sourceNum) && !isNaN(compareNum) && sourceNum > compareNum,
          value: source,
        };
      }

      case "less_than": {
        const sourceNum = parseFloat(source);
        const compareNum = parseFloat(compare);
        return {
          matched: !isNaN(sourceNum) && !isNaN(compareNum) && sourceNum < compareNum,
          value: source,
        };
      }

      case "is_empty":
        return { matched: source.length === 0, value: source };

      case "is_not_empty":
        return { matched: source.length > 0, value: source };

      default:
        console.warn(`[Condition] Unknown operator: ${operator}`);
        return { matched: false };
    }
  }

  private executeTransferNode(node: FlowNode): ExecutionResult {
    // Transfer node: queue, advisor, or bot
    const target = node.action?.data?.target || "queue"; // "queue", "advisor", or "bot"
    const destination = node.action?.data?.destination || "";
    const transferMessage = node.action?.data?.message;

    // For backward compatibility, check old queueId field
    const legacyQueueId = node.action?.data?.queueId;
    const finalQueueId = target === "queue" ? destination : (legacyQueueId || null);

    const responses: OutboundMessage[] = [];

    // Send optional transfer message if configured
    if (transferMessage && typeof transferMessage === 'string' && transferMessage.trim()) {
      responses.push({
        type: "text",
        text: transferMessage,
      });
    }

    // Add system message for transfer handling
    responses.push({
      type: "system",
      payload: {
        level: "info",
        message: `Transfer to ${target}: ${destination}`,
        nodeId: node.id,
        action: "transfer",
        transferTarget: target, // "queue", "advisor", or "bot"
        transferDestination: destination, // ID of queue/advisor/flow
        queueId: finalQueueId, // CRITICAL: Pass queueId to prevent limbo (for backward compatibility)
      },
    });

    // CRITICAL FIX: Don't end the flow when transferring to queue
    // The conversation should stay open and wait for an advisor
    return {
      responses,
      nextNodeId: null,
      awaitingUserInput: false,
      ended: false,  // ← CHANGED: Don't close chat when transferring
      shouldTransfer: true,  // ← CRITICAL: Signal that transfer is happening
      transferQueue: finalQueueId,  // ← CRITICAL: Pass queue ID for transfer
    };
  }

  private executeHandoffNode(node: FlowNode): ExecutionResult {
    // Handoff node transfers conversation to human agent
    const queue = node.action?.data?.queue || "default";
    const note = node.action?.data?.note || "User requested human assistance";

    return {
      responses: [
        {
          type: "text",
          text: "Un momento, te voy a conectar con un agente...",
        },
        {
          type: "system",
          payload: {
            level: "info",
            message: `Handoff to queue: ${queue}`,
            nodeId: node.id,
            action: "handoff_to_agent",
            metadata: { queue, note },
          },
        },
      ],
      nextNodeId: null,
      awaitingUserInput: false,
      ended: true,
    };
  }

  private async executeIaRagNode(node: FlowNode, message: IncomingMessage | null, session: ConversationSession): Promise<ExecutionResult> {
    // IA/RAG node - Real implementation with multi-provider support
    const systemPrompt = node.action?.data?.prompt || node.action?.data?.systemPrompt || "Responde la pregunta del usuario de manera útil y precisa.";
    const model = node.action?.data?.model || "gpt-4";
    const provider = node.action?.data?.provider || this.detectProviderFromModel(model);
    const temperature = node.action?.data?.temperature ?? 0.7;
    const knowledgeBase = node.action?.data?.knowledgeBase || "default";
    const userMessage = message?.text || "Hola";

    botLogger.log({
      level: "info",
      type: "ia_rag_invoked",
      nodeId: node.id,
      message: `IA/RAG node invoked with ${provider}/${model}`,
      metadata: { provider, model, knowledgeBase, userMessage },
    });

    // Import RAG service dynamically (server-side only)
    try {
      // This will only work on the server side
      const { getRagService } = await import('../../server/ai/rag-service');
      const ragService = await getRagService();

      if (!ragService.isProviderAvailable(provider)) {
        const available = ragService.getAvailableProviders();
        botLogger.log({
          level: "error",
          type: "ia_rag_provider_unavailable",
          nodeId: node.id,
          message: `Provider ${provider} not configured`,
          metadata: { available },
        });

        return {
          responses: [
            {
              type: "text",
              text: `Lo siento, el proveedor de IA '${provider}' no está configurado. Proveedores disponibles: ${available.join(', ')}`,
            },
          ],
          nextNodeId: this.nextChild(node),
          awaitingUserInput: false,
        };
      }

      // Build conversation history
      const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
        (session.variables?.conversationHistory as unknown as Array<{ role: 'user' | 'assistant'; content: string }>) || [];
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: userMessage },
      ];

      // Call AI service
      const response = await ragService.complete({
        provider,
        model,
        messages,
        temperature,
        maxTokens: 1024,
      });

      botLogger.log({
        level: "info",
        type: "ia_rag_success",
        nodeId: node.id,
        message: `IA response generated`,
        metadata: {
          provider,
          model,
          usage: response.usage,
        },
      });

      // Update conversation history
      const updatedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...conversationHistory,
        { role: 'user' as 'user', content: userMessage },
        { role: 'assistant' as 'assistant', content: response.content },
      ].slice(-10); // Keep last 10 messages

      return {
        responses: [
          {
            type: "text",
            text: response.content,
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
        variables: {
          ...session.variables,
          conversationHistory: updatedHistory as any,
          lastAiResponse: response.content,
        },
      };
    } catch (error) {
      botLogger.log({
        level: "error",
        type: "ia_rag_error",
        nodeId: node.id,
        message: `IA/RAG error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { provider, model, error },
      });

      return {
        responses: [
          {
            type: "text",
            text: `Lo siento, hubo un error al procesar tu solicitud con IA. Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }
  }

  private detectProviderFromModel(model: string): 'openai' | 'anthropic' | 'gemini' | 'ollama' {
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('gemini-')) return 'gemini';
    return 'ollama'; // Default to ollama for custom models
  }

  private async executeIaAgentNode(node: FlowNode, message: IncomingMessage | null, session: ConversationSession): Promise<ExecutionResult> {
    // IA Agent node - Executes AI agent with function calling and tools
    botLogger.log({
      level: "info",
      type: "ia_agent_invoked",
      nodeId: node.id,
      message: `IA Agent node invoked`,
      metadata: { phone: session.contactId },
    });

    try {
      // Import agent executor dynamically (server-side only)
      const { executeAgent } = await import('../../server/ai/agent-executor');
      const { getRagService } = await import('../../server/ai/rag-service');
      const ragService = await getRagService();

      // Check if OpenAI is available
      if (!ragService.isProviderAvailable('openai')) {
        botLogger.log({
          level: "error",
          type: "ia_agent_provider_unavailable",
          nodeId: node.id,
          message: `OpenAI not configured for IA Agent`,
        });

        return {
          responses: [
            {
              type: "text",
              text: `Lo siento, el agente IA no está configurado. Por favor contacta a un asesor.`,
            },
          ],
          nextNodeId: this.nextChild(node),
          awaitingUserInput: false,
        };
      }

      // Get OpenAI client
      const openaiClient = ragService.getClient('openai');

      // Execute agent with metadata (includes WhatsApp referral data)
      const messageMetadata = session.variables?.['__messageMetadata'] as any;
      const whatsappMetadata = messageMetadata?.whatsapp;
      const agentResult = await executeAgent(openaiClient, session, message, whatsappMetadata);

      botLogger.log({
        level: "info",
        type: "ia_agent_success",
        nodeId: node.id,
        message: `IA Agent executed successfully`,
        metadata: {
          responseCount: agentResult.responses.length,
          shouldTransfer: agentResult.shouldTransfer,
          transferQueue: agentResult.transferQueue,
        },
      });

      // Determine next node based on agent result
      let nextNodeId = this.nextChild(node);
      let awaitingUserInput = false;
      let ended = false;

      if (agentResult.shouldTransfer) {
        // Agent wants to transfer - end flow and let transfer happen
        nextNodeId = null;
        ended = true;
      } else if (agentResult.shouldEnd) {
        // Agent wants to end conversation
        nextNodeId = null;
        ended = true;
      } else {
        // Agent continues conversation - stay on this node to await next message
        nextNodeId = node.id;
        awaitingUserInput = true;
      }

      return {
        responses: agentResult.responses,
        nextNodeId,
        awaitingUserInput,
        variables: agentResult.variables,
        ended,
        shouldTransfer: agentResult.shouldTransfer,
        transferQueue: agentResult.transferQueue,
      };
    } catch (error) {
      botLogger.log({
        level: "error",
        type: "ia_agent_error",
        nodeId: node.id,
        message: `IA Agent error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error },
      });

      return {
        responses: [
          {
            type: "text",
            text: `Lo siento, hubo un error al procesar tu solicitud. Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }
  }

  private executeToolNode(node: FlowNode, session: ConversationSession): ExecutionResult {
    // Tool/External Action node - placeholder implementation
    // In production, this would call external APIs or custom functions
    const toolName = node.action?.data?.toolName || node.action?.data?.name || "unknown";
    const endpoint = node.action?.data?.endpoint;
    const method = node.action?.data?.method || "POST";

    botLogger.log({
      level: "info",
      type: "tool_invoked",
      nodeId: node.id,
      message: `Tool node invoked: ${toolName}`,
      metadata: { toolName, endpoint, method },
    });

    return {
      responses: [
        {
          type: "text",
          text: `Ejecutando acción: ${toolName}...`,
        },
        {
          type: "system",
          payload: {
            level: "warn",
            message: "Tool node requires backend implementation",
            nodeId: node.id,
            action: "tool_placeholder",
            metadata: { toolName, endpoint },
          },
        },
      ],
      nextNodeId: this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private async executeDelayNode(flow: Flow, node: FlowNode, session: ConversationSession, message: IncomingMessage | null): Promise<ExecutionResult> {
    // Check if this is a timer completion callback
    if (message?.text === "__TIMER_COMPLETE__" && session.variables.__delay_next_node__) {
      const resumeNodeId = session.variables.__delay_next_node__;
      console.log(`[Executor] Timer complete, resuming flow at node ${resumeNodeId}`);

      // Clear delay variables and continue to next node
      return {
        responses: [],
        nextNodeId: resumeNodeId,
        awaitingUserInput: false,
        variables: {
          __delay_next_node__: "",
          __delay_timer_id__: "",
        },
      };
    }

    const data = node.action?.data;
    const delaySeconds = typeof data?.delaySeconds === "number" ? data.delaySeconds : null;

    if (!delaySeconds || delaySeconds < 1) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Delay node missing valid delay configuration", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    // Max delay: 4 days = 345600 seconds
    if (delaySeconds > 345600) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: "Delay exceeds maximum of 4 days", nodeId: node.id },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    if (!this.timerScheduler) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "warn",
              message: "Timer scheduler not configured. Delay was skipped.",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    // Schedule the timer
    const nextNodeId = this.nextChild(node);
    if (!nextNodeId) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: "Delay node has no next node to resume to",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: null,
        awaitingUserInput: false,
        ended: true,
      };
    }

    try {
      const timerId = await this.timerScheduler.scheduleTimer(
        session.id,
        flow.id,
        session.contactId,
        session.channel,
        nextNodeId,
        node.id,
        delaySeconds
      );

      // Store nextNodeId in session variables so timer can resume from there
      // Keep session alive by staying on current node and awaiting (timer will resume it)
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "info",
              message: `Timer scheduled for ${delaySeconds} seconds`,
              nodeId: node.id,
              timerId,
              delaySeconds,
            },
          },
        ],
        nextNodeId: node.id, // Stay on current node
        awaitingUserInput: true, // Keep session alive
        variables: {
          __delay_next_node__: nextNodeId,
          __delay_timer_id__: timerId,
        },
      };
    } catch (error) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: error instanceof Error ? error.message : "Failed to schedule timer",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }
  }

  private async executeBitrixCrmNode(
    node: FlowNode,
    session: ConversationSession
  ): Promise<ExecutionResult> {
    const data = node.action?.data;

    // Determine operation (default to "create" for backward compatibility with bitrix_create nodes)
    const operation = data?.operation || "create";

    if (!data || !data.entityType) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: "Bitrix CRM node missing configuration",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: data?.errorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    if (!this.bitrix24Client) {
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: "Bitrix24 client not configured",
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: data.errorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    try {
      const entityType = data.entityType as "lead" | "deal" | "contact" | "company";

      // Handle CREATE operation
      if (operation === "create") {
        if (!data.fields || data.fields.length === 0) {
          return {
            responses: [
              {
                type: "system",
                payload: {
                  level: "error",
                  message: "No fields configured for Bitrix entity creation",
                  nodeId: node.id,
                },
              },
            ],
            nextNodeId: data.errorTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        // Build fields object from configuration
        const fieldsToCreate: Record<string, any> = {};
        for (const field of data.fields) {
          let value: string | undefined;

          if (field.valueType === "static") {
            value = field.staticValue || "";
          } else if (field.valueType === "variable") {
            value = session.variables[field.variableName || ""] || "";
          }

          if (value !== undefined && value !== "") {
            fieldsToCreate[field.fieldName] = value;
          }
        }

        if (Object.keys(fieldsToCreate).length === 0) {
          return {
            responses: [
              {
                type: "system",
                payload: {
                  level: "error",
                  message: "No fields provided for entity creation",
                  nodeId: node.id,
                },
              },
            ],
            nextNodeId: data.errorTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        const entityId = await this.bitrix24Client.createEntity(entityType, fieldsToCreate);

        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "info",
                message: `${entityType} created successfully in Bitrix24`,
                nodeId: node.id,
                entityType,
                entityId,
              },
            },
          ],
          nextNodeId: data.successTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
          variables: {
            [`bitrix_created_${entityType}_id`]: String(entityId),
          },
        };
      }

      // Handle UPDATE and DELETE operations
      // First, identify the entity to update/delete
      let entityId: string | null = null;

      if (data.identifierType === "id" && data.identifierId) {
        // Use specific ID
        entityId = data.identifierId;
      } else if (data.identifierType === "phone") {
        // Find entity by phone
        const entity = await this.bitrix24Client.findEntity(entityType, {
          filter: { PHONE: session.contactId },
          select: ["ID"],
        });
        entityId = entity?.ID ?? null;
      } else if (data.identifierType === "email") {
        // Find entity by email
        const email = session.variables.email || "";
        const entity = await this.bitrix24Client.findEntity(entityType, {
          filter: { EMAIL: email },
          select: ["ID"],
        });
        entityId = entity?.ID ?? null;
      } else if (data.identifierType === "current") {
        // Use current entity from session (if previously created/loaded)
        entityId = session.variables[`bitrix_created_${entityType}_id`] || null;
      }

      if (!entityId) {
        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "error",
                message: `Could not find ${entityType} to ${operation}`,
                nodeId: node.id,
              },
            },
          ],
          nextNodeId: data.errorTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
        };
      }

      // Handle UPDATE operation
      if (operation === "update") {
        if (!data.fields || data.fields.length === 0) {
          return {
            responses: [
              {
                type: "system",
                payload: {
                  level: "error",
                  message: "No fields configured for Bitrix entity update",
                  nodeId: node.id,
                },
              },
            ],
            nextNodeId: data.errorTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        // Build fields object from configuration
        const fieldsToUpdate: Record<string, any> = {};
        for (const field of data.fields) {
          let value: string | undefined;

          if (field.valueType === "static") {
            value = field.staticValue || "";
          } else if (field.valueType === "variable") {
            value = session.variables[field.variableName || ""] || "";
          }

          if (value !== undefined && value !== "") {
            fieldsToUpdate[field.fieldName] = value;
          }
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
          return {
            responses: [
              {
                type: "system",
                payload: {
                  level: "error",
                  message: "No fields provided for entity update",
                  nodeId: node.id,
                },
              },
            ],
            nextNodeId: data.errorTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        const success = await this.bitrix24Client.updateEntity(entityType, entityId, fieldsToUpdate);

        if (!success) {
          throw new Error("Update operation returned false");
        }

        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "info",
                message: `${entityType} ${entityId} updated successfully in Bitrix24`,
                nodeId: node.id,
                entityType,
                entityId,
              },
            },
          ],
          nextNodeId: data.successTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
        };
      }

      // Handle DELETE operation
      if (operation === "delete") {
        const success = await this.bitrix24Client.deleteEntity(entityType, entityId);

        if (!success) {
          throw new Error("Delete operation returned false");
        }

        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "info",
                message: `${entityType} ${entityId} deleted successfully from Bitrix24`,
                nodeId: node.id,
                entityType,
                entityId,
              },
            },
          ],
          nextNodeId: data.successTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
        };
      }

      // Handle SEARCH operation
      if (operation === "search") {
        if (!data.searchFilters || data.searchFilters.length === 0) {
          return {
            responses: [
              {
                type: "system",
                payload: {
                  level: "error",
                  message: "No search filters configured for Bitrix search",
                  nodeId: node.id,
                },
              },
            ],
            nextNodeId: data.errorTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        // Build filter object from search filters configuration
        const filter: Record<string, any> = {};
        const matchMode = data.searchMatchMode || "all";

        // For "any" mode, we need to evaluate each filter separately and combine results
        // For "all" mode, we add all filters to the filter object
        if (matchMode === "all") {
          for (const searchFilter of data.searchFilters) {
            let value: string | undefined;

            if (searchFilter.valueType === "static") {
              value = searchFilter.staticValue || "";
            } else if (searchFilter.valueType === "variable") {
              value = session.variables[searchFilter.variableName || ""] || "";
            }

            if (value !== undefined && value !== "") {
              // Map operators to Bitrix filter syntax
              const fieldName = searchFilter.fieldName;
              switch (searchFilter.operator) {
                case "equals":
                  filter[fieldName] = value;
                  break;
                case "not_equals":
                  filter[`!${fieldName}`] = value;
                  break;
                case "contains":
                  filter[`%${fieldName}`] = value;
                  break;
                case "not_contains":
                  filter[`!%${fieldName}`] = value;
                  break;
                case "starts_with":
                  filter[`${fieldName}`] = `${value}%`;
                  break;
                case "ends_with":
                  filter[`${fieldName}`] = `%${value}`;
                  break;
                case "greater_than":
                  filter[`>${fieldName}`] = value;
                  break;
                case "less_than":
                  filter[`<${fieldName}`] = value;
                  break;
                case "greater_or_equal":
                  filter[`>=${fieldName}`] = value;
                  break;
                case "less_or_equal":
                  filter[`<=${fieldName}`] = value;
                  break;
                default:
                  filter[fieldName] = value;
              }
            }
          }
        }

        // Execute search
        const limit = data.searchLimit || 1;
        const results = await this.bitrix24Client.searchEntities(entityType, {
          filter,
          select: ["*"],
          limit,
        });

        const found = results && results.length > 0;
        const resultVariables: Record<string, string> = {};

        if (found) {
          // Save results to variables if configured
          if (data.saveResultsTo) {
            resultVariables[data.saveResultsTo] = JSON.stringify(results);
          }
          if (data.saveCountTo) {
            resultVariables[data.saveCountTo] = String(results.length);
          }

          // Save first result fields as individual variables
          if (results[0]) {
            for (const [key, value] of Object.entries(results[0])) {
              resultVariables[`bitrix_search_${key.toLowerCase()}`] = String(value || "");
            }
          }
        } else {
          // No results found
          if (data.saveCountTo) {
            resultVariables[data.saveCountTo] = "0";
          }
        }

        // Determine next node based on found/not found
        let nextNodeId: string | null;
        if (found) {
          nextNodeId = data.foundTargetId ?? data.successTargetId ?? this.nextChild(node);
        } else {
          nextNodeId = data.notFoundTargetId ?? data.errorTargetId ?? this.nextChild(node);
        }

        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "info",
                message: found
                  ? `Found ${results.length} ${entityType}(s) in Bitrix24`
                  : `No ${entityType}(s) found matching the search criteria`,
                nodeId: node.id,
                entityType,
                resultCount: results.length,
              },
            },
          ],
          nextNodeId,
          awaitingUserInput: false,
          variables: resultVariables,
        };
      }

      // Unknown operation
      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: `Unknown CRM operation: ${operation}`,
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: data.errorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    } catch (error) {
      console.error(`[BitrixCRM] Error during ${operation} operation:`, error, {
        nodeId: node.id,
        entityType: data.entityType,
        operation,
      });

      return {
        responses: [
          {
            type: "system",
            payload: {
              level: "error",
              message: error instanceof Error ? error.message : `Failed to ${operation} Bitrix entity`,
              nodeId: node.id,
            },
          },
        ],
        nextNodeId: data.errorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }
  }

  private executeWebhookInNode(
    node: FlowNode,
    session: ConversationSession
  ): ExecutionResult {
    const data = node.action?.data;
    const path = data?.path || "/hooks/inbound";

    // Check if webhook data was already received (stored in session by the webhook handler)
    const webhookDataKey = `webhook_in_${node.id}`;
    const webhookData = session.variables[webhookDataKey];

    if (webhookData) {
      // Webhook data received, parse and continue
      try {
        const parsedData = JSON.parse(webhookData);

        // Store webhook data in individual variables for easy access
        const variables: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsedData)) {
          variables[`webhook_${key}`] = String(value);
        }

        // Clear the webhook data from session
        delete session.variables[webhookDataKey];

        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "info",
                message: "Webhook data received and processed",
                nodeId: node.id,
                webhookPath: path,
              },
            },
          ],
          nextNodeId: this.nextChild(node),
          awaitingUserInput: false,
          variables,
        };
      } catch (error) {
        return {
          responses: [
            {
              type: "system",
              payload: {
                level: "error",
                message: "Failed to parse webhook data",
                nodeId: node.id,
              },
            },
          ],
          nextNodeId: this.nextChild(node),
          awaitingUserInput: false,
        };
      }
    }

    // Webhook IN node is ready to receive data
    // The actual webhook handler should be set up in the server routes
    return {
      responses: [
        {
          type: "system",
          payload: {
            level: "info",
            message: `Waiting for webhook at path: ${path}`,
            nodeId: node.id,
            webhookPath: path,
            action: "webhook_in_waiting",
          },
        },
      ],
      nextNodeId: node.id, // Stay on this node until webhook arrives
      awaitingUserInput: true, // Keep session alive
    };
  }

  /**
   * Replace variables in message text with values from Bitrix entities and session
   * Supports {{contact:FIELD}}, {{lead:FIELD}}, {{deal:FIELD}}, {{company:FIELD}}, {{variable_name}}
   */
  private async replaceMessageVariables(text: string, session: ConversationSession): Promise<string> {
    if (!text || !text.includes('{{')) {
      return text; // No variables to replace
    }

    // Build context for variable replacement
    const context: {
      contact?: Record<string, any>;
      lead?: Record<string, any>;
      deal?: Record<string, any>;
      company?: Record<string, any>;
      custom?: Record<string, string>;
    } = {
      custom: session.variables || {},
    };

    // Fetch Bitrix entities if needed and bitrix client is available
    if (this.bitrix24Client) {
      try {
        // Use phone number from session as identifier
        const phoneIdentifier = session.contactId;

        // Check if message contains {{contact:...}} variables
        if (text.includes('{{contact:')) {
          const contact = await this.bitrix24Client.findContact({
            filter: { PHONE: phoneIdentifier },
            select: ['*'], // Get all fields
          });
          if (contact) {
            context.contact = contact;
          }
        }

        // Check if message contains {{lead:...}} variables
        if (text.includes('{{lead:')) {
          const lead = await this.bitrix24Client.findLead({
            filter: { PHONE: phoneIdentifier },
            select: ['*'],
          });
          if (lead) {
            context.lead = lead;
          }
        }

        // Check if message contains {{deal:...}} variables
        if (text.includes('{{deal:')) {
          const deal = await this.bitrix24Client.findDeal({
            filter: { PHONE: phoneIdentifier },
            select: ['*'],
          });
          if (deal) {
            context.deal = deal;
          }
        }

        // Check if message contains {{company:...}} variables
        if (text.includes('{{company:')) {
          const company = await this.bitrix24Client.findCompany({
            filter: { PHONE: phoneIdentifier },
            select: ['*'],
          });
          if (company) {
            context.company = company;
          }
        }
      } catch (error) {
        console.error('[Executor] Error fetching Bitrix entities for variable replacement:', error);
        // Continue with available context
      }
    }

    // Replace variables using utility function
    return replaceVariables(text, context);
  }

  private async executeValidationNode(
    node: FlowNode,
    message: IncomingMessage | null,
    session: ConversationSession,
    flow: Flow
  ): Promise<ExecutionResult> {
    const data = node.action?.data as any;

    console.log('🔍 [Validation] Executing validation node:', {
      nodeId: node.id,
      nodeLabel: node.label,
      hasData: !!data,
      hasMessage: !!message,
      validationType: data?.validationType,
      userText: message?.text || '',
      keywordGroups: data?.keywordGroups?.length || 0,
    });

    if (!data || !data.validationType) {
      console.log('⚠️ [Validation] No data or validationType, going to invalidTargetId');
      return {
        responses: [],
        nextNodeId: data?.invalidTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    // If no message yet, wait for user input
    if (!message) {
      console.log('⏸️ [Validation] No message received, waiting for user input');
      return {
        responses: [],
        nextNodeId: node.id,  // Stay on current node
        awaitingUserInput: true,
      };
    }

    const userText = message?.text || '';

    // Handle keyword validation
    if (data.validationType === 'keywords' && data.keywordGroups && Array.isArray(data.keywordGroups)) {
      console.log('🔍 [Validation] Processing keyword validation with groups:',
        data.keywordGroups.map((g: any) => ({ id: g.id, label: g.label, keywords: g.keywords }))
      );
      const matchedGroupIds: string[] = [];

      const keywordMatches: Array<{groupId: string, groupLabel: string, keyword: string}> = [];

      for (const group of data.keywordGroups) {
        if (!group.keywords || group.keywords.length === 0) continue;

        const mode = group.mode || 'contains';
        const normalizedText = userText.toLowerCase();
        let groupMatched = false;
        let matchedKeywordText = '';

        for (const keyword of group.keywords) {
          const normalizedKeyword = keyword.toLowerCase();

          if (mode === 'exact') {
            if (normalizedText === normalizedKeyword) {
              groupMatched = true;
              matchedKeywordText = keyword;
              break;
            }
          } else {
            // contains mode
            if (normalizedText.includes(normalizedKeyword)) {
              groupMatched = true;
              matchedKeywordText = keyword;
              break;
            }
          }
        }

        if (groupMatched) {
          matchedGroupIds.push(group.id);
          keywordMatches.push({
            groupId: group.id,
            groupLabel: group.label || group.id,
            keyword: matchedKeywordText
          });
        }
      }

      // Check if any group matched
      if (matchedGroupIds.length > 0) {
        // Check if there's a specific target for the first matched group
        const firstMatchedId = matchedGroupIds[0];
        const groupTargetId = data.groupTargetIds?.[firstMatchedId];

        console.log('✅ [Validation] Matched groups:', matchedGroupIds, {
          firstMatchedId,
          groupTargetId,
          allGroupTargetIds: data.groupTargetIds,
        });

        // Emit keyword match event for tracking
        if (keywordMatches.length > 0 && keywordUsageHandler) {
          const firstMatch = keywordMatches[0];
          keywordUsageHandler({
            flowId: flow.id,
            flowName: flow.name,
            nodeId: node.id,
            keywordGroupId: firstMatch.groupId,
            keywordGroupLabel: firstMatch.groupLabel,
            matchedKeyword: firstMatch.keyword,
            phone: session.contactId,
            conversationId: session.id,
          });
        }

        if (groupTargetId) {
          console.log('➡️ [Validation] Going to group target:', groupTargetId);
          return {
            responses: [],
            nextNodeId: groupTargetId,
            awaitingUserInput: false,
          };
        }

        console.log('➡️ [Validation] No group target, using validTargetId or nextChild');
        // Use validTargetId as fallback
        return {
          responses: [],
          nextNodeId: data.validTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
        };
      } else {
        console.log('❌ [Validation] No match found, going to noMatchTargetId:', data.noMatchTargetId);
        // No match
        return {
          responses: [],
          nextNodeId: data.noMatchTargetId ?? data.invalidTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
        };
      }
    }

    // Handle format validation
    if (data.validationType === 'format') {
      let isValid = false;
      const formatType = data.formatType;

      switch (formatType) {
        case 'email':
          isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(userText);
          break;
        case 'phone_pe':
          isValid = /^9\d{8}$/.test(userText);
          break;
        case 'dni':
          isValid = /^\d{8}$/.test(userText);
          break;
        case 'ruc':
          isValid = /^\d{11}$/.test(userText);
          break;
        case 'number':
          isValid = !isNaN(Number(userText));
          break;
        case 'url':
          isValid = /^https?:\/\/.+/.test(userText);
          break;
        case 'date':
          isValid = /^\d{2}\/\d{2}\/\d{4}$/.test(userText);
          break;
        case 'custom_regex':
          if (data.customRegex) {
            try {
              const regex = new RegExp(data.customRegex);
              isValid = regex.test(userText);
            } catch (e) {
              isValid = false;
            }
          }
          break;
      }

      if (isValid && data.saveToVariable) {
        session.variables[data.saveToVariable] = userText;
      }

      return {
        responses: [],
        nextNodeId: isValid ? (data.validTargetId ?? this.nextChild(node)) : (data.invalidTargetId ?? this.nextChild(node)),
        awaitingUserInput: false,
      };
    }

    // Handle variable validation
    if (data.validationType === 'variable' && data.variableName) {
      const varValue = session.variables[data.variableName] || '';
      const isValid = this.evaluateOperator(data.operator || 'equals', varValue, data.compareValue || '').matched;

      return {
        responses: [],
        nextNodeId: isValid ? (data.validTargetId ?? this.nextChild(node)) : (data.invalidTargetId ?? this.nextChild(node)),
        awaitingUserInput: false,
      };
    }

    // Handle range validation
    if (data.validationType === 'range') {
      const num = Number(userText);
      let isValid = !isNaN(num);

      if (isValid && data.min !== undefined) {
        isValid = data.includeMin ? num >= data.min : num > data.min;
      }
      if (isValid && data.max !== undefined) {
        isValid = data.includeMax ? num <= data.max : num < data.max;
      }

      return {
        responses: [],
        nextNodeId: isValid ? (data.validTargetId ?? this.nextChild(node)) : (data.invalidTargetId ?? this.nextChild(node)),
        awaitingUserInput: false,
      };
    }

    // Handle options list validation
    if (data.validationType === 'options_list' && data.validOptions) {
      const checkText = data.caseSensitive ? userText : userText.toLowerCase();
      const options = data.caseSensitive ? data.validOptions : data.validOptions.map((opt: string) => opt.toLowerCase());
      const isValid = options.includes(checkText);

      return {
        responses: [],
        nextNodeId: isValid ? (data.validTargetId ?? this.nextChild(node)) : (data.invalidTargetId ?? this.nextChild(node)),
        awaitingUserInput: false,
      };
    }

    // Handle length validation
    if (data.validationType === 'length') {
      let isValid = true;
      if (data.minLength !== undefined) {
        isValid = userText.length >= data.minLength;
      }
      if (isValid && data.maxLength !== undefined) {
        isValid = userText.length <= data.maxLength;
      }

      return {
        responses: [],
        nextNodeId: isValid ? (data.validTargetId ?? this.nextChild(node)) : (data.invalidTargetId ?? this.nextChild(node)),
        awaitingUserInput: false,
      };
    }

    // Handle regex validation
    if (data.validationType === 'regex' && data.customRegex) {
      try {
        const regex = new RegExp(data.customRegex);
        const isValid = regex.test(userText);

        return {
          responses: [],
          nextNodeId: isValid ? (data.validTargetId ?? this.nextChild(node)) : (data.invalidTargetId ?? this.nextChild(node)),
          awaitingUserInput: false,
        };
      } catch (e) {
        return {
          responses: [],
          nextNodeId: data.invalidTargetId ?? this.nextChild(node),
          awaitingUserInput: false,
        };
      }
    }

    // Fallback: no validation configured
    return {
      responses: [],
      nextNodeId: this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private async executeValidationBitrixNode(
    node: FlowNode,
    message: IncomingMessage | null,
    session: ConversationSession
  ): Promise<ExecutionResult> {
    const data = node.action?.data as any;

    if (!data || !data.validationType || !this.bitrix24Client) {
      return {
        responses: [],
        nextNodeId: data?.errorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    try {
      const identifier = session.contactId;
      const entityType = data.entityType || 'lead';
      const identifierField = data.identifierField || 'PHONE';

      // Check if entity exists
      if (data.validationType === 'exists') {
        const filter: Record<string, string> = {};
        filter[identifierField] = identifier;

        let exists = false;
        if (entityType === 'lead') {
          const entity = await this.bitrix24Client.findLead({ filter, select: ['ID'] });
          exists = !!entity;
        } else if (entityType === 'contact') {
          const entity = await this.bitrix24Client.findContact({ filter, select: ['ID'] });
          exists = !!entity;
        } else if (entityType === 'deal') {
          const entity = await this.bitrix24Client.findDeal({ filter, select: ['ID'] });
          exists = !!entity;
        } else if (entityType === 'company') {
          const entity = await this.bitrix24Client.findCompany({ filter, select: ['ID'] });
          exists = !!entity;
        }

        return {
          responses: [],
          nextNodeId: exists ? (data.matchTargetId ?? this.nextChild(node)) : (data.noMatchTargetId ?? this.nextChild(node)),
          awaitingUserInput: false,
        };
      }

      // Check field values
      if (data.validationType === 'field' || data.validationType === 'multiple_fields') {
        if (!data.fieldChecks || data.fieldChecks.length === 0) {
          return {
            responses: [],
            nextNodeId: data.noMatchTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        const filter: Record<string, string> = {};
        filter[identifierField] = identifier;

        let entity: any = null;
        if (entityType === 'lead') {
          entity = await this.bitrix24Client.findLead({ filter, select: ['*'] });
        } else if (entityType === 'contact') {
          entity = await this.bitrix24Client.findContact({ filter, select: ['*'] });
        } else if (entityType === 'deal') {
          entity = await this.bitrix24Client.findDeal({ filter, select: ['*'] });
        } else if (entityType === 'company') {
          entity = await this.bitrix24Client.findCompany({ filter, select: ['*'] });
        }

        if (!entity) {
          return {
            responses: [],
            nextNodeId: data.noMatchTargetId ?? this.nextChild(node),
            awaitingUserInput: false,
          };
        }

        // Evaluate field checks
        const checkResults = data.fieldChecks.map((check: any) => {
          const fieldValue = String(entity[check.fieldName] || '');
          return this.evaluateOperator(check.operator, fieldValue, check.expectedValue || '').matched;
        });

        const matchMode = data.matchMode || 'all';
        const allMatch = matchMode === 'all' ? checkResults.every((r: boolean) => r) : checkResults.some((r: boolean) => r);

        return {
          responses: [],
          nextNodeId: allMatch ? (data.matchTargetId ?? this.nextChild(node)) : (data.noMatchTargetId ?? this.nextChild(node)),
          awaitingUserInput: false,
        };
      }

    } catch (error) {
      console.error('[ValidationBitrix] Error:', error);
      return {
        responses: [],
        nextNodeId: data.errorTargetId ?? this.nextChild(node),
        awaitingUserInput: false,
      };
    }

    // Fallback
    return {
      responses: [],
      nextNodeId: this.nextChild(node),
      awaitingUserInput: false,
    };
  }
}
