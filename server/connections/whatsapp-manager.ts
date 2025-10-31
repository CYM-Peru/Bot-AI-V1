import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONNECTIONS_PATH = path.join(DATA_DIR, 'whatsapp-connections.json');

export interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string | null;
  accessToken: string;
  verifyToken: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface WhatsAppConnectionsStore {
  connections: WhatsAppConnection[];
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('[WhatsApp Manager] Error creating data dir:', error);
  }
}

async function loadStore(): Promise<WhatsAppConnectionsStore> {
  await ensureDataDir();

  try {
    const raw = await fs.readFile(CONNECTIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as WhatsAppConnectionsStore;
    return {
      connections: parsed.connections ?? [],
    };
  } catch (error) {
    // File doesn't exist or is invalid, return empty store
    return { connections: [] };
  }
}

async function saveStore(store: WhatsAppConnectionsStore): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CONNECTIONS_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export class WhatsAppConnectionManager {
  /**
   * Get all WhatsApp connections
   */
  static async listConnections(): Promise<WhatsAppConnection[]> {
    const store = await loadStore();
    return store.connections.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get a specific connection by ID
   */
  static async getConnection(id: string): Promise<WhatsAppConnection | null> {
    const store = await loadStore();
    return store.connections.find((conn) => conn.id === id) ?? null;
  }

  /**
   * Get connection by phoneNumberId (Meta's Phone Number ID)
   */
  static async getConnectionByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppConnection | null> {
    const store = await loadStore();
    return store.connections.find((conn) => conn.phoneNumberId === phoneNumberId) ?? null;
  }

  /**
   * Create a new WhatsApp connection
   * AUTOMATICALLY fetches displayNumber from Meta if not provided
   */
  static async createConnection(data: Omit<WhatsAppConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<WhatsAppConnection> {
    const store = await loadStore();

    // Check if phoneNumberId already exists
    const existing = store.connections.find((conn) => conn.phoneNumberId === data.phoneNumberId);
    if (existing) {
      throw new Error(`Connection with phoneNumberId ${data.phoneNumberId} already exists`);
    }

    // AUTOMATIC: If displayNumber not provided, fetch from Meta
    let displayNumber = data.displayNumber;
    if (!displayNumber) {
      console.log(`[WhatsApp Manager] Auto-fetching displayNumber from Meta for ${data.phoneNumberId}...`);
      displayNumber = await this.fetchDisplayNumberFromMeta(data.phoneNumberId, data.accessToken);
      if (displayNumber) {
        console.log(`[WhatsApp Manager] ✅ Auto-fetched: ${displayNumber}`);
      }
    }

    const now = Date.now();
    const connection: WhatsAppConnection = {
      ...data,
      displayNumber,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    store.connections.push(connection);
    await saveStore(store);

    console.log(`[WhatsApp Manager] Created connection: ${connection.alias} (${connection.id})`);
    return connection;
  }

  /**
   * Update an existing WhatsApp connection
   * AUTOMATICALLY refreshes displayNumber if phoneNumberId or accessToken changes
   */
  static async updateConnection(
    id: string,
    data: Partial<Omit<WhatsAppConnection, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<WhatsAppConnection | null> {
    const store = await loadStore();
    const index = store.connections.findIndex((conn) => conn.id === id);

    if (index === -1) {
      return null;
    }

    const oldConnection = store.connections[index];

    // If updating phoneNumberId, check it doesn't conflict
    if (data.phoneNumberId && data.phoneNumberId !== oldConnection.phoneNumberId) {
      const existing = store.connections.find((conn) => conn.phoneNumberId === data.phoneNumberId);
      if (existing) {
        throw new Error(`Connection with phoneNumberId ${data.phoneNumberId} already exists`);
      }
    }

    // AUTOMATIC: If phoneNumberId or accessToken changed, refresh displayNumber from Meta
    const phoneNumberChanged = data.phoneNumberId && data.phoneNumberId !== oldConnection.phoneNumberId;
    const tokenChanged = data.accessToken && data.accessToken !== oldConnection.accessToken;

    if ((phoneNumberChanged || tokenChanged) && !data.displayNumber) {
      const phoneId = data.phoneNumberId || oldConnection.phoneNumberId;
      const token = data.accessToken || oldConnection.accessToken;

      console.log(`[WhatsApp Manager] Auto-refreshing displayNumber from Meta for ${phoneId}...`);
      const fetchedDisplayNumber = await this.fetchDisplayNumberFromMeta(phoneId, token);
      if (fetchedDisplayNumber) {
        data.displayNumber = fetchedDisplayNumber;
        console.log(`[WhatsApp Manager] ✅ Auto-refreshed: ${fetchedDisplayNumber}`);
      }
    }

    const updated: WhatsAppConnection = {
      ...oldConnection,
      ...data,
      updatedAt: Date.now(),
    };

    store.connections[index] = updated;
    await saveStore(store);

    console.log(`[WhatsApp Manager] Updated connection: ${updated.alias} (${updated.id})`);
    return updated;
  }

  /**
   * Delete a WhatsApp connection
   */
  static async deleteConnection(id: string): Promise<boolean> {
    const store = await loadStore();
    const index = store.connections.findIndex((conn) => conn.id === id);

    if (index === -1) {
      return false;
    }

    const deleted = store.connections[index];
    store.connections.splice(index, 1);
    await saveStore(store);

    console.log(`[WhatsApp Manager] Deleted connection: ${deleted.alias} (${deleted.id})`);
    return true;
  }

  /**
   * Get the primary/default connection (for backward compatibility)
   * Returns the first active connection or null
   */
  static async getPrimaryConnection(): Promise<WhatsAppConnection | null> {
    const store = await loadStore();
    return store.connections.find((conn) => conn.isActive) ?? store.connections[0] ?? null;
  }

  /**
   * Fetch displayNumber from Meta Graph API
   */
  private static async fetchDisplayNumberFromMeta(phoneNumberId: string, accessToken: string): Promise<string | null> {
    try {
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?access_token=${accessToken}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[WhatsApp Manager] Failed to fetch displayNumber from Meta: ${response.status}`);
        return null;
      }

      const data = await response.json() as { display_phone_number?: string };
      return data.display_phone_number || null;
    } catch (error) {
      console.warn('[WhatsApp Manager] Error fetching displayNumber from Meta:', error);
      return null;
    }
  }

  /**
   * Migrate from old .env based config to new multi-connection format
   * This runs once to import existing credentials
   * AUTOMATICALLY fetches displayNumber from Meta API
   */
  static async migrateFromEnv(): Promise<void> {
    const store = await loadStore();

    // If connections already exist, skip migration
    if (store.connections.length > 0) {
      return;
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!phoneNumberId || !accessToken) {
      console.log('[WhatsApp Manager] No .env credentials found to migrate');
      return;
    }

    // AUTOMATIC: Fetch displayNumber from Meta
    console.log('[WhatsApp Manager] Fetching displayNumber from Meta API...');
    const displayNumber = await this.fetchDisplayNumberFromMeta(phoneNumberId, accessToken);

    const connection: WhatsAppConnection = {
      id: randomUUID(),
      alias: 'Principal',
      phoneNumberId,
      displayNumber,
      accessToken,
      verifyToken: verifyToken ?? null,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    store.connections.push(connection);
    await saveStore(store);

    console.log(`[WhatsApp Manager] ✅ Migrated credentials from .env to connections.json`);
    if (displayNumber) {
      console.log(`[WhatsApp Manager] ✅ Auto-fetched displayNumber: ${displayNumber}`);
    } else {
      console.log('[WhatsApp Manager] ⚠️ Could not fetch displayNumber from Meta (will retry on verify)');
    }
  }
}
