import { crmDb } from "./crm/db-postgres";
import type { CrmRealtimeManager } from "./crm/ws";
import { ConversationStatus } from "./crm/conversation-status";
import { Pool } from "pg";

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
  console.error('[BotTimeoutScheduler] Unexpected pool error:', err);
});

interface BotConfig {
  perFlowConfig: Record<string, { botTimeout: number; fallbackQueue: string }>;
}

/**
 * BotTimeoutScheduler
 *
 * Checks for conversations where the bot has been active longer than the configured timeout
 * and transfers them to the fallback queue.
 */
export class BotTimeoutScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private socketManager: CrmRealtimeManager | null = null;
  private config: BotConfig = { perFlowConfig: {} };

  constructor(socketManager?: CrmRealtimeManager) {
    this.socketManager = socketManager || null;
    // Load config async (don't block constructor)
    this.loadConfig().catch(err => {
      console.error('[BotTimeoutScheduler] Failed to load initial config:', err);
    });
  }

  setSocketManager(socketManager: CrmRealtimeManager): void {
    this.socketManager = socketManager;
  }

  /**
   * Load bot config from PostgreSQL
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT flow_id, bot_timeout, fallback_queue FROM bot_flow_configs'
      );

      this.config = { perFlowConfig: {} };

      for (const row of result.rows) {
        this.config.perFlowConfig[row.flow_id] = {
          botTimeout: row.bot_timeout,
          fallbackQueue: row.fallback_queue,
        };
      }

      console.log(`[BotTimeoutScheduler] 🐘 Loaded config from PostgreSQL for ${result.rows.length} flows`);
    } catch (error) {
      console.error("[BotTimeoutScheduler] Error loading config from PostgreSQL:", error);
      this.config = { perFlowConfig: {} };
    }
  }

  /**
   * Save bot config to PostgreSQL
   */
  async saveConfig(config: BotConfig): Promise<void> {
    try {
      // Delete all existing configs
      await pool.query('DELETE FROM bot_flow_configs');

      // Insert new configs
      for (const [flowId, flowConfig] of Object.entries(config.perFlowConfig)) {
        await pool.query(
          `INSERT INTO bot_flow_configs (flow_id, bot_timeout, fallback_queue)
           VALUES ($1, $2, $3)
           ON CONFLICT (flow_id) DO UPDATE SET
             bot_timeout = EXCLUDED.bot_timeout,
             fallback_queue = EXCLUDED.fallback_queue,
             updated_at = NOW()`,
          [flowId, flowConfig.botTimeout, flowConfig.fallbackQueue]
        );
      }

      this.config = config;
      console.log(`[BotTimeoutScheduler] 🐘 Saved config to PostgreSQL for ${Object.keys(config.perFlowConfig).length} flows`);
    } catch (error) {
      console.error("[BotTimeoutScheduler] Error saving config to PostgreSQL:", error);
      throw error;
    }
  }

  /**
   * Get current config
   */
  getConfig(): BotConfig {
    return this.config;
  }

  /**
   * Start checking for bot timeouts
   * @param intervalMs Check interval in milliseconds (default: 60 seconds)
   */
  startChecking(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      console.log("[BotTimeoutScheduler] Already checking");
      return;
    }

    console.log(`[BotTimeoutScheduler] Starting bot timeout checks every ${intervalMs}ms`);

    this.checkInterval = setInterval(() => {
      this.checkAndTransfer();
    }, intervalMs);

    // Also check immediately
    this.checkAndTransfer();
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[BotTimeoutScheduler] Stopped bot timeout checks");
    }
  }

  /**
   * Check for bot timeouts and transfer to fallback queue
   */
  private async checkAndTransfer(): Promise<void> {
    try {
      // Reload config to get latest changes
      this.loadConfig();

      if (Object.keys(this.config.perFlowConfig).length === 0) {
        return; // No flows configured
      }

      const now = Date.now();
      const pool = crmDb.pool;

      // Get all active conversations with bot
      const result = await pool.query(
        `SELECT id, bot_flow_id, bot_started_at, phone
         FROM crm_conversations
         WHERE status = $1
           AND bot_flow_id IS NOT NULL
           AND bot_started_at IS NOT NULL`,
        [ConversationStatus.ACTIVE]
      );

      for (const row of result.rows) {
        const flowConfig = this.config.perFlowConfig[row.bot_flow_id];

        if (!flowConfig || !flowConfig.fallbackQueue) {
          continue; // No config for this flow
        }

        const botDuration = (now - row.bot_started_at) / 1000 / 60; // minutes
        const timeoutMinutes = flowConfig.botTimeout;

        if (botDuration >= timeoutMinutes) {
          console.log(
            `[BotTimeoutScheduler] 🤖⏱️ Bot timeout exceeded for conversation ${row.id} (${botDuration.toFixed(1)}/${timeoutMinutes} min) - transferring to queue ${flowConfig.fallbackQueue}`
          );

          // Transfer to fallback queue
          await pool.query(
            `UPDATE crm_conversations
             SET queue_id = $1,
                 queued_at = $2,
                 bot_flow_id = NULL,
                 bot_started_at = NULL
             WHERE id = $3`,
            [flowConfig.fallbackQueue, now, row.id]
          );

          // Insert system message about the transfer
          await this.insertSystemMessage(
            row.id,
            `⏱️ El bot alcanzó el tiempo máximo de atención (${timeoutMinutes} minutos). Esta conversación ha sido transferida a la cola para que un asesor pueda atenderla.`
          );

          // Emit WebSocket update
          if (this.socketManager) {
            const updated = await crmDb.getConversationById(row.id);
            if (updated) {
              this.socketManager.emitConversationUpdate({ conversation: updated });
            }
          }
        }
      }
    } catch (error) {
      console.error("[BotTimeoutScheduler] Error checking bot timeouts:", error);
    }
  }

  /**
   * Insert a system message in the conversation
   */
  private async insertSystemMessage(conversationId: string, text: string): Promise<void> {
    try {
      const pool = crmDb.pool;
      const messageId = `sys_bot_timeout_${conversationId}_${Date.now()}`;

      await pool.query(
        `INSERT INTO crm_messages
         (id, conversation_id, direction, type, text, timestamp, event_type, metadata)
         VALUES ($1, $2, 'incoming', 'event', $3, $4, 'bot_timeout', $5)`,
        [
          messageId,
          conversationId,
          text,
          Date.now(),
          JSON.stringify({ system: true, reason: "bot_timeout" })
        ]
      );

      // Emit WebSocket update for the new message
      if (this.socketManager) {
        const message = {
          id: messageId,
          conversationId,
          direction: 'incoming' as const,
          type: 'event' as const,
          text,
          createdAt: Date.now(),
          eventType: 'bot_timeout',
          metadata: { system: true, reason: "bot_timeout" }
        };
        this.socketManager.emitNewMessage({ conversationId, message: message as any });
      }

      console.log(`[BotTimeoutScheduler] 💬 System message inserted for conversation ${conversationId}`);
    } catch (error) {
      console.error(`[BotTimeoutScheduler] Error inserting system message:`, error);
    }
  }

  getStatus(): {
    active: boolean;
    flowsConfigured: number;
    intervalMs: number | null;
  } {
    return {
      active: this.checkInterval !== null,
      flowsConfigured: Object.keys(this.config.perFlowConfig).length,
      intervalMs: this.checkInterval ? 60000 : null,
    };
  }
}
