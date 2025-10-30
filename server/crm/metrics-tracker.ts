import fs from "fs";
import path from "path";

export interface ConversationMetric {
  id: string;
  conversationId: string;
  advisorId: string;
  startedAt: number;
  firstResponseAt: number | null;
  endedAt: number | null;
  messageCount: number;
  responseCount: number;
  satisfactionScore: number | null; // 1-5
  tags: string[];
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

  private loadStore(): MetricsStore {
    if (!fs.existsSync(this.storageFile)) {
      return { metrics: [] };
    }
    try {
      const data = fs.readFileSync(this.storageFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("[MetricsTracker] Error loading metrics:", error);
      return { metrics: [] };
    }
  }

  private saveStore(): void {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(this.store, null, 2), "utf8");
    } catch (error) {
      console.error("[MetricsTracker] Error saving metrics:", error);
    }
  }

  /**
   * Start tracking a conversation when advisor accepts it
   */
  startConversation(conversationId: string, advisorId: string): void {
    const existing = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);

    if (existing) {
      console.log(`[MetricsTracker] Conversation ${conversationId} already being tracked`);
      return;
    }

    const metric: ConversationMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      advisorId,
      startedAt: Date.now(),
      firstResponseAt: null,
      endedAt: null,
      messageCount: 0,
      responseCount: 0,
      satisfactionScore: null,
      tags: [],
    };

    this.store.metrics.push(metric);
    this.saveStore();
    console.log(`[MetricsTracker] Started tracking conversation ${conversationId} for advisor ${advisorId}`);
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
  endConversation(conversationId: string): void {
    const metric = this.store.metrics.find((m) => m.conversationId === conversationId && !m.endedAt);
    if (!metric) return;

    metric.endedAt = Date.now();
    this.saveStore();
    console.log(`[MetricsTracker] Ended tracking conversation ${conversationId}`);
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
    avgFirstResponseTime: number; // milliseconds
    avgResolutionTime: number; // milliseconds
    avgSatisfactionScore: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
  } {
    const metrics = this.getAdvisorMetrics(advisorId, startDate, endDate);
    const completedMetrics = metrics.filter((m) => m.endedAt);

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

    // Satisfaction Score
    const satisfactionScores = metrics.filter((m) => m.satisfactionScore !== null).map((m) => m.satisfactionScore!);
    const avgSatisfactionScore =
      satisfactionScores.length > 0 ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length : 0;

    // Message stats
    const totalMessages = metrics.reduce((sum, m) => sum + m.messageCount, 0);
    const avgMessagesPerConversation = metrics.length > 0 ? totalMessages / metrics.length : 0;

    return {
      totalConversations: metrics.length,
      avgFirstResponseTime,
      avgResolutionTime,
      avgSatisfactionScore,
      totalMessages,
      avgMessagesPerConversation,
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
}

export const metricsTracker = new MetricsTracker();
