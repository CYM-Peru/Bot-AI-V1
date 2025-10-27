/**
 * Persistent Session Storage
 *
 * Implementaciones de almacenamiento persistente de sesiones para producción.
 * Soporta Redis y almacenamiento en archivos.
 */

import type { ConversationSession, SessionStore } from "../src/runtime/session";
import { promises as fs } from "fs";
import path from "path";

/**
 * File-based Session Store
 *
 * Almacena sesiones en archivos JSON en el sistema de archivos.
 * Útil para desarrollo y deployment simple.
 */
export class FileSessionStore implements SessionStore {
  private readonly storageDir: string;

  constructor(storageDir: string = "./data/sessions") {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const filePath = this.getSessionPath(sessionId);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as ConversationSession;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      console.error(`[FileSessionStore] Error reading session ${sessionId}:`, error);
      return null;
    }
  }

  async saveSession(session: ConversationSession): Promise<void> {
    try {
      const filePath = this.getSessionPath(session.id);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
    } catch (error) {
      console.error(`[FileSessionStore] Error saving session ${session.id}:`, error);
      throw error;
    }
  }

  async createSession(seed: Omit<ConversationSession, "createdAt" | "updatedAt">): Promise<ConversationSession> {
    const now = new Date().toISOString();
    const session: ConversationSession = {
      ...seed,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveSession(session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.getSessionPath(sessionId);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[FileSessionStore] Error deleting session ${sessionId}:`, error);
      }
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files.filter((file) => file.endsWith(".json")).map((file) => file.replace(".json", ""));
    } catch (error) {
      console.error("[FileSessionStore] Error listing sessions:", error);
      return [];
    }
  }

  async clearExpiredSessions(maxAgeHours: number): Promise<number> {
    try {
      const sessionIds = await this.listSessions();
      let deletedCount = 0;
      const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          const lastActivity = session.lastInboundAt ? new Date(session.lastInboundAt).getTime() : new Date(session.updatedAt).getTime();

          if (lastActivity < cutoff) {
            await this.deleteSession(sessionId);
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error("[FileSessionStore] Error clearing expired sessions:", error);
      return 0;
    }
  }

  private getSessionPath(sessionId: string): string {
    const sanitizedId = sessionId.replace(/[^a-zA-Z0-9-_]/g, "_");
    return path.join(this.storageDir, `${sanitizedId}.json`);
  }

  private ensureStorageDir(): void {
    try {
      fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error("[FileSessionStore] Error creating storage directory:", error);
    }
  }
}

/**
 * Redis Session Store
 *
 * Almacena sesiones en Redis para alta disponibilidad y rendimiento.
 * Recomendado para producción con múltiples instancias del servidor.
 */
export class RedisSessionStore implements SessionStore {
  private redis: any; // RedisClientType
  private readonly keyPrefix: string;
  private readonly ttl: number;

  constructor(redisClient: any, options: { keyPrefix?: string; ttlSeconds?: number } = {}) {
    this.redis = redisClient;
    this.keyPrefix = options.keyPrefix ?? "bot:session:";
    this.ttl = options.ttlSeconds ?? 24 * 60 * 60; // 24 horas por defecto
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const key = this.getKey(sessionId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as ConversationSession;
    } catch (error) {
      console.error(`[RedisSessionStore] Error reading session ${sessionId}:`, error);
      return null;
    }
  }

  async saveSession(session: ConversationSession): Promise<void> {
    try {
      const key = this.getKey(session.id);
      const data = JSON.stringify(session);

      await this.redis.setEx(key, this.ttl, data);
    } catch (error) {
      console.error(`[RedisSessionStore] Error saving session ${session.id}:`, error);
      throw error;
    }
  }

  async createSession(seed: Omit<ConversationSession, "createdAt" | "updatedAt">): Promise<ConversationSession> {
    const now = new Date().toISOString();
    const session: ConversationSession = {
      ...seed,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveSession(session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      await this.redis.del(key);
    } catch (error) {
      console.error(`[RedisSessionStore] Error deleting session ${sessionId}:`, error);
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      return keys.map((key: string) => key.replace(this.keyPrefix, ""));
    } catch (error) {
      console.error("[RedisSessionStore] Error listing sessions:", error);
      return [];
    }
  }

  async clearExpiredSessions(maxAgeHours: number): Promise<number> {
    // Redis ya maneja expiración automáticamente con TTL
    // Esta función es opcional aquí
    return 0;
  }

  private getKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }
}

/**
 * Hybrid Session Store
 *
 * Combina Redis (caché) con almacenamiento en archivos (persistencia).
 * Ofrece velocidad de Redis con respaldo en disco.
 */
export class HybridSessionStore implements SessionStore {
  private readonly redis: RedisSessionStore;
  private readonly file: FileSessionStore;

  constructor(redisClient: any, fileStorageDir: string) {
    this.redis = new RedisSessionStore(redisClient);
    this.file = new FileSessionStore(fileStorageDir);
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    // Intentar obtener de Redis primero
    let session = await this.redis.getSession(sessionId);

    if (session) {
      return session;
    }

    // Si no está en Redis, buscar en archivos
    session = await this.file.getSession(sessionId);

    if (session) {
      // Restaurar a Redis
      await this.redis.saveSession(session);
    }

    return session;
  }

  async saveSession(session: ConversationSession): Promise<void> {
    // Guardar en ambos lugares
    await Promise.all([
      this.redis.saveSession(session),
      this.file.saveSession(session),
    ]);
  }

  async createSession(seed: Omit<ConversationSession, "createdAt" | "updatedAt">): Promise<ConversationSession> {
    const session = await this.redis.createSession(seed);
    await this.file.saveSession(session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.redis.deleteSession(sessionId),
      this.file.deleteSession(sessionId),
    ]);
  }
}

/**
 * Factory para crear session store según configuración
 */
export function createSessionStore(config: {
  type: "memory" | "file" | "redis" | "hybrid";
  fileStorageDir?: string;
  redisClient?: any;
}): SessionStore {
  switch (config.type) {
    case "file":
      return new FileSessionStore(config.fileStorageDir);

    case "redis":
      if (!config.redisClient) {
        throw new Error("Redis client is required for Redis session store");
      }
      return new RedisSessionStore(config.redisClient);

    case "hybrid":
      if (!config.redisClient) {
        throw new Error("Redis client is required for hybrid session store");
      }
      return new HybridSessionStore(config.redisClient, config.fileStorageDir ?? "./data/sessions");

    case "memory":
    default:
      const { InMemorySessionStore } = require("../src/runtime/session");
      return new InMemorySessionStore();
  }
}
