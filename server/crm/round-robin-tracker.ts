/**
 * Round-Robin Tracker
 * Manages fair distribution of conversations across advisors in a queue
 */

import * as fs from 'fs';
import * as path from 'path';

const TRACKER_FILE = path.join(process.cwd(), 'data', 'admin', 'round-robin-state.json');

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
    this.loadState();
  }

  /**
   * Load state from disk
   */
  private loadState(): void {
    try {
      if (fs.existsSync(TRACKER_FILE)) {
        const data = fs.readFileSync(TRACKER_FILE, 'utf8');
        this.state = JSON.parse(data);
        console.log('[RoundRobin] Loaded state:', Object.keys(this.state).length, 'queues');
      } else {
        this.state = {};
        this.saveState();
        console.log('[RoundRobin] Initialized new state file');
      }
    } catch (error) {
      console.error('[RoundRobin] Error loading state:', error);
      this.state = {};
    }
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    try {
      const dir = path.dirname(TRACKER_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(TRACKER_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('[RoundRobin] Error saving state:', error);
    }
  }

  /**
   * Get next advisor using round-robin algorithm
   * @param queueId - The queue ID
   * @param availableAdvisors - Array of available advisor IDs
   * @returns The next advisor ID to assign
   */
  getNextAdvisor(queueId: string, availableAdvisors: string[]): string | null {
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

    // Save to disk
    this.saveState();

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
  resetQueue(queueId: string): void {
    if (this.state[queueId]) {
      this.state[queueId] = {
        lastIndex: -1,
        lastAdvisorId: null,
        totalAssignments: 0
      };
      this.saveState();
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
