import { Pool } from 'pg';

interface WhatsAppConnection {
  id: string;
  alias: string;
  phoneNumberId: string;
  displayNumber: string;
  accessToken: string;
  verifyToken: string;
  wabaId?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

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
  console.error('[WhatsApp Connections] Unexpected pool error:', err);
});

let cachedConnections: WhatsAppConnection[] | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Load WhatsApp connections from PostgreSQL with caching
 */
async function loadConnections(): Promise<WhatsAppConnection[]> {
  const now = Date.now();
  if (cachedConnections && (now - lastLoadTime) < CACHE_TTL) {
    return cachedConnections;
  }

  try {
    const result = await pool.query(
      'SELECT id, alias, phone_number_id, display_number, access_token, verify_token, waba_id, is_active, created_at, updated_at FROM whatsapp_connections WHERE is_active = true ORDER BY created_at'
    );

    cachedConnections = result.rows.map(row => ({
      id: row.id,
      alias: row.alias,
      phoneNumberId: row.phone_number_id,
      displayNumber: row.display_number,
      accessToken: row.access_token,
      verifyToken: row.verify_token,
      wabaId: row.waba_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    lastLoadTime = now;
    return cachedConnections;
  } catch (error) {
    console.error("[WhatsApp Connections] Error loading connections from PostgreSQL:", error);
    return [];
  }
}

/**
 * Get WhatsApp connection by phoneNumberId (Meta's ID) or by connection UUID
 * Supports both formats for backward compatibility
 */
export async function getWhatsAppConnection(
  channelConnectionId: string | null
): Promise<WhatsAppConnection | null> {
  if (!channelConnectionId) {
    return null;
  }

  const connections = await loadConnections();

  // Try to find by phoneNumberId first (Meta's ID)
  let connection = connections.find((c) => c.phoneNumberId === channelConnectionId);

  // If not found, try by UUID (backward compatibility)
  if (!connection) {
    connection = connections.find((c) => c.id === channelConnectionId);
  }

  return connection || null;
}

/**
 * Get credentials for sending WhatsApp messages
 */
export async function getWhatsAppCredentials(channelConnectionId: string | null): Promise<{
  phoneNumberId: string;
  accessToken: string;
  displayNumber: string;
} | null> {
  const connection = await getWhatsAppConnection(channelConnectionId);
  if (!connection) {
    return null;
  }

  return {
    phoneNumberId: connection.phoneNumberId,
    accessToken: connection.accessToken,
    displayNumber: connection.displayNumber,
  };
}

/**
 * Get the first active connection (fallback)
 */
export async function getDefaultWhatsAppConnection(): Promise<WhatsAppConnection | null> {
  const connections = await loadConnections();
  return connections.find((c) => c.isActive) || connections[0] || null;
}

/**
 * Invalidate cache (call when connections are updated)
 */
export function invalidateConnectionsCache(): void {
  cachedConnections = null;
  lastLoadTime = 0;
}

console.log('[WhatsApp Connections] 🐘 Using PostgreSQL storage');
