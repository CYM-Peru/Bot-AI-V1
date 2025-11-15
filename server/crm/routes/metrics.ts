import { Router } from "express";
import { metricsTrackerDB as metricsTracker } from "../metrics-tracker-db";
import { adminDb } from "../../admin-db";
import { getTemplateUsageStats } from "../template-usage-tracker";
import { getKeywordUsageStats } from "../keyword-usage-tracker";
import { getRagUsageStats } from "../rag-usage-tracker";
import { getCampaignStats } from "../campaign-tracker";

export function createMetricsRouter() {
  const router = Router();

  /**
   * GET /metrics/advisor/:advisorId
   * Get metrics for a specific advisor with optional date filters
   */
  router.get("/advisor/:advisorId", async (req, res) => {
    try {
      const { advisorId } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const metrics = metricsTracker.getAdvisorMetrics(advisorId, start, end);
      const kpis = await metricsTracker.calculateKPIs(advisorId, start, end);

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
  router.get("/kpis", async (req, res) => {
    try {
      const { startDate, endDate, advisorId } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;
      const advisor = advisorId as string | undefined;

      // If no advisorId specified, use current user's userId
      const targetAdvisor = advisor || req.user?.userId || "unknown";

      const kpis = await metricsTracker.calculateKPIs(targetAdvisor, start, end);

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
  router.get("/all", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const metrics = await metricsTracker.getAllMetrics(start, end);

      // Group by advisor
      const advisorIds = [...new Set(metrics.map(m => m.advisorId))];

      // Calculate KPIs for all advisors in parallel
      const advisorKPIs = await Promise.all(
        advisorIds.map(async (advisorId) => {
          const kpis = await metricsTracker.calculateKPIs(advisorId, start, end);
          const conversations = metrics.filter(m => m.advisorId === advisorId).length;
          return {
            advisorId,
            conversations,
            kpis,
          };
        })
      );

      res.json({
        total: metrics.length,
        advisors: advisorKPIs,
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
  router.get("/dashboard", async (req, res) => {
    try {
      const { days = "7" } = req.query;
      const daysNum = parseInt(days as string, 10);

      // Get all metrics for the period
      const startDate = Date.now() - daysNum * 24 * 60 * 60 * 1000;
      const allMetrics = await metricsTracker.getAllMetrics(startDate);

      // Group by advisor and calculate KPIs
      const advisorIds = [...new Set(allMetrics.map(m => m.advisorId))];
      const advisorKPIs = await Promise.all(
        advisorIds.map(async (advisorId) => {
          const kpis = await metricsTracker.calculateKPIs(advisorId, startDate);
          return { advisorId, ...kpis };
        })
      );

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

      if (advisorKPIs.length > 0) {
        overallKPIs.avgFirstResponseTime = advisorKPIs.reduce((sum, a) => sum + a.avgFirstResponseTime, 0) / advisorKPIs.length;
        overallKPIs.avgResolutionTime = advisorKPIs.reduce((sum, a) => sum + a.avgResolutionTime, 0) / advisorKPIs.length;
        const scoresWithValues = advisorKPIs.filter(a => a.avgSatisfactionScore > 0);
        overallKPIs.avgSatisfactionScore = scoresWithValues.length > 0
          ? scoresWithValues.reduce((sum, a) => sum + a.avgSatisfactionScore, 0) / scoresWithValues.length
          : 0;
        overallKPIs.totalMessages = advisorKPIs.reduce((sum, a) => sum + a.totalMessages, 0);
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
        advisors: advisorKPIs,
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
  router.get("/advisors/ranking", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      // Get all metrics
      const allMetrics = await metricsTracker.getAllMetrics(start, end);

      // Get all users first to avoid multiple DB calls
      const allUsers = await adminDb.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      // Group by advisor and calculate KPIs
      const advisorIds = [...new Set(allMetrics.map(m => m.advisorId))];
      const advisorData = await Promise.all(
        advisorIds.map(async (advisorId) => {
          const kpis = await metricsTracker.calculateKPIs(advisorId, start, end);
          const user = userMap.get(advisorId);

          return {
            advisorId,
            advisorName: user?.name || user?.username || advisorId,
            advisorEmail: user?.email || null,
            advisorRole: user?.role || null,
            ...kpis,
          };
        })
      );

      // Sort by total conversations (descending) and add rank
      const ranking = advisorData
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

  /**
   * GET /metrics/template-usage
   * Get template usage statistics with cost tracking
   * Query params:
   *   - startDate: ISO date string for start of period
   *   - endDate: ISO date string for end of period
   *   - advisorId: Filter by specific advisor
   *   - status: Filter by status ('sent' or 'failed')
   *   - limit: Number of records to return (default 100)
   *   - offset: Number of records to skip (default 0)
   */
  router.get("/template-usage", async (req, res) => {
    try {
      const { startDate, endDate, advisorId, status, limit, offset } = req.query;

      const filters: any = {};

      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }

      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate);
      }

      if (advisorId && typeof advisorId === 'string') {
        filters.advisorId = advisorId;
      }

      if (status && typeof status === 'string') {
        filters.status = status;
      }

      if (limit && typeof limit === 'string') {
        filters.limit = parseInt(limit, 10);
      }

      if (offset && typeof offset === 'string') {
        filters.offset = parseInt(offset, 10);
      }

      const result = await getTemplateUsageStats(filters);

      res.json(result);
    } catch (error) {
      console.error("[Metrics] Error fetching template usage:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/keyword-usage
   * Get keyword usage statistics
   * Query params:
   *   - startDate: ISO date string for start of period
   *   - endDate: ISO date string for end of period
   *   - flowId: Filter by specific flow
   *   - keywordGroupId: Filter by specific keyword group
   *   - limit: Number of records to return (default 100)
   *   - offset: Number of records to skip (default 0)
   */
  router.get("/keyword-usage", async (req, res) => {
    try {
      const { startDate, endDate, flowId, keywordGroupId, limit, offset } = req.query;

      const filters: any = {};

      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }

      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate);
      }

      if (flowId && typeof flowId === 'string') {
        filters.flowId = flowId;
      }

      if (keywordGroupId && typeof keywordGroupId === 'string') {
        filters.keywordGroupId = keywordGroupId;
      }

      if (limit && typeof limit === 'string') {
        filters.limit = parseInt(limit, 10);
      }

      if (offset && typeof offset === 'string') {
        filters.offset = parseInt(offset, 10);
      }

      const result = await getKeywordUsageStats(filters);

      res.json(result);
    } catch (error) {
      console.error("[Metrics] Error fetching keyword usage:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/rag-usage
   * Get RAG (Retrieval-Augmented Generation) usage statistics with cost tracking
   * Query params:
   *   - startDate: ISO date string for start of period
   *   - endDate: ISO date string for end of period
   *   - advisorId: Filter by specific advisor
   *   - category: Filter by category
   *   - found: Filter by whether results were found (true/false)
   *   - limit: Number of records to return (default 100)
   *   - offset: Number of records to skip (default 0)
   */
  router.get("/rag-usage", async (req, res) => {
    try {
      const { startDate, endDate, advisorId, category, found, limit, offset } = req.query;

      const filters: any = {};

      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }

      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate);
      }

      if (advisorId && typeof advisorId === 'string') {
        filters.advisorId = advisorId;
      }

      if (category && typeof category === 'string') {
        filters.category = category;
      }

      if (found && typeof found === 'string') {
        filters.found = found === 'true';
      }

      if (limit && typeof limit === 'string') {
        filters.limit = parseInt(limit, 10);
      }

      if (offset && typeof offset === 'string') {
        filters.offset = parseInt(offset, 10);
      }

      const result = await getRagUsageStats(filters);

      res.json(result);
    } catch (error) {
      console.error("[Metrics] Error fetching RAG usage:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/campaign-tracking
   * Get campaign tracking statistics
   * Query params:
   *   - startDate: ISO date string for start of period
   *   - endDate: ISO date string for end of period
   *   - campaignSource: Filter by campaign source
   *   - campaignName: Filter by campaign name
   *   - keyword: Filter by detected keyword
   *   - limit: Number of records to return (default 100)
   *   - offset: Number of records to skip (default 0)
   */
  router.get("/campaign-tracking", async (req, res) => {
    try {
      const { startDate, endDate, campaignSource, campaignName, keyword, limit, offset } = req.query;

      const filters: any = {};

      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }

      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate);
      }

      if (campaignSource && typeof campaignSource === 'string') {
        filters.campaignSource = campaignSource;
      }

      if (campaignName && typeof campaignName === 'string') {
        filters.campaignName = campaignName;
      }

      if (keyword && typeof keyword === 'string') {
        filters.keyword = keyword;
      }

      if (limit && typeof limit === 'string') {
        filters.limit = parseInt(limit, 10);
      }

      if (offset && typeof offset === 'string') {
        filters.offset = parseInt(offset, 10);
      }

      const result = await getCampaignStats(filters);

      res.json(result);
    } catch (error) {
      console.error("[Metrics] Error fetching campaign tracking:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/response-time-by-hour
   * Get average response time by hour of day
   */
  router.get("/response-time-by-hour", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const data = await metricsTracker.getResponseTimeByHour(start, end);
      res.json({ data });
    } catch (error) {
      console.error("[Metrics] Error fetching response time by hour:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/channel-distribution
   * Get distribution of conversations by channel
   */
  router.get("/channel-distribution", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const data = await metricsTracker.getChannelDistribution(start, end);
      res.json({ data });
    } catch (error) {
      console.error("[Metrics] Error fetching channel distribution:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/advisor-workload
   * Get current workload by advisor
   */
  router.get("/advisor-workload", async (req, res) => {
    try {
      const workload = await metricsTracker.getAdvisorWorkload();

      // Get user names
      const allUsers = await adminDb.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const enrichedWorkload = workload.map(w => ({
        ...w,
        advisorName: userMap.get(w.advisorId)?.name || w.advisorId,
      }));

      res.json({ data: enrichedWorkload });
    } catch (error) {
      console.error("[Metrics] Error fetching advisor workload:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/completion-rates
   * Get completion, abandonment, and transfer rates
   */
  router.get("/completion-rates", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const data = await metricsTracker.getCompletionRates(start, end);
      res.json(data);
    } catch (error) {
      console.error("[Metrics] Error fetching completion rates:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /metrics/peak-hours
   * Get peak hours for conversations
   */
  router.get("/peak-hours", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? parseInt(startDate as string, 10) : undefined;
      const end = endDate ? parseInt(endDate as string, 10) : undefined;

      const data = await metricsTracker.getPeakHours(start, end);
      res.json({ data });
    } catch (error) {
      console.error("[Metrics] Error fetching peak hours:", error);
      res.status(500).json({
        error: "server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
