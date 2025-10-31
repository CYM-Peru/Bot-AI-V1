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
   */
  static async createConnection(data: Omit<WhatsAppConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<WhatsAppConnection> {
    const store = await loadStore();

    // Check if phoneNumberId already exists
    const existing = store.connections.find((conn) => conn.phoneNumberId === data.phoneNumberId);
    if (existing) {
      throw new Error(`Connection with phoneNumberId ${data.phoneNumberId} already exists`);
    }

    const now = Date.now();
    const connection: WhatsAppConnection = {
      ...data,
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

    // If updating phoneNumberId, check it doesn't conflict
    if (data.phoneNumberId && data.phoneNumberId !== store.connections[index].phoneNumberId) {
      const existing = store.connections.find((conn) => conn.phoneNumberId === data.phoneNumberId);
      if (existing) {
        throw new Error(`Connection with phoneNumberId ${data.phoneNumberId} already exists`);
      }
    }

    const updated: WhatsAppConnection = {
      ...store.connections[index],
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
   * Migrate from old .env based config to new multi-connection format
   * This runs once to import existing credentials
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

    const connection: WhatsAppConnection = {
      id: randomUUID(),
      alias: 'Principal',
      phoneNumberId,
      displayNumber: null,
      accessToken,
      verifyToken: verifyToken ?? null,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    store.connections.push(connection);
    await saveStore(store);

    console.log('[WhatsApp Manager] ✅ Migrated credentials from .env to connections.json');
  }
}
