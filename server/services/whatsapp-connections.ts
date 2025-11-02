import fs from "fs/promises";
import path from "path";

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

interface WhatsAppConnectionsData {
  connections: WhatsAppConnection[];
}

const CONNECTIONS_PATH = path.join(process.cwd(), "data", "whatsapp-connections.json");

let cachedConnections: WhatsAppConnection[] | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Load WhatsApp connections from file with caching
 */
async function loadConnections(): Promise<WhatsAppConnection[]> {
  const now = Date.now();
  if (cachedConnections && (now - lastLoadTime) < CACHE_TTL) {
    return cachedConnections;
  }

  try {
    const data = await fs.readFile(CONNECTIONS_PATH, "utf-8");
    const parsed = JSON.parse(data) as WhatsAppConnectionsData;
    cachedConnections = parsed.connections || [];
    lastLoadTime = now;
    return cachedConnections;
  } catch (error) {
    console.error("[WhatsApp Connections] Error loading connections:", error);
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
