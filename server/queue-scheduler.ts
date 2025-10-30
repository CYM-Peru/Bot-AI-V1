import { crmDb } from "./crm/db";
import type { CrmRealtimeManager } from "./crm/ws";

/**
 * QueueScheduler
 *
 * Manages automatic reassignment of conversations based on timeout rules.
 * Checks periodically for conversations that have exceeded their timeout
 * and returns them to the queue for other advisors to accept.
 */
export class QueueScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private socketManager: CrmRealtimeManager | null = null;
  private timeoutRules: number[] = [10, 30, 60, 120, 240, 480, 720]; // minutes

  constructor(socketManager?: CrmRealtimeManager) {
    this.socketManager = socketManager || null;
  }

  setSocketManager(socketManager: CrmRealtimeManager): void {
    this.socketManager = socketManager;
  }

  /**
   * Start checking for timeouts at the specified interval
   * @param intervalMs Check interval in milliseconds (default: 60 seconds)
   */
  startChecking(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      console.log("[QueueScheduler] Already checking");
      return;
    }

    console.log(`[QueueScheduler] Starting timeout checks every ${intervalMs}ms`);
    console.log(`[QueueScheduler] Timeout rules: ${this.timeoutRules.join(", ")} minutes`);

    this.checkInterval = setInterval(() => {
      this.checkAndReassign();
    }, intervalMs);

    // Also check immediately
    this.checkAndReassign();
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[QueueScheduler] Stopped timeout checks");
    }
  }

  /**
   * Set custom timeout rules
   * @param timeoutMinutes Array of timeout values in minutes
   */
  setTimeoutRules(timeoutMinutes: number[]): void {
    this.timeoutRules = timeoutMinutes.sort((a, b) => a - b);
    console.log(`[QueueScheduler] Updated timeout rules: ${this.timeoutRules.join(", ")} minutes`);
  }

  private async checkAndReassign(): Promise<void> {
    // Check each timeout level
    for (const timeoutMinutes of this.timeoutRules) {
      const timedOut = crmDb.checkTimeoutsAndReassign(timeoutMinutes);

      // Emit WebSocket updates for reassigned conversations
      if (timedOut.length > 0 && this.socketManager) {
        for (const conversation of timedOut) {
          const updated = crmDb.getConversationById(conversation.id);
          if (updated) {
            this.socketManager.emitConversationUpdate({ conversation: updated });
          }
        }

        console.log(
          `[QueueScheduler] Reassigned ${timedOut.length} conversation(s) after ${timeoutMinutes} minute timeout`
        );
      }
    }
  }

  getStatus(): {
    active: boolean;
    timeoutRules: number[];
    intervalMs: number | null;
  } {
    return {
      active: this.checkInterval !== null,
      timeoutRules: this.timeoutRules,
      intervalMs: this.checkInterval ? 60000 : null,
    };
  }
}
