import { createLogger } from "@agentcraft/shared";
import type { SessionRegistry, SessionLease } from "@agentcraft/core";
import type { AgentManager } from "@agentcraft/core";

const logger = createLogger("acp-relay");

type ClientCallback = (notification: unknown) => void;

/**
 * Routes ACP session update notifications from Agent processes to
 * the correct client based on sessionId → clientId mapping from SessionRegistry.
 *
 * Architecture:
 * - Agent sends `sessionUpdate { sessionId }` via AcpConnection
 * - AcpRelayServer looks up sessionId in SessionRegistry to find the bound client
 * - Routes the notification to the registered client callback
 *
 * This is NOT a transparent proxy: Daemon interacts with Agent via structured
 * AcpConnection API, and clients interact with Daemon via session.* RPC.
 */
export class AcpRelayServer {
  private clientCallbacks = new Map<string, ClientCallback>();
  private disposed = false;

  constructor(
    private readonly sessionRegistry: SessionRegistry,
    readonly agentManager: AgentManager,
  ) {}

  /**
   * Register a callback for a specific client.
   * When a session update arrives for a session owned by this client,
   * the callback is invoked with the notification payload.
   */
  registerClient(clientId: string, callback: ClientCallback): void {
    this.clientCallbacks.set(clientId, callback);
    logger.debug({ clientId }, "Client registered for relay");
  }

  /** Unregister a client callback. */
  unregisterClient(clientId: string): void {
    this.clientCallbacks.delete(clientId);
    logger.debug({ clientId }, "Client unregistered from relay");
  }

  /**
   * Route an incoming session update notification to the correct client.
   * Called by the session prompt handler when streaming notifications arrive.
   */
  routeNotification(sessionId: string, notification: unknown): void {
    if (this.disposed) return;

    const lease = this.sessionRegistry.get(sessionId);
    if (!lease) {
      logger.debug({ sessionId }, "Notification for unknown session, dropping");
      return;
    }

    if (lease.state !== "active" || !lease.clientId) {
      logger.debug({ sessionId, state: lease.state }, "Session not active, dropping notification");
      return;
    }

    const callback = this.clientCallbacks.get(lease.clientId);
    if (callback) {
      try {
        callback(notification);
      } catch (err) {
        logger.error({ sessionId, clientId: lease.clientId, error: err }, "Error in client callback");
      }
    }
  }

  /** Get the number of registered clients. */
  get clientCount(): number {
    return this.clientCallbacks.size;
  }

  /** Check if a specific client is registered. */
  hasClient(clientId: string): boolean {
    return this.clientCallbacks.has(clientId);
  }

  /**
   * List all sessions for a given client.
   */
  getClientSessions(clientId: string): SessionLease[] {
    return this.sessionRegistry
      .list()
      .filter((s) => s.clientId === clientId && s.state === "active");
  }

  /** Release resources. */
  dispose(): void {
    this.disposed = true;
    this.clientCallbacks.clear();
    logger.info("ACP relay server disposed");
  }
}
