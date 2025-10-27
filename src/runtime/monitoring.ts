/**
 * Logging and Monitoring System
 *
 * Sistema para registrar y monitorear conversaciones, mensajes, errores y métricas en tiempo real.
 */

import type { IncomingMessage, OutboundMessage } from "./executor";
import type { ConversationSession } from "./session";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEventType =
  | "conversation_started"
  | "conversation_ended"
  | "message_received"
  | "message_sent"
  | "node_executed"
  | "webhook_called"
  | "webhook_error"
  | "condition_evaluated"
  | "error"
  | "system";

export interface LogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  type: LogEventType;
  sessionId?: string;
  flowId?: string;
  nodeId?: string;
  message: string;
  metadata?: Record<string, any>;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface ConversationMetrics {
  sessionId: string;
  flowId: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  messagesReceived: number;
  messagesSent: number;
  nodesExecuted: number;
  webhooksCalled: number;
  errors: number;
  status: "active" | "ended" | "error";
}

export interface MonitoringStats {
  activeConversations: number;
  totalConversations: number;
  messagesPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
}

/**
 * Logger for bot events
 */
export class BotLogger {
  private logs: LogEvent[] = [];
  private maxLogs: number = 10000;
  private startTime: number = Date.now();

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  /**
   * Registrar un evento
   */
  log(event: Omit<LogEvent, "id" | "timestamp">): void {
    const logEvent: LogEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.logs.push(logEvent);

    // Mantener solo los últimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console
    this.outputToConsole(logEvent);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log({ level: "debug", type: "system", message, metadata });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log({ level: "info", type: "system", message, metadata });
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log({ level: "warn", type: "system", message, metadata });
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log({
      level: "error",
      type: "error",
      message,
      metadata,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  /**
   * Registrar inicio de conversación
   */
  logConversationStarted(sessionId: string, flowId: string): void {
    this.log({
      level: "info",
      type: "conversation_started",
      sessionId,
      flowId,
      message: `Conversación iniciada: ${sessionId}`,
    });
  }

  /**
   * Registrar fin de conversación
   */
  logConversationEnded(sessionId: string, flowId: string, duration: number): void {
    this.log({
      level: "info",
      type: "conversation_ended",
      sessionId,
      flowId,
      message: `Conversación finalizada: ${sessionId}`,
      duration,
    });
  }

  /**
   * Registrar mensaje recibido
   */
  logMessageReceived(sessionId: string, flowId: string, message: IncomingMessage): void {
    this.log({
      level: "info",
      type: "message_received",
      sessionId,
      flowId,
      message: `Mensaje recibido: ${message.text || message.payload || ""}`,
      metadata: { message },
    });
  }

  /**
   * Registrar mensaje enviado
   */
  logMessageSent(sessionId: string, flowId: string, message: OutboundMessage, duration?: number): void {
    this.log({
      level: "info",
      type: "message_sent",
      sessionId,
      flowId,
      message: `Mensaje enviado: ${message.type}`,
      metadata: { message },
      duration,
    });
  }

  /**
   * Registrar ejecución de nodo
   */
  logNodeExecuted(sessionId: string, flowId: string, nodeId: string, nodeName: string, duration: number): void {
    this.log({
      level: "debug",
      type: "node_executed",
      sessionId,
      flowId,
      nodeId,
      message: `Nodo ejecutado: ${nodeName} (${nodeId})`,
      duration,
    });
  }

  /**
   * Registrar llamada a webhook
   */
  logWebhookCalled(
    sessionId: string,
    flowId: string,
    nodeId: string,
    url: string,
    duration: number,
    success: boolean
  ): void {
    this.log({
      level: success ? "info" : "warn",
      type: success ? "webhook_called" : "webhook_error",
      sessionId,
      flowId,
      nodeId,
      message: `Webhook ${success ? "ejecutado" : "fallido"}: ${url}`,
      duration,
      metadata: { url, success },
    });
  }

  /**
   * Obtener logs
   */
  getLogs(filters?: {
    level?: LogLevel;
    type?: LogEventType;
    sessionId?: string;
    flowId?: string;
    limit?: number;
  }): LogEvent[] {
    let filtered = [...this.logs];

    if (filters?.level) {
      filtered = filtered.filter((log) => log.level === filters.level);
    }

    if (filters?.type) {
      filtered = filtered.filter((log) => log.type === filters.type);
    }

    if (filters?.sessionId) {
      filtered = filtered.filter((log) => log.sessionId === filters.sessionId);
    }

    if (filters?.flowId) {
      filtered = filtered.filter((log) => log.flowId === filters.flowId);
    }

    if (filters?.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  /**
   * Limpiar logs antiguos
   */
  clearOldLogs(olderThanMinutes: number): void {
    const cutoff = Date.now() - olderThanMinutes * 60 * 1000;
    this.logs = this.logs.filter((log) => new Date(log.timestamp).getTime() > cutoff);
  }

  /**
   * Obtener estadísticas
   */
  getStats(): MonitoringStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const recentLogs = this.logs.filter((log) => new Date(log.timestamp).getTime() > oneMinuteAgo);

    const messagesPerMinute =
      recentLogs.filter((log) => log.type === "message_received" || log.type === "message_sent").length;

    const activeSessions = new Set(
      this.logs
        .filter((log) => log.type === "conversation_started" || log.type === "conversation_ended")
        .filter((log) => log.type === "conversation_started")
        .map((log) => log.sessionId)
    ).size;

    const responseTimes = this.logs.filter((log) => log.duration).map((log) => log.duration!);

    const averageResponseTime =
      responseTimes.length > 0 ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0;

    const errors = this.logs.filter((log) => log.level === "error").length;
    const errorRate = this.logs.length > 0 ? errors / this.logs.length : 0;

    return {
      activeConversations: activeSessions,
      totalConversations: this.logs.filter((log) => log.type === "conversation_started").length,
      messagesPerMinute,
      averageResponseTime,
      errorRate,
      uptime: (now - this.startTime) / 1000,
    };
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private outputToConsole(event: LogEvent): void {
    const prefix = `[${event.level.toUpperCase()}] [${event.type}]`;
    const sessionInfo = event.sessionId ? ` [${event.sessionId}]` : "";
    const nodeInfo = event.nodeId ? ` [${event.nodeId}]` : "";
    const message = `${prefix}${sessionInfo}${nodeInfo} ${event.message}`;

    switch (event.level) {
      case "error":
        console.error(message, event.metadata);
        break;
      case "warn":
        console.warn(message, event.metadata);
        break;
      case "debug":
        console.debug(message, event.metadata);
        break;
      default:
        console.log(message, event.metadata);
    }
  }
}

/**
 * Metrics Tracker
 */
export class MetricsTracker {
  private metrics = new Map<string, ConversationMetrics>();

  /**
   * Iniciar tracking de conversación
   */
  startConversation(sessionId: string, flowId: string): void {
    this.metrics.set(sessionId, {
      sessionId,
      flowId,
      startedAt: new Date().toISOString(),
      messagesReceived: 0,
      messagesSent: 0,
      nodesExecuted: 0,
      webhooksCalled: 0,
      errors: 0,
      status: "active",
    });
  }

  /**
   * Finalizar tracking de conversación
   */
  endConversation(sessionId: string): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      const endedAt = new Date();
      const startedAt = new Date(metrics.startedAt);
      metrics.endedAt = endedAt.toISOString();
      metrics.duration = endedAt.getTime() - startedAt.getTime();
      metrics.status = "ended";
    }
  }

  /**
   * Incrementar contador
   */
  incrementCounter(sessionId: string, counter: keyof Pick<ConversationMetrics, "messagesReceived" | "messagesSent" | "nodesExecuted" | "webhooksCalled" | "errors">): void {
    const metrics = this.metrics.get(sessionId);
    if (metrics) {
      metrics[counter]++;
    }
  }

  /**
   * Obtener métricas de una conversación
   */
  getMetrics(sessionId: string): ConversationMetrics | null {
    return this.metrics.get(sessionId) ?? null;
  }

  /**
   * Obtener todas las métricas
   */
  getAllMetrics(): ConversationMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Obtener conversaciones activas
   */
  getActiveConversations(): ConversationMetrics[] {
    return Array.from(this.metrics.values()).filter((m) => m.status === "active");
  }

  /**
   * Limpiar métricas antiguas
   */
  clearOldMetrics(olderThanHours: number): void {
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;

    for (const [sessionId, metrics] of this.metrics.entries()) {
      if (new Date(metrics.startedAt).getTime() < cutoff) {
        this.metrics.delete(sessionId);
      }
    }
  }
}

/**
 * Singleton para logger y metrics tracker
 */
export const botLogger = new BotLogger();
export const metricsTracker = new MetricsTracker();
