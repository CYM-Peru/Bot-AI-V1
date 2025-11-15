import { crmDb } from "./crm/db-postgres";
import { adminDb } from "./admin-db";
import { advisorPresence } from "./crm/advisor-presence";
import type { CrmRealtimeManager } from "./crm/ws";
import { formatEventTimestamp } from "./utils/file-logger";
import { metricsTracker } from "./crm/metrics-tracker";
import { canBeAutoAssigned } from "../shared/conversation-rules";

/**
 * QueueDistributor
 *
 * Distribuye automáticamente chats en cola a asesores disponibles
 * Corre cada X segundos de forma continua
 */
export class QueueDistributor {
  private intervalId: NodeJS.Timeout | null = null;
  private socketManager: CrmRealtimeManager | null = null;
  private isRunning = false;

  constructor(socketManager?: CrmRealtimeManager) {
    this.socketManager = socketManager || null;
  }

  setSocketManager(socketManager: CrmRealtimeManager): void {
    this.socketManager = socketManager;
  }

  /**
   * Iniciar distribución automática
   * @param intervalMs Intervalo en milisegundos (default: 10 segundos)
   */
  start(intervalMs: number = 10000): void {
    if (this.intervalId) {
      console.log("[QueueDistributor] ⚠️  Ya está en ejecución");
      return;
    }

    console.log(`[QueueDistributor] 🚀 Iniciando distribución automática cada ${intervalMs}ms`);

    // Ejecutar inmediatamente y luego cada intervalo
    this.distribute();

    this.intervalId = setInterval(() => {
      this.distribute();
    }, intervalMs);
  }

  /**
   * Detener distribución automática
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[QueueDistributor] 🛑 Distribución automática detenida");
    }
  }

  /**
   * Distribución principal - ejecutada cada intervalo
   */
  private async distribute(): Promise<void> {
    // Prevenir ejecuciones concurrentes
    if (this.isRunning) {
      console.log("[QueueDistributor] ⏭️  Saltando ejecución - otra en progreso");
      return;
    }

    this.isRunning = true;

    try {
      // 1. Obtener todas las colas (no hay campo status en PostgreSQL)
      const queues = await adminDb.getAllQueues();

      if (queues.length === 0) {
        return;
      }

      // 2. Para cada cola, distribuir chats
      for (const queue of queues) {
        // Usar "least-busy" por defecto (distribución equitativa)
        await this.distributeQueue(queue.id, queue.name, queue.distributionMode || "least-busy");
      }

    } catch (error) {
      console.error("[QueueDistributor] ❌ Error en distribución:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Distribuir chats de una cola específica
   */
  private async distributeQueue(queueId: string, queueName: string, distributionMode: string): Promise<void> {
    try {
      // 1. Obtener chats en cola sin asignar
      // ✅ USAR FUNCIÓN COMPARTIDA: canBeAutoAssigned() desde /shared/conversation-rules.ts
      // CRITICAL: NO asignar conversaciones que tienen bot activo o ya tienen asesor
      const chatsInQueue = await crmDb.listConversations();
      const unassignedChats = chatsInQueue.filter(
        conv => conv.queueId === queueId &&
                canBeAutoAssigned({
                  status: conv.status,
                  assignedTo: conv.assignedTo,
                  botFlowId: conv.botFlowId,
                  queueId: conv.queueId,
                  campaignId: null,
                })
      );

      if (unassignedChats.length === 0) {
        return; // No hay chats que distribuir
      }

      // 2. Obtener asesores disponibles en esta cola
      const queue = await adminDb.getQueueById(queueId);
      if (!queue) return;

      const availableAdvisors = await this.getAvailableAdvisorsInQueue(queue);

      if (availableAdvisors.length === 0) {
        console.log(`[QueueDistributor] ⚠️  Cola "${queueName}": ${unassignedChats.length} chats esperando, pero no hay asesores disponibles`);
        return;
      }

      console.log(`[QueueDistributor] 📊 Cola "${queueName}": ${unassignedChats.length} chats → ${availableAdvisors.length} asesores disponibles`);

      // 3. Distribuir según el modo
      if (distributionMode === "round-robin") {
        await this.distributeRoundRobin(unassignedChats, availableAdvisors, queueName);
      } else if (distributionMode === "least-busy") {
        await this.distributeLeastBusy(unassignedChats, availableAdvisors, queueName);
      } else {
        console.log(`[QueueDistributor] ⚠️  Cola "${queueName}" en modo manual - sin distribución automática`);
      }

    } catch (error) {
      console.error(`[QueueDistributor] ❌ Error distribuyendo cola "${queueName}":`, error);
    }
  }

  /**
   * Obtener asesores disponibles en una cola
   */
  private async getAvailableAdvisorsInQueue(queue: any): Promise<string[]> {
    const advisors = queue.assignedAdvisors || [];

    const availableAdvisors: string[] = [];

    for (const advisorId of advisors) {
      // 1. Excluir supervisores (no reciben chats automáticamente)
      if (queue.supervisors && queue.supervisors.includes(advisorId)) {
        continue;
      }

      // 2. Verificar que esté online
      if (!advisorPresence.isOnline(advisorId)) {
        continue;
      }

      // 3. Verificar que tenga estado con action='accept'
      const statusAssignment = await adminDb.getAdvisorStatus(advisorId);
      if (!statusAssignment || !statusAssignment.status) continue;

      if (statusAssignment.status.action !== "accept") {
        continue;
      }

      // 4. Verificar que no esté en su límite de chats
      // TODO: Implementar verificación de maxConcurrent

      availableAdvisors.push(advisorId);
    }

    return availableAdvisors;
  }

  /**
   * Distribución round-robin (equitativa)
   */
  private async distributeRoundRobin(chats: any[], advisors: string[], queueName: string): Promise<void> {
    let advisorIndex = 0;
    let assigned = 0;

    for (const chat of chats) {
      const advisorId = advisors[advisorIndex];

      try {
        // IMPORTANTE: Solo ASIGNAR (no aceptar) para que quede en categoría "POR TRABAJAR"
        // El asesor deberá presionar "Aceptar" para pasar a "TRABAJANDO"
        await crmDb.assignConversation(chat.id, advisorId);

        // Obtener nombre del asesor
        const user = await adminDb.getUserById(advisorId);
        const advisorName = user?.name || user?.username || advisorId;

        console.log(`[QueueDistributor] ✅ Cola "${queueName}": Chat ${chat.phone} → ${advisorName} (POR TRABAJAR)`);

        // Start tracking metrics for this conversation
        const metricId = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        metricsTracker.startConversation(metricId, chat.id, advisorId, {
          queueId: chat.queueId || undefined,
          channelType: chat.channel as any,
          channelId: chat.channelConnectionId || undefined,
        });

        // Create system message for automatic assignment
        const timestamp = formatEventTimestamp();
        const assignMessage = await crmDb.createSystemEvent(
          chat.id,
          'conversation_assigned',
          `🎯 Asignado automáticamente a ${advisorName} (${timestamp})`
        );

        // Emit system message via WebSocket
        if (this.socketManager) {
          this.socketManager.emitNewMessage({ message: assignMessage, attachment: null });

          // Emit conversation update
          const updated = await crmDb.getConversationById(chat.id);
          if (updated) {
            this.socketManager.emitConversationUpdate({ conversation: updated });
          }
        }

        assigned++;

        // Siguiente asesor (round-robin)
        advisorIndex = (advisorIndex + 1) % advisors.length;

      } catch (error) {
        console.error(`[QueueDistributor] ❌ Error asignando chat ${chat.id}:`, error);
      }
    }

    if (assigned > 0) {
      console.log(`[QueueDistributor] 🎯 Cola "${queueName}": ${assigned}/${chats.length} chats distribuidos`);
    }
  }

  /**
   * Distribución least-busy (al menos ocupado)
   */
  private async distributeLeastBusy(chats: any[], advisors: string[], queueName: string): Promise<void> {
    let assigned = 0;

    for (const chat of chats) {
      try {
        // Contar chats activos por asesor
        const allConversations = await crmDb.listConversations();
        const advisorChatCounts = advisors.map(advisorId => ({
          advisorId,
          count: allConversations.filter(conv =>
            conv.assignedTo === advisorId &&
            (conv.status === "active" || conv.status === "attending")
          ).length
        }));

        // Ordenar por cantidad (ascendente) y tomar el menos ocupado
        advisorChatCounts.sort((a, b) => a.count - b.count);
        const leastBusyAdvisorId = advisorChatCounts[0].advisorId;

        // IMPORTANTE: Solo ASIGNAR (no aceptar) para que quede en categoría "POR TRABAJAR"
        // El asesor deberá presionar "Aceptar" para pasar a "TRABAJANDO"
        await crmDb.assignConversation(chat.id, leastBusyAdvisorId);

        // Obtener nombre del asesor
        const user = await adminDb.getUserById(leastBusyAdvisorId);
        const advisorName = user?.name || user?.username || leastBusyAdvisorId;

        console.log(`[QueueDistributor] ✅ Cola "${queueName}": Chat ${chat.phone} → ${advisorName} (${advisorChatCounts[0].count} chats) (POR TRABAJAR)`);

        // Start tracking metrics for this conversation
        const metricId = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        metricsTracker.startConversation(metricId, chat.id, leastBusyAdvisorId, {
          queueId: chat.queueId || undefined,
          channelType: chat.channel as any,
          channelId: chat.channelConnectionId || undefined,
        });

        // Create system message for automatic assignment
        const timestamp = formatEventTimestamp();
        const assignMessage = await crmDb.createSystemEvent(
          chat.id,
          'conversation_assigned',
          `🎯 Asignado automáticamente a ${advisorName} (${timestamp})`
        );

        // Emit system message via WebSocket
        if (this.socketManager) {
          this.socketManager.emitNewMessage({ message: assignMessage, attachment: null });

          // Emit conversation update
          const updated = await crmDb.getConversationById(chat.id);
          if (updated) {
            this.socketManager.emitConversationUpdate({ conversation: updated });
          }
        }

        assigned++;

      } catch (error) {
        console.error(`[QueueDistributor] ❌ Error asignando chat ${chat.id}:`, error);
      }
    }

    if (assigned > 0) {
      console.log(`[QueueDistributor] 🎯 Cola "${queueName}": ${assigned}/${chats.length} chats distribuidos`);
    }
  }

  /**
   * Estado actual del distribuidor
   */
  getStatus(): { active: boolean; isRunning: boolean } {
    return {
      active: this.intervalId !== null,
      isRunning: this.isRunning,
    };
  }
}
