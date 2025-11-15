import Redis from 'ioredis';
import { logDebug, logError } from './file-logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    // Conectar a Redis en Docker (red azanet, IP 172.19.0.3)
    redisClient = new Redis({
      host: '172.19.0.3',
      port: 6379,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logDebug('[Redis] ✅ Conectado exitosamente');
    });

    redisClient.on('error', (err) => {
      logError('[Redis] ❌ Error de conexión:', err);
    });

    redisClient.on('ready', () => {
      logDebug('[Redis] 🟢 Listo para usar');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logDebug('[Redis] Conexión cerrada');
  }
}

// Health check
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logError('[Redis] Health check failed:', error);
    return false;
  }
}
