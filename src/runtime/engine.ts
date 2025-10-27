import { type ChannelKey, type Flow } from "../flow/types";
import { NodeExecutor, type IncomingMessage, type OutboundMessage } from "./executor";
import {
  type ConversationSession,
  type SessionStore,
  InMemorySessionStore,
  appendInteraction,
} from "./session";

export interface FlowProvider {
  getFlow(flowId: string): Promise<Flow | null>;
}

export interface RuntimeEngineOptions {
  flowProvider: FlowProvider;
  sessionStore?: SessionStore;
  executor?: NodeExecutor;
}

export interface ProcessMessageInput {
  sessionId: string;
  flowId: string;
  channel: ChannelKey;
  contactId: string;
  message: IncomingMessage;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface ProcessMessageOutput {
  responses: OutboundMessage[];
  session: ConversationSession | null;
  ended: boolean;
}

export class RuntimeEngine {
  private readonly flowProvider: FlowProvider;

  private readonly sessionStore: SessionStore;

  private readonly executor: NodeExecutor;

  constructor(options: RuntimeEngineOptions) {
    this.flowProvider = options.flowProvider;
    this.sessionStore = options.sessionStore ?? new InMemorySessionStore();
    this.executor = options.executor ?? new NodeExecutor();
  }

  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const flow = await this.flowProvider.getFlow(input.flowId);
    if (!flow) {
      return {
        responses: [
          {
            type: "system",
            payload: { level: "error", message: `Flow ${input.flowId} not found` },
          },
        ],
        session: null,
        ended: true,
      };
    }

    let session = await this.sessionStore.getSession(input.sessionId);
    if (!session) {
      session = await this.sessionStore.createSession({
        id: input.sessionId,
        flowId: input.flowId,
        channel: input.channel,
        contactId: input.contactId,
        currentNodeId: flow.rootId,
        awaitingNodeId: null,
        variables: {},
        history: [],
        lastInboundAt: null,
      });
    }

    const now = input.now ?? new Date();
    session = appendInteraction(session, {
      type: "inbound",
      timestamp: now.toISOString(),
      payload: { ...input.message, metadata: input.metadata },
    });
    session.lastInboundAt = now.toISOString();

    const responses: OutboundMessage[] = [];
    let ended = false;

    if (session.awaitingNodeId) {
      const waitingNode = flow.nodes[session.awaitingNodeId];
      if (waitingNode) {
        const result = await this.executor.execute(flow, waitingNode, session, input.message, { now });
        responses.push(...result.responses);
        if (result.variables) {
          session.variables = { ...session.variables, ...result.variables };
        }
        if (result.ended) {
          ended = true;
        }
        if (result.awaitingUserInput) {
          session.awaitingNodeId = result.nextNodeId ?? waitingNode.id;
          session.currentNodeId = result.nextNodeId ?? waitingNode.id;
          this.appendOutboundInteractions(session, responses, now);
          await this.persistSession(session);
          return { responses, session, ended };
        }
        session.awaitingNodeId = null;
        session.currentNodeId = result.nextNodeId ?? null;
        ended = ended || (!result.nextNodeId && Boolean(result.ended));
        await this.runAutomaticNodes(flow, session, result.nextNodeId, responses, now);
        this.appendOutboundInteractions(session, responses, now);
        if (ended || session.currentNodeId == null) {
          if (result.ended) {
            await this.sessionStore.deleteSession(session.id);
            return { responses, session: null, ended: true };
          }
        }
        await this.persistSession(session);
        return { responses, session, ended: session.currentNodeId == null };
      }
      session.awaitingNodeId = null;
    }

    await this.runAutomaticNodes(flow, session, session.currentNodeId ?? flow.rootId, responses, now, input.message);
    this.appendOutboundInteractions(session, responses, now);

    if (!session.currentNodeId) {
      await this.sessionStore.deleteSession(session.id);
      return { responses, session: null, ended: true };
    }

    await this.persistSession(session);
    return { responses, session, ended };
  }

  private async runAutomaticNodes(
    flow: Flow,
    session: ConversationSession,
    startNodeId: string | null,
    responses: OutboundMessage[],
    now: Date,
    initialMessage: IncomingMessage | null = null,
  ): Promise<void> {
    let nextNodeId = startNodeId;
    let message = initialMessage;
    while (nextNodeId) {
      const node = flow.nodes[nextNodeId];
      if (!node) {
        session.currentNodeId = null;
        return;
      }
      const result = await this.executor.execute(flow, node, session, message, { now });
      responses.push(...result.responses);
      if (result.variables) {
        session.variables = { ...session.variables, ...result.variables };
      }
      if (result.ended) {
        session.currentNodeId = null;
        return;
      }
      if (result.awaitingUserInput) {
        session.awaitingNodeId = node.id;
        session.currentNodeId = result.nextNodeId ?? node.id;
        return;
      }
      nextNodeId = result.nextNodeId;
      session.currentNodeId = nextNodeId;
      message = null;
      if (!nextNodeId) {
        session.currentNodeId = null;
      }
    }
  }

  private appendOutboundInteractions(session: ConversationSession, responses: OutboundMessage[], now: Date): void {
    for (const response of responses) {
      const updated = appendInteraction(session, {
        type: "outbound",
        timestamp: now.toISOString(),
        payload: response as Record<string, unknown>,
      });
      session.history = updated.history;
      session.updatedAt = updated.updatedAt;
    }
  }

  private async persistSession(session: ConversationSession): Promise<void> {
    await this.sessionStore.saveSession(session);
  }
}
