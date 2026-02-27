import { randomUUID } from "node:crypto";
import { createLogger } from "@actant/shared";
import type { SessionLifecycleData } from "@actant/shared";
import type { EventJournal } from "../journal/event-journal";

const logger = createLogger("session-registry");

const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TTL_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

export type SessionState = "active" | "idle" | "expired";

export interface SessionLease {
  /** Ephemeral lease ID — used as the API session identifier for runtime calls. */
  sessionId: string;
  agentName: string;
  /** Currently-bound client identifier. null when idle (client disconnected). */
  clientId: string | null;
  state: SessionState;
  createdAt: string;
  lastActivityAt: string;
  /** Milliseconds of idle time before the session expires. */
  idleTtlMs: number;
  /**
   * Stable conversation thread ID used for activity recording.
   * Multiple leases (reconnections) share the same conversationId so all
   * messages accumulate in one continuous on-disk conversation record.
   * Auto-generated if not provided on create().
   */
  conversationId: string;
}

export interface CreateSessionOptions {
  agentName: string;
  clientId: string;
  idleTtlMs?: number;
  /** Provide to continue an existing conversation; omit to start a fresh one. */
  conversationId?: string;
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
  private journal: EventJournal | null = null;

  constructor(options?: SessionRegistryOptions) {
    this.defaultIdleTtlMs = options?.defaultIdleTtlMs ?? DEFAULT_IDLE_TTL_MS;
    const interval = options?.ttlCheckIntervalMs ?? TTL_CHECK_INTERVAL_MS;
    this.sweepTimer = setInterval(() => this.sweepExpired(), interval);
    this.sweepTimer.unref();
  }

  /** Attach an EventJournal so session lifecycle events are persisted to disk. */
  setJournal(journal: EventJournal | null): void {
    this.journal = journal;
  }

  /**
   * Rebuild in-memory session state by replaying journal entries.
   * Should be called once at startup, before accepting new requests.
   */
  async rebuildFromJournal(journal: EventJournal): Promise<void> {
    const count = await journal.replay("session", (entry) => {
      const d = entry.data as SessionLifecycleData;
      switch (d.action) {
        case "created": {
          const lease: SessionLease = {
            sessionId: d.sessionId,
            agentName: d.agentName,
            clientId: d.clientId ?? null,
            state: "active",
            createdAt: new Date(entry.ts).toISOString(),
            lastActivityAt: new Date(entry.ts).toISOString(),
            idleTtlMs: d.idleTtlMs ?? this.defaultIdleTtlMs,
            conversationId: d.conversationId ?? d.sessionId,
          };
          this.sessions.set(d.sessionId, lease);
          break;
        }
        case "released": {
          const s = this.sessions.get(d.sessionId);
          if (s) {
            s.clientId = null;
            s.state = "idle";
            s.lastActivityAt = new Date(entry.ts).toISOString();
          }
          break;
        }
        case "resumed": {
          const s = this.sessions.get(d.sessionId);
          if (s) {
            s.clientId = d.clientId ?? null;
            s.state = "active";
            s.lastActivityAt = new Date(entry.ts).toISOString();
          }
          break;
        }
        case "closed":
        case "expired":
          this.sessions.delete(d.sessionId);
          break;
      }
    });

    if (count > 0) {
      logger.info({ replayed: count, sessions: this.sessions.size }, "Session state rebuilt from journal");
    }
  }

  /** Register a callback invoked when a session expires. */
  onExpire(callback: (session: SessionLease) => void): void {
    this.onExpireCallback = callback;
  }

  /** Create a new session (lease) for an agent, bound to a client. */
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
      conversationId: opts.conversationId ?? randomUUID(),
    };
    this.sessions.set(session.sessionId, session);
    logger.info(
      { sessionId: session.sessionId, conversationId: session.conversationId, agentName: opts.agentName, clientId: opts.clientId, resumed: !!opts.conversationId },
      "Session created",
    );
    this.journalWrite({
      action: "created",
      sessionId: session.sessionId,
      agentName: opts.agentName,
      clientId: opts.clientId,
      idleTtlMs: session.idleTtlMs,
      conversationId: session.conversationId,
    });
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
    this.journalWrite({ action: "released", sessionId, agentName: session.agentName });
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
    this.journalWrite({ action: "resumed", sessionId, agentName: session.agentName, clientId });
    return true;
  }

  /** Explicitly close and remove a session. */
  close(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    logger.info({ sessionId, agentName: session.agentName }, "Session closed");
    this.journalWrite({ action: "closed", sessionId, agentName: session.agentName });
    return true;
  }

  /** Close all sessions for a given agent. */
  closeByAgent(agentName: string): number {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.agentName === agentName) {
        this.sessions.delete(id);
        this.journalWrite({ action: "closed", sessionId: id, agentName });
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
        this.journalWrite({ action: "expired", sessionId: id, agentName: session.agentName });
        this.onExpireCallback?.(session);
      }
    }
  }

  private journalWrite(data: SessionLifecycleData): void {
    if (!this.journal) return;
    this.journal.append("session", `session:${data.action}`, data).catch((err) => {
      logger.warn({ err, action: data.action, sessionId: data.sessionId }, "Failed to journal session event");
    });
  }
}
