import fs from "fs";
import path from "path";

export interface ConversationMetric {
  id: string;
  conversationId: string;
  advisorId: string;
  queueId: string | null; // Cola de atención
  channelType: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'webchat' | 'other'; // Canal de atención
  channelId: string | null; // ID específico del canal (ej: número de WhatsApp)
  startedAt: number;
  firstResponseAt: number | null;
  endedAt: number | null;
  messageCount: number;
  responseCount: number;
  satisfactionScore: number | null; // 1-5
  tags: string[];
  // New fields for enhanced tracking
  status: 'received' | 'active' | 'transferred_out' | 'transferred_in' | 'rejected' | 'completed' | 'abandoned';
  transferredTo: string | null; // advisorId si fue transferido
  transferredFrom: string | null; // advisorId de quien transfirió (para transfer_in)
  transferredAt: number | null;
  rejectedReason: string | null;
  sessionDuration: number | null; // milliseconds (endedAt - startedAt)
  averageResponseTime: number | null; // promedio de tiempo de respuesta por mensaje
}

interface MetricsStore {
  metrics: ConversationMetric[];
}

export class MetricsTracker {
  private readonly storageFile: string;
  private store: MetricsStore;

  constructor(dataDir: string = "./data") {
    this.storageFile = path.join(dataDir, "conversation-metrics.json");
    this.ensureDir(dataDir);
    this.store = this.loadStore();
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Recover metrics from the most recent backup file
   */
  private recoverFromBackup(): MetricsStore {
    try {
      const dir = path.dirname(this.storageFile);
      const files = fs.readdirSync(dir);

      // Find all backup files (both manual and auto)
      const backupFiles = files
        .filter(f => f.includes("conversation-metrics") && (f.includes("backup") || f.includes("auto_backup")))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          mtime: fs.statSync(path.join(dir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime); // Most recent first

      if (backupFiles.length > 0) {
        console.log(`[MetricsTracker] 🔄 Recovering from backup: ${backupFiles[0].name}`);
        const data = fs.readFileSync(backupFiles[0].path, "utf8");
        const parsed = JSON.parse(data);
        console.log(`[MetricsTracker] ✅ Recovered ${parsed.metrics?.length || 0} metrics from backup`);
        return parsed;
      }
    } catch (error) {
      console.error("[MetricsTracker] Failed to recover from backup:", error);
    }

    // Last resort: return empty
    console.warn("[MetricsTracker] ⚠️ No backup available, starting with empty metrics");
    return { metrics: [] };
  }

  /**
   * Clean old auto backup files, keep only last 3
   */
  private cleanOldBackups(): void {
    try {
      const dir = path.dirname(this.storageFile);
      const files = fs.readdirSync(dir);

      const autoBackups = files
        .filter(f => f.includes("conversation-metrics") && f.includes("auto_backup"))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          mtime: fs.statSync(path.join(dir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime); // Most recent first

      // Delete backups beyond the 3 most recent
      if (autoBackups.length > 3) {
        for (let i = 3; i < autoBackups.length; i++) {
          fs.unlinkSync(autoBackups[i].path);
          console.log(`[MetricsTracker] 🗑️ Cleaned old backup: ${autoBackups[i].name}`);
        }
      }
    } catch (error) {
      // Ignore errors in cleanup
    }
  }

  private loadStore(): MetricsStore {
    if (!fs.existsSync(this.storageFile)) {
      console.log("[MetricsTracker] No existing metrics file, starting fresh");
      return { metrics: [] };
    }
    try {
      const data = fs.readFileSync(this.storageFile, "utf8");
      const parsed = JSON.parse(data);

      // ⚠️ CRITICAL: Never return empty if file exists and has data
      if (parsed.metrics && Array.isArray(parsed.metrics)) {
        console.log(`[MetricsTracker] ✅ Loaded ${parsed.metrics.length} metrics from storage`);
        return parsed;
      }

      // If metrics is invalid, try to recover from backup
      console.error("[MetricsTracker] ⚠️ Invalid metrics format, attempting recovery from backup...");
      return this.recoverFromBackup();
    } catch (error) {
      console.error("[MetricsTracker] ❌ Error loading metrics:", error);
      // NEVER return empty - try to recover from backup instead
      return this.recoverFromBackup();
    }
  }

  private saveStore(): void {
    try {
      // ⚠️ CRITICAL PROTECTION: Never save empty metrics if file has data
      if (this.store.metrics.length === 0 && fs.existsSync(this.storageFile)) {
        try {
          const currentData = fs.readFileSync(this.storageFile, "utf8");
          const currentStore = JSON.parse(currentData);
          if (currentStore.metrics && currentStore.metrics.length > 0) {
            console.error(`[MetricsTracker] ⚠️ BLOCKED: Attempted to overwrite ${currentStore.metrics.length} metrics with empty data!`);
            console.error("[MetricsTracker] 🛡️ Protection activated - metrics preserved");
            return; // DO NOT SAVE
          }
        } catch (e) {
          // If we can't read current file, proceed with save
        }
      }

      // Create automatic backup before saving (only if file exists and has data)
      if (fs.existsSync(this.storageFile)) {
        try {
          const backupPath = this.storageFile.replace(".json", `.auto_backup_${Date.now()}.json`);
          fs.copyFileSync(this.storageFile, backupPath);

          // Keep only last 3 auto backups to avoid filling disk
          this.cleanOldBackups();
        } catch (e) {
          console.warn("[MetricsTracker] Could not create backup:", e);
        }
      }

      fs.writeFileSync(this.storageFile, JSON.stringify(this.store, null, 2), "utf8");
    } catch (error) {
      console.error("[MetricsTracker] Error saving metrics:", error);
    }
  }

  /**
   * Start tracking a conversation when advisor accepts it
   */
  startConversation(
    conversationId: string,
    advisorId: string,
    options?: {
      queueId?: string;
      channelType?: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'webchat' | 'other';
      channelId?: string;
    }
  ): void {
    const existing = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);

    if (existing) {
      console.log(`[MetricsTracker] Conversation ${conversationId} already being tracked`);
      return;
    }

    const metric: ConversationMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      advisorId,
      queueId: options?.queueId || null,
      channelType: options?.channelType || 'other',
      channelId: options?.channelId || null,
      startedAt: Date.now(),
      firstResponseAt: null,
      endedAt: null,
      messageCount: 0,
      responseCount: 0,
      satisfactionScore: null,
      tags: [],
      status: 'received',
      transferredTo: null,
      transferredFrom: null,
      transferredAt: null,
      rejectedReason: null,
      sessionDuration: null,
      averageResponseTime: null,
    };

    this.store.metrics.push(metric);
    this.saveStore();
    console.log(`[MetricsTracker] Started tracking conversation ${conversationId} for advisor ${advisorId}${options?.queueId ? ` in queue ${options.queueId}` : ''}${options?.channelType ? ` via ${options.channelType}` : ''}`);
  }

  /**
   * Record when advisor sends first response
   */
  recordFirstResponse(conversationId: string): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!metric || metric.firstResponseAt) return;

    metric.firstResponseAt = Date.now();
    this.saveStore();
  }

  /**
   * Increment message counters
   */
  recordMessage(conversationId: string, isAdvisorMessage: boolean): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!metric) return;

    metric.messageCount++;
    if (isAdvisorMessage) {
      metric.responseCount++;
      // Record first response time
      if (!metric.firstResponseAt) {
        metric.firstResponseAt = Date.now();
      }
    }
    this.saveStore();
  }

  /**
   * End conversation tracking (archive/close)
   */
  endConversation(conversationId: string, finalStatus?: 'completed' | 'abandoned'): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!metric) return;

    metric.endedAt = Date.now();
    metric.sessionDuration = metric.endedAt - metric.startedAt;

    // Calculate average response time if there were responses
    if (metric.firstResponseAt && metric.responseCount > 0) {
      metric.averageResponseTime = (metric.endedAt - metric.firstResponseAt) / metric.responseCount;
    }

    // Update status if not already transferred or rejected
    if (metric.status !== 'transferred_out' && metric.status !== 'transferred_in' && metric.status !== 'rejected') {
      metric.status = finalStatus || 'completed';
    }

    this.saveStore();
    console.log(`[MetricsTracker] Ended tracking conversation ${conversationId} - Status: ${metric.status}`);
  }

  /**
   * Record satisfaction score (1-5)
   */
  recordSatisfaction(conversationId: string, score: number): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId);
    if (!metric) return;

    metric.satisfactionScore = Math.max(1, Math.min(5, score));
    this.saveStore();
  }

  /**
   * Add tags to conversation
   */
  addTags(conversationId: string, tags: string[]): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId);
    if (!metric) return;

    metric.tags = [...new Set([...metric.tags, ...tags])];
    this.saveStore();
  }

  /**
   * Remove tags from conversation
   */
  removeTags(conversationId: string, tagsToRemove: string[]): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId);
    if (!metric) return;

    metric.tags = metric.tags.filter((tag) => !tagsToRemove.includes(tag));
    this.saveStore();
  }

  /**
   * Get tags for a conversation
   */
  getConversationTags(conversationId: string): string[] {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId);
    return metric ? metric.tags : [];
  }

  /**
   * Transfer conversation to another advisor
   * This creates TWO metrics:
   * 1. Closes current metric with 'transferred_out' status (for the advisor who transfers)
   * 2. Creates new metric with 'transferred_in' status (for the advisor who receives)
   */
  transferConversation(conversationId: string, fromAdvisorId: string, toAdvisorId: string, options?: {
    queueId?: string;
    channelType?: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'webchat' | 'other';
    channelId?: string;
  }): void {
    // Find active metric for the conversation
    const currentMetric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!currentMetric) {
      console.warn(`[MetricsTracker] No active metric found for conversation ${conversationId}`);
      return;
    }

    const now = Date.now();

    // 1. Close current metric with 'transferred_out' status (for advisor who transfers)
    currentMetric.status = 'transferred_out';
    currentMetric.transferredTo = toAdvisorId;
    currentMetric.transferredAt = now;
    currentMetric.endedAt = now;
    currentMetric.sessionDuration = now - currentMetric.startedAt;

    // Calculate average response time if there were responses
    if (currentMetric.firstResponseAt && currentMetric.responseCount > 0) {
      currentMetric.averageResponseTime = (now - currentMetric.firstResponseAt) / currentMetric.responseCount;
    }

    console.log(`[MetricsTracker] ⬅️ Transfer OUT: Conversation ${conversationId} transferred from ${fromAdvisorId} to ${toAdvisorId}`);

    // 2. Create new metric for receiving advisor with 'transferred_in' status
    const incomingMetric: ConversationMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      advisorId: toAdvisorId,
      queueId: options?.queueId || currentMetric.queueId,
      channelType: options?.channelType || currentMetric.channelType,
      channelId: options?.channelId || currentMetric.channelId,
      startedAt: now,
      firstResponseAt: null,
      endedAt: null,
      messageCount: 0,
      responseCount: 0,
      satisfactionScore: null,
      tags: [...currentMetric.tags], // Copy tags from previous metric
      status: 'transferred_in',
      transferredTo: null,
      transferredFrom: fromAdvisorId,
      transferredAt: now,
      rejectedReason: null,
      sessionDuration: null,
      averageResponseTime: null,
    };

    this.store.metrics.push(incomingMetric);
    console.log(`[MetricsTracker] ➡️ Transfer IN: Conversation ${conversationId} received by ${toAdvisorId} from ${fromAdvisorId}`);

    this.saveStore();
  }

  /**
   * Reject conversation (advisor declines to accept)
   */
  rejectConversation(conversationId: string, advisorId: string, reason?: string): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!metric) return;

    metric.status = 'rejected';
    metric.rejectedReason = reason || 'No reason provided';
    metric.endedAt = Date.now();
    metric.sessionDuration = metric.endedAt - metric.startedAt;
    this.saveStore();
    console.log(`[MetricsTracker] Conversation ${conversationId} rejected by ${advisorId}: ${metric.rejectedReason}`);
  }

  /**
   * Mark conversation as active (advisor is actively responding)
   */
  markConversationActive(conversationId: string): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!metric) return;

    if (metric.status === 'received') {
      metric.status = 'active';
      this.saveStore();
    }
  }

  /**
   * Get metrics for an advisor with date filters
   */
  getAdvisorMetrics(advisorId: string, startDate?: number, endDate?: number): ConversationMetric[] {
    let metrics = this.store.metrics.filter((m) => m.advisorId === advisorId);

    if (startDate) {
      metrics = metrics.filter((m) => m.startedAt >= startDate);
    }

    if (endDate) {
      metrics = metrics.filter((m) => m.startedAt <= endDate);
    }

    return metrics;
  }

  /**
   * Get all metrics with filters
   */
  getAllMetrics(startDate?: number, endDate?: number): ConversationMetric[] {
    let metrics = [...this.store.metrics];

    if (startDate) {
      metrics = metrics.filter((m) => m.startedAt >= startDate);
    }

    if (endDate) {
      metrics = metrics.filter((m) => m.startedAt <= endDate);
    }

    return metrics;
  }

  /**
   * Calculate KPIs for an advisor
   */
  calculateKPIs(advisorId: string, startDate?: number, endDate?: number): {
    totalConversations: number;
    received: number;
    active: number;
    transferred_out: number;
    transferred_in: number;
    rejected: number;
    completed: number;
    abandoned: number;
    avgFirstResponseTime: number; // milliseconds
    avgResolutionTime: number; // milliseconds
    avgSessionDuration: number; // milliseconds
    avgSatisfactionScore: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
    satisfactionDistribution: { score: number; count: number }[];
    channelDistribution: { channel: string; count: number }[];
  } {
    const metrics = this.getAdvisorMetrics(advisorId, startDate, endDate);
    const completedMetrics = metrics.filter((m) => m.endedAt);

    // Count by status
    const statusCounts = {
      received: metrics.filter((m) => m.status === 'received').length,
      active: metrics.filter((m) => m.status === 'active').length,
      transferred_out: metrics.filter((m) => m.status === 'transferred_out').length,
      transferred_in: metrics.filter((m) => m.status === 'transferred_in').length,
      rejected: metrics.filter((m) => m.status === 'rejected').length,
      completed: metrics.filter((m) => m.status === 'completed').length,
      abandoned: metrics.filter((m) => m.status === 'abandoned').length,
    };

    // First Response Time (FRT)
    const firstResponseTimes = metrics
      .filter((m) => m.firstResponseAt)
      .map((m) => m.firstResponseAt! - m.startedAt);
    const avgFirstResponseTime =
      firstResponseTimes.length > 0
        ? firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length
        : 0;

    // Resolution Time
    const resolutionTimes = completedMetrics.map((m) => m.endedAt! - m.startedAt);
    const avgResolutionTime =
      resolutionTimes.length > 0 ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

    // Session Duration
    const sessionDurations = metrics.filter((m) => m.sessionDuration !== null).map((m) => m.sessionDuration!);
    const avgSessionDuration =
      sessionDurations.length > 0 ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length : 0;

    // Satisfaction Score
    const satisfactionScores = metrics.filter((m) => m.satisfactionScore !== null).map((m) => m.satisfactionScore!);
    const avgSatisfactionScore =
      satisfactionScores.length > 0 ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length : 0;

    // Satisfaction distribution
    const satisfactionDistribution = [1, 2, 3, 4, 5].map(score => ({
      score,
      count: metrics.filter(m => m.satisfactionScore === score).length,
    }));

    // Channel distribution
    const channelCounts = new Map<string, number>();
    metrics.forEach(m => {
      const count = channelCounts.get(m.channelType) || 0;
      channelCounts.set(m.channelType, count + 1);
    });
    const channelDistribution = Array.from(channelCounts.entries()).map(([channel, count]) => ({
      channel,
      count,
    }));

    // Message stats
    const totalMessages = metrics.reduce((sum, m) => sum + m.messageCount, 0);
    const avgMessagesPerConversation = metrics.length > 0 ? totalMessages / metrics.length : 0;

    return {
      totalConversations: metrics.length,
      received: statusCounts.received,
      active: statusCounts.active,
      transferred_out: statusCounts.transferred_out,
      transferred_in: statusCounts.transferred_in,
      rejected: statusCounts.rejected,
      completed: statusCounts.completed,
      abandoned: statusCounts.abandoned,
      avgFirstResponseTime,
      avgResolutionTime,
      avgSessionDuration,
      avgSatisfactionScore,
      totalMessages,
      avgMessagesPerConversation,
      satisfactionDistribution,
      channelDistribution,
    };
  }

  /**
   * Get conversation trend data for charts (grouped by day)
   */
  getConversationTrend(advisorId?: string, days: number = 7): Array<{ date: string; count: number }> {
    const now = Date.now();
    const startDate = now - days * 24 * 60 * 60 * 1000;

    let metrics = this.getAllMetrics(startDate);
    if (advisorId) {
      metrics = metrics.filter((m) => m.advisorId === advisorId);
    }

    // Group by date
    const grouped = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      grouped.set(dateStr, 0);
    }

    metrics.forEach((m) => {
      const date = new Date(m.startedAt).toISOString().split("T")[0];
      grouped.set(date, (grouped.get(date) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get queue statistics
   */
  getQueueStats(startDate?: number, endDate?: number): Array<{
    queueId: string | null;
    totalConversations: number;
    received: number;
    active: number;
    transferred_out: number;
    transferred_in: number;
    rejected: number;
    completed: number;
    abandoned: number;
    avgWaitTime: number; // time until first response
    avgHandleTime: number; // session duration
  }> {
    let metrics = this.getAllMetrics(startDate, endDate);

    // Group by queue
    const queueMap = new Map<string | null, ConversationMetric[]>();
    metrics.forEach((m) => {
      const existing = queueMap.get(m.queueId) || [];
      existing.push(m);
      queueMap.set(m.queueId, existing);
    });

    return Array.from(queueMap.entries()).map(([queueId, queueMetrics]) => {
      const statusCounts = {
        received: queueMetrics.filter((m) => m.status === 'received').length,
        active: queueMetrics.filter((m) => m.status === 'active').length,
        transferred_out: queueMetrics.filter((m) => m.status === 'transferred_out').length,
        transferred_in: queueMetrics.filter((m) => m.status === 'transferred_in').length,
        rejected: queueMetrics.filter((m) => m.status === 'rejected').length,
        completed: queueMetrics.filter((m) => m.status === 'completed').length,
        abandoned: queueMetrics.filter((m) => m.status === 'abandoned').length,
      };

      // Avg wait time (time until first response)
      const waitTimes = queueMetrics
        .filter((m) => m.firstResponseAt)
        .map((m) => m.firstResponseAt! - m.startedAt);
      const avgWaitTime = waitTimes.length > 0
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 0;

      // Avg handle time (session duration)
      const handleTimes = queueMetrics
        .filter((m) => m.sessionDuration !== null)
        .map((m) => m.sessionDuration!);
      const avgHandleTime = handleTimes.length > 0
        ? handleTimes.reduce((a, b) => a + b, 0) / handleTimes.length
        : 0;

      return {
        queueId,
        totalConversations: queueMetrics.length,
        ...statusCounts,
        avgWaitTime,
        avgHandleTime,
      };
    });
  }

  /**
   * Reset ALL metrics (ADMIN ONLY - destructive operation)
   * Creates a backup before reset
   */
  resetAllMetrics(): void {
    try {
      // Create backup before reset
      const backupPath = this.storageFile.replace(".json", `.backup_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(this.store, null, 2), "utf8");
      console.log(`[MetricsTracker] Backup created: ${backupPath}`);

      // Reset store
      this.store = { metrics: [] };
      this.saveStore();

      console.log("[MetricsTracker] ⚠️  ALL METRICS RESET - backup saved");
    } catch (error) {
      console.error("[MetricsTracker] Error resetting metrics:", error);
      throw error;
    }
  }
}

export const metricsTracker = new MetricsTracker();
