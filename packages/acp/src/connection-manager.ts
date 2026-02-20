import { createLogger } from "@agentcraft/shared";
import { AcpConnection, type AcpConnectionOptions, type AcpSessionInfo } from "./connection";

const logger = createLogger("acp-connection-manager");

export interface ConnectOptions {
  command: string;
  args: string[];
  cwd: string;
  connectionOptions?: AcpConnectionOptions;
}

/**
 * Manages a pool of ACP connections, keyed by agent instance name.
 * Handles spawn → initialize → session lifecycle for each agent.
 */
export class AcpConnectionManager {
  private connections = new Map<string, AcpConnection>();
  private primarySessions = new Map<string, string>();

  /**
   * Spawn an ACP agent process, initialize, and create a default session.
   * Returns the AcpSessionInfo for the primary session.
   */
  async connect(name: string, options: ConnectOptions): Promise<AcpSessionInfo> {
    if (this.connections.has(name)) {
      throw new Error(`ACP connection for "${name}" already exists`);
    }

    const conn = new AcpConnection(options.connectionOptions);
    this.connections.set(name, conn);

    try {
      await conn.spawn(options.command, options.args, options.cwd);
      await conn.initialize();
      const session = await conn.newSession(options.cwd);
      this.primarySessions.set(name, session.sessionId);

      logger.info({ name, sessionId: session.sessionId }, "ACP agent connected");
      return session;
    } catch (err) {
      await conn.close().catch(() => {});
      this.connections.delete(name);
      this.primarySessions.delete(name);
      throw err;
    }
  }

  /**
   * Get an existing connection by agent instance name.
   */
  getConnection(name: string): AcpConnection | undefined {
    return this.connections.get(name);
  }

  /**
   * Get the primary session ID for a named agent.
   */
  getPrimarySessionId(name: string): string | undefined {
    return this.primarySessions.get(name);
  }

  /**
   * Check if a named agent has an active ACP connection.
   */
  has(name: string): boolean {
    const conn = this.connections.get(name);
    return conn != null && conn.isConnected;
  }

  /**
   * Disconnect and close the ACP connection for a named agent.
   */
  async disconnect(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (!conn) return;

    await conn.close();
    this.connections.delete(name);
    this.primarySessions.delete(name);
    logger.info({ name }, "ACP agent disconnected");
  }

  /**
   * Close all connections.
   */
  async disposeAll(): Promise<void> {
    const names = Array.from(this.connections.keys());
    await Promise.allSettled(names.map((n) => this.disconnect(n)));
    logger.info({ count: names.length }, "All ACP connections disposed");
  }
}
