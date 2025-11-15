/**
 * SessionsStorage - PostgreSQL Implementation
 * Migrated from JSON file storage to PostgreSQL
 */

import pg from 'pg';

const { Pool } = pg;

export interface Session {
  id: string;
  advisorId: string;
  conversationId: string;
  startTime: number;
  endTime: number | null;
  duration: number | null; // in milliseconds
}

export class SessionsStorageDB {
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

  async init() {
    // No initialization needed for PostgreSQL
    // Connection pool is ready
  }

  async startSession(advisorId: string, conversationId: string): Promise<Session> {
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      advisorId,
      conversationId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
    };

    await this.pool.query(
      `INSERT INTO advisor_sessions (
        id, advisor_id, conversation_id, start_time
      ) VALUES ($1, $2, $3, $4)`,
      [session.id, session.advisorId, session.conversationId, session.startTime]
    );

    console.log(`[Sessions] Started session ${session.id} for advisor ${advisorId}`);
    return session;
  }

  async endSession(sessionId: string): Promise<Session | null> {
    const result = await this.pool.query(
      `SELECT * FROM advisor_sessions WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = this.mapRowToSession(result.rows[0]);

    if (session.endTime) {
      console.warn(`[Sessions] Session ${sessionId} already ended`);
      return session;
    }

    const endTime = Date.now();
    const duration = endTime - session.startTime;

    await this.pool.query(
      `UPDATE advisor_sessions
       SET end_time = $1, duration = $2, updated_at = NOW()
       WHERE id = $3`,
      [endTime, duration, sessionId]
    );

    session.endTime = endTime;
    session.duration = duration;

    console.log(`[Sessions] Ended session ${sessionId}, duration: ${(duration / 1000 / 60).toFixed(2)} minutes`);
    return session;
  }

  async getActiveSession(conversationId: string): Promise<Session | null> {
    const result = await this.pool.query(
      `SELECT * FROM advisor_sessions
       WHERE conversation_id = $1 AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [conversationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSession(result.rows[0]);
  }

  async getAdvisorSessions(advisorId: string, startDate?: number, endDate?: number): Promise<Session[]> {
    let query = 'SELECT * FROM advisor_sessions WHERE advisor_id = $1';
    const params: any[] = [advisorId];

    if (startDate !== undefined) {
      params.push(startDate);
      query += ` AND start_time >= $${params.length}`;
    }

    if (endDate !== undefined) {
      params.push(endDate);
      query += ` AND start_time <= $${params.length}`;
    }

    query += ' ORDER BY start_time DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToSession(row));
  }

  async getAdvisorStats(advisorId: string, period: 'day' | 'week' | 'month'): Promise<{
    totalSessions: number;
    completedSessions: number;
    activeSessions: number;
    totalDuration: number;
    averageDuration: number;
  }> {
    const now = Date.now();
    let startDate: number;

    switch (period) {
      case 'day':
        startDate = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startDate = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startDate = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE end_time IS NOT NULL) as completed_sessions,
        COUNT(*) FILTER (WHERE end_time IS NULL) as active_sessions,
        COALESCE(SUM(duration) FILTER (WHERE duration IS NOT NULL), 0) as total_duration,
        COALESCE(AVG(duration) FILTER (WHERE duration IS NOT NULL), 0) as average_duration
       FROM advisor_sessions
       WHERE advisor_id = $1 AND start_time >= $2`,
      [advisorId, startDate]
    );

    const row = result.rows[0];

    return {
      totalSessions: parseInt(row.total_sessions) || 0,
      completedSessions: parseInt(row.completed_sessions) || 0,
      activeSessions: parseInt(row.active_sessions) || 0,
      totalDuration: parseInt(row.total_duration) || 0,
      averageDuration: parseFloat(row.average_duration) || 0,
    };
  }

  async getAllAdvisorsStats(period: 'day' | 'week' | 'month'): Promise<Array<{
    advisorId: string;
    stats: Awaited<ReturnType<typeof this.getAdvisorStats>>;
  }>> {
    const now = Date.now();
    let startDate: number;

    switch (period) {
      case 'day':
        startDate = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startDate = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startDate = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    // Get unique advisor IDs with recent sessions
    const advisorsResult = await this.pool.query(
      `SELECT DISTINCT advisor_id
       FROM advisor_sessions
       WHERE start_time >= $1`,
      [startDate]
    );

    const advisorIds = advisorsResult.rows.map(row => row.advisor_id);

    const results = await Promise.all(
      advisorIds.map(async advisorId => ({
        advisorId,
        stats: await this.getAdvisorStats(advisorId, period),
      }))
    );

    return results;
  }

  private mapRowToSession(row: any): Session {
    return {
      id: row.id,
      advisorId: row.advisor_id,
      conversationId: row.conversation_id,
      startTime: parseInt(row.start_time),
      endTime: row.end_time ? parseInt(row.end_time) : null,
      duration: row.duration ? parseInt(row.duration) : null,
    };
  }

  /**
   * Close pool connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const sessionsStorageDB = new SessionsStorageDB();
