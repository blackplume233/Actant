import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import {
  AgentSideConnection,
  TerminalHandle,
  ndJsonStream,
  type Agent,
  type InitializeResponse,
  type ClientCapabilities,
  type NewSessionResponse,
  type LoadSessionResponse,
  type SetSessionConfigOptionResponse,
} from "@agentclientprotocol/sdk";
import { createLogger } from "@actant/shared";
import {
  AcpGatewayStateError,
  AcpConnectionStateError,
  AcpTerminalHandleMissingError,
} from "@actant/shared";
import type { AcpConnection } from "./connection";
import { ClientCallbackRouter, type UpstreamHandler } from "./callback-router";
import { getAcpPackageVersion } from "./package-version";

const logger = createLogger("acp-gateway");

/* ---------------------------------------------------------------------------
 * SDK WORKAROUND: TerminalHandleRegistry
 *
 * INVARIANT CONTRACT:
 * - The ACP SDK's AgentSideConnection exposes fs ops as flat methods
 *   (readTextFile, writeTextFile) but wraps terminal ops behind TerminalHandle.
 *   The SDK does NOT expose flat terminalOutput(), waitForTerminalExit(),
 *   killTerminal(), releaseTerminal() on AgentSideConnection.
 *
 * - This registry exists solely as an adapter: we store handles from
 *   createTerminal() and delegate IDE requests through them. The IDE (Client)
 *   owns the real terminal state; this map is purely an SDK workaround.
 *
 * - REMOVAL: Delete this entire section once @agentclientprotocol/sdk adds
 *   flat terminal methods. See #95, #116.
 *
 * LIFECYCLE INVARIANTS:
 * - Handles are valid only while upstream is connected. On upstream disconnect,
 *   cleanupAll() must run to release every handle and clear the map.
 * - A handle is "stale" if it's not in the map (released or never existed).
 * - Duplicate release is safe: we delete-before-release so concurrent calls
 *   get undefined and return no-op.
 * ------------------------------------------------------------------------- */
class TerminalHandleRegistry {
  private readonly handles = new Map<string, TerminalHandle>();

  add(handle: TerminalHandle): void {
    this.handles.set(handle.id, handle);
  }

  get(terminalId: string): TerminalHandle | undefined {
    return this.handles.get(terminalId);
  }

  /**
   * Release a terminal handle. Uses delete-before-release to prevent duplicate
   * release: concurrent calls will get undefined and return early.
   */
  async release(terminalId: string): Promise<Record<string, unknown>> {
    const handle = this.handles.get(terminalId);
    if (!handle) return {}; // Already released or never existed
    this.handles.delete(terminalId); // Remove FIRST to guard against double release
    const result = await handle.release();
    return (result as Record<string, unknown>) ?? {};
  }

  /**
   * Release all handles and clear the map. Call on upstream disconnect.
   */
  cleanupAll(): void {
    for (const handle of this.handles.values()) {
      handle.release().catch(() => {});
    }
    this.handles.clear();
  }

  /** Check if a handle exists (not yet released). */
  has(terminalId: string): boolean {
    return this.handles.has(terminalId);
  }
}

export interface GatewayOptions {
  /** The downstream AcpConnection (Daemon → Agent). */
  downstream: AcpConnection;
  /** The callback router to attach upstream when IDE connects. */
  callbackRouter: ClientCallbackRouter;
}

/**
 * ACP Gateway — bridges upstream IDE (ACP Client) and downstream Agent (ACP Server).
 *
 * Architecture:
 *   IDE ← ACP/socket → AgentSideConnection (upstream)
 *                            ↕ (bridged)
 *                       ClientSideConnection (downstream) ← ACP/stdio → Agent
 *
 * The Gateway:
 * - Exposes an Agent interface to the IDE via AgentSideConnection
 * - Forwards IDE requests (prompt, cancel, etc.) to the downstream Agent
 * - Routes Agent callbacks (permissions, fs, terminal) to IDE or local
 *   via the ClientCallbackRouter
 *
 * Terminal handle invariants (SDK workaround, see TerminalHandleRegistry):
 * - On upstream disconnect: all terminal handles are released and cleared
 * - Duplicate release: safe (delete-before-release prevents double release)
 * - Stale handles: operations check handle existence before use
 */
export class AcpGateway {
  private upstream: AgentSideConnection | null = null;
  private readonly downstream: AcpConnection;
  private readonly callbackRouter: ClientCallbackRouter;
  private ideCapabilities: ClientCapabilities | null = null;
  /** SDK workaround: see TerminalHandleRegistry JSDoc above. */
  private readonly terminalRegistry = new TerminalHandleRegistry();

  constructor(options: GatewayOptions) {
    this.downstream = options.downstream;
    this.callbackRouter = options.callbackRouter;
  }

  get isUpstreamConnected(): boolean {
    return this.upstream != null && !this.upstream.signal.aborted;
  }

  /**
   * Accept an IDE connection on a Unix/named-pipe socket.
   * Creates an AgentSideConnection that bridges to the downstream Agent.
   */
  acceptSocket(socket: Socket): void {
    if (this.upstream && !this.upstream.signal.aborted) {
      throw new AcpGatewayStateError("Gateway already has an active upstream connection");
    }

    const { readable, writable } = Duplex.toWeb(socket as unknown as Duplex);
    const stream = ndJsonStream(
      writable as WritableStream<Uint8Array>,
      readable as ReadableStream<Uint8Array>,
    );

    this.upstream = new AgentSideConnection(
      (conn: AgentSideConnection): Agent => this.buildAgentHandler(conn),
      stream,
    );

    this.upstream.signal.addEventListener("abort", () => {
      logger.info("Upstream IDE disconnected from Gateway");
      this.terminalRegistry.cleanupAll(); // Reconnect safety: clean all handles on disconnect
      this.callbackRouter.detachUpstream();
      this.ideCapabilities = null;
    });

    logger.info("Upstream IDE connected to Gateway");
  }

  /**
   * Disconnect the upstream IDE.
   */
  disconnectUpstream(): void {
    this.terminalRegistry.cleanupAll();
    this.callbackRouter.detachUpstream();
    this.upstream = null;
    this.ideCapabilities = null;
  }

  /* ---------------------------------------------------------------- */
  /*  Agent handler (facing IDE)                                       */
  /* ---------------------------------------------------------------- */

  private buildAgentHandler(conn: AgentSideConnection): Agent {
    const cachedInit = this.downstream.agentCapabilities;

    const upstreamHandler: UpstreamHandler = {
      requestPermission: (p) => conn.requestPermission(p),
      sessionUpdate: (p) => conn.sessionUpdate(p),
      readTextFile: (p) => conn.readTextFile(p),
      writeTextFile: (p) => conn.writeTextFile(p),
      // Terminal forwarding via TerminalHandleRegistry (SDK workaround).
      createTerminal: async (p) => {
        const handle = await conn.createTerminal(p);
        this.terminalRegistry.add(handle);
        return { terminalId: handle.id };
      },
      terminalOutput: async (p) => {
        if (!this.isUpstreamConnected) throw new AcpConnectionStateError("Upstream disconnected");
        const handle = this.terminalRegistry.get(p.terminalId);
        if (!handle) throw new AcpTerminalHandleMissingError(p.terminalId); // Stale handle
        return handle.currentOutput();
      },
      waitForTerminalExit: async (p) => {
        if (!this.isUpstreamConnected) throw new AcpConnectionStateError("Upstream disconnected");
        const handle = this.terminalRegistry.get(p.terminalId);
        if (!handle) throw new AcpTerminalHandleMissingError(p.terminalId);
        return handle.waitForExit();
      },
      killTerminal: async (p) => {
        if (!this.isUpstreamConnected) throw new AcpConnectionStateError("Upstream disconnected");
        const handle = this.terminalRegistry.get(p.terminalId);
        if (!handle) throw new AcpTerminalHandleMissingError(p.terminalId);
        return handle.kill();
      },
      releaseTerminal: async (p) => {
        if (!this.isUpstreamConnected) return {}; // No-op if already disconnected
        return this.terminalRegistry.release(p.terminalId); // Duplicate release protected
      },
    };

    return {
      initialize: async (params) => {
        this.ideCapabilities = params.clientCapabilities ?? {};
        this.callbackRouter.attachUpstream(upstreamHandler, this.ideCapabilities);

        // Return the cached Agent capabilities to the IDE
        if (cachedInit) {
          return {
            protocolVersion: cachedInit.protocolVersion,
            agentCapabilities: cachedInit.agentCapabilities,
            agentInfo: cachedInit.agentInfo,
            authMethods: cachedInit.authMethods,
          } as InitializeResponse;
        }
        return {
          protocolVersion: 1,
          agentCapabilities: {},
          agentInfo: { name: "actant-gateway", version: getAcpPackageVersion() },
        } as InitializeResponse;
      },

      authenticate: async (params) => {
        await this.downstream.authenticate(params.methodId);
        return {};
      },

      newSession: async (params) => {
        const info = await this.downstream.newSession(
          params.cwd,
          params.mcpServers as never[],
        );
        return {
          sessionId: info.sessionId,
          modes: info.modes,
          configOptions: info.configOptions,
        } as NewSessionResponse;
      },

      loadSession: async (params) => {
        await this.downstream.loadSession(params.sessionId, params.cwd);
        return {} as LoadSessionResponse;
      },

      prompt: async (params) => {
        const conn = this.downstream.rawConnection;
        if (!conn) throw new AcpConnectionStateError("Downstream not connected");
        return conn.prompt(params);
      },

      cancel: async (params) => {
        await this.downstream.cancel(params.sessionId);
      },

      setSessionMode: async (params) => {
        await this.downstream.setSessionMode(params.sessionId, params.modeId);
      },

      setSessionConfigOption: async (params) => {
        return await this.downstream.setSessionConfigOption(
          params.sessionId, params.configId, params.value,
        ) as unknown as SetSessionConfigOptionResponse;
      },
    };
  }
}
