import { Pool } from "pg";
import type { RuntimeEngine } from "../src/runtime/engine";
import type { ExecutionResult } from "../src/runtime/types";

interface ScheduledTimer {
  id: string;
  sessionId: string;
  flowId: string;
  contactId: string;
  channel: string;
  nextNodeId: string;
  executeAt: number; // timestamp
  createdAt: number;
  nodeId: string;
}

type TimerCompleteCallback = (result: {
  timer: ScheduledTimer;
  executionResult: ExecutionResult;
}) => Promise<void> | void;

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'whatsapp_user',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'flowbuilder_crm',
  password: process.env.POSTGRES_PASSWORD || 'azaleia_pg_2025_secure',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[TimerScheduler] Unexpected pool error:', err);
});

export class TimerScheduler {
  private timers: Map<string, ScheduledTimer> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private engine: RuntimeEngine | null = null;
  private onTimerComplete: TimerCompleteCallback | null = null;

  constructor(_storageDir?: string, onTimerComplete?: TimerCompleteCallback) {
    // storageDir parameter kept for backward compatibility but not used
    this.onTimerComplete = onTimerComplete || null;
    this.loadTimers();
  }

  setEngine(engine: RuntimeEngine): void {
    this.engine = engine;
  }

  setOnTimerComplete(callback: TimerCompleteCallback): void {
    this.onTimerComplete = callback;
  }

  private async loadTimers(): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT
          id, session_id, flow_id, contact_id, channel,
          next_node_id, node_id, execute_at, timer_created_at
        FROM scheduled_timers
        WHERE executed = false
        ORDER BY execute_at ASC`
      );

      this.timers = new Map(
        result.rows.map((row) => [
          row.id,
          {
            id: row.id,
            sessionId: row.session_id,
            flowId: row.flow_id,
            contactId: row.contact_id,
            channel: row.channel,
            nextNodeId: row.next_node_id,
            nodeId: row.node_id,
            executeAt: parseInt(row.execute_at),
            createdAt: parseInt(row.timer_created_at),
          },
        ])
      );

      console.log(`[TimerScheduler] Loaded ${this.timers.size} pending timers from PostgreSQL`);
    } catch (error) {
      console.error("[TimerScheduler] Failed to load timers from PostgreSQL:", error);
    }
  }

  async scheduleTimer(
    sessionId: string,
    flowId: string,
    contactId: string,
    channel: string,
    nextNodeId: string,
    nodeId: string,
    delaySeconds: number
  ): Promise<string> {
    const id = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const executeAt = Date.now() + delaySeconds * 1000;
    const createdAt = Date.now();

    const timer: ScheduledTimer = {
      id,
      sessionId,
      flowId,
      contactId,
      channel,
      nextNodeId,
      executeAt,
      createdAt,
      nodeId,
    };

    try {
      await pool.query(
        `INSERT INTO scheduled_timers (
          id, session_id, flow_id, contact_id, channel,
          next_node_id, node_id, execute_at, timer_created_at, executed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, sessionId, flowId, contactId, channel, nextNodeId, nodeId, executeAt, createdAt, false]
      );

      this.timers.set(id, timer);

      console.log(
        `[TimerScheduler] Scheduled timer ${id} for ${delaySeconds}s (${new Date(executeAt).toISOString()})`
      );
    } catch (error) {
      console.error(`[TimerScheduler] Failed to schedule timer:`, error);
      throw error;
    }

    return id;
  }

  async cancelTimer(id: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `DELETE FROM scheduled_timers WHERE id = $1 AND executed = false`,
        [id]
      );

      const deleted = result.rowCount && result.rowCount > 0;
      if (deleted) {
        this.timers.delete(id);
        console.log(`[TimerScheduler] Cancelled timer ${id}`);
      }
      return !!deleted;
    } catch (error) {
      console.error(`[TimerScheduler] Failed to cancel timer ${id}:`, error);
      return false;
    }
  }

  startChecking(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      console.log("[TimerScheduler] Already checking");
      return;
    }

    console.log(`[TimerScheduler] Starting timer checks every ${intervalMs}ms`);

    this.checkInterval = setInterval(() => {
      this.checkAndExecute();
    }, intervalMs);

    // Also check immediately
    this.checkAndExecute();
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[TimerScheduler] Stopped timer checks");
    }
  }

  private async checkAndExecute(): Promise<void> {
    const now = Date.now();

    // Reload timers from database to catch any new ones
    await this.loadTimers();

    const dueTimers = Array.from(this.timers.values()).filter((t) => t.executeAt <= now);

    if (dueTimers.length === 0) {
      return;
    }

    console.log(`[TimerScheduler] Found ${dueTimers.length} timers ready to execute`);

    for (const timer of dueTimers) {
      try {
        await this.executeTimer(timer);

        // Mark as executed in PostgreSQL
        await pool.query(
          `UPDATE scheduled_timers
           SET executed = true, executed_at = $1, updated_at = NOW()
           WHERE id = $2`,
          [Date.now(), timer.id]
        );

        this.timers.delete(timer.id);
      } catch (error) {
        console.error(`[TimerScheduler] Failed to execute timer ${timer.id}:`, error);
        // Keep timer for retry on next check
      }
    }
  }

  private async executeTimer(timer: ScheduledTimer): Promise<void> {
    console.log(`[TimerScheduler] Executing timer ${timer.id} for session ${timer.sessionId}`);

    if (!this.engine) {
      console.error(`[TimerScheduler] Engine not set, cannot execute timer ${timer.id}`);
      throw new Error("RuntimeEngine not initialized");
    }

    // Resume flow from nextNodeId with a special "timer_complete" message
    const result = await this.engine.processMessage({
      sessionId: timer.sessionId,
      flowId: timer.flowId,
      channel: timer.channel as any,
      contactId: timer.contactId,
      message: {
        type: "text",
        text: "__TIMER_COMPLETE__",
      },
      metadata: {
        timerNodeId: timer.nodeId,
        timerId: timer.id,
      },
    });

    console.log(
      `[TimerScheduler] Timer ${timer.id} executed, responses: ${result.responses.length}, ended: ${result.ended}`
    );

    // CRITICAL: Call the onTimerComplete callback to send responses to WhatsApp/CRM
    if (this.onTimerComplete && result.responses.length > 0) {
      try {
        await this.onTimerComplete({ timer, executionResult: result });
        console.log(`[TimerScheduler] ✅ Timer responses sent via callback`);
      } catch (error) {
        console.error(`[TimerScheduler] ❌ Failed to send timer responses:`, error);
      }
    } else if (result.responses.length > 0) {
      console.warn(`[TimerScheduler] ⚠️ Timer generated ${result.responses.length} responses but no callback is registered!`);
    }
  }

  getStatus(): { total: number; pending: number; overdue: number } {
    const now = Date.now();
    const all = Array.from(this.timers.values());
    return {
      total: all.length,
      pending: all.filter((t) => t.executeAt > now).length,
      overdue: all.filter((t) => t.executeAt <= now).length,
    };
  }
}
