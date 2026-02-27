import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  ClientCapabilities,
} from "@agentclientprotocol/sdk";
import { createLogger } from "@actant/shared";
import type { PermissionPolicyEnforcer } from "@actant/core";
import type { ClientCallbackHandler } from "./connection";
import type { ToolCallInterceptor } from "./tool-call-interceptor";

const logger = createLogger("acp-callback-router");

/**
 * Upstream (IDE) handler interface.
 * When a lease is active, agent callbacks are forwarded to the IDE
 * through this interface, which wraps the AgentSideConnection facing the IDE.
 */
export interface UpstreamHandler {
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  sessionUpdate(params: SessionNotification): Promise<void>;
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse>;
  releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse>;
}

/**
 * Routes Client callbacks from the Agent to either:
 *   (A) the IDE (upstream) — when a lease is active and IDE supports the capability
 *   (B) local handlers (impersonation) — when no lease or IDE lacks the capability
 *
 * The Agent always sees full capabilities; the router handles fallback transparently.
 */
export class ClientCallbackRouter implements ClientCallbackHandler {
  private upstream: UpstreamHandler | null = null;
  private ideCapabilities: ClientCapabilities | null = null;
  private enforcer: PermissionPolicyEnforcer | null = null;
  private toolCallInterceptor: ToolCallInterceptor | null = null;

  constructor(private readonly local: ClientCallbackHandler) {}

  /** Attach a PermissionPolicyEnforcer for pre-filtering in lease mode. */
  setEnforcer(enforcer: PermissionPolicyEnforcer | null): void {
    this.enforcer = enforcer;
  }

  /** Attach a ToolCallInterceptor for observing internal tool calls. */
  setToolCallInterceptor(interceptor: ToolCallInterceptor | null): void {
    this.toolCallInterceptor = interceptor;
  }

  /**
   * Activate lease-forwarding mode.
   * Callbacks will be routed to the IDE for supported capabilities.
   */
  attachUpstream(handler: UpstreamHandler, capabilities: ClientCapabilities): void {
    this.upstream = handler;
    this.ideCapabilities = capabilities;
    logger.info({
      terminal: !!capabilities.terminal,
      fsRead: !!capabilities.fs?.readTextFile,
      fsWrite: !!capabilities.fs?.writeTextFile,
    }, "Upstream IDE attached — lease forwarding active");
  }

  /**
   * Deactivate lease-forwarding. All callbacks revert to local handlers.
   */
  detachUpstream(): void {
    this.upstream = null;
    this.ideCapabilities = null;
    logger.info("Upstream IDE detached — local mode");
  }

  get isLeaseActive(): boolean {
    return this.upstream != null;
  }

  /* ---------------------------------------------------------------- */
  /*  ClientCallbackHandler implementation                             */
  /* ---------------------------------------------------------------- */

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    // Pre-filter with enforcer: deny/allow decisions bypass IDE forwarding
    if (this.enforcer && params.options.length > 0) {
      const toolInfo = {
        kind: params.toolCall?.kind ?? undefined,
        title: params.toolCall?.title ?? undefined,
        toolCallId: params.toolCall?.toolCallId ?? "unknown",
      };
      const decision = this.enforcer.evaluate(toolInfo);
      if (decision.action === "deny") {
        const outcome = this.enforcer.buildOutcome(decision, params.options);
        return { outcome };
      }
      if (decision.action === "allow") {
        const outcome = this.enforcer.buildOutcome(decision, params.options);
        return { outcome };
      }
      // "ask" → fall through to upstream IDE or local
    }

    if (this.upstream) {
      try {
        return await this.upstream.requestPermission(params);
      } catch (err) {
        logger.warn({ error: err }, "Failed to forward requestPermission to IDE, falling back");
      }
    }
    return this.local.requestPermission(params);
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    // Observe internal tool calls for audit (non-blocking)
    if (this.toolCallInterceptor) {
      this.toolCallInterceptor.onToolCall(params).catch((err) => {
        logger.warn({ err }, "ToolCallInterceptor.onToolCall failed");
      });
    }

    // Always notify local listeners (for internal state tracking)
    await this.local.sessionUpdate(params);
    // Also forward to IDE when lease is active
    if (this.upstream) {
      try {
        await this.upstream.sessionUpdate(params);
      } catch {
        // Best-effort: IDE might have disconnected
      }
    }
  }

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    if (this.upstream && this.ideCapabilities?.fs?.readTextFile) {
      try {
        return await this.upstream.readTextFile(params);
      } catch (err) {
        logger.warn({ path: params.path, error: err }, "IDE readTextFile failed, falling back");
      }
    }
    return this.local.readTextFile(params);
  }

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    if (this.upstream && this.ideCapabilities?.fs?.writeTextFile) {
      try {
        return await this.upstream.writeTextFile(params);
      } catch (err) {
        logger.warn({ path: params.path, error: err }, "IDE writeTextFile failed, falling back");
      }
    }
    return this.local.writeTextFile(params);
  }

  async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    if (this.upstream && this.ideCapabilities?.terminal) {
      try {
        return await this.upstream.createTerminal(params);
      } catch (err) {
        logger.warn({ error: err }, "IDE createTerminal failed, falling back");
      }
    }
    if (this.local.createTerminal) return this.local.createTerminal(params);
    throw new Error("Terminal not supported");
  }

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    if (this.upstream && this.ideCapabilities?.terminal) {
      try {
        return await this.upstream.terminalOutput(params);
      } catch (err) {
        logger.warn({ error: err }, "IDE terminalOutput failed, falling back");
      }
    }
    if (this.local.terminalOutput) return this.local.terminalOutput(params);
    throw new Error("Terminal not supported");
  }

  async waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    if (this.upstream && this.ideCapabilities?.terminal) {
      try {
        return await this.upstream.waitForTerminalExit(params);
      } catch (err) {
        logger.warn({ error: err }, "IDE waitForTerminalExit failed, falling back");
      }
    }
    if (this.local.waitForTerminalExit) return this.local.waitForTerminalExit(params);
    throw new Error("Terminal not supported");
  }

  async killTerminal(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse> {
    if (this.upstream && this.ideCapabilities?.terminal) {
      try {
        return await this.upstream.killTerminal(params);
      } catch (err) {
        logger.warn({ error: err }, "IDE killTerminal failed, falling back");
      }
    }
    if (this.local.killTerminal) return this.local.killTerminal(params);
    throw new Error("Terminal not supported");
  }

  async releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
    if (this.upstream && this.ideCapabilities?.terminal) {
      try {
        return await this.upstream.releaseTerminal(params);
      } catch (err) {
        logger.warn({ error: err }, "IDE releaseTerminal failed, falling back");
      }
    }
    if (this.local.releaseTerminal) return this.local.releaseTerminal(params);
    throw new Error("Terminal not supported");
  }
}
