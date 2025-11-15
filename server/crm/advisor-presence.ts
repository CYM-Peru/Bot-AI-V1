/**
 * Advisor Presence Tracker
 *
 * Tracks real-time online/offline status of advisors
 * Integrates with WebSocket and session management
 */

import { crmDb } from "./db";
import { adminDb } from "../admin-db";

export interface AdvisorPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: number;
  sessionId?: string;
  connectedAt?: number;
  activeConnections: number; // Track number of active WebSocket connections
}

export class AdvisorPresenceTracker {
  private presence = new Map<string, AdvisorPresence>();
  private sessionToUser = new Map<string, string>(); // sessionId -> userId mapping
  private offlineTimeouts = new Map<string, NodeJS.Timeout>(); // Delayed offline marking

  /**
   * Initialize presence for all known advisors (set them as offline)
   * Call this on server startup
   */
   async initializeAdvisors(userIds: string[]): void {
    const now = Date.now();
    for(const userId of userIds) {
      if(!this.presence.has(userId)) {
        this.presence.set(userId, {
          userId,
          isOnline: false,
          lastSeen: now,
          activeConnections: 0,
        });
      }
    }
    console.log(`[AdvisorPresence] Initialized ${userIds.length} advisors as offline`);
  }

  /**
   * Mark advisor as online when they login or connect via WebSocket
   * Increments active connections counter
   */
   async markOnline(userId: string, sessionId?: string): void {
    const logMsg = `[AdvisorPresence] 🔵 markOnline() CALLED - userId: ${userId}, sessionId: ${sessionId?.substring(0, 10)}..., timestamp: ${new Date().toISOString()}`;
    console.log(logMsg);
    // Also write to file for debugging
    try {
      require('fs').appendFileSync('/tmp/advisor-presence-debug.log', logMsg + '\n');
    } catch (e) {}

    const now = Date.now();
    const existing = this.presence.get(userId);
    console.log(`[AdvisorPresence] 📊 Existing presence before update:`, existing);
    try {
      require('fs').appendFileSync('/tmp/advisor-presence-debug.log', `[AdvisorPresence] 📊 Existing: ${JSON.stringify(existing)}\n`);
    } catch (e) {}
    const wasOffline = !existing || !existing.isOnline;

    // Cancel any pending offline timeout (in case of reconnection)
    const timeout = this.offlineTimeouts.get(userId);
    if(timeout) {
      clearTimeout(timeout);
      this.offlineTimeouts.delete(userId);
      console.log(`[AdvisorPresence] ✅ ${userId} reconnected - offline timeout cancelled`);
    }

    const newPresence = {
      userId,
      isOnline: true,
      lastSeen: now,
      connectedAt: existing?.connectedAt || now,
      sessionId,
      activeConnections: (existing?.activeConnections || 0) + 1,
    };

    console.log(`[AdvisorPresence] 📝 Setting new presence:`, newPresence);
    this.presence.set(userId, newPresence);

    // Verify it was set
    const verified = this.presence.get(userId);
    console.log(`[AdvisorPresence] 🔍 VERIFIED presence after set:`, verified);
    console.log(`[AdvisorPresence] 📈 Total presence entries: ${this.presence.size}`);

    if(sessionId) {
      this.sessionToUser.set(sessionId, userId);
    }

    console.log(`[AdvisorPresence] ✅ ${userId} is now ONLINE (${(existing?.activeConnections || 0) + 1} connections)`);

    // CRITICAL: Redistribute queue chats when advisor goes from offline to online
    if(wasOffline) {
      console.log(`[AdvisorPresence] 🔄 ${userId} came online - triggering queue redistribution`);
      // Use setTimeout to avoid blocking the connection
      setTimeout(() => {
        this.redistributeQueueChats(userId);
      }, 1000);
    }
  }

  /**
   * Mark advisor as offline when they logout or disconnect
   * Decrements active connections counter - uses 5s delay before marking offline
   * This prevents flickering during page refreshes
   */
   async markOffline(userId: string, immediate: boolean = false): Promise<void> {
    const current = this.presence.get(userId);

    if(current) {
      const newConnectionCount = Math.max(0, (current.activeConnections || 0) - 1);
      const shouldScheduleOffline = newConnectionCount === 0;

      // Update connection count immediately
      this.presence.set(userId, {
        ...current,
        lastSeen: Date.now(),
        activeConnections: newConnectionCount,
      });

      if(shouldScheduleOffline) {
        // If immediate logout (manual logout), mark offline right away
        if(immediate) {
          console.log(`[AdvisorPresence] 🔴 ${userId} logging out - marking offline immediately`);

          this.presence.set(userId, {
            ...current,
            isOnline: false,
            lastSeen: Date.now(),
            sessionId: undefined,
            connectedAt: undefined,
            activeConnections: 0,
          });

          // Remove session mapping
          if(current.sessionId) {
            this.sessionToUser.delete(current.sessionId);
          }

          // Cancel any pending timeout
          const existingTimeout = this.offlineTimeouts.get(userId);
          if(existingTimeout) {
            clearTimeout(existingTimeout);
            this.offlineTimeouts.delete(userId);
          }

          // Emit presence update immediately
          this.emitPresenceUpdate(userId);
          return;
        }

        console.log(`[AdvisorPresence] ⚠️ ${userId} all connections closed - scheduling offline in 5s...`);

        // Cancel any existing timeout
        const existingTimeout = this.offlineTimeouts.get(userId);
        if(existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Schedule offline marking after 5 seconds (gives time for reconnection)
        const timeout = setTimeout(() => {
          const latest = this.presence.get(userId);

          // Double-check: only mark offline if still at 0 connections
          if(latest && latest.activeConnections === 0) {
            this.presence.set(userId, {
              ...latest,
              isOnline: false,
              sessionId: undefined,
              connectedAt: undefined,
            });

            // Remove session mapping
            if(latest.sessionId) {
              this.sessionToUser.delete(latest.sessionId);
            }

            this.offlineTimeouts.delete(userId);
            console.log(`[AdvisorPresence] 🔴 ${userId} is now OFFLINE (timeout expired, no reconnection)`);

            // CRITICAL FIX: Emit presence update after marking offline
            this.emitPresenceUpdate(userId);
          } else {
            console.log(`[AdvisorPresence] ✅ ${userId} reconnected before timeout - staying ONLINE`);
            this.offlineTimeouts.delete(userId);
          }
        }, 5000); // 5 second grace period

        this.offlineTimeouts.set(userId, timeout);
      } else {
        console.log(`[AdvisorPresence] ⚠️ ${userId} connection closed (${newConnectionCount} remaining)`);
      }
    }
  }

  /**
   * Mark advisor as offline by session ID (for WebSocket disconnections)
   */
   async markOfflineBySession(sessionId: string): void {
    const userId = this.sessionToUser.get(sessionId);
    if(userId) {
      this.markOffline(userId);
    }
  }

  /**
   * Update last seen timestamp (heartbeat)
   */
   async updateLastSeen(userId: string): void {
    const current = this.presence.get(userId);
    if(current && current.isOnline) {
      current.lastSeen = Date.now();
    }
  }

  /**
   * Check if advisor is online
   * IMPORTANT: NOT async - returns boolean directly (no Promise)
   */
   isOnline(userId: string): boolean {
    return this.presence.get(userId)?.isOnline ?? false;
  }

  /**
   * Get presence info for a specific advisor
   */
   getPresence(userId: string): AdvisorPresence | null {
    return this.presence.get(userId) || null;
  }

  /**
   * Get all advisors presence (for dashboard)
   */
   getAllPresence(): AdvisorPresence[] {
    return Array.from(this.presence.values());
  }

  /**
   * Get only online advisors
   */
   getOnlineAdvisors(): AdvisorPresence[] {
    return Array.from(this.presence.values()).filter(p => p.isOnline);
  }

  /**
   * Get count of online advisors
   */
   getOnlineCount(): number {
    return this.getOnlineAdvisors().length;
  }

  /**
   * Clean up stale presence (advisors offline for more than X time)
   */
   async cleanupStale(maxOfflineMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for(const [userId, presence] of this.presence.entries()) {
      if(!presence.isOnline && (now - presence.lastSeen) > maxOfflineMs) {
        toDelete.push(userId);
      }
    }

    for(const userId of toDelete) {
      this.presence.delete(userId);
      console.log(`[AdvisorPresence] 🗑️  Cleaned up stale presence for ${userId}`);
    }
  }

  /**
   * Get statistics
   */
   getStats() {
    const all = this.getAllPresence();
    const online = all.filter(p => p.isOnline);
    const offline = all.filter(p => !p.isOnline);

    return {
      total: all.length,
      online: online.length,
      offline: offline.length,
      sessions: this.sessionToUser.size,
    };
  }

  /**
   * Redistribute queue chats when an advisor comes online
   * This ensures chats assigned to offline advisors get reassigned to online ones
   */
  async redistributeQueueChats(userId: string): Promise<void> {
    console.log(`[QueueRedistribution] 🔄 Starting redistribution for ${userId}`);

    try {
      // 1. Get all queues where this advisor is assigned
      const allQueues = await adminDb.getAllQueues();
      const advisorQueues = allQueues.filter(queue =>
        queue.status === "active" &&
        queue.assignedAdvisors.includes(userId)
      );

      if(advisorQueues.length === 0) {
        console.log(`[QueueRedistribution] ⚠️  ${userId} is not assigned to any active queues`);
        return;
      }

      console.log(`[QueueRedistribution] 📋 ${userId} is in ${advisorQueues.length} queue(s): ${advisorQueues.map(q => q.name).join(", ")}`);

      // 2. For each queue, redistribute chats
      for(const queue of advisorQueues) {
        await this.redistributeQueueChatsForQueue(queue.id, queue.name);
      }

    } catch (error) {
      console.error(`[QueueRedistribution] ❌ Error redistributing chats for ${userId}:`, error);
    }
  }

  /**
   * Redistribute chats for a specific queue
   */
  private async redistributeQueueChatsForQueue(queueId: string, queueName: string): Promise<void> {
    try {
      const queue = adminDb.getQueueById(queueId);
      if(!queue || queue.status !== "active") {
        return;
      }

      // 1. Get all conversations in this queue
      const allConversations = await crmDb.listConversations();
      const queueConversations = allConversations.filter(conv =>
        conv.queueId === queueId &&
        conv.status === "active"
      );

      if(queueConversations.length === 0) {
        console.log(`[QueueRedistribution] ✅ Queue "${queueName}" has no active conversations`);
        return;
      }

      // 2. Get online advisors in this queue (excluding supervisors)
      const onlineAdvisorsInQueue = queue.assignedAdvisors.filter(advisorId => {
        // Only include if advisor is online
        if (!this.isOnline(advisorId)) return false;

        // Exclude if advisor is in supervisors list (supervisors don't receive chats)
        if (queue.supervisors && queue.supervisors.includes(advisorId)) return false;

        // Also exclude by role - supervisors, admins, gerencia don't receive chats
        const user = adminDb.getUserById(advisorId);
        if (user && (user.role === 'supervisor' || user.role === 'admin' || user.role === 'gerencia')) {
          return false;
        }

        return true;
      });

      if(onlineAdvisorsInQueue.length === 0) {
        console.log(`[QueueRedistribution] ⚠️  Queue "${queueName}" has no online advisors - keeping chats in queue`);
        return;
      }

      console.log(`[QueueRedistribution] 📊 Queue "${queueName}": ${queueConversations.length} chats, ${onlineAdvisorsInQueue.length} online advisors`);

      // 3. Get chats that need redistribution (unassigned OR assigned to offline advisors)
      const chatsToRedistribute = queueConversations.filter(conv => {
        if(!conv.assignedTo) {
          return true; // Unassigned
        }
        // Check if assigned advisor is offline
        const isAssignedAdvisorOnline = this.isOnline(conv.assignedTo);
        return !isAssignedAdvisorOnline;
      });

      if(chatsToRedistribute.length === 0) {
        console.log(`[QueueRedistribution] ✅ Queue "${queueName}" - all chats already assigned to online advisors`);
        return;
      }

      console.log(`[QueueRedistribution] 🔄 Redistributing ${chatsToRedistribute.length} chats in queue "${queueName}"`);

      // 4. Redistribute based on queue distribution mode
      if(queue.distributionMode === "round-robin") {
        await this.redistributeRoundRobin(chatsToRedistribute, onlineAdvisorsInQueue, queueName);
      } else if (queue.distributionMode === "least-busy") {
        await this.redistributeLeastBusy(chatsToRedistribute, onlineAdvisorsInQueue, queueName);
      } else {
        // Manual mode - don't auto-redistribute
        console.log(`[QueueRedistribution] ⚠️  Queue "${queueName}" is in manual mode - skipping redistribution`);
      }

    } catch (error) {
      console.error(`[QueueRedistribution] ❌ Error redistributing queue "${queueName}":`, error);
    }
  }

  /**
   * Distribute ONLY unassigned chats to advisors with fewer active chats
   * NEVER removes chats from advisors who already have them
   */
  private async redistributeRoundRobin(chats: any[], advisors: string[], queueName: string): Promise<void> {
    console.log(`[QueueRedistribution] 🔄 Starting distribution for queue "${queueName}"`);

    // Only distribute chats that are NOT assigned yet (assignedTo === null)
    const unassignedChats = chats.filter(chat => !chat.assignedTo);

    if(unassignedChats.length === 0) {
      console.log(`[QueueRedistribution] ✅ No unassigned chats to distribute in queue "${queueName}"`);
      return;
    }

    console.log(`[QueueRedistribution] 📊 Unassigned chats to distribute: ${unassignedChats.length}`);
    console.log(`[QueueRedistribution] 📊 Online advisors: ${advisors.length}`);

    // Get current chat counts for each advisor (to know who has less)
    const allConversations = await crmDb.listConversations();
    const advisorChatCounts = advisors.map(advisorId => ({
      advisorId,
      count: allConversations.filter(conv =>
        conv.assignedTo === advisorId &&
        (conv.status === "active" || conv.status === "attending")
      ).length
    }));

    // Sort by count (ascending) - advisors with fewer chats first
    advisorChatCounts.sort((a, b) => a.count - b.count);

    console.log(`[QueueRedistribution] 📊 Current load:`, advisorChatCounts.map(a => `${a.advisorId}: ${a.count} chats`).join(', '));

    let distributed = 0;

    // Distribute each unassigned chat to the advisor with LEAST chats
    for(const chat of unassignedChats) {
      // Always pick the advisor with fewest chats (re-sort after each assignment)
      advisorChatCounts.sort((a, b) => a.count - b.count);
      const targetAdvisor = advisorChatCounts[0].advisorId;

      try {
        await crmDb.assignConversation(chat.id, targetAdvisor);
        console.log(`[QueueRedistribution] ✅ Assigned chat ${chat.id} to ${targetAdvisor} (now has ${advisorChatCounts[0].count + 1} chats)`);
        distributed++;

        // Update count for this advisor
        advisorChatCounts[0].count++;
      } catch (error) {
        console.error(`[QueueRedistribution] ❌ Failed to assign chat ${chat.id}:`, error);
      }
    }

    const finalDistribution = advisors.map(adv => ({
      advisor: adv,
      count: advisorChatCounts.find(a => a.advisorId === adv)?.count || 0
    }));

    console.log(`[QueueRedistribution] ✅ Distribution complete: ${distributed}/${unassignedChats.length} chats assigned`);
    console.log(`[QueueRedistribution] 📊 Final load:`, finalDistribution.map(a => `${a.advisor}: ${a.count} chats`).join(', '));
  }

  /**
   * Redistribute using least-busy (assign to advisor with fewest active chats)
   */
  private async redistributeLeastBusy(chats: any[], advisors: string[], queueName: string): Promise<void> {
    let redistributed = 0;

    for(const chat of chats) {
      // Count active chats for each advisor
      const allConversations = await crmDb.listConversations();
      const advisorChatCounts = advisors.map(advisorId => ({
        advisorId,
        count: allConversations.filter(conv =>
          conv.assignedTo === advisorId &&
          (conv.status === "active" || conv.status === "attending")
        ).length
      }));

      // Sort by count (ascending) and pick the advisor with fewest chats
      advisorChatCounts.sort((a, b) => a.count - b.count);
      const leastBusyAdvisor = advisorChatCounts[0].advisorId;

      try {
        await crmDb.assignConversation(chat.id, leastBusyAdvisor);
        console.log(`[QueueRedistribution] ✅ Assigned chat ${chat.id} to ${leastBusyAdvisor} (least busy with ${advisorChatCounts[0].count} chats)`);
        redistributed++;
      } catch (error) {
        console.error(`[QueueRedistribution] ❌ Failed to assign chat ${chat.id}:`, error);
      }
    }

    console.log(`[QueueRedistribution] ✅ Least-busy: Redistributed ${redistributed}/${chats.length} chats in queue "${queueName}"`);
  }

  /**
   * Emit presence update via WebSocket
   * This is called after presence changes to notify all connected clients
   */
  private async emitPresenceUpdate(userId: string): Promise<void> {
    try {
      // Import getCrmGateway lazily to avoid circular dependency (using ES dynamic import)
      const { getCrmGateway, buildPresencePayload } = await import("./ws");
      const gateway = getCrmGateway();

      if (gateway) {
        // Build and emit presence payload asynchronously
        const payload = await buildPresencePayload(userId);
        if (payload) {
          gateway.emitAdvisorPresenceUpdate(payload);
          console.log(`[AdvisorPresence] 📡 Emitted presence update for ${userId}`);
        }
      } else {
        console.warn(`[AdvisorPresence] ⚠️ Cannot emit presence update - WebSocket gateway not available`);
      }
    } catch (error: any) {
      console.error(`[AdvisorPresence] ❌ Error emitting presence update for ${userId}:`, error);
    }
  }
}

// Singleton instance
export const advisorPresence = new AdvisorPresenceTracker();
