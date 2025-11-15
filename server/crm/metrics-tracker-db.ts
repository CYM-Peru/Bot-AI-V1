/**
 * MetricsTracker - PostgreSQL Implementation
 * Migrated from JSON file storage to PostgreSQL for better performance,
 * consistency, and scalability.
 */

import pg from 'pg';

const { Pool } = pg;

export interface ConversationMetric {
  id: string;
  conversationId: string;
  advisorId: string;
  queueId: string | null;
  channelType: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'webchat' | 'other';
  channelId: string | null;
  startedAt: number;
  firstResponseAt: number | null;
  endedAt: number | null;
  messageCount: number;
  responseCount: number;
  satisfactionScore: number | null;
  tags: string[];
  status: 'received' | 'active' | 'transferred_out' | 'transferred_in' | 'rejected' | 'completed' | 'abandoned';
  transferredTo: string | null;
  transferredFrom: string | null;
  transferredAt: number | null;
  rejectedReason?: string | null;
  sessionDuration: number | null;
  averageResponseTime: number | null;
}

export class MetricsTrackerDB {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'flowbuilder_crm',
      user: process.env.POSTGRES_USER || 'whatsapp_user',
      password: process.env.POSTGRES_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Start tracking a new conversation
   */
  async startConversation(
    id: string,
    conversationId: string,
    advisorId: string,
    options?: {
      queueId?: string | null;
      channelType?: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'webchat' | 'other';
      channelId?: string | null;
      status?: 'received' | 'active' | 'transferred_in';
      transferredFrom?: string | null;
    }
  ): Promise<void> {
    const status = options?.status || 'active';
    const startedAt = Date.now();

    await this.pool.query(
      `INSERT INTO conversation_metrics (
        id, conversation_id, advisor_id, queue_id, channel_type, channel_id,
        started_at, status, transferred_from, message_count, response_count, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, '[]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        id,
        conversationId,
        advisorId,
        options?.queueId || null,
        options?.channelType || 'other',
        options?.channelId || null,
        startedAt,
        status,
        options?.transferredFrom || null,
      ]
    );
  }

  /**
   * Record the first response time
   */
  async recordFirstResponse(conversationId: string): Promise<void> {
    const firstResponseAt = Date.now();

    await this.pool.query(
      `UPDATE conversation_metrics
       SET first_response_at = $1, updated_at = NOW()
       WHERE conversation_id = $2 AND first_response_at IS NULL`,
      [firstResponseAt, conversationId]
    );
  }

  /**
   * Record a message
   */
  async recordMessage(conversationId: string, isAdvisorMessage: boolean): Promise<void> {
    if (isAdvisorMessage) {
      await this.pool.query(
        `UPDATE conversation_metrics
         SET response_count = response_count + 1, updated_at = NOW()
         WHERE conversation_id = $1`,
        [conversationId]
      );
    } else {
      await this.pool.query(
        `UPDATE conversation_metrics
         SET message_count = message_count + 1, updated_at = NOW()
         WHERE conversation_id = $1`,
        [conversationId]
      );
    }
  }

  /**
   * End a conversation and calculate final metrics
   */
  async endConversation(conversationId: string, finalStatus?: 'completed' | 'abandoned'): Promise<void> {
    const endedAt = Date.now();
    const status = finalStatus || 'completed';

    // Calculate session duration and average response time
    const result = await this.pool.query(
      `SELECT started_at, message_count, response_count
       FROM conversation_metrics
       WHERE conversation_id = $1`,
      [conversationId]
    );

    if (result.rows.length > 0) {
      const { started_at, message_count, response_count } = result.rows[0];
      const sessionDuration = endedAt - started_at;
      const averageResponseTime = response_count > 0 ? Math.round(sessionDuration / response_count) : null;

      await this.pool.query(
        `UPDATE conversation_metrics
         SET ended_at = $1, status = $2, session_duration = $3, average_response_time = $4, updated_at = NOW()
         WHERE conversation_id = $5`,
        [endedAt, status, sessionDuration, averageResponseTime, conversationId]
      );
    }
  }

  /**
   * Record satisfaction score
   */
  async recordSatisfaction(conversationId: string, score: number): Promise<void> {
    await this.pool.query(
      `UPDATE conversation_metrics
       SET satisfaction_score = $1, updated_at = NOW()
       WHERE conversation_id = $2`,
      [score, conversationId]
    );
  }

  /**
   * Add tags to a conversation
   */
  async addTags(conversationId: string, tags: string[]): Promise<void> {
    await this.pool.query(
      `UPDATE conversation_metrics
       SET tags = (
         SELECT jsonb_agg(DISTINCT tag)
         FROM (
           SELECT jsonb_array_elements_text(tags) as tag
           UNION
           SELECT unnest($1::text[]) as tag
         ) t
       ), updated_at = NOW()
       WHERE conversation_id = $2`,
      [tags, conversationId]
    );
  }

  /**
   * Remove tags from a conversation
   */
  async removeTags(conversationId: string, tagsToRemove: string[]): Promise<void> {
    await this.pool.query(
      `UPDATE conversation_metrics
       SET tags = (
         SELECT COALESCE(jsonb_agg(tag), '[]'::jsonb)
         FROM jsonb_array_elements_text(tags) as tag
         WHERE tag NOT IN (SELECT unnest($1::text[]))
       ), updated_at = NOW()
       WHERE conversation_id = $2`,
      [tagsToRemove, conversationId]
    );
  }

  /**
   * Get conversation tags
   */
  async getConversationTags(conversationId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT tags FROM conversation_metrics WHERE conversation_id = $1`,
      [conversationId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].tags || [];
    }
    return [];
  }

  /**
   * Transfer conversation to another advisor
   */
  async transferConversation(
    conversationId: string,
    fromAdvisorId: string,
    toAdvisorId: string,
    options?: {
      queueId?: string | null;
      note?: string;
    }
  ): Promise<void> {
    const transferredAt = Date.now();

    // Mark the old metric as transferred_out
    await this.pool.query(
      `UPDATE conversation_metrics
       SET status = 'transferred_out', transferred_to = $1, transferred_at = $2, ended_at = $2, updated_at = NOW()
       WHERE conversation_id = $3 AND advisor_id = $4 AND status NOT IN ('transferred_out', 'completed', 'abandoned')`,
      [toAdvisorId, transferredAt, conversationId, fromAdvisorId]
    );

    // Create new metric for the receiving advisor
    const newId = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get original metric data
    const original = await this.pool.query(
      `SELECT channel_type, channel_id, tags
       FROM conversation_metrics
       WHERE conversation_id = $1 AND advisor_id = $2
       ORDER BY started_at DESC
       LIMIT 1`,
      [conversationId, fromAdvisorId]
    );

    if (original.rows.length > 0) {
      const { channel_type, channel_id, tags } = original.rows[0];

      await this.startConversation(newId, conversationId, toAdvisorId, {
        queueId: options?.queueId || null,
        channelType: channel_type,
        channelId: channel_id,
        status: 'transferred_in',
        transferredFrom: fromAdvisorId,
      });

      // Copy tags if any
      if (tags && Array.isArray(tags) && tags.length > 0) {
        await this.addTags(conversationId, tags);
      }
    }
  }

  /**
   * Reject a conversation
   */
  async rejectConversation(conversationId: string, advisorId: string, reason?: string): Promise<void> {
    await this.pool.query(
      `UPDATE conversation_metrics
       SET status = 'rejected', ended_at = $1, updated_at = NOW()
       WHERE conversation_id = $2 AND advisor_id = $3 AND status NOT IN ('completed', 'abandoned')`,
      [Date.now(), conversationId, advisorId]
    );
  }

  /**
   * Mark conversation as active
   */
  async markConversationActive(conversationId: string): Promise<void> {
    await this.pool.query(
      `UPDATE conversation_metrics
       SET status = 'active', updated_at = NOW()
       WHERE conversation_id = $1 AND status = 'received'`,
      [conversationId]
    );
  }

  /**
   * Get metrics for a specific advisor
   */
  async getAdvisorMetrics(advisorId: string, startDate?: number, endDate?: number): Promise<ConversationMetric[]> {
    let query = 'SELECT * FROM conversation_metrics WHERE advisor_id = $1';
    const params: any[] = [advisorId];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    query += ' ORDER BY started_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRowToMetric);
  }

  /**
   * Get all metrics with optional date filtering
   */
  async getAllMetrics(startDate?: number, endDate?: number): Promise<ConversationMetric[]> {
    let query = `SELECT * FROM conversation_metrics
                 WHERE advisor_id NOT IN ('user-1', 'user-1762290677265')`;
    const params: any[] = [];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    query += ' ORDER BY started_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRowToMetric);
  }

  /**
   * Calculate KPIs for an advisor
   */
  async calculateKPIs(advisorId: string, startDate?: number, endDate?: number): Promise<{
    totalConversations: number;
    received: number;
    active: number;
    transferred_out: number;
    transferred_in: number;
    rejected: number;
    completed: number;
    abandoned: number;
    avgFirstResponseTime: number;
    avgResolutionTime: number;
    avgSessionDuration: number;
    avgSatisfactionScore: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
  }> {
    let query = `
      SELECT
        COUNT(*) as total_conversations,
        COUNT(*) FILTER (WHERE status = 'received') as received,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'transferred_out') as transferred_out,
        COUNT(*) FILTER (WHERE status = 'transferred_in') as transferred_in,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned,
        AVG(first_response_at - started_at) FILTER (WHERE first_response_at IS NOT NULL) as avg_first_response_time,
        AVG(ended_at - started_at) FILTER (WHERE ended_at IS NOT NULL) as avg_resolution_time,
        AVG(session_duration) as avg_session_duration,
        AVG(satisfaction_score) as avg_satisfaction_score,
        SUM(message_count) as total_messages,
        AVG(message_count) as avg_messages_per_conversation
      FROM conversation_metrics
      WHERE advisor_id = $1
    `;

    const params: any[] = [advisorId];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    const result = await this.pool.query(query, params);

    if (result.rows.length === 0) {
      return {
        totalConversations: 0,
        received: 0,
        active: 0,
        transferred_out: 0,
        transferred_in: 0,
        rejected: 0,
        completed: 0,
        abandoned: 0,
        avgFirstResponseTime: 0,
        avgResolutionTime: 0,
        avgSessionDuration: 0,
        avgSatisfactionScore: 0,
        totalMessages: 0,
        avgMessagesPerConversation: 0,
      };
    }

    const row = result.rows[0];
    return {
      totalConversations: parseInt(row.total_conversations) || 0,
      received: parseInt(row.received) || 0,
      active: parseInt(row.active) || 0,
      transferred_out: parseInt(row.transferred_out) || 0,
      transferred_in: parseInt(row.transferred_in) || 0,
      rejected: parseInt(row.rejected) || 0,
      completed: parseInt(row.completed) || 0,
      abandoned: parseInt(row.abandoned) || 0,
      avgFirstResponseTime: Math.round(parseFloat(row.avg_first_response_time) || 0),
      avgResolutionTime: Math.round(parseFloat(row.avg_resolution_time) || 0),
      avgSessionDuration: Math.round(parseFloat(row.avg_session_duration) || 0),
      avgSatisfactionScore: parseFloat(row.avg_satisfaction_score) || 0,
      totalMessages: parseInt(row.total_messages) || 0,
      avgMessagesPerConversation: Math.round(parseFloat(row.avg_messages_per_conversation) || 0),
    };
  }

  /**
   * Get conversation trend over time
   */
  async getConversationTrend(advisorId?: string, days: number = 7): Promise<Array<{ date: string; count: number }>> {
    const startDate = Date.now() - days * 24 * 60 * 60 * 1000;

    let query = `
      SELECT
        TO_CHAR(TO_TIMESTAMP(started_at / 1000), 'YYYY-MM-DD') as date,
        COUNT(*) as count
      FROM conversation_metrics
      WHERE started_at >= $1
        AND advisor_id NOT IN ('user-1', 'user-1762290677265')
    `;

    const params: any[] = [startDate];

    if (advisorId) {
      params.push(advisorId);
      query += ` AND advisor_id = $${params.length}`;
    }

    query += ' GROUP BY date ORDER BY date ASC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count),
    }));
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(startDate?: number, endDate?: number): Promise<Array<{
    queueId: string;
    queueName?: string;
    totalConversations: number;
    completedConversations: number;
    averageSessionDuration: number;
    averageResponseTime: number;
  }>> {
    let query = `
      SELECT
        queue_id,
        COUNT(*) as total_conversations,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_conversations,
        AVG(session_duration) as avg_session_duration,
        AVG(average_response_time) as avg_response_time
      FROM conversation_metrics
      WHERE queue_id IS NOT NULL
    `;

    const params: any[] = [];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    query += ' GROUP BY queue_id ORDER BY total_conversations DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      queueId: row.queue_id,
      totalConversations: parseInt(row.total_conversations),
      completedConversations: parseInt(row.completed_conversations),
      averageSessionDuration: Math.round(parseFloat(row.avg_session_duration) || 0),
      averageResponseTime: Math.round(parseFloat(row.avg_response_time) || 0),
    }));
  }

  /**
   * Map database row to ConversationMetric
   */
  private mapRowToMetric(row: any): ConversationMetric {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      advisorId: row.advisor_id,
      queueId: row.queue_id,
      channelType: row.channel_type,
      channelId: row.channel_id,
      startedAt: parseInt(row.started_at),
      firstResponseAt: row.first_response_at ? parseInt(row.first_response_at) : null,
      endedAt: row.ended_at ? parseInt(row.ended_at) : null,
      messageCount: parseInt(row.message_count) || 0,
      responseCount: parseInt(row.response_count) || 0,
      satisfactionScore: row.satisfaction_score,
      tags: row.tags || [],
      status: row.status,
      transferredTo: row.transferred_to,
      transferredFrom: row.transferred_from,
      transferredAt: row.transferred_at ? parseInt(row.transferred_at) : null,
      sessionDuration: row.session_duration ? parseInt(row.session_duration) : null,
      averageResponseTime: row.average_response_time ? parseInt(row.average_response_time) : null,
    };
  }

  /**
   * Get response time by hour of day (para ver cuándo son más rápidos los asesores)
   */
  async getResponseTimeByHour(startDate?: number, endDate?: number): Promise<Array<{ hour: number; avgResponseTime: number; count: number }>> {
    let query = `
      SELECT
        EXTRACT(HOUR FROM TO_TIMESTAMP(started_at / 1000)) as hour,
        AVG(first_response_at - started_at) as avg_response_time,
        COUNT(*) as count
      FROM conversation_metrics
      WHERE first_response_at IS NOT NULL
        AND advisor_id NOT IN ('user-1', 'user-1762290677265')
    `;

    const params: any[] = [];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    query += ' GROUP BY hour ORDER BY hour ASC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      hour: parseInt(row.hour),
      avgResponseTime: Math.round(parseFloat(row.avg_response_time)),
      count: parseInt(row.count),
    }));
  }

  /**
   * Get channel distribution
   */
  async getChannelDistribution(startDate?: number, endDate?: number): Promise<Array<{ channel: string; count: number }>> {
    let query = `
      SELECT
        channel_type as channel,
        COUNT(*) as count
      FROM conversation_metrics
      WHERE advisor_id NOT IN ('user-1', 'user-1762290677265')
    `;

    const params: any[] = [];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    query += ' GROUP BY channel_type ORDER BY count DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      channel: row.channel || 'other',
      count: parseInt(row.count),
    }));
  }

  /**
   * Get workload by advisor (conversaciones activas + en cola)
   */
  async getAdvisorWorkload(): Promise<Array<{ advisorId: string; advisorName: string; activeConversations: number; totalToday: number }>> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const query = `
      SELECT
        cm.advisor_id,
        COUNT(*) FILTER (WHERE cm.status = 'active') as active_conversations,
        COUNT(*) FILTER (WHERE cm.started_at >= $1) as total_today
      FROM conversation_metrics cm
      WHERE cm.advisor_id NOT IN ('user-1', 'user-1762290677265')
      GROUP BY cm.advisor_id
      ORDER BY active_conversations DESC, total_today DESC
    `;

    const result = await this.pool.query(query, [todayStart.getTime()]);
    return result.rows.map(row => ({
      advisorId: row.advisor_id,
      advisorName: row.advisor_id, // Will be filled by the route
      activeConversations: parseInt(row.active_conversations),
      totalToday: parseInt(row.total_today),
    }));
  }

  /**
   * Get completion and abandonment rates
   */
  async getCompletionRates(startDate?: number, endDate?: number): Promise<{
    completionRate: number;
    abandonmentRate: number;
    transferRate: number;
    avgTimeToClose: number;
  }> {
    let query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned,
        COUNT(*) FILTER (WHERE status = 'transferred_out') as transferred,
        AVG(ended_at - started_at) FILTER (WHERE status = 'completed' AND ended_at IS NOT NULL) as avg_time_to_close
      FROM conversation_metrics
      WHERE advisor_id NOT IN ('user-1', 'user-1762290677265')
    `;

    const params: any[] = [];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    const total = parseInt(row.total) || 1; // Evitar división por 0

    return {
      completionRate: (parseInt(row.completed) || 0) / total * 100,
      abandonmentRate: (parseInt(row.abandoned) || 0) / total * 100,
      transferRate: (parseInt(row.transferred) || 0) / total * 100,
      avgTimeToClose: Math.round(parseFloat(row.avg_time_to_close) || 0),
    };
  }

  /**
   * Get peak hours (horas pico de conversaciones)
   */
  async getPeakHours(startDate?: number, endDate?: number): Promise<Array<{ hour: number; count: number; avgResponseTime: number }>> {
    let query = `
      SELECT
        EXTRACT(HOUR FROM TO_TIMESTAMP(started_at / 1000)) as hour,
        COUNT(*) as count,
        AVG(first_response_at - started_at) FILTER (WHERE first_response_at IS NOT NULL) as avg_response_time
      FROM conversation_metrics
      WHERE advisor_id NOT IN ('user-1', 'user-1762290677265')
    `;

    const params: any[] = [];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND started_at >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND started_at <= $${params.length}`;
    }

    query += ' GROUP BY hour ORDER BY count DESC LIMIT 5';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      hour: parseInt(row.hour),
      count: parseInt(row.count),
      avgResponseTime: Math.round(parseFloat(row.avg_response_time) || 0),
    }));
  }

  /**
   * Close pool connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const metricsTrackerDB = new MetricsTrackerDB();
