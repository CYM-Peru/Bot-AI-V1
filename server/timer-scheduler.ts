import { promises as fs } from "fs";
import path from "path";
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

export class TimerScheduler {
  private readonly storageFile: string;
  private timers: Map<string, ScheduledTimer> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private engine: RuntimeEngine | null = null;
  private onTimerComplete: TimerCompleteCallback | null = null;

  constructor(storageDir: string = "./data", onTimerComplete?: TimerCompleteCallback) {
    this.storageFile = path.join(storageDir, "scheduled-timers.json");
    this.onTimerComplete = onTimerComplete || null;
    this.ensureStorageDir(storageDir);
    this.loadTimers();
  }

  setEngine(engine: RuntimeEngine): void {
    this.engine = engine;
  }

  setOnTimerComplete(callback: TimerCompleteCallback): void {
    this.onTimerComplete = callback;
  }

  private ensureStorageDir(dir: string): void {
    fs.mkdir(dir, { recursive: true }).catch((err) => {
      console.error("[TimerScheduler] Failed to create storage directory:", err);
    });
  }

  private async loadTimers(): Promise<void> {
    try {
      const data = await fs.readFile(this.storageFile, "utf-8");
      const timers: ScheduledTimer[] = JSON.parse(data);
      this.timers = new Map(timers.map((t) => [t.id, t]));
      console.log(`[TimerScheduler] Loaded ${this.timers.size} timers`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.log("[TimerScheduler] No existing timers file, starting fresh");
      } else {
        console.error("[TimerScheduler] Failed to load timers:", error);
      }
    }
  }

  private async saveTimers(): Promise<void> {
    try {
      const timers = Array.from(this.timers.values());
      await fs.writeFile(this.storageFile, JSON.stringify(timers, null, 2), "utf-8");
    } catch (error) {
      console.error("[TimerScheduler] Failed to save timers:", error);
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

    const timer: ScheduledTimer = {
      id,
      sessionId,
      flowId,
      contactId,
      channel,
      nextNodeId,
      executeAt,
      createdAt: Date.now(),
      nodeId,
    };

    this.timers.set(id, timer);
    await this.saveTimers();

    console.log(
      `[TimerScheduler] Scheduled timer ${id} for ${delaySeconds}s (${new Date(executeAt).toISOString()})`
    );

    return id;
  }

  async cancelTimer(id: string): Promise<boolean> {
    const deleted = this.timers.delete(id);
    if (deleted) {
      await this.saveTimers();
      console.log(`[TimerScheduler] Cancelled timer ${id}`);
    }
    return deleted;
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
    const dueTimers = Array.from(this.timers.values()).filter((t) => t.executeAt <= now);

    if (dueTimers.length === 0) {
      return;
    }

    console.log(`[TimerScheduler] Found ${dueTimers.length} timers ready to execute`);

    for (const timer of dueTimers) {
      try {
        await this.executeTimer(timer);
        this.timers.delete(timer.id);
      } catch (error) {
        console.error(`[TimerScheduler] Failed to execute timer ${timer.id}:`, error);
        // Keep timer for retry on next check
      }
    }

    await this.saveTimers();
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
