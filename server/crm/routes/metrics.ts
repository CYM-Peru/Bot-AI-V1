import { Router } from "express";
import { metricsTracker } from "../metrics-tracker";
import { adminDb } from "../../admin-db";

export function createMetricsRouter() {
  const router = Router();

  /**
   * GET /metrics/advisor/:advisorId
   * Get metrics for a specific advisor with optional date filters
   */
  router.get("/advisor/:advisorId", (req, res) => {
    try {
      const { advisorId } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const metrics = metricsTracker.getAdvisorMetrics(advisorId, start, end);
      const kpis = metricsTracker.calculateKPIs(advisorId, start, end);

      res.json({ metrics, kpis });
    } catch (error) {
      console.error("[Metrics] Error fetching advisor metrics:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/kpis
   * Get KPIs for current user (advisor) or all advisors (admin)
   */
  router.get("/kpis", (req, res) => {
    try {
      const { startDate, endDate, advisorId } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;
      const advisor = advisorId as string | undefined;

      // If no advisorId specified, use current user's userId
      const targetAdvisor = advisor || req.user?.userId || "unknown";

      const kpis = metricsTracker.calculateKPIs(targetAdvisor, start, end);

      res.json({ kpis, advisorId: targetAdvisor });
    } catch (error) {
      console.error("[Metrics] Error calculating KPIs:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/trend
   * Get conversation trend data for charts
   */
  router.get("/trend", (req, res) => {
    try {
      const { days = "7", advisorId } = req.query;

      const daysNum = parseInt(days as string, 10);
      const advisor = advisorId as string | undefined;

      const trend = metricsTracker.getConversationTrend(advisor, daysNum);

      res.json({ trend, days: daysNum });
    } catch (error) {
      console.error("[Metrics] Error fetching trend data:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/all
   * Get all metrics with optional filters (admin only)
   */
  router.get("/all", (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const metrics = metricsTracker.getAllMetrics(start, end);

      // Group by advisor
      const byAdvisor = new Map<string, any>();
      metrics.forEach((m) => {
        if (!byAdvisor.has(m.advisorId)) {
          byAdvisor.set(m.advisorId, {
            advisorId: m.advisorId,
            conversations: 0,
            kpis: metricsTracker.calculateKPIs(m.advisorId, start, end),
          });
        }
        byAdvisor.get(m.advisorId)!.conversations++;
      });

      res.json({
        total: metrics.length,
        advisors: Array.from(byAdvisor.values()),
      });
    } catch (error) {
      console.error("[Metrics] Error fetching all metrics:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /metrics/:conversationId/satisfaction
   * Record satisfaction score for a conversation
   */
  router.post("/:conversationId/satisfaction", (req, res) => {
    try {
      const { conversationId } = req.params;
      const { score } = req.body;

      if (typeof score !== "number" || score < 1 || score > 5) {
        res.status(400).json({
          error: "invalid_score",
          message: "Score must be a number between 1 and 5",
        });
        return;
      }

      metricsTracker.recordSatisfaction(conversationId, score);

      res.json({ success: true });
    } catch (error) {
      console.error("[Metrics] Error recording satisfaction:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/:conversationId/tags
   * Get tags for a conversation
   */
  router.get("/:conversationId/tags", (req, res) => {
    try {
      const { conversationId } = req.params;
      const tags = metricsTracker.getConversationTags(conversationId);

      res.json({ tags });
    } catch (error) {
      console.error("[Metrics] Error fetching tags:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /metrics/:conversationId/tags
   * Add tags to a conversation
   */
  router.post("/:conversationId/tags", (req, res) => {
    try {
      const { conversationId } = req.params;
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        res.status(400).json({
          error: "invalid_tags",
          message: "Tags must be an array",
        });
        return;
      }

      metricsTracker.addTags(conversationId, tags);

      res.json({ success: true });
    } catch (error) {
      console.error("[Metrics] Error adding tags:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * DELETE /metrics/:conversationId/tags
   * Remove tags from a conversation
   */
  router.delete("/:conversationId/tags", (req, res) => {
    try {
      const { conversationId } = req.params;
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        res.status(400).json({
          error: "invalid_tags",
          message: "Tags must be an array",
        });
        return;
      }

      metricsTracker.removeTags(conversationId, tags);

      res.json({ success: true });
    } catch (error) {
      console.error("[Metrics] Error removing tags:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /metrics/reset
   * Reset ALL metrics data (ADMIN ONLY - destructive operation)
   */
  router.post("/reset", (req, res) => {
    try {
      // Verify user is admin
      if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
          error: "forbidden",
          message: "Only administrators can reset metrics",
        });
        return;
      }

      const { confirmText } = req.body;

      // Require confirmation text to prevent accidental resets
      if (confirmText !== "RESET_ALL_METRICS") {
        res.status(400).json({
          error: "confirmation_required",
          message: "Please provide confirmText: 'RESET_ALL_METRICS'",
        });
        return;
      }

      metricsTracker.resetAllMetrics();

      console.log(`[Metrics] ⚠️  ALL METRICS RESET by ${req.user.email}`);

      res.json({
        success: true,
        message: "All metrics have been reset",
        resetBy: req.user.email,
        resetAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Metrics] Error resetting metrics:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/dashboard
   * Get comprehensive dashboard data (all KPIs, trends, comparisons)
   */
  router.get("/dashboard", (req, res) => {
    try {
      const { days = "7" } = req.query;
      const daysNum = parseInt(days as string, 10);

      // Get all metrics for the period
      const startDate = Date.now() - daysNum * 24 * 60 * 60 * 1000;
      const allMetrics = metricsTracker.getAllMetrics(startDate);

      // Group by advisor
      const advisorStats = new Map<string, any>();
      allMetrics.forEach((m) => {
        if (!advisorStats.has(m.advisorId)) {
          advisorStats.set(m.advisorId, metricsTracker.calculateKPIs(m.advisorId, startDate));
        }
      });

      // Get trends
      const trend = metricsTracker.getConversationTrend(undefined, daysNum);

      // Overall KPIs (all advisors combined)
      const overallKPIs = {
        totalConversations: allMetrics.length,
        avgFirstResponseTime: 0,
        avgResolutionTime: 0,
        avgSatisfactionScore: 0,
        totalMessages: 0,
        avgMessagesPerConversation: 0,
      };

      const advisorsArray = Array.from(advisorStats.values());
      if (advisorsArray.length > 0) {
        overallKPIs.avgFirstResponseTime = advisorsArray.reduce((sum, a) => sum + a.avgFirstResponseTime, 0) / advisorsArray.length;
        overallKPIs.avgResolutionTime = advisorsArray.reduce((sum, a) => sum + a.avgResolutionTime, 0) / advisorsArray.length;
        const scoresWithValues = advisorsArray.filter(a => a.avgSatisfactionScore > 0);
        overallKPIs.avgSatisfactionScore = scoresWithValues.length > 0
          ? scoresWithValues.reduce((sum, a) => sum + a.avgSatisfactionScore, 0) / scoresWithValues.length
          : 0;
        overallKPIs.totalMessages = advisorsArray.reduce((sum, a) => sum + a.totalMessages, 0);
        overallKPIs.avgMessagesPerConversation = overallKPIs.totalConversations > 0
          ? overallKPIs.totalMessages / overallKPIs.totalConversations
          : 0;
      }

      res.json({
        period: {
          days: daysNum,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date().toISOString(),
        },
        overall: overallKPIs,
        advisors: advisorsArray.map((kpis, index) => ({
          advisorId: Array.from(advisorStats.keys())[index],
          ...kpis,
        })),
        trend,
      });
    } catch (error) {
      console.error("[Metrics] Error fetching dashboard data:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/queues
   * Get queue statistics
   */
  router.get("/queues", (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const queueStats = metricsTracker.getQueueStats(start, end);

      res.json({ queues: queueStats });
    } catch (error) {
      console.error("[Metrics] Error fetching queue stats:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/advisors/ranking
   * Get advisor ranking with names and complete stats
   */
  router.get("/advisors/ranking", (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      // Get all metrics
      const allMetrics = metricsTracker.getAllMetrics(start, end);

      // Group by advisor
      const advisorMap = new Map<string, any>();
      allMetrics.forEach((m) => {
        if (!advisorMap.has(m.advisorId)) {
          const kpis = metricsTracker.calculateKPIs(m.advisorId, start, end);

          // Get advisor info from adminDb
          const user = adminDb.getUserById(m.advisorId);

          advisorMap.set(m.advisorId, {
            advisorId: m.advisorId,
            advisorName: user?.name || user?.username || m.advisorId,
            advisorEmail: user?.email || null,
            advisorRole: user?.role || null,
            ...kpis,
          });
        }
      });

      // Convert to array and sort by total conversations (descending)
      const ranking = Array.from(advisorMap.values())
        .sort((a, b) => b.totalConversations - a.totalConversations)
        .map((advisor, index) => ({
          rank: index + 1,
          ...advisor,
        }));

      res.json({ ranking, total: ranking.length });
    } catch (error) {
      console.error("[Metrics] Error fetching advisor ranking:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
