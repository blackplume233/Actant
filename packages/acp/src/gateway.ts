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
import type { AcpConnection } from "./connection";
import { ClientCallbackRouter, type UpstreamHandler } from "./callback-router";

const logger = createLogger("acp-gateway");

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
 */
export class AcpGateway {
  private upstream: AgentSideConnection | null = null;
  private readonly downstream: AcpConnection;
  private readonly callbackRouter: ClientCallbackRouter;
  private ideCapabilities: ClientCapabilities | null = null;
  /**
   * WORKAROUND for SDK API limitation (see #95):
   * AgentSideConnection exposes flat methods for fs (readTextFile, writeTextFile)
   * but wraps terminal ops behind TerminalHandle. Ideally the Gateway should be
   * stateless — the IDE (Client) manages its own terminal state keyed by terminalId.
   * We maintain this map only because the SDK doesn't expose flat terminalOutput(),
   * waitForTerminalExit(), killTerminal(), releaseTerminal() on AgentSideConnection.
   * Remove this once the SDK adds flat terminal methods.
   */
  private terminalHandles = new Map<string, TerminalHandle>();

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
      throw new Error("Gateway already has an active upstream connection");
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
      for (const handle of this.terminalHandles.values()) {
        handle.release().catch(() => {});
      }
      this.terminalHandles.clear();
      this.callbackRouter.detachUpstream();
      this.ideCapabilities = null;
    });

    logger.info("Upstream IDE connected to Gateway");
  }

  /**
   * Disconnect the upstream IDE.
   */
  disconnectUpstream(): void {
    for (const handle of this.terminalHandles.values()) {
      handle.release().catch(() => {});
    }
    this.terminalHandles.clear();
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
      // Terminal forwarding via TerminalHandle map.
      // SDK limitation: AgentSideConnection doesn't expose flat terminalOutput() etc.
      // so we store handles from createTerminal and delegate through them.
      // The IDE (Client) owns the real terminal state; this map is purely an SDK
      // adapter and should be removed once the SDK exposes flat terminal methods.
      createTerminal: async (p) => {
        const handle = await conn.createTerminal(p);
        this.terminalHandles.set(handle.id, handle);
        return { terminalId: handle.id };
      },
      terminalOutput: async (p) => {
        const handle = this.terminalHandles.get(p.terminalId);
        if (!handle) throw new Error(`Terminal "${p.terminalId}" not found in Gateway handle map`);
        return handle.currentOutput();
      },
      waitForTerminalExit: async (p) => {
        const handle = this.terminalHandles.get(p.terminalId);
        if (!handle) throw new Error(`Terminal "${p.terminalId}" not found in Gateway handle map`);
        return handle.waitForExit();
      },
      killTerminal: async (p) => {
        const handle = this.terminalHandles.get(p.terminalId);
        if (!handle) throw new Error(`Terminal "${p.terminalId}" not found in Gateway handle map`);
        return handle.kill();
      },
      releaseTerminal: async (p) => {
        const handle = this.terminalHandles.get(p.terminalId);
        if (!handle) return {};
        const result = await handle.release();
        this.terminalHandles.delete(p.terminalId);
        return result ?? {};
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
          agentInfo: { name: "actant-gateway", version: "0.1.0" },
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
        if (!conn) throw new Error("Downstream not connected");
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
