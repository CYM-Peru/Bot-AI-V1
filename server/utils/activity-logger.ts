/**
 * Activity Logger - Records advisor activity events to PostgreSQL
 */
import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      user: process.env.POSTGRES_USER || 'whatsapp_user',
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB || 'flowbuilder_crm',
      password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export type ActivityEventType = 'login' | 'logout' | 'status_change';

interface LogActivityParams {
  userId: string;
  userName: string;
  eventType: ActivityEventType;
  statusId?: string;
  statusName?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an advisor activity event
 */
export async function logAdvisorActivity(params: LogActivityParams): Promise<void> {
  try {
    const pool = getPool();

    await pool.query(
      `INSERT INTO advisor_activity_logs
        (user_id, user_name, event_type, status_id, status_name, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        params.userId,
        params.userName,
        params.eventType,
        params.statusId || null,
        params.statusName || null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );

    console.log(`[ActivityLogger] Logged ${params.eventType} for ${params.userName} (${params.userId})`);
  } catch (error) {
    console.error('[ActivityLogger] Error logging activity:', error);
    // Don't throw - we don't want to break the main flow if logging fails
  }
}

/**
 * Cleanup on shutdown
 */
export async function closeActivityLogger(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
