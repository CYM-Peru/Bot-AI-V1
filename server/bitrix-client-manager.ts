/**
 * Bitrix24 Client Manager - Singleton Pattern
 *
 * Manages a single Bitrix24Client instance that automatically refreshes
 * when tokens are updated, preventing stale token issues.
 */

import { Bitrix24Client } from "../src/integrations/bitrix24";
import type { Bitrix24Config } from "../src/integrations/bitrix24";

class BitrixClientManager {
  private static instance: BitrixClientManager | null = null;
  private client: Bitrix24Client | null = null;
  private config: Bitrix24Config | null = null;
  private onTokenRefreshCallback: (() => Promise<string>) | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): BitrixClientManager {
    if (!BitrixClientManager.instance) {
      BitrixClientManager.instance = new BitrixClientManager();
    }
    return BitrixClientManager.instance;
  }

  /**
   * Initialize the Bitrix client with configuration
   */
  initialize(config: Bitrix24Config, onTokenRefresh: () => Promise<string>): void {
    this.config = config;
    this.onTokenRefreshCallback = onTokenRefresh;
    this.createClient();
  }

  /**
   * Create or recreate the Bitrix client instance
   */
  private createClient(): void {
    if (!this.config || !this.onTokenRefreshCallback) {
      throw new Error("BitrixClientManager not initialized. Call initialize() first.");
    }

    console.log("[BitrixClientManager] Creating new Bitrix24Client instance");

    this.client = new Bitrix24Client({
      ...this.config,
      onTokenRefresh: this.onTokenRefreshCallback,
    });
  }

  /**
   * Refresh the client instance (useful after token updates)
   * This recreates the client with fresh configuration
   */
  async refreshClient(newAccessToken: string): Promise<void> {
    if (!this.config) {
      throw new Error("BitrixClientManager not initialized");
    }

    console.log("[BitrixClientManager] Refreshing client instance with new token");

    // Update config with new token
    this.config.accessToken = newAccessToken;

    // Recreate client
    this.createClient();

    console.log("[BitrixClientManager] ✅ Client instance refreshed successfully");
  }

  /**
   * Get the current Bitrix client instance
   */
  getClient(): Bitrix24Client | null {
    return this.client;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Reset the manager (useful for testing or shutdown)
   */
  reset(): void {
    this.client = null;
    this.config = null;
    this.onTokenRefreshCallback = null;
    BitrixClientManager.instance = null;
  }
}

// Export singleton instance getter
export const getBitrixClientManager = () => BitrixClientManager.getInstance();
