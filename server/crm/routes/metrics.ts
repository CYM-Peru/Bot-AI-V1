import { Router } from "express";
import { metricsTracker } from "../metrics-tracker";

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

      // If no advisorId specified, use current user's email
      const targetAdvisor = advisor || req.user?.email || "unknown";

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

  return router;
}
