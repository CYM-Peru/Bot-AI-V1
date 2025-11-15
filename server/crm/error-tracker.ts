/**
 * Error Tracker Service
 * Tracks and logs errors for metrics and monitoring
 */

import pg from 'pg';
const { Pool } = pg;

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorLog {
  id?: number;
  timestamp: number;
  errorType: string;
  errorMessage: string;
  context?: Record<string, any>;
  conversationId?: string;
  advisorId?: string;
  severity: ErrorSeverity;
  stackTrace?: string;
}

class ErrorTrackerService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'flowbuilder_crm',
      user: process.env.POSTGRES_USER || 'whatsapp_user',
      password: process.env.POSTGRES_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Log an error to the database
   */
  async logError(error: ErrorLog): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO error_logs
         (timestamp, error_type, error_message, context, conversation_id, advisor_id, severity, stack_trace)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          error.timestamp,
          error.errorType,
          error.errorMessage,
          error.context ? JSON.stringify(error.context) : null,
          error.conversationId || null,
          error.advisorId || null,
          error.severity,
          error.stackTrace || null,
        ]
      );
    } catch (err) {
      // Don't throw - just log to console to avoid infinite loops
      console.error('[ErrorTracker] Failed to log error:', err);
    }
  }

  /**
   * Log an error from an Error object
   */
  async logErrorObject(
    err: Error,
    errorType: string,
    options?: {
      conversationId?: string;
      advisorId?: string;
      severity?: ErrorSeverity;
      context?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logError({
      timestamp: Date.now(),
      errorType,
      errorMessage: err.message,
      context: options?.context,
      conversationId: options?.conversationId,
      advisorId: options?.advisorId,
      severity: options?.severity || 'error',
      stackTrace: err.stack,
    });
  }

  /**
   * Get error rate for a time period
   * Returns percentage of operations that resulted in errors
   */
  async getErrorRate(startTime: number, endTime?: number): Promise<number> {
    try {
      const end = endTime || Date.now();

      const result = await this.pool.query(
        `SELECT COUNT(*) as error_count
         FROM error_logs
         WHERE timestamp >= $1 AND timestamp <= $2
           AND severity IN ('error', 'critical')`,
        [startTime, end]
      );

      const errorCount = parseInt(result.rows[0]?.error_count) || 0;

      // Get total operations (messages sent/received in the same period)
      const opsResult = await this.pool.query(
        `SELECT COUNT(*) as total_operations
         FROM crm_messages
         WHERE timestamp >= $1 AND timestamp <= $2`,
        [startTime, end]
      );

      const totalOps = parseInt(opsResult.rows[0]?.total_operations) || 0;

      if (totalOps === 0) return 0;

      // Return percentage (0-100)
      return Math.round((errorCount / totalOps) * 10000) / 100;
    } catch (err) {
      console.error('[ErrorTracker] Error calculating error rate:', err);
      return 0;
    }
  }

  /**
   * Get error count for a time period
   */
  async getErrorCount(startTime: number, endTime?: number): Promise<number> {
    try {
      const end = endTime || Date.now();

      const result = await this.pool.query(
        `SELECT COUNT(*) as error_count
         FROM error_logs
         WHERE timestamp >= $1 AND timestamp <= $2`,
        [startTime, end]
      );

      return parseInt(result.rows[0]?.error_count) || 0;
    } catch (err) {
      console.error('[ErrorTracker] Error getting error count:', err);
      return 0;
    }
  }

  /**
   * Get errors by type
   */
  async getErrorsByType(
    startTime: number,
    endTime?: number
  ): Promise<Array<{ errorType: string; count: number }>> {
    try {
      const end = endTime || Date.now();

      const result = await this.pool.query(
        `SELECT error_type, COUNT(*) as count
         FROM error_logs
         WHERE timestamp >= $1 AND timestamp <= $2
         GROUP BY error_type
         ORDER BY count DESC
         LIMIT 20`,
        [startTime, end]
      );

      return result.rows.map(row => ({
        errorType: row.error_type,
        count: parseInt(row.count),
      }));
    } catch (err) {
      console.error('[ErrorTracker] Error getting errors by type:', err);
      return [];
    }
  }

  /**
   * Get recent errors
   */
  async getRecentErrors(limit = 50): Promise<ErrorLog[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, timestamp, error_type, error_message,
          context, conversation_id, advisor_id, severity, stack_trace
         FROM error_logs
         ORDER BY timestamp DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        timestamp: parseInt(row.timestamp),
        errorType: row.error_type,
        errorMessage: row.error_message,
        context: row.context,
        conversationId: row.conversation_id,
        advisorId: row.advisor_id,
        severity: row.severity,
        stackTrace: row.stack_trace,
      }));
    } catch (err) {
      console.error('[ErrorTracker] Error getting recent errors:', err);
      return [];
    }
  }

  /**
   * Clear old error logs (cleanup)
   */
  async clearOldErrors(olderThanDays = 30): Promise<number> {
    try {
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

      const result = await this.pool.query(
        `DELETE FROM error_logs WHERE timestamp < $1`,
        [cutoffTime]
      );

      return result.rowCount || 0;
    } catch (err) {
      console.error('[ErrorTracker] Error clearing old errors:', err);
      return 0;
    }
  }

  /**
   * Close pool connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const errorTracker = new ErrorTrackerService();

// Auto-cleanup every day (remove errors older than 30 days)
setInterval(async () => {
  const deleted = await errorTracker.clearOldErrors(30);
  if (deleted > 0) {
    console.log(`[ErrorTracker] Cleaned up ${deleted} old error logs`);
  }
}, 24 * 60 * 60 * 1000);
