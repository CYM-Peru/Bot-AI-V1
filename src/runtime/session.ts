import { ChannelKey } from "../flow/types";

export interface InteractionRecord {
  type: "inbound" | "outbound" | "system";
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ConversationSession {
  id: string;
  flowId: string;
  channel: ChannelKey;
  contactId: string;
  currentNodeId: string | null;
  awaitingNodeId: string | null;
  variables: Record<string, string>;
  history: InteractionRecord[];
  createdAt: string;
  updatedAt: string;
  lastInboundAt: string | null;
}

export type SessionUpdate = Partial<Omit<ConversationSession, "id" | "flowId" | "contactId" | "channel" | "createdAt">>;

export interface SessionStore {
  getSession(sessionId: string): Promise<ConversationSession | null>;
  saveSession(session: ConversationSession): Promise<void>;
  createSession(seed: Omit<ConversationSession, "createdAt" | "updatedAt">): Promise<ConversationSession>;
  deleteSession(sessionId: string): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, ConversationSession>();

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async saveSession(session: ConversationSession): Promise<void> {
    const normalized = {
      ...session,
      updatedAt: new Date().toISOString(),
    } satisfies ConversationSession;
    this.sessions.set(session.id, normalized);
  }

  async createSession(seed: Omit<ConversationSession, "createdAt" | "updatedAt">): Promise<ConversationSession> {
    const now = new Date().toISOString();
    const session: ConversationSession = {
      ...seed,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export function appendInteraction(
  session: ConversationSession,
  record: InteractionRecord,
): ConversationSession {
  const history = session.history.length > 1000 ? session.history.slice(-1000) : session.history;
  return {
    ...session,
    history: [...history, record],
    updatedAt: new Date().toISOString(),
  };
}
