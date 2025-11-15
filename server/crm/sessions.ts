import { promises as fs } from 'fs';
import path from 'path';

export interface Session {
  id: string;
  advisorId: string;
  conversationId: string;
  startTime: number;
  endTime: number | null;
  duration: number | null; // in milliseconds
}

interface SessionsData {
  sessions: Session[];
}

const SESSIONS_FILE = path.join(process.cwd(), 'data', 'crm-sessions.json');

class SessionsStorage {
  private data: SessionsData = { sessions: [] };
  private initialized = false;

  async init() {
    if (this.initialized) return;

    try {
      const content = await fs.readFile(SESSIONS_FILE, 'utf-8');
      this.data = JSON.parse(content);
      console.log(`[Sessions] Loaded ${this.data.sessions.length} sessions`);
    } catch (error) {
      // File doesn't exist yet
      this.data = { sessions: [] };
      await this.save();
    }

    this.initialized = true;
  }

  private async save() {
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async startSession(advisorId: string, conversationId: string): Promise<Session> {
    await this.init();

    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      advisorId,
      conversationId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
    };

    this.data.sessions.push(session);
    await this.save();

    console.log(`[Sessions] Started session ${session.id} for advisor ${advisorId}`);
    return session;
  }

  async endSession(sessionId: string): Promise<Session | null> {
    await this.init();

    const session = this.data.sessions.find(s => s.id === sessionId);
    if (!session) return null;

    if (session.endTime) {
      console.warn(`[Sessions] Session ${sessionId} already ended`);
      return session;
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;

    await this.save();

    console.log(`[Sessions] Ended session ${sessionId}, duration: ${(session.duration / 1000 / 60).toFixed(2)} minutes`);
    return session;
  }

  async getActiveSession(conversationId: string): Promise<Session | null> {
    await this.init();

    return this.data.sessions.find(
      s => s.conversationId === conversationId && s.endTime === null
    ) || null;
  }

  async getAdvisorSessions(advisorId: string, startDate?: number, endDate?: number): Promise<Session[]> {
    await this.init();

    let sessions = this.data.sessions.filter(s => s.advisorId === advisorId);

    if (startDate) {
      sessions = sessions.filter(s => s.startTime >= startDate);
    }

    if (endDate) {
      sessions = sessions.filter(s => s.startTime <= endDate);
    }

    return sessions;
  }

  async getAdvisorStats(advisorId: string, period: 'day' | 'week' | 'month'): Promise<{
    totalSessions: number;
    completedSessions: number;
    activeSessions: number;
    totalDuration: number;
    averageDuration: number;
  }> {
    await this.init();

    const now = Date.now();
    let startDate: number;

    switch (period) {
      case 'day':
        startDate = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startDate = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startDate = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const sessions = await this.getAdvisorSessions(advisorId, startDate);
    const completedSessions = sessions.filter(s => s.endTime !== null);
    const activeSessions = sessions.filter(s => s.endTime === null);

    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const averageDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      activeSessions: activeSessions.length,
      totalDuration,
      averageDuration,
    };
  }

  async getAllAdvisorsStats(period: 'day' | 'week' | 'month'): Promise<Array<{
    advisorId: string;
    stats: Awaited<ReturnType<typeof this.getAdvisorStats>>;
  }>> {
    await this.init();

    const now = Date.now();
    let startDate: number;

    switch (period) {
      case 'day':
        startDate = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startDate = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startDate = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const recentSessions = this.data.sessions.filter(s => s.startTime >= startDate);
    const advisorIds = [...new Set(recentSessions.map(s => s.advisorId))];

    const results = await Promise.all(
      advisorIds.map(async advisorId => ({
        advisorId,
        stats: await this.getAdvisorStats(advisorId, period),
      }))
    );

    return results;
  }
}

// Select storage based on environment variable
import { sessionsStorageDB } from './sessions-db';

const storageMode = process.env.SESSIONS_STORAGE_MODE || 'postgres';

let sessionsStorageInstance: any;

if (storageMode === 'postgres') {
  console.log('[Sessions] 🐘 Using PostgreSQL storage mode');
  sessionsStorageInstance = sessionsStorageDB;
} else {
  console.log('[Sessions] 📄 Using JSON file storage mode');
  sessionsStorageInstance = new SessionsStorage();
}

export const sessionsStorage = sessionsStorageInstance;
