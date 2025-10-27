/**
 * Flow Validation System
 *
 * Valida flujos antes de publicarlos para prevenir errores en producción.
 */

import type { Flow, FlowNode } from "./types";
import { CHANNEL_BUTTON_LIMITS } from "./channelLimits";

export type ValidationLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: ValidationLevel;
  nodeId?: string;
  code: string;
  message: string;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Validador de flujos
 */
export class FlowValidator {
  private issues: ValidationIssue[] = [];

  /**
   * Validar un flujo completo
   */
  validate(flow: Flow): ValidationResult {
    this.issues = [];

    // 1. Validar estructura básica
    this.validateBasicStructure(flow);

    // 2. Validar nodo raíz
    this.validateRootNode(flow);

    // 3. Validar nodos individuales
    for (const nodeId in flow.nodes) {
      const node = flow.nodes[nodeId];
      this.validateNode(flow, node);
    }

    // 4. Validar conectividad
    this.validateConnectivity(flow);

    // 5. Validar loops infinitos
    this.validateInfiniteLoops(flow);

    const errors = this.issues.filter((issue) => issue.level === "error");
    const warnings = this.issues.filter((issue) => issue.level === "warning");

    return {
      valid: errors.length === 0,
      issues: this.issues,
      errors,
      warnings,
    };
  }

  private addIssue(issue: ValidationIssue): void {
    this.issues.push(issue);
  }

  private validateBasicStructure(flow: Flow): void {
    if (!flow.id || !flow.id.trim()) {
      this.addIssue({
        level: "error",
        code: "MISSING_FLOW_ID",
        message: "El flujo no tiene un ID",
        fix: "Asigna un ID único al flujo",
      });
    }

    if (!flow.name || !flow.name.trim()) {
      this.addIssue({
        level: "warning",
        code: "MISSING_FLOW_NAME",
        message: "El flujo no tiene nombre",
        fix: "Asigna un nombre descriptivo al flujo",
      });
    }

    if (!flow.nodes || Object.keys(flow.nodes).length === 0) {
      this.addIssue({
        level: "error",
        code: "EMPTY_FLOW",
        message: "El flujo no tiene nodos",
        fix: "Agrega al menos un nodo al flujo",
      });
    }
  }

  private validateRootNode(flow: Flow): void {
    if (!flow.rootId) {
      this.addIssue({
        level: "error",
        code: "MISSING_ROOT_NODE",
        message: "El flujo no tiene un nodo raíz definido",
        fix: "Define un nodo raíz (rootId) para el flujo",
      });
      return;
    }

    if (!flow.nodes[flow.rootId]) {
      this.addIssue({
        level: "error",
        code: "INVALID_ROOT_NODE",
        message: `El nodo raíz "${flow.rootId}" no existe en el flujo`,
        fix: "Verifica que el rootId apunte a un nodo válido",
      });
    }
  }

  private validateNode(flow: Flow, node: FlowNode): void {
    // Validar ID
    if (!node.id || !node.id.trim()) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "MISSING_NODE_ID",
        message: "El nodo no tiene un ID",
        fix: "Asigna un ID único al nodo",
      });
    }

    // Validar label
    if (!node.label || !node.label.trim()) {
      this.addIssue({
        level: "warning",
        nodeId: node.id,
        code: "MISSING_NODE_LABEL",
        message: `El nodo "${node.id}" no tiene etiqueta`,
        fix: "Asigna una etiqueta descriptiva al nodo",
      });
    }

    // Validar según tipo de nodo
    if (node.type === "menu") {
      this.validateMenuNode(flow, node);
    } else if (node.type === "action") {
      this.validateActionNode(flow, node);
    }

    // Validar children
    this.validateChildren(flow, node);
  }

  private validateMenuNode(flow: Flow, node: FlowNode): void {
    const options = node.menuOptions ?? [];

    if (options.length === 0) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "EMPTY_MENU",
        message: `El menú "${node.label}" no tiene opciones`,
        fix: "Agrega al menos una opción al menú",
      });
      return;
    }

    // Validar cada opción
    options.forEach((option, index) => {
      if (!option.label || !option.label.trim()) {
        this.addIssue({
          level: "warning",
          nodeId: node.id,
          code: "EMPTY_MENU_OPTION_LABEL",
          message: `La opción ${index + 1} del menú "${node.label}" no tiene etiqueta`,
          fix: "Asigna una etiqueta a la opción",
        });
      }

      if (option.targetId && !flow.nodes[option.targetId]) {
        this.addIssue({
          level: "error",
          nodeId: node.id,
          code: "INVALID_TARGET",
          message: `La opción "${option.label}" apunta a un nodo inexistente: ${option.targetId}`,
          fix: "Conecta la opción a un nodo válido",
        });
      }
    });
  }

  private validateActionNode(flow: Flow, node: FlowNode): void {
    if (!node.action) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "MISSING_ACTION",
        message: `El nodo de acción "${node.label}" no tiene una acción configurada`,
        fix: "Configura una acción para el nodo",
      });
      return;
    }

    const actionKind = node.action.kind;

    switch (actionKind) {
      case "message":
        this.validateMessageAction(node);
        break;
      case "buttons":
        this.validateButtonsAction(flow, node);
        break;
      case "attachment":
        this.validateAttachmentAction(node);
        break;
      case "ask":
        this.validateAskAction(flow, node);
        break;
      case "condition":
        this.validateConditionAction(flow, node);
        break;
      case "webhook_out":
        this.validateWebhookAction(node);
        break;
      case "scheduler":
        this.validateSchedulerAction(flow, node);
        break;
      case "end":
        // End nodes don't need validation
        break;
      default:
        this.addIssue({
          level: "warning",
          nodeId: node.id,
          code: "UNKNOWN_ACTION",
          message: `El nodo "${node.label}" tiene una acción desconocida: ${String(actionKind)}`,
          fix: "Verifica que la acción sea válida",
        });
    }
  }

  private validateMessageAction(node: FlowNode): void {
    const text = node.action?.data?.text ?? node.description;

    if (!text || !text.trim()) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "EMPTY_MESSAGE",
        message: `El mensaje "${node.label}" está vacío`,
        fix: "Escribe un mensaje para enviar",
      });
    }
  }

  private validateButtonsAction(flow: Flow, node: FlowNode): void {
    const items = node.action?.data?.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "EMPTY_BUTTONS",
        message: `El nodo de botones "${node.label}" no tiene botones`,
        fix: "Agrega al menos un botón",
      });
      return;
    }

    // Validar límites por canal
    const maxWhatsAppButtons = CHANNEL_BUTTON_LIMITS.find((limit) => limit.channel === "whatsapp")?.max ?? 3;

    if (items.length > maxWhatsAppButtons) {
      this.addIssue({
        level: "warning",
        nodeId: node.id,
        code: "TOO_MANY_BUTTONS",
        message: `El nodo "${node.label}" tiene ${items.length} botones, pero WhatsApp solo soporta ${maxWhatsAppButtons}`,
        fix: `Reduce el número de botones a ${maxWhatsAppButtons} o menos`,
      });
    }

    // Validar cada botón
    items.forEach((button, index) => {
      if (!button.label || !button.label.trim()) {
        this.addIssue({
          level: "error",
          nodeId: node.id,
          code: "EMPTY_BUTTON_LABEL",
          message: `El botón ${index + 1} del nodo "${node.label}" no tiene etiqueta`,
          fix: "Asigna una etiqueta al botón",
        });
      }

      if (button.targetId && !flow.nodes[button.targetId]) {
        this.addIssue({
          level: "error",
          nodeId: node.id,
          code: "INVALID_BUTTON_TARGET",
          message: `El botón "${button.label}" apunta a un nodo inexistente: ${button.targetId}`,
          fix: "Conecta el botón a un nodo válido",
        });
      }
    });
  }

  private validateAttachmentAction(node: FlowNode): void {
    const url = node.action?.data?.url;

    if (!url || !url.trim()) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "MISSING_ATTACHMENT_URL",
        message: `El nodo de adjunto "${node.label}" no tiene URL`,
        fix: "Configura una URL válida para el adjunto",
      });
      return;
    }

    // Validar que sea una URL válida
    try {
      new URL(url);
    } catch (error) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "INVALID_ATTACHMENT_URL",
        message: `La URL del adjunto "${node.label}" no es válida: ${url}`,
        fix: "Proporciona una URL válida (ej: https://example.com/image.jpg)",
      });
    }
  }

  private validateAskAction(flow: Flow, node: FlowNode): void {
    const data = node.action?.data;

    if (!data?.questionText || !data.questionText.trim()) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "EMPTY_QUESTION",
        message: `El nodo de pregunta "${node.label}" no tiene texto`,
        fix: "Escribe una pregunta para el usuario",
      });
    }

    if (!data?.varName || !data.varName.trim()) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "MISSING_VARIABLE_NAME",
        message: `El nodo de pregunta "${node.label}" no tiene nombre de variable`,
        fix: "Asigna un nombre a la variable donde se guardará la respuesta",
      });
    }

    if (data?.answerTargetId && !flow.nodes[data.answerTargetId]) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "INVALID_ANSWER_TARGET",
        message: `El nodo "${node.label}" apunta a un nodo de respuesta inexistente`,
        fix: "Conecta el nodo a un nodo válido",
      });
    }
  }

  private validateConditionAction(flow: Flow, node: FlowNode): void {
    const rules = node.action?.data?.rules ?? [];

    if (!Array.isArray(rules) || rules.length === 0) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "EMPTY_CONDITION",
        message: `El nodo de condición "${node.label}" no tiene reglas`,
        fix: "Agrega al menos una regla de condición",
      });
      return;
    }

    rules.forEach((rule, index) => {
      if (rule.targetId && !flow.nodes[rule.targetId]) {
        this.addIssue({
          level: "error",
          nodeId: node.id,
          code: "INVALID_CONDITION_TARGET",
          message: `La regla ${index + 1} del nodo "${node.label}" apunta a un nodo inexistente`,
          fix: "Conecta la regla a un nodo válido",
        });
      }
    });
  }

  private validateWebhookAction(node: FlowNode): void {
    const url = node.action?.data?.url;

    if (!url || !url.trim()) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "MISSING_WEBHOOK_URL",
        message: `El webhook "${node.label}" no tiene URL`,
        fix: "Configura una URL válida para el webhook",
      });
      return;
    }

    try {
      new URL(url);
    } catch (error) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "INVALID_WEBHOOK_URL",
        message: `La URL del webhook "${node.label}" no es válida: ${url}`,
        fix: "Proporciona una URL válida (ej: https://api.example.com/endpoint)",
      });
    }
  }

  private validateSchedulerAction(flow: Flow, node: FlowNode): void {
    const data = node.action?.data;

    if (data?.inWindowTargetId && !flow.nodes[data.inWindowTargetId]) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "INVALID_SCHEDULER_IN_TARGET",
        message: `El scheduler "${node.label}" apunta a un nodo "dentro de horario" inexistente`,
        fix: "Conecta el scheduler a un nodo válido",
      });
    }

    if (data?.outOfWindowTargetId && !flow.nodes[data.outOfWindowTargetId]) {
      this.addIssue({
        level: "error",
        nodeId: node.id,
        code: "INVALID_SCHEDULER_OUT_TARGET",
        message: `El scheduler "${node.label}" apunta a un nodo "fuera de horario" inexistente`,
        fix: "Conecta el scheduler a un nodo válido",
      });
    }
  }

  private validateChildren(flow: Flow, node: FlowNode): void {
    if (!node.children) {
      return;
    }

    node.children.forEach((childId, index) => {
      if (!flow.nodes[childId]) {
        this.addIssue({
          level: "error",
          nodeId: node.id,
          code: "INVALID_CHILD",
          message: `El nodo "${node.label}" tiene un hijo inexistente: ${childId}`,
          fix: "Elimina la conexión o conecta a un nodo válido",
        });
      }
    });
  }

  private validateConnectivity(flow: Flow): void {
    const visited = new Set<string>();
    const queue = [flow.rootId];

    // BFS para encontrar nodos alcanzables
    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      const node = flow.nodes[currentId];
      if (!node) {
        continue;
      }

      // Agregar hijos
      if (node.children) {
        queue.push(...node.children);
      }

      // Agregar targets de menú
      if (node.type === "menu" && node.menuOptions) {
        node.menuOptions.forEach((option) => {
          if (option.targetId) {
            queue.push(option.targetId);
          }
        });
      }

      // Agregar targets de botones
      if (node.action?.kind === "buttons" && node.action.data?.items) {
        node.action.data.items.forEach((button: any) => {
          if (button.targetId) {
            queue.push(button.targetId);
          }
        });
      }

      // Agregar targets de condiciones
      if (node.action?.kind === "condition" && node.action.data?.rules) {
        node.action.data.rules.forEach((rule: any) => {
          if (rule.targetId) {
            queue.push(rule.targetId);
          }
        });
      }
    }

    // Encontrar nodos huérfanos
    const allNodeIds = Object.keys(flow.nodes);
    const orphanedNodes = allNodeIds.filter((nodeId) => !visited.has(nodeId));

    orphanedNodes.forEach((nodeId) => {
      const node = flow.nodes[nodeId];
      this.addIssue({
        level: "warning",
        nodeId,
        code: "ORPHANED_NODE",
        message: `El nodo "${node.label}" (${nodeId}) no está conectado al flujo principal`,
        fix: "Conecta este nodo al flujo o elimínalo",
      });
    });
  }

  private validateInfiniteLoops(flow: Flow): void {
    const detectCycle = (startId: string): string[] | null => {
      const visited = new Set<string>();
      const stack: string[] = [];

      const dfs = (nodeId: string): boolean => {
        if (stack.includes(nodeId)) {
          return true; // Cycle detected
        }

        if (visited.has(nodeId)) {
          return false;
        }

        visited.add(nodeId);
        stack.push(nodeId);

        const node = flow.nodes[nodeId];
        if (!node) {
          stack.pop();
          return false;
        }

        // Check children
        for (const childId of node.children ?? []) {
          if (dfs(childId)) {
            return true;
          }
        }

        stack.pop();
        return false;
      };

      if (dfs(startId)) {
        return stack;
      }

      return null;
    };

    const cycle = detectCycle(flow.rootId);
    if (cycle && cycle.length > 0) {
      const cycleNodes = cycle.map((id) => flow.nodes[id]?.label ?? id).join(" → ");

      this.addIssue({
        level: "error",
        code: "INFINITE_LOOP",
        message: `Se detectó un loop infinito en el flujo: ${cycleNodes}`,
        fix: "Agrega un nodo de finalización o rompe el ciclo",
      });
    }
  }
}

/**
 * Validar un flujo
 */
export function validateFlow(flow: Flow): ValidationResult {
  const validator = new FlowValidator();
  return validator.validate(flow);
}
