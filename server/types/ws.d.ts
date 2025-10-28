declare module "ws" {
  import { EventEmitter } from "node:events";
  import type { Server as HttpServer } from "http";

  export type RawData = string | Buffer | ArrayBuffer | Buffer[];

  export interface WebSocketServerOptions {
    server: HttpServer;
    path?: string;
  }

  export class WebSocket extends EventEmitter {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;
    readonly readyState: number;
    ping(data?: RawData): void;
    send(data: RawData | string): void;
    close(code?: number, reason?: string | Buffer): void;
    terminate(): void;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options: WebSocketServerOptions);
    readonly clients: Set<WebSocket>;
    close(cb?: () => void): void;
  }
}
