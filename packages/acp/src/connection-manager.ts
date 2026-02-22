import type { Socket } from "node:net";
import { createLogger } from "@actant/shared";
import type { PermissionsConfig } from "@actant/shared";
import { PermissionPolicyEnforcer, PermissionAuditLogger } from "@actant/core";
import { AcpConnection, type AcpConnectionOptions, type AcpSessionInfo, type ClientCallbackHandler } from "./connection";
import { ClientCallbackRouter } from "./callback-router";
import { AcpGateway } from "./gateway";
import { LocalTerminalManager } from "./terminal-manager";

const logger = createLogger("acp-connection-manager");

export interface ConnectOptions {
  command: string;
  args: string[];
  cwd: string;
  connectionOptions?: AcpConnectionOptions;
}

/**
 * Manages a pool of ACP connections keyed by agent instance name.
 * Handles spawn → initialize → session lifecycle for each agent.
 * Supports Gateway mode for Session Lease (IDE ↔ Gateway ↔ Agent).
 */
export class AcpConnectionManager {
  private connections = new Map<string, AcpConnection>();
  private primarySessions = new Map<string, string>();
  private routers = new Map<string, ClientCallbackRouter>();
  private gateways = new Map<string, AcpGateway>();
  private enforcers = new Map<string, PermissionPolicyEnforcer>();

  /**
   * Spawn an ACP agent process, initialize, and create a default session.
   * Uses ClientCallbackRouter so Gateway can later attach an IDE upstream.
   * When connectionOptions.permissionPolicy is set, creates a PermissionPolicyEnforcer
   * for Layer 2 ACP Client allowlist enforcement.
   */
  async connect(name: string, options: ConnectOptions): Promise<AcpSessionInfo> {
    if (this.connections.has(name)) {
      throw new Error(`ACP connection for "${name}" already exists`);
    }

    // Create enforcer if permission policy is provided
    let enforcer: PermissionPolicyEnforcer | undefined;
    let auditLogger: PermissionAuditLogger | undefined;
    if (options.connectionOptions?.permissionPolicy) {
      enforcer = new PermissionPolicyEnforcer(options.connectionOptions.permissionPolicy);
      auditLogger = new PermissionAuditLogger(name);
      this.enforcers.set(name, enforcer);
    }

    // Build a local-only AcpConnection first; the router wraps it
    // so we can later attach an IDE upstream without reinitializing.
    const localConn = new AcpConnection(options.connectionOptions);

    // Create a router using the connection's built-in local callbacks as fallback.
    // We create a "local handler" that is the default AcpConnection behavior.
    const localHandler: ClientCallbackHandler = buildLocalHandler(localConn, options.connectionOptions, enforcer, auditLogger);
    const router = new ClientCallbackRouter(localHandler);

    // Now create the real connection with the router as callback handler
    const connWithRouter = new AcpConnection({
      ...options.connectionOptions,
      callbackHandler: router,
    });

    this.connections.set(name, connWithRouter);
    this.routers.set(name, router);

    try {
      await connWithRouter.spawn(options.command, options.args, options.cwd);
      await connWithRouter.initialize();
      const session = await connWithRouter.newSession(options.cwd);
      this.primarySessions.set(name, session.sessionId);

      // Pre-create a Gateway for this connection (inactive until IDE connects)
      const gateway = new AcpGateway({
        downstream: connWithRouter,
        callbackRouter: router,
      });
      this.gateways.set(name, gateway);

      logger.info({ name, sessionId: session.sessionId }, "ACP agent connected (gateway-ready)");
      return session;
    } catch (err) {
      await connWithRouter.close().catch(() => {});
      this.connections.delete(name);
      this.primarySessions.delete(name);
      this.routers.delete(name);
      throw err;
    }
  }

  /**
   * Accept an IDE connection on the Gateway for a named agent.
   * The IDE socket carries ACP protocol messages.
   */
  acceptLeaseSocket(name: string, socket: Socket): void {
    const gateway = this.gateways.get(name);
    if (!gateway) {
      throw new Error(`No gateway for agent "${name}". Is the agent connected via ACP?`);
    }
    gateway.acceptSocket(socket);
  }

  /**
   * Disconnect IDE from the Gateway.
   */
  disconnectLease(name: string): void {
    this.gateways.get(name)?.disconnectUpstream();
  }

  getConnection(name: string): AcpConnection | undefined {
    return this.connections.get(name);
  }

  getGateway(name: string): AcpGateway | undefined {
    return this.gateways.get(name);
  }

  getRouter(name: string): ClientCallbackRouter | undefined {
    return this.routers.get(name);
  }

  getPrimarySessionId(name: string): string | undefined {
    return this.primarySessions.get(name);
  }

  has(name: string): boolean {
    const conn = this.connections.get(name);
    return conn != null && conn.isConnected;
  }

  async disconnect(name: string): Promise<void> {
    this.gateways.get(name)?.disconnectUpstream();
    this.gateways.delete(name);
    this.routers.delete(name);
    this.enforcers.delete(name);

    const conn = this.connections.get(name);
    if (!conn) return;
    await conn.close();
    this.connections.delete(name);
    this.primarySessions.delete(name);
    logger.info({ name }, "ACP agent disconnected");
  }

  async disposeAll(): Promise<void> {
    const names = Array.from(this.connections.keys());
    await Promise.allSettled(names.map((n) => this.disconnect(n)));
    logger.info({ count: names.length }, "All ACP connections disposed");
  }

  /**
   * Update the permission policy for a named connection at runtime.
   * Propagates to both the AcpConnection and the local handler enforcer.
   */
  updatePermissionPolicy(name: string, config: PermissionsConfig): void {
    const conn = this.connections.get(name);
    if (conn) {
      conn.updatePermissionPolicy(config);
    }
    const enforcer = this.enforcers.get(name);
    if (enforcer) {
      enforcer.updateConfig(config);
    }
  }
}

/**
 * Build a local ClientCallbackHandler from connection defaults.
 * This is the "Mode A" handler used when no IDE is connected.
 * When a permissionPolicy is provided, uses PermissionPolicyEnforcer for smart decisions.
 */
function buildLocalHandler(
  _conn: AcpConnection,
  options?: AcpConnectionOptions,
  enforcer?: PermissionPolicyEnforcer,
  auditLogger?: PermissionAuditLogger,
): ClientCallbackHandler {
  const terminalManager = new LocalTerminalManager();

  return {
    requestPermission: async (params) => {
      // Layer 2: Policy-based enforcement
      if (enforcer && params.options.length > 0) {
        const toolInfo = {
          kind: params.toolCall?.kind ?? undefined,
          title: params.toolCall?.title ?? undefined,
          toolCallId: params.toolCall?.toolCallId ?? "unknown",
        };
        const decision = enforcer.evaluate(toolInfo);
        auditLogger?.logEvaluation(toolInfo, decision);

        if (decision.action === "allow" || decision.action === "deny") {
          const outcome = enforcer.buildOutcome(decision, params.options);
          return { outcome };
        }
      }

      // Fallback: legacy autoApprove
      if (options?.autoApprove && params.options.length > 0) {
        const opt = params.options.find(
          (o) => o.kind === "allow_once" || o.kind === "allow_always",
        ) ?? params.options[0];
        if (!opt) return { outcome: { outcome: "cancelled" } };
        return { outcome: { outcome: "selected", optionId: opt.optionId } };
      }
      return { outcome: { outcome: "cancelled" } };
    },

    sessionUpdate: async (params) => {
      options?.onSessionUpdate?.(params);
    },

    readTextFile: async (params) => {
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(params.path, "utf-8");
      if (params.line != null || params.limit != null) {
        const lines = raw.split("\n");
        const start = Math.max(0, (params.line ?? 1) - 1);
        const end = params.limit != null ? start + params.limit : lines.length;
        return { content: lines.slice(start, end).join("\n") };
      }
      return { content: raw };
    },

    writeTextFile: async (params) => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(params.path), { recursive: true });
      await writeFile(params.path, params.content, "utf-8");
      return {};
    },

    createTerminal: (p) => terminalManager.createTerminal(p),
    terminalOutput: (p) => terminalManager.terminalOutput(p),
    waitForTerminalExit: (p) => terminalManager.waitForExit(p),
    killTerminal: (p) => terminalManager.killTerminal(p),
    releaseTerminal: (p) => terminalManager.releaseTerminal(p),
  };
}
