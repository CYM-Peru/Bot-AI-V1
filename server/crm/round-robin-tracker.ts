/**
 * Round-Robin Tracker
 * Manages fair distribution of conversations across advisors in a queue
 * MIGRATED TO POSTGRESQL - Uses queue_round_robin_state table
 */

import { Pool } from 'pg';

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
  console.error('[RoundRobin] Unexpected pool error:', err);
});

interface RoundRobinState {
  [queueId: string]: {
    lastIndex: number;
    lastAdvisorId: string | null;
    totalAssignments: number;
  };
}

class RoundRobinTracker {
  private state: RoundRobinState = {};

  constructor() {
    this.loadState().catch(err => {
      console.error('[RoundRobin] Failed to load initial state:', err);
    });
  }

  /**
   * Load state from PostgreSQL
   */
  private async loadState(): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT queue_id, last_index, last_advisor_id, total_assignments FROM queue_round_robin_state'
      );

      this.state = {};
      for (const row of result.rows) {
        this.state[row.queue_id] = {
          lastIndex: row.last_index,
          lastAdvisorId: row.last_advisor_id,
          totalAssignments: parseInt(row.total_assignments),
        };
      }

      console.log('[RoundRobin] 🐘 Loaded state from PostgreSQL:', Object.keys(this.state).length, 'queues');
    } catch (error) {
      console.error('[RoundRobin] Error loading state from PostgreSQL:', error);
      this.state = {};
    }
  }

  /**
   * Save state to PostgreSQL
   */
  private async saveState(queueId: string): Promise<void> {
    try {
      const queueState = this.state[queueId];
      if (!queueState) return;

      await pool.query(
        `INSERT INTO queue_round_robin_state (queue_id, last_index, last_advisor_id, total_assignments)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (queue_id) DO UPDATE SET
           last_index = EXCLUDED.last_index,
           last_advisor_id = EXCLUDED.last_advisor_id,
           total_assignments = EXCLUDED.total_assignments,
           updated_at = NOW()`,
        [queueId, queueState.lastIndex, queueState.lastAdvisorId, queueState.totalAssignments]
      );
    } catch (error) {
      console.error('[RoundRobin] Error saving state to PostgreSQL:', error);
    }
  }

  /**
   * Get next advisor using round-robin algorithm
   * @param queueId - The queue ID
   * @param availableAdvisors - Array of available advisor IDs
   * @returns The next advisor ID to assign
   */
  async getNextAdvisor(queueId: string, availableAdvisors: string[]): Promise<string | null> {
    if (availableAdvisors.length === 0) {
      console.warn(`[RoundRobin] No available advisors in queue ${queueId}`);
      return null;
    }

    // Initialize queue state if not exists
    if (!this.state[queueId]) {
      this.state[queueId] = {
        lastIndex: -1,
        lastAdvisorId: null,
        totalAssignments: 0
      };
    }

    const queueState = this.state[queueId];

    // Calculate next index (circular)
    const nextIndex = (queueState.lastIndex + 1) % availableAdvisors.length;
    const nextAdvisor = availableAdvisors[nextIndex];

    // Update state
    queueState.lastIndex = nextIndex;
    queueState.lastAdvisorId = nextAdvisor;
    queueState.totalAssignments++;

    // Save to PostgreSQL
    await this.saveState(queueId);

    console.log(`[RoundRobin] Queue ${queueId}: Assigned to advisor ${nextIndex + 1}/${availableAdvisors.length} (${nextAdvisor}) - Total assignments: ${queueState.totalAssignments}`);

    return nextAdvisor;
  }

  /**
   * Get current state for a queue
   */
  getQueueState(queueId: string) {
    return this.state[queueId] || null;
  }

  /**
   * Reset state for a queue
   */
  async resetQueue(queueId: string): Promise<void> {
    if (this.state[queueId]) {
      this.state[queueId] = {
        lastIndex: -1,
        lastAdvisorId: null,
        totalAssignments: 0
      };
      await this.saveState(queueId);
      console.log(`[RoundRobin] Reset state for queue ${queueId}`);
    }
  }

  /**
   * Get statistics for all queues
   */
  getStats() {
    return Object.entries(this.state).map(([queueId, state]) => ({
      queueId,
      lastIndex: state.lastIndex,
      lastAdvisorId: state.lastAdvisorId,
      totalAssignments: state.totalAssignments
    }));
  }
}

// Singleton instance
export const roundRobinTracker = new RoundRobinTracker();
