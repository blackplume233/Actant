import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import {
  AgentSideConnection,
  ndJsonStream,
  type Agent,
  type InitializeResponse,
  type ClientCapabilities,
} from "@agentclientprotocol/sdk";
import { createLogger } from "@agentcraft/shared";
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
      this.callbackRouter.detachUpstream();
      this.ideCapabilities = null;
    });

    logger.info("Upstream IDE connected to Gateway");
  }

  /**
   * Disconnect the upstream IDE.
   */
  disconnectUpstream(): void {
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
      createTerminal: async (p) => {
        const handle = await conn.createTerminal(p);
        return { terminalId: handle.id };
      },
      terminalOutput: async (_p) => {
        // SDK's TerminalHandle wraps this, but we need raw access.
        // The AgentSideConnection.createTerminal returns a TerminalHandle on the agent side.
        // For forwarding, we relay the raw request to IDE and get raw response.
        // Since we're using AgentSideConnection methods which are meant for Agent→Client,
        // the SDK handles the JSON-RPC routing automatically.
        // However, terminalOutput/waitForExit/kill/release are separate methods
        // on the Client interface, not on AgentSideConnection directly.
        // We need to use the underlying extension mechanism or handle differently.
        //
        // Actually, looking at the SDK: AgentSideConnection.createTerminal returns a
        // TerminalHandle whose methods (currentOutput, waitForExit, kill, release) internally
        // call the respective terminal/* methods on the Client.
        // So for the Gateway, we can't directly call terminalOutput on the connection.
        // Instead, terminal callbacks are handled at the Client level automatically.
        //
        // This means: when the downstream Agent creates a terminal, if we're forwarding
        // createTerminal to the IDE, the SDK on the Agent side will call terminal/output etc
        // on the Client (us). We need to forward those to the IDE.
        //
        // The callback router already handles this at the Client level.
        // This upstream handler is called BY the router when it decides to forward.
        // For terminal/* callbacks from the Agent, they go through the Client interface
        // which is handled by the router.
        //
        // So this method on UpstreamHandler is for the router to call when forwarding.
        // We need a way to forward terminal/output to the IDE.
        // Since AgentSideConnection doesn't expose terminalOutput directly,
        // we use extMethod as a workaround, or we need to send the raw JSON-RPC.
        throw new Error("Terminal output forwarding not yet supported via UpstreamHandler");
      },
      waitForTerminalExit: async () => {
        throw new Error("Terminal waitForExit forwarding not yet supported");
      },
      killTerminal: async () => {
        throw new Error("Terminal kill forwarding not yet supported");
      },
      releaseTerminal: async () => {
        throw new Error("Terminal release forwarding not yet supported");
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
          agentInfo: { name: "agentcraft-gateway", version: "0.1.0" },
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
        } as any;
      },

      loadSession: async (params) => {
        await this.downstream.loadSession(params.sessionId, params.cwd);
        return {} as any;
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
        ) as any;
      },
    };
  }
}
