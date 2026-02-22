import { randomUUID } from "node:crypto";
import { createLogger } from "@actant/shared";

const logger = createLogger("session-registry");

const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TTL_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

export type SessionState = "active" | "idle" | "expired";

export interface SessionLease {
  sessionId: string;
  agentName: string;
  /** Currently-bound client identifier. null when idle (client disconnected). */
  clientId: string | null;
  state: SessionState;
  createdAt: string;
  lastActivityAt: string;
  /** Milliseconds of idle time before the session expires. */
  idleTtlMs: number;
}

export interface CreateSessionOptions {
  agentName: string;
  clientId: string;
  idleTtlMs?: number;
}

export interface SessionRegistryOptions {
  defaultIdleTtlMs?: number;
  ttlCheckIntervalMs?: number;
}

/**
 * In-memory registry of Session Lease objects.
 * Tracks which client owns which session, handles idle/expire transitions,
 * and runs a periodic sweep to expire stale sessions.
 */
export class SessionRegistry {
  private sessions = new Map<string, SessionLease>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly defaultIdleTtlMs: number;
  private onExpireCallback?: (session: SessionLease) => void;

  constructor(options?: SessionRegistryOptions) {
    this.defaultIdleTtlMs = options?.defaultIdleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    const interval = options?.ttlCheckIntervalMs ?? TTL_CHECK_INTERVAL_MS;
    this.sweepTimer = setInterval(() => this.sweepExpired(), interval);
    this.sweepTimer.unref();
  }

  /** Register a callback invoked when a session expires. */
  onExpire(callback: (session: SessionLease) => void): void {
    this.onExpireCallback = callback;
  }

  /** Create a new session for an agent, bound to a client. */
  create(opts: CreateSessionOptions): SessionLease {
    const now = new Date().toISOString();
    const session: SessionLease = {
      sessionId: randomUUID(),
      agentName: opts.agentName,
      clientId: opts.clientId,
      state: "active",
      createdAt: now,
      lastActivityAt: now,
      idleTtlMs: opts.idleTtlMs ?? this.defaultIdleTtlMs,
    };
    this.sessions.set(session.sessionId, session);
    logger.info({ sessionId: session.sessionId, agentName: opts.agentName, clientId: opts.clientId }, "Session created");
    return session;
  }

  /** Get a session by ID, or undefined if not found. */
  get(sessionId: string): SessionLease | undefined {
    return this.sessions.get(sessionId);
  }

  /** List all sessions, optionally filtered by agent name. */
  list(agentName?: string): SessionLease[] {
    const all = Array.from(this.sessions.values());
    return agentName ? all.filter((s) => s.agentName === agentName) : all;
  }

  /**
   * Record activity on a session, updating lastActivityAt
   * and ensuring state is "active".
   */
  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === "expired") return;
    session.lastActivityAt = new Date().toISOString();
    session.state = "active";
  }

  /**
   * Mark a session as idle (client disconnected but session is kept alive).
   * The session will expire after its idleTtlMs elapses.
   */
  release(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === "expired") return;
    session.clientId = null;
    session.state = "idle";
    session.lastActivityAt = new Date().toISOString();
    logger.info({ sessionId, agentName: session.agentName }, "Session released to idle");
  }

  /**
   * Resume an idle session, binding it to a (potentially new) client.
   * Returns false if the session is not found, expired, or already active.
   */
  resume(sessionId: string, clientId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === "expired") return false;
    if (session.state === "active" && session.clientId !== null) return false;

    session.clientId = clientId;
    session.state = "active";
    session.lastActivityAt = new Date().toISOString();
    logger.info({ sessionId, clientId, agentName: session.agentName }, "Session resumed");
    return true;
  }

  /** Explicitly close and remove a session. */
  close(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    logger.info({ sessionId, agentName: session.agentName }, "Session closed");
    return true;
  }

  /** Close all sessions for a given agent. */
  closeByAgent(agentName: string): number {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.agentName === agentName) {
        this.sessions.delete(id);
        count++;
      }
    }
    if (count > 0) {
      logger.info({ agentName, count }, "Sessions closed for agent");
    }
    return count;
  }

  /** Number of active sessions. */
  get size(): number {
    return this.sessions.size;
  }

  /** Stop the TTL sweep timer and clear all sessions. */
  dispose(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.sessions.clear();
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.state !== "idle") continue;

      const lastActivity = new Date(session.lastActivityAt).getTime();
      if (now - lastActivity > session.idleTtlMs) {
        session.state = "expired";
        this.sessions.delete(id);
        logger.info({ sessionId: id, agentName: session.agentName, idleMs: now - lastActivity }, "Session expired (TTL)");
        this.onExpireCallback?.(session);
      }
    }
  }
}
