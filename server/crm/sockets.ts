import { createHash, randomUUID } from "crypto";
import type { IncomingMessage, Server as HttpServer } from "http";
import type { Socket as NetSocket } from "net";
import { crmDb } from "./db";
import type { CRMEmitConversation, CRMEmitMessage } from "./models";

const SOCKET_PATH = "/api/crm/socket";
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export const SOCKET_EVENTS = {
  conversationUpdate: "crm:conv:update",
  messageNew: "crm:msg:new",
  messageUpdate: "crm:msg:update",
  typing: "crm:typing",
  read: "crm:read",
} as const;

type ClientId = string;

interface ClientConnection {
  id: ClientId;
  socket: NetSocket;
  buffer: Buffer;
}

interface ParsedFrame {
  opcode: number;
  payload: Buffer;
  fin: boolean;
}

export class CrmRealtimeManager {
  private readonly clients = new Map<ClientId, ClientConnection>();

  constructor(private readonly server: HttpServer) {
    this.server.on("upgrade", (req, socket, head) => {
      if (!req.url) {
        socket.destroy();
        return;
      }
      const url = safeParseUrl(req);
      if (!url || url.pathname !== SOCKET_PATH) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }
      const keyHeader = req.headers["sec-websocket-key"];
      if (typeof keyHeader !== "string" || keyHeader.trim() === "") {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }
      this.acceptConnection(req, socket, head, keyHeader);
    });
  }

  emitNewMessage(payload: CRMEmitMessage) {
    this.broadcast(SOCKET_EVENTS.messageNew, payload);
  }

  emitMessageUpdate(payload: CRMEmitMessage) {
    this.broadcast(SOCKET_EVENTS.messageUpdate, payload);
  }

  emitConversationUpdate(payload: CRMEmitConversation) {
    this.broadcast(SOCKET_EVENTS.conversationUpdate, payload);
  }

  private acceptConnection(req: IncomingMessage, socket: NetSocket, head: Buffer, key: string) {
    try {
      const acceptKey = createHash("sha1").update(key + WEBSOCKET_GUID).digest("base64");
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
          "Sec-WebSocket-Version: 13\r\n" +
          "\r\n",
      );
    } catch (error) {
      console.warn("[CRM] WebSocket handshake failed", error);
      socket.destroy();
      return;
    }

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 20_000);

    const id = randomUUID();
    const client: ClientConnection = { id, socket, buffer: Buffer.alloc(0) };
    this.clients.set(id, client);

    socket.on("data", (chunk) => this.handleSocketData(client, chunk));
    socket.on("error", () => this.dropClient(id));
    socket.on("end", () => this.dropClient(id));
    socket.on("close", () => this.dropClient(id));

    this.send(client, "connected", { clientId: id });

    if (head && head.length > 0) {
      this.handleSocketData(client, head);
    }
  }

  private handleSocketData(client: ClientConnection, chunk: Buffer) {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    while (true) {
      const frame = this.extractFrame(client);
      if (!frame) break;
      if (!frame.fin) {
        continue;
      }
      switch (frame.opcode) {
        case 0x1: { // text frame
          this.handleClientMessage(client, frame.payload);
          break;
        }
        case 0x8: { // close
          this.dropClient(client.id);
          return;
        }
        case 0x9: { // ping
          this.sendControlFrame(client, 0xA, frame.payload);
          break;
        }
        case 0xA: {
          // pong, ignore
          break;
        }
        default:
          break;
      }
    }
  }

  private handleClientMessage(client: ClientConnection, payload: Buffer) {
    try {
      const text = payload.toString("utf8");
      const message = JSON.parse(text) as { event?: string; payload?: unknown };
      if (!message || typeof message.event !== "string") {
        return;
      }
      this.handleClientEvent(client, message.event, message.payload);
    } catch (error) {
      console.warn("[CRM] Mensaje WebSocket inválido", error);
    }
  }

  private handleClientEvent(client: ClientConnection, event: string, data: unknown) {
    switch (event) {
      case SOCKET_EVENTS.read: {
        if (typeof data === "string") {
          crmDb.markConversationRead(data);
          const conversation = crmDb.getConversationById(data);
          if (conversation) {
            this.emitConversationUpdate({ conversation });
          }
        }
        break;
      }
      case SOCKET_EVENTS.typing: {
        this.broadcast(SOCKET_EVENTS.typing, data, client.id);
        break;
      }
      default:
        break;
    }
  }

  private extractFrame(client: ClientConnection): ParsedFrame | null {
    const buffer = client.buffer;
    if (buffer.length < 2) {
      return null;
    }
    const first = buffer[0];
    const second = buffer[1];
    const fin = (first & 0x80) === 0x80;
    const opcode = first & 0x0f;
    let offset = 2;
    let payloadLength = second & 0x7f;
    const masked = (second & 0x80) === 0x80;

    if (payloadLength === 126) {
      if (buffer.length < offset + 2) return null;
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (buffer.length < offset + 8) return null;
      const length64 = buffer.readBigUInt64BE(offset);
      payloadLength = Number(length64);
      offset += 8;
    }

    let mask: Buffer | null = null;
    if (masked) {
      if (buffer.length < offset + 4) return null;
      mask = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + payloadLength) {
      return null;
    }

    const payload = buffer.slice(offset, offset + payloadLength);
    client.buffer = buffer.slice(offset + payloadLength);

    let unmasked = payload;
    if (masked && mask) {
      const maskBytes = mask;
      unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) {
        unmasked[i] = payload[i] ^ maskBytes[i % 4];
      }
    }

    return { opcode, payload: unmasked, fin };
  }

  private broadcast(event: string, payload: unknown, excludeId?: ClientId) {
    const frame = encodeTextMessage(event, payload);
    for (const [id, client] of this.clients.entries()) {
      if (excludeId && id === excludeId) continue;
      try {
        client.socket.write(frame);
      } catch (error) {
        console.warn("[CRM] no se pudo enviar evento a cliente", error);
        this.dropClient(id);
      }
    }
  }

  private send(client: ClientConnection, event: string, payload: unknown) {
    const frame = encodeTextMessage(event, payload);
    try {
      client.socket.write(frame);
    } catch (error) {
      console.warn("[CRM] envío a cliente falló", error);
      this.dropClient(client.id);
    }
  }

  private sendControlFrame(client: ClientConnection, opcode: number, payload: Buffer) {
    const frame = encodeFrame(payload, opcode);
    try {
      client.socket.write(frame);
    } catch (error) {
      this.dropClient(client.id);
    }
  }

  private dropClient(clientId: ClientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);
    try {
      client.socket.destroy();
    } catch (error) {
      console.warn("[CRM] error cerrando socket", error);
    }
  }
}

export function createCrmRealtimeManager(server: HttpServer) {
  return new CrmRealtimeManager(server);
}

function encodeTextMessage(event: string, payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify({ event, payload }), "utf8");
  return encodeFrame(body, 0x1);
}

function encodeFrame(payload: Buffer, opcode: number): Buffer {
  const length = payload.length;
  let headerLength = 2;
  if (length >= 126 && length < 65_536) {
    headerLength = 4;
  } else if (length >= 65_536) {
    headerLength = 10;
  }

  const frame = Buffer.alloc(headerLength + length);
  frame[0] = 0x80 | (opcode & 0x0f);

  if (length < 126) {
    frame[1] = length;
    payload.copy(frame, 2);
  } else if (length < 65_536) {
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
  } else {
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
    payload.copy(frame, 10);
  }

  return frame;
}

function safeParseUrl(req: IncomingMessage): URL | null {
  try {
    return new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
  } catch {
    return null;
  }
}
