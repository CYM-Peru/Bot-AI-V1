import { crmDb } from "./crm/db-postgres";
import type { CrmRealtimeManager } from "./crm/ws";
import { formatEventTimestamp } from "./utils/file-logger";

/**
 * AutoArchiveScheduler
 *
 * Automatically archives conversations after 24 hours of inactivity FROM CLIENT
 * This mimics WhatsApp's 24-hour conversation window (only counts client messages)
 * This keeps the CRM clean and organized by moving old conversations to archive
 */
export class AutoArchiveScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private socketManager: CrmRealtimeManager | null = null;
  private inactivityHours: number = 24; // Default: 24 hours

  constructor(socketManager?: CrmRealtimeManager) {
    this.socketManager = socketManager || null;
  }

  setSocketManager(socketManager: CrmRealtimeManager): void {
    this.socketManager = socketManager;
  }

  /**
   * Start checking for inactive conversations
   * @param intervalMs Check interval in milliseconds (default: 1 hour)
   */
  startChecking(intervalMs: number = 3600000): void {
    if (this.checkInterval) {
      console.log("[AutoArchive] Already checking");
      return;
    }

    console.log(`[AutoArchive] Starting auto-archive checks every ${intervalMs}ms`);
    console.log(`[AutoArchive] Will archive conversations after ${this.inactivityHours} hours since LAST CLIENT MESSAGE (like WhatsApp 24h window)`);

    this.checkInterval = setInterval(() => {
      this.checkAndArchive();
    }, intervalMs);

    // Also check immediately
    this.checkAndArchive();
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[AutoArchive] Stopped auto-archive checks");
    }
  }

  /**
   * Set custom inactivity threshold
   * @param hours Number of hours of inactivity before archiving
   */
  setInactivityHours(hours: number): void {
    this.inactivityHours = hours;
    console.log(`[AutoArchive] Updated inactivity threshold: ${this.inactivityHours} hours since last CLIENT message`);
  }

  private async checkAndArchive(): Promise<void> {
    const now = Date.now();
    const inactivityMs = this.inactivityHours * 60 * 60 * 1000;
    const threshold = now - inactivityMs;

    // Get all active and attending conversations
    const conversations = await crmDb.listConversations();

    if (!conversations || conversations.length === 0) {
      return;
    }

    const inactiveConversations = [];

    // For each conversation, find the LAST CLIENT MESSAGE (direction=incoming)
    for (const conv of conversations) {
      // Only check active/attending conversations
      if (conv.status !== "active" && conv.status !== "attending") {
        continue;
      }

      try {
        // Get all messages for this conversation
        const messages = await crmDb.listMessages(conv.id);

        // Find the last INCOMING message (from client)
        const incomingMessages = messages.filter(m => m.direction === "incoming");

        if (incomingMessages.length === 0) {
          // No incoming messages - skip (this shouldn't happen in normal flow)
          continue;
        }

        // Get the most recent incoming message
        const lastClientMessage = incomingMessages[incomingMessages.length - 1];
        const lastClientMessageTime = lastClientMessage.createdAt;

        // Check if client has been inactive for more than threshold
        if (lastClientMessageTime < threshold) {
          inactiveConversations.push({
            conversation: conv,
            lastClientMessageTime: lastClientMessageTime,
          });
        }
      } catch (error) {
        console.error(`[AutoArchive] Error checking conversation ${conv.id}:`, error);
      }
    }

    if (inactiveConversations.length === 0) {
      return;
    }

    console.log(`[AutoArchive] Found ${inactiveConversations.length} conversations with client inactive > ${this.inactivityHours}h`);

    let notifiedCount = 0;
    for (const item of inactiveConversations) {
      try {
        const { conversation, lastClientMessageTime } = item;

        // Calculate inactivity duration from last CLIENT message
        const inactiveHours = ((now - lastClientMessageTime) / (1000 * 60 * 60)).toFixed(1);

        // Check if we already notified about 24h expiration (to avoid duplicate messages)
        const messages = await crmDb.listMessages(conversation.id);
        const alreadyNotified = messages.some(m =>
          m.type === "system" &&
          m.text?.includes("ventana de 24 horas ha expirado") &&
          m.createdAt > lastClientMessageTime
        );

        if (alreadyNotified) {
          // Already notified for this 24h window, skip
          continue;
        }

        // CHANGED: DO NOT ARCHIVE - Only create warning message
        // The conversation stays open but advisor is warned to send a template
        const timestamp = formatEventTimestamp();
        const warningMessage = await crmDb.appendMessage({
          convId: conversation.id,
          direction: "outgoing",
          type: "system",
          text: `⏰ La ventana de 24 horas ha expirado (${timestamp})\n\n⚠️ Para continuar la conversación, debes enviar una plantilla de WhatsApp.\n\nDespués de enviar la plantilla, tendrás otras 24 horas para responder libremente.`,
          mediaUrl: null,
          mediaThumb: null,
          repliedToId: null,
          status: "sent",
        });

        // Emit system message via WebSocket so advisor sees it immediately
        if (this.socketManager) {
          this.socketManager.emitNewMessage({ message: warningMessage, attachment: null });
        }

        notifiedCount++;

        console.log(
          `[AutoArchive] ⏰ Notified 24h expiration for conversation ${conversation.id} (${conversation.phone}) - Client inactive ${inactiveHours}h (conversation stays open)`
        );
      } catch (error) {
        console.error(`[AutoArchive] Failed to notify conversation ${item.conversation.id}:`, error);
      }
    }

    if (notifiedCount > 0) {
      console.log(`[AutoArchive] ⏰ Successfully notified ${notifiedCount} conversations about 24h expiration (conversations stay open, advisor must send template)`);
    }
  }

  getStatus(): {
    active: boolean;
    inactivityHours: number;
    intervalMs: number | null;
  } {
    return {
      active: this.checkInterval !== null,
      inactivityHours: this.inactivityHours,
      intervalMs: this.checkInterval ? 3600000 : null,
    };
  }
}
