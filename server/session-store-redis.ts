import type { SessionStore, ConversationSession } from '../src/runtime/session';
import { getRedisClient } from './utils/redis';
import { logDebug, logError } from './utils/file-logger';

export class RedisSessionStore implements SessionStore {
  private readonly prefix = 'bot:session:';
  private readonly ttl = 24 * 60 * 60; // 24 horas en segundos

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(this.prefix + sessionId);
      
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data) as ConversationSession;
      logDebug(`[RedisSession] ✅ Sesión recuperada: ${sessionId}`);
      return parsed;
    } catch (error) {
      logError(`[RedisSession] Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  async saveSession(session: ConversationSession): Promise<void> {
    try {
      const redis = getRedisClient();
      
      // Actualizar timestamp
      const updated = {
        ...session,
        updatedAt: new Date().toISOString(),
      };
      
      const serialized = JSON.stringify(updated);
      await redis.setex(this.prefix + session.id, this.ttl, serialized);
      
      logDebug(`[RedisSession] ✅ Sesión guardada: ${session.id}`);
    } catch (error) {
      logError(`[RedisSession] Error saving session ${session.id}:`, error);
      throw error;
    }
  }

  async createSession(seed: Omit<ConversationSession, "createdAt" | "updatedAt">): Promise<ConversationSession> {
    try {
      const now = new Date().toISOString();
      const session: ConversationSession = {
        ...seed,
        createdAt: now,
        updatedAt: now,
      };

      const redis = getRedisClient();
      const serialized = JSON.stringify(session);
      await redis.setex(this.prefix + session.id, this.ttl, serialized);

      logDebug(`[RedisSession] ✅ Sesión creada: ${session.id}`);
      return session;
    } catch (error) {
      logError(`[RedisSession] Error creating session ${seed.id}:`, error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.prefix + sessionId);
      logDebug(`[RedisSession] ✅ Sesión eliminada: ${sessionId}`);
    } catch (error) {
      logError(`[RedisSession] Error deleting session ${sessionId}:`, error);
    }
  }

  // Métodos adicionales útiles
  async clear(contactId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      // Buscar todas las sesiones de este contacto
      const pattern = this.prefix + '*';
      const keys = await redis.keys(pattern);
      
      const toDelete: string[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const session = JSON.parse(data) as ConversationSession;
          if (session.contactId === contactId) {
            toDelete.push(key);
          }
        }
      }
      
      if (toDelete.length > 0) {
        await redis.del(...toDelete);
        logDebug(`[RedisSession] ✅ ${toDelete.length} sesiones eliminadas para contacto: ${contactId}`);
      }
    } catch (error) {
      logError(`[RedisSession] Error clearing sessions for ${contactId}:`, error);
    }
  }

  async listAll(): Promise<ConversationSession[]> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(this.prefix + '*');
      
      const sessions: ConversationSession[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          sessions.push(JSON.parse(data));
        }
      }
      
      return sessions;
    } catch (error) {
      logError(`[RedisSession] Error listing sessions:`, error);
      return [];
    }
  }
}
