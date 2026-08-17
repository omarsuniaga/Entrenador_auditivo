/**
 * Hand-rolled minimal ambient types for the Cloudflare Workers/Durable Objects runtime
 * APIs this project actually uses. The project deliberately doesn't depend on
 * `@cloudflare/workers-types` (see the equally hand-rolled D1 interfaces in
 * worker/index.ts) so `tsc --noEmit` stays self-contained without an extra devDependency.
 * These are TYPE-ONLY — the real objects are provided by the Workers runtime at request
 * time and are not constructed from these declarations.
 */

export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
  readonly id: DurableObjectId;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;
  getAlarm(): Promise<number | null>;
}

export interface DurableObjectState {
  readonly id: DurableObjectId;
  readonly storage: DurableObjectStorage;
  /** Registers a WebSocket for hibernation: the DO may be evicted from memory while the
   * socket stays open, and wakes on the next message/close/alarm. Tags let handlers
   * recover per-socket metadata (here, the playerId) after such a wake. */
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  getTags(ws: WebSocket): string[];
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

/** The 101-response `Response` constructor accepts a `webSocket` field in Workers that
 * standard DOM `ResponseInit` doesn't declare. */
export interface WebSocketResponseInit extends ResponseInit {
  webSocket: WebSocket;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
    constructor();
  }
}
