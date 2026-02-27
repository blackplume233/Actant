import { randomBytes } from "node:crypto";
import { createLogger } from "@actant/shared";

const logger = createLogger("session-token-store");

const TOKEN_BYTES = 32;

export interface SessionToken {
  token: string;
  agentName: string;
  sessionId: string;
  pid?: number;
  createdAt: number;
}

/**
 * In-memory store for per-session tokens used to authenticate
 * internal tool calls from managed agents.
 *
 * Tokens are generated when an ACP session is created and revoked
 * when the session ends. The Daemon validates tokens on every
 * `actant internal` CLI call or direct RPC with token auth.
 */
export class SessionTokenStore {
  private byToken = new Map<string, SessionToken>();
  private bySession = new Map<string, string>();
  private byAgent = new Map<string, Set<string>>();

  generate(agentName: string, sessionId: string, pid?: number): string {
    this.revokeSession(sessionId);

    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const entry: SessionToken = {
      token,
      agentName,
      sessionId,
      pid,
      createdAt: Date.now(),
    };

    this.byToken.set(token, entry);
    this.bySession.set(sessionId, token);

    let agentTokens = this.byAgent.get(agentName);
    if (!agentTokens) {
      agentTokens = new Set();
      this.byAgent.set(agentName, agentTokens);
    }
    agentTokens.add(token);

    logger.debug({ agentName, sessionId, tokenPrefix: token.slice(0, 8) }, "Session token generated");
    return token;
  }

  validate(token: string): SessionToken | null {
    return this.byToken.get(token) ?? null;
  }

  revokeSession(sessionId: string): boolean {
    const token = this.bySession.get(sessionId);
    if (!token) return false;

    const entry = this.byToken.get(token);
    this.byToken.delete(token);
    this.bySession.delete(sessionId);

    if (entry) {
      const agentTokens = this.byAgent.get(entry.agentName);
      agentTokens?.delete(token);
      if (agentTokens?.size === 0) this.byAgent.delete(entry.agentName);
    }

    logger.debug({ sessionId, tokenPrefix: token.slice(0, 8) }, "Session token revoked");
    return true;
  }

  revokeByAgent(agentName: string): number {
    const agentTokens = this.byAgent.get(agentName);
    if (!agentTokens) return 0;

    let count = 0;
    for (const token of agentTokens) {
      const entry = this.byToken.get(token);
      if (entry) {
        this.byToken.delete(token);
        this.bySession.delete(entry.sessionId);
        count++;
      }
    }
    this.byAgent.delete(agentName);

    logger.debug({ agentName, revokedCount: count }, "Agent tokens revoked");
    return count;
  }

  /** Number of active tokens (for diagnostics). */
  get size(): number {
    return this.byToken.size;
  }
}
