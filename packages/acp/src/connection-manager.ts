import type { Socket } from "node:net";
import { createLogger } from "@actant/shared";
import type { PermissionsConfig } from "@actant/shared";
import {
  AcpConnectionAlreadyExistsError,
  AcpGatewayNotFoundError,
} from "@actant/shared";
import { PermissionPolicyEnforcer, PermissionAuditLogger, type ActivityRecorder } from "@actant/core";
import type { ActantToolDefinition, ChannelHostServices, McpServerSpec } from "@actant/core";
import { AcpConnection, type AcpConnectionOptions, type AcpSessionInfo, type ClientCallbackHandler } from "./connection";
import { ClientCallbackRouter } from "./callback-router";
import { RecordingCallbackHandler } from "./recording-handler";
import { ToolCallInterceptor } from "./tool-call-interceptor";
import { AcpGateway } from "./gateway";
import { LocalTerminalManager } from "./terminal-manager";

const logger = createLogger("acp-connection-manager");

export interface ConnectOptions {
  command: string;
  args: string[];
  cwd: string;
  connectionOptions?: AcpConnectionOptions;
  resolvePackage?: string;
  activityRecorder?: ActivityRecorder;
  mcpServers?: McpServerSpec[];
  tools?: ActantToolDefinition[];
  sessionToken?: string;
  systemContext?: string[];
  hostServices?: ChannelHostServices;
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
  private recordingHandlers = new Map<string, RecordingCallbackHandler>();

  private cleanupConnectionState(name: string): void {
    this.connections.delete(name);
    this.primarySessions.delete(name);
    this.routers.delete(name);
    this.gateways.delete(name);
    this.enforcers.delete(name);
    this.recordingHandlers.delete(name);
  }

  /**
   * Spawn an ACP agent process, initialize, and create a default session.
   * Uses ClientCallbackRouter so Gateway can later attach an IDE upstream.
   * When connectionOptions.permissionPolicy is set, creates a PermissionPolicyEnforcer
   * for Layer 2 ACP Client allowlist enforcement.
   */
  async connect(name: string, options: ConnectOptions): Promise<AcpSessionInfo & { pid?: number }> {
    if (this.connections.has(name)) {
      throw new AcpConnectionAlreadyExistsError(name);
    }

    let enforcer: PermissionPolicyEnforcer | undefined;
    let auditLogger: PermissionAuditLogger | undefined;
    if (options.connectionOptions?.permissionPolicy) {
      enforcer = new PermissionPolicyEnforcer(options.connectionOptions.permissionPolicy);
      auditLogger = new PermissionAuditLogger(name);
      this.enforcers.set(name, enforcer);
    }

    const localConn = new AcpConnection(options.connectionOptions);
    const localHandler: ClientCallbackHandler = buildLocalHandler(
      localConn,
      options.connectionOptions,
      enforcer,
      auditLogger,
      options.hostServices,
    );
    const router = new ClientCallbackRouter(localHandler);

    if (options.tools && options.tools.length > 0) {
      const interceptor = new ToolCallInterceptor(
        options.tools.map((t) => t.name),
        options.activityRecorder,
        name,
      );
      router.setToolCallInterceptor(interceptor);
    }

    let finalHandler: ClientCallbackHandler = router;
    if (options.activityRecorder) {
      const rh = new RecordingCallbackHandler(router, options.activityRecorder, name);
      this.recordingHandlers.set(name, rh);
      finalHandler = rh;
    }

    const MAX_ENV_VALUE_BYTES = 128 * 1024;
    const extraEnv: Record<string, string> = {};
    if (options.sessionToken) {
      extraEnv["ACTANT_SESSION_TOKEN"] = options.sessionToken;
    }
    if (options.systemContext && options.systemContext.length > 0) {
      const ctx = options.systemContext.join("\n\n---\n\n");
      if (Buffer.byteLength(ctx, "utf-8") > MAX_ENV_VALUE_BYTES) {
        logger.warn({ name, bytes: Buffer.byteLength(ctx, "utf-8") }, "ACTANT_SYSTEM_CONTEXT exceeds size limit, truncating");
        const buf = Buffer.from(ctx, "utf-8");
        let end = MAX_ENV_VALUE_BYTES;
        while (end > 0 && ((buf[end] ?? 0) & 0xC0) === 0x80) end--;
        extraEnv["ACTANT_SYSTEM_CONTEXT"] = buf.subarray(0, end).toString("utf-8");
      } else {
        extraEnv["ACTANT_SYSTEM_CONTEXT"] = ctx;
      }
    }
    if (options.tools && options.tools.length > 0) {
      let toolsToUse = options.tools;
      let toolsJson = JSON.stringify(toolsToUse);
      while (Buffer.byteLength(toolsJson, "utf-8") > MAX_ENV_VALUE_BYTES && toolsToUse.length > 1) {
        toolsToUse = toolsToUse.slice(0, Math.max(1, Math.floor(toolsToUse.length / 2)));
        toolsJson = JSON.stringify(toolsToUse);
      }
      if (Buffer.byteLength(toolsJson, "utf-8") > MAX_ENV_VALUE_BYTES) {
        logger.warn({ name, bytes: Buffer.byteLength(toolsJson, "utf-8") }, "ACTANT_TOOLS single tool exceeds size limit, skipping injection");
      } else {
        if (toolsToUse.length < options.tools.length) {
          logger.warn({ name, original: options.tools.length, kept: toolsToUse.length }, "ACTANT_TOOLS truncated to fit size limit");
        }
        extraEnv["ACTANT_TOOLS"] = toolsJson;
      }
    }

    const mergedOptions: AcpConnectionOptions = {
      ...options.connectionOptions,
      callbackHandler: finalHandler,
    };
    if (Object.keys(extraEnv).length > 0) {
      mergedOptions.env = { ...mergedOptions.env, ...extraEnv };
    }

    const connWithRouter = new AcpConnection(mergedOptions);

    this.connections.set(name, connWithRouter);
    this.routers.set(name, router);

    try {
      await connWithRouter.spawn(options.command, options.args, options.cwd, options.resolvePackage);
      await connWithRouter.initialize();
      const session = await connWithRouter.newSession(options.cwd, toLegacyMcpServers(options.mcpServers));
      this.primarySessions.set(name, session.sessionId);

      const gateway = new AcpGateway({
        downstream: connWithRouter,
        callbackRouter: router,
      });
      this.gateways.set(name, gateway);

      const pid = connWithRouter.childPid;
      logger.info({ name, sessionId: session.sessionId, pid }, "ACP agent connected (gateway-ready)");
      return { ...session, pid };
    } catch (err) {
      await connWithRouter.close().catch(() => {});
      this.cleanupConnectionState(name);
      throw err;
    }
  }

  acceptLeaseSocket(name: string, socket: Socket): void {
    const gateway = this.gateways.get(name);
    if (!gateway) {
      throw new AcpGatewayNotFoundError(name);
    }
    gateway.acceptSocket(socket);
  }

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

  setCurrentActivitySession(name: string, id: string | null): void {
    this.recordingHandlers.get(name)?.setCurrentSession(id);
  }

  async disconnect(name: string): Promise<void> {
    this.gateways.get(name)?.disconnectUpstream();

    const conn = this.connections.get(name);
    if (!conn) {
      this.cleanupConnectionState(name);
      return;
    }
    await conn.close();
    this.cleanupConnectionState(name);
    logger.info({ name }, "ACP agent disconnected");
  }

  async disposeAll(): Promise<void> {
    const names = Array.from(this.connections.keys());
    await Promise.allSettled(names.map((n) => this.disconnect(n)));
    logger.info({ count: names.length }, "All ACP connections disposed");
  }

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

function buildLocalHandler(
  _conn: AcpConnection,
  options?: AcpConnectionOptions,
  enforcer?: PermissionPolicyEnforcer,
  auditLogger?: PermissionAuditLogger,
  hostServices?: ChannelHostServices,
): ClientCallbackHandler {
  const terminalManager = new LocalTerminalManager();

  return {
    requestPermission: async (params) => {
      if (hostServices?.requestPermission) {
        return hostServices.requestPermission(params as never) as never;
      }

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
      await hostServices?.sessionUpdate?.(params.update as never);
    },

    readTextFile: async (params) => {
      if (hostServices?.readTextFile) {
        return hostServices.readTextFile(params as never) as never;
      }
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
      if (hostServices?.writeTextFile) {
        return hostServices.writeTextFile(params as never) as never;
      }
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(params.path), { recursive: true });
      await writeFile(params.path, params.content, "utf-8");
      return {};
    },

    createTerminal: (p) => hostServices?.createTerminal
      ? hostServices.createTerminal(p as never) as never
      : terminalManager.createTerminal(p),
    terminalOutput: (p) => hostServices?.terminalOutput
      ? hostServices.terminalOutput(p as never) as never
      : terminalManager.terminalOutput(p),
    waitForTerminalExit: (p) => hostServices?.waitForTerminalExit
      ? hostServices.waitForTerminalExit(p as never) as never
      : terminalManager.waitForExit(p),
    killTerminal: (p) => hostServices?.killTerminal
      ? hostServices.killTerminal(p as never) as never
      : terminalManager.killTerminal(p),
    releaseTerminal: (p) => hostServices?.releaseTerminal
      ? hostServices.releaseTerminal(p as never) as never
      : terminalManager.releaseTerminal(p),
  };
}

function toLegacyMcpServers(servers: McpServerSpec[] | undefined): Array<{ name: string; command: string; args: string[]; env?: Array<{ name: string; value: string }> }> {
  if (!servers?.length) return [];
  return servers
    .filter((server) => server.transport.type === "stdio")
    .map((server) => ({
      name: server.name,
      command: server.transport.command,
      args: server.transport.args ?? [],
      env: server.transport.env
        ? Object.entries(server.transport.env).map(([envName, value]) => ({ name: envName, value }))
        : undefined,
    }));
}
