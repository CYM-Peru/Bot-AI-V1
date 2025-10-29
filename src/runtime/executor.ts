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
  | { type: "menu"; text: string; options: MenuOption[] }
  | { type: "media"; url: string; mediaType: string; caption?: string }
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

export interface ExecutorDependencies {
  webhookDispatcher?: WebhookDispatcher;
  bitrix24Client?: Bitrix24Client;
}

export class NodeExecutor {
  private readonly webhookDispatcher?: WebhookDispatcher;
  private readonly bitrix24Client?: Bitrix24Client;

  constructor(dependencies: ExecutorDependencies = {}) {
    this.webhookDispatcher = dependencies.webhookDispatcher;
    this.bitrix24Client = dependencies.bitrix24Client;
  }

  async execute(
    flow: Flow,
    node: FlowNode,
    session: ConversationSession,
    message: IncomingMessage | null,
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    if (node.type === "menu") {
      return this.executeMenu(node, message);
    }

    const actionKind = node.action?.kind;
    switch (actionKind) {
      case "message":
        return this.executeMessageNode(node);
      case "buttons":
        return this.executeButtonsNode(node, message);
      case "attachment":
        return this.executeAttachmentNode(node);
      case "ask":
        return this.executeAskNode(node, message);
      case "condition":
        return this.executeConditionNode(node, message, session);
      case "scheduler":
        return this.executeSchedulerNode(flow, node, options.now ?? new Date());
      case "webhook_out":
        return this.executeWebhookNode(flow, node, session);
      case "end":
        return { responses: [], nextNodeId: null, awaitingUserInput: false, ended: true };
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

  private executeMessageNode(node: FlowNode): ExecutionResult {
    const text = typeof node.action?.data?.text === "string" ? node.action?.data?.text : node.description ?? node.label;
    return {
      responses: [{ type: "text", text }],
      nextNodeId: this.nextChild(node),
      awaitingUserInput: false,
    };
  }

  private executeButtonsNode(node: FlowNode, message: IncomingMessage | null): ExecutionResult {
    const data = getButtonsData(node);
    const prompt =
      typeof node.action?.data?.text === "string"
        ? node.action.data.text
        : node.description ?? "Selecciona una opción:";
    if (!data) {
      return {
        responses: [{ type: "text", text: prompt }],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: false,
      };
    }
    if (!message) {
      return {
        responses: [{ type: "buttons", text: prompt, buttons: data.items, moreTargetId: data.moreTargetId }],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: true,
      };
    }

    const selected = this.findMatchingOption(message, data.items);
    if (!selected) {
      return {
        responses: [
          {
            type: "text",
            text: "No pude reconocer tu respuesta. Por favor selecciona un botón de la lista.",
          },
          { type: "buttons", text: prompt, buttons: data.items, moreTargetId: data.moreTargetId },
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

  private executeAttachmentNode(node: FlowNode): ExecutionResult {
    const data = node.action?.data ?? {};
    const url = typeof data.url === "string" ? data.url : "";
    const mediaType = typeof data.mediaType === "string" ? data.mediaType : data.type ?? "file";
    const caption = typeof data.caption === "string" ? data.caption : undefined;
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
      responses: [{ type: "media", url, mediaType, caption }],
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

  private executeMenu(node: FlowNode, message: IncomingMessage | null): ExecutionResult {
    const options = getMenuOptions(node);
    if (!message) {
      const text = node.description ?? node.label ?? "Selecciona una opción";
      return {
        responses: [{ type: "menu", text, options }],
        nextNodeId: this.nextChild(node),
        awaitingUserInput: true,
      };
    }

    const selected = this.findMatchingOption(message, options);
    if (!selected) {
      return {
        responses: [
          {
            type: "text",
            text: "No pude reconocer tu respuesta. Por favor elige una de las opciones listadas.",
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

    if (!isOpen) {
      const nextSlot = nextOpening(now, data.custom);
      const humanReadable = nextSlot
        ? `Abrimos nuevamente el ${nextSlot.isoDate} entre ${nextSlot.start} y ${nextSlot.end}.`
        : "Actualmente estamos fuera del horario de atención.";
      return {
        responses: [{ type: "text", text: humanReadable }],
        nextNodeId: targetId,
        awaitingUserInput: false,
      };
    }

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

      for (const keyword of rule.keywords) {
        const normalizedKeyword = rule.caseSensitive ? keyword : keyword.toLowerCase();

        if (normalizedText.includes(normalizedKeyword)) {
          return { matched: true, value: sourceValue ?? "" };
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
}
