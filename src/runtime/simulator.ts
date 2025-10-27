/**
 * Conversation Simulator
 *
 * Sistema para simular conversaciones y probar flujos sin enviar mensajes reales a WhatsApp.
 * Permite validar el comportamiento del bot antes de publicar.
 */

import type { Flow } from "../flow/types";
import { RuntimeEngine, type FlowProvider, type ProcessMessageInput } from "./engine";
import { NodeExecutor, type IncomingMessage, type OutboundMessage } from "./executor";
import { InMemorySessionStore, type ConversationSession } from "./session";

export interface SimulationMessage {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  content: IncomingMessage | OutboundMessage;
  nodeId?: string;
}

export interface SimulationState {
  flowId: string;
  sessionId: string;
  messages: SimulationMessage[];
  session: ConversationSession | null;
  ended: boolean;
  currentNodeId: string | null;
}

export interface SimulatorOptions {
  flowProvider: FlowProvider;
  sessionStore?: InMemorySessionStore;
  executor?: NodeExecutor;
}

/**
 * Conversation Simulator
 *
 * Simula conversaciones para testing sin conectarse a WhatsApp.
 */
export class ConversationSimulator {
  private readonly engine: RuntimeEngine;
  private readonly sessionStore: InMemorySessionStore;
  private state: SimulationState;

  constructor(options: SimulatorOptions) {
    this.sessionStore = options.sessionStore ?? new InMemorySessionStore();
    this.engine = new RuntimeEngine({
      flowProvider: options.flowProvider,
      sessionStore: this.sessionStore,
      executor: options.executor,
    });

    this.state = {
      flowId: "",
      sessionId: "",
      messages: [],
      session: null,
      ended: false,
      currentNodeId: null,
    };
  }

  /**
   * Iniciar una nueva simulación
   */
  async start(flowId: string): Promise<SimulationState> {
    const sessionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    this.state = {
      flowId,
      sessionId,
      messages: [],
      session: null,
      ended: false,
      currentNodeId: null,
    };

    // Send empty message to trigger initial node
    const input: ProcessMessageInput = {
      sessionId,
      flowId,
      channel: "whatsapp",
      contactId: "simulator",
      message: { type: "text", text: "" },
    };

    const result = await this.engine.processMessage(input);

    // Add responses to messages
    for (const response of result.responses) {
      this.addOutboundMessage(response);
    }

    this.state.session = result.session;
    this.state.ended = result.ended;
    this.state.currentNodeId = result.session?.currentNodeId ?? null;

    return this.getState();
  }

  /**
   * Enviar un mensaje de texto del usuario simulado
   */
  async sendText(text: string): Promise<SimulationState> {
    if (this.state.ended) {
      throw new Error("Simulation has ended. Start a new one.");
    }

    const message: IncomingMessage = {
      type: "text",
      text,
    };

    this.addInboundMessage(message);

    const result = await this.engine.processMessage({
      sessionId: this.state.sessionId,
      flowId: this.state.flowId,
      channel: "whatsapp",
      contactId: "simulator",
      message,
    });

    for (const response of result.responses) {
      this.addOutboundMessage(response);
    }

    this.state.session = result.session;
    this.state.ended = result.ended;
    this.state.currentNodeId = result.session?.currentNodeId ?? null;

    return this.getState();
  }

  /**
   * Simular clic en un botón
   */
  async clickButton(buttonId: string, buttonText: string): Promise<SimulationState> {
    if (this.state.ended) {
      throw new Error("Simulation has ended. Start a new one.");
    }

    const message: IncomingMessage = {
      type: "button",
      text: buttonText,
      payload: buttonId,
    };

    this.addInboundMessage(message);

    const result = await this.engine.processMessage({
      sessionId: this.state.sessionId,
      flowId: this.state.flowId,
      channel: "whatsapp",
      contactId: "simulator",
      message,
    });

    for (const response of result.responses) {
      this.addOutboundMessage(response);
    }

    this.state.session = result.session;
    this.state.ended = result.ended;
    this.state.currentNodeId = result.session?.currentNodeId ?? null;

    return this.getState();
  }

  /**
   * Seleccionar opción de menú
   */
  async selectOption(optionValue: string): Promise<SimulationState> {
    return this.sendText(optionValue);
  }

  /**
   * Obtener el estado actual de la simulación
   */
  getState(): SimulationState {
    return { ...this.state };
  }

  /**
   * Reiniciar la simulación
   */
  async reset(): Promise<SimulationState> {
    await this.sessionStore.deleteSession(this.state.sessionId);

    this.state = {
      flowId: this.state.flowId,
      sessionId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      messages: [],
      session: null,
      ended: false,
      currentNodeId: null,
    };

    return this.getState();
  }

  /**
   * Obtener el historial de mensajes
   */
  getMessages(): SimulationMessage[] {
    return [...this.state.messages];
  }

  /**
   * Obtener variables de la sesión
   */
  getVariables(): Record<string, string> {
    return this.state.session?.variables ?? {};
  }

  private addInboundMessage(content: IncomingMessage): void {
    this.state.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      direction: "inbound",
      content,
      nodeId: this.state.currentNodeId ?? undefined,
    });
  }

  private addOutboundMessage(content: OutboundMessage): void {
    this.state.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      direction: "outbound",
      content,
      nodeId: this.state.currentNodeId ?? undefined,
    });
  }
}

/**
 * Simulador de conversación para testing de flujos
 */
export async function simulateConversation(
  flow: Flow,
  userInputs: string[]
): Promise<SimulationMessage[]> {
  const flowProvider: FlowProvider = {
    async getFlow(flowId: string) {
      return flowId === flow.id ? flow : null;
    },
  };

  const simulator = new ConversationSimulator({ flowProvider });

  await simulator.start(flow.id);

  for (const input of userInputs) {
    await simulator.sendText(input);
  }

  return simulator.getMessages();
}
