import { spawn, execSync, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import {
  ClientSideConnection,
  ndJsonStream,
  type Client,
  type Agent,
  type InitializeResponse,
  type NewSessionResponse,
  type PromptResponse,
  type SessionNotification,
  type ContentBlock,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type TerminalOutputRequest,
  type TerminalOutputResponse,
  type WaitForTerminalExitRequest,
  type WaitForTerminalExitResponse,
  type KillTerminalCommandRequest,
  type KillTerminalCommandResponse,
  type ReleaseTerminalRequest,
  type ReleaseTerminalResponse,
} from "@agentclientprotocol/sdk";
import { createLogger, isWindows } from "@actant/shared";
import { resolveAcpBinary } from "./binary-resolver";
import type { PermissionsConfig } from "@actant/shared";
import { PermissionPolicyEnforcer, PermissionAuditLogger } from "@actant/core";
import { LocalTerminalManager } from "./terminal-manager";

const logger = createLogger("acp-connection");

/* ------------------------------------------------------------------ */
/*  Client callback delegation                                         */
/* ------------------------------------------------------------------ */

/**
 * Pluggable handler for every Client callback the Agent can invoke.
 * Implementations decide whether to handle locally or forward to IDE.
 */
export interface ClientCallbackHandler {
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  sessionUpdate(params: SessionNotification): Promise<void>;
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  createTerminal?(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  waitForTerminalExit?(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal?(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse>;
  releaseTerminal?(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse>;
}

/* ------------------------------------------------------------------ */
/*  Options & session info                                             */
/* ------------------------------------------------------------------ */

export interface AcpConnectionOptions {
  /** Auto-approve all tool permission requests (fallback when no permissionPolicy). */
  autoApprove?: boolean;
  /** Permission policy for the ACP Client allowlist (Layer 2 enforcement). */
  permissionPolicy?: PermissionsConfig;
  /** Instance name for audit logging. */
  instanceName?: string;
  /** Global session update listener. */
  onSessionUpdate?: (notification: SessionNotification) => void;
  /** Env vars to pass to the agent subprocess. */
  env?: Record<string, string>;
  /**
   * Override the default local Client callbacks.
   * When provided, AcpConnection delegates ALL Client requests to this handler
   * instead of using the built-in local implementation.
   * Used by AcpGateway to route callbacks to IDE or local depending on lease state.
   */
  callbackHandler?: ClientCallbackHandler;
}

export interface AcpSessionInfo {
  sessionId: string;
  modes?: NewSessionResponse["modes"];
  configOptions?: NewSessionResponse["configOptions"];
}

/* ------------------------------------------------------------------ */
/*  AcpConnection                                                      */
/* ------------------------------------------------------------------ */

/**
 * Wraps a ClientSideConnection + child process lifecycle.
 * Manages spawn → initialize → session/new → prompt → cancel → close.
 *
 * Implements ALL ACP Client callbacks:
 * - requestPermission (auto-approve or delegate)
 * - sessionUpdate
 * - fs/read_text_file (with line/limit)
 * - fs/write_text_file
 * - terminal/* (create, output, wait_for_exit, kill, release)
 */
export class AcpConnection {
  private child: ChildProcess | null = null;
  private conn: ClientSideConnection | null = null;
  private initResponse: InitializeResponse | null = null;
  private sessions = new Map<string, AcpSessionInfo>();
  private updateListeners = new Map<string, ((n: SessionNotification) => void)[]>();
  private readonly options: AcpConnectionOptions;
  private readonly terminalManager: LocalTerminalManager;
  private enforcer: PermissionPolicyEnforcer | null = null;
  private auditLogger: PermissionAuditLogger;
  private _earlyExitPromise: Promise<never> | null = null;

  constructor(options?: AcpConnectionOptions) {
    this.options = options ?? {};
    this.terminalManager = new LocalTerminalManager();
    this.auditLogger = new PermissionAuditLogger(options?.instanceName);
    if (options?.permissionPolicy) {
      this.enforcer = new PermissionPolicyEnforcer(options.permissionPolicy);
    }
  }

  /** Update the permission policy at runtime (hot-reload). */
  updatePermissionPolicy(config: PermissionsConfig): void {
    if (this.enforcer) {
      this.enforcer.updateConfig(config);
    } else {
      this.enforcer = new PermissionPolicyEnforcer(config);
    }
    this.auditLogger.logUpdated("runtime");
  }

  get isConnected(): boolean {
    return this.conn != null && !this.conn.signal.aborted;
  }

  get childPid(): number | undefined {
    return this.child?.pid;
  }

  get agentCapabilities(): InitializeResponse | null {
    return this.initResponse;
  }

  get rawConnection(): ClientSideConnection | null {
    return this.conn;
  }

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  async spawn(command: string, args: string[], cwd: string, resolvePackage?: string): Promise<void> {
    if (this.child) throw new Error("AcpConnection already spawned");

    const resolved = resolveAcpBinary(command, resolvePackage);
    const finalCommand = resolved.command;
    const finalArgs = [...resolved.prependArgs, ...args];

    const env = { ...process.env, ...this.options.env };
    logger.info({ command: finalCommand, args: finalArgs, cwd }, "Spawning ACP agent subprocess");

    const spawnCommand = isWindows() && finalCommand.includes(" ")
      ? `"${finalCommand}"`
      : finalCommand;

    this.child = spawn(spawnCommand, finalArgs, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env,
      shell: isWindows(),
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("Failed to create stdio pipes for ACP agent");
    }

    const stderrChunks: string[] = [];
    this.child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) stderrChunks.push(text);
      logger.debug({ stderr: text }, "ACP agent stderr");
    });
    this.child.on("error", (err) => {
      logger.error({ error: err }, "ACP agent process error");
    });

    const child = this.child;
    this._earlyExitPromise = new Promise<never>((_resolve, reject) => {
      child.on("exit", (code, signal) => {
        const stderr = stderrChunks.join("\n");
        const detail = stderr
          ? `\n  stderr: ${stderr}`
          : "";
        reject(new Error(
          `ACP agent process exited unexpectedly (code=${code}, signal=${signal}).` +
          ` Command: ${finalCommand} ${finalArgs.join(" ")}${detail}`,
        ));
      });
    });
    this._earlyExitPromise.catch(() => {});

    const webWritable = Writable.toWeb(this.child.stdin) as WritableStream<Uint8Array>;
    const webReadable = Readable.toWeb(this.child.stdout) as ReadableStream<Uint8Array>;
    const stream = ndJsonStream(webWritable, webReadable);

    this.conn = new ClientSideConnection(
      (_agent: Agent): Client => this.buildClient(),
      stream,
    );

    this.conn.signal.addEventListener("abort", () => {
      logger.info("ACP connection closed");
    });
  }

  async initialize(): Promise<InitializeResponse> {
    if (!this.conn) throw new Error("AcpConnection not spawned");

    const initPromise = this.conn.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: {
        name: "actant",
        title: "Actant Daemon",
        version: "0.1.0",
      },
    });

    this.initResponse = this._earlyExitPromise
      ? await Promise.race([initPromise, this._earlyExitPromise])
      : await initPromise;

    this._earlyExitPromise = null;

    logger.info({
      agentName: this.initResponse.agentInfo?.name,
      protocolVersion: this.initResponse.protocolVersion,
      loadSession: this.initResponse.agentCapabilities?.loadSession,
    }, "ACP initialized");

    return this.initResponse;
  }

  /* ---------------------------------------------------------------- */
  /*  Session management                                               */
  /* ---------------------------------------------------------------- */

  async newSession(cwd: string, mcpServers: NewSessionResponse["modes"] extends unknown ? unknown[] : never[] = []): Promise<AcpSessionInfo> {
    if (!this.conn) throw new Error("AcpConnection not initialized");

    const response = await this.conn.newSession({
      cwd,
      mcpServers: mcpServers as never[],
    });
    const info: AcpSessionInfo = {
      sessionId: response.sessionId,
      modes: response.modes,
      configOptions: response.configOptions,
    };
    this.sessions.set(response.sessionId, info);

    logger.info({ sessionId: response.sessionId, cwd }, "ACP session created");
    return info;
  }

  async loadSession(sessionId: string, cwd: string): Promise<void> {
    if (!this.conn) throw new Error("AcpConnection not initialized");
    if (!this.initResponse?.agentCapabilities?.loadSession) {
      throw new Error("Agent does not support loadSession capability");
    }
    await this.conn.loadSession({ sessionId, cwd, mcpServers: [] });
    logger.info({ sessionId }, "ACP session loaded");
  }

  async setSessionMode(sessionId: string, modeId: string): Promise<void> {
    if (!this.conn) throw new Error("AcpConnection not initialized");
    await this.conn.setSessionMode({ sessionId, modeId });
    logger.info({ sessionId, modeId }, "Session mode set");
  }

  async setSessionConfigOption(sessionId: string, configId: string, value: string): Promise<unknown> {
    if (!this.conn) throw new Error("AcpConnection not initialized");
    const result = await this.conn.setSessionConfigOption({ sessionId, configId, value });
    logger.info({ sessionId, configId, value }, "Session config option set");
    return result;
  }

  async authenticate(methodId: string): Promise<void> {
    if (!this.conn) throw new Error("AcpConnection not initialized");
    await this.conn.authenticate({ methodId });
    logger.info({ methodId }, "Authenticated");
  }

  /* ---------------------------------------------------------------- */
  /*  Prompt                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Send a prompt with arbitrary content blocks.
   * For text-only convenience, use the string overload.
   */
  async prompt(
    sessionId: string,
    content: string | ContentBlock[],
  ): Promise<{ stopReason: string; text: string }> {
    if (!this.conn) throw new Error("AcpConnection not initialized");

    const promptBlocks: ContentBlock[] = typeof content === "string"
      ? [{ type: "text", text: content }]
      : content;

    let collectedText = "";
    const listener = (notification: SessionNotification) => {
      const update = notification.update;
      if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
        collectedText += update.content.text;
      }
    };
    this.addUpdateListener(sessionId, listener);

    try {
      const response: PromptResponse = await this.conn.prompt({
        sessionId,
        prompt: promptBlocks,
      });
      return { stopReason: response.stopReason, text: collectedText };
    } finally {
      this.removeUpdateListener(sessionId, listener);
    }
  }

  /**
   * Stream prompt — yields every SessionNotification as it arrives.
   */
  async *streamPrompt(
    sessionId: string,
    content: string | ContentBlock[],
  ): AsyncIterable<SessionNotification> {
    if (!this.conn) throw new Error("AcpConnection not initialized");

    const promptBlocks: ContentBlock[] = typeof content === "string"
      ? [{ type: "text", text: content }]
      : content;

    const queue: SessionNotification[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    const listener = (notification: SessionNotification) => {
      queue.push(notification);
      resolve?.();
    };
    this.addUpdateListener(sessionId, listener);

    const promptPromise = this.conn.prompt({
      sessionId,
      prompt: promptBlocks,
    }).then(() => {
      done = true;
      resolve?.();
    }).catch((err) => {
      done = true;
      resolve?.();
      throw err;
    });

    try {
      while (!done || queue.length > 0) {
        if (queue.length === 0 && !done) {
          await new Promise<void>((r) => { resolve = r; });
          resolve = null;
        }
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) yield item;
        }
      }
      await promptPromise;
    } finally {
      this.removeUpdateListener(sessionId, listener);
    }
  }

  async cancel(sessionId: string): Promise<void> {
    if (!this.conn) return;
    await this.conn.cancel({ sessionId });
  }

  /* ---------------------------------------------------------------- */
  /*  Session accessors                                                */
  /* ---------------------------------------------------------------- */

  getSession(sessionId: string): AcpSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /* ---------------------------------------------------------------- */
  /*  Close                                                            */
  /* ---------------------------------------------------------------- */

  async close(): Promise<void> {
    this.terminalManager.disposeAll();

    if (this.child) {
      const child = this.child;
      this.child = null;

      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.end();
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          killProcessTree(child);
          resolve();
        }, 5000);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
        killProcessTree(child);
      });
      logger.info("ACP agent subprocess terminated");
    }

    this.conn = null;
    this.initResponse = null;
    this.sessions.clear();
    this.updateListeners.clear();
  }

  /* ---------------------------------------------------------------- */
  /*  Build the Client callback implementation                         */
  /* ---------------------------------------------------------------- */

  private buildClient(): Client {
    const handler = this.options.callbackHandler;

    if (handler) {
      return {
        requestPermission: (p) => handler.requestPermission(p),
        sessionUpdate: async (p) => {
          await handler.sessionUpdate(p);
          this.dispatchToListeners(p);
        },
        readTextFile: (p) => handler.readTextFile(p),
        writeTextFile: (p) => handler.writeTextFile(p),
        createTerminal: handler.createTerminal?.bind(handler),
        terminalOutput: handler.terminalOutput?.bind(handler),
        waitForTerminalExit: handler.waitForTerminalExit?.bind(handler),
        killTerminal: handler.killTerminal?.bind(handler),
        releaseTerminal: handler.releaseTerminal?.bind(handler),
      };
    }

    return {
      requestPermission: (p) => this.localRequestPermission(p),
      sessionUpdate: (p) => this.localSessionUpdate(p),
      readTextFile: (p) => this.localReadTextFile(p),
      writeTextFile: (p) => this.localWriteTextFile(p),
      createTerminal: (p) => this.terminalManager.createTerminal(p),
      terminalOutput: (p) => this.terminalManager.terminalOutput(p),
      waitForTerminalExit: (p) => this.terminalManager.waitForExit(p),
      killTerminal: (p) => this.terminalManager.killTerminal(p),
      releaseTerminal: (p) => this.terminalManager.releaseTerminal(p),
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Local callback implementations                                   */
  /* ---------------------------------------------------------------- */

  private async localRequestPermission(
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    // Layer 2: Policy-based enforcement via PermissionPolicyEnforcer
    if (this.enforcer && params.options.length > 0) {
      const toolInfo = {
        kind: params.toolCall?.kind ?? undefined,
        title: params.toolCall?.title ?? undefined,
        toolCallId: params.toolCall?.toolCallId ?? "unknown",
      };
      const decision = this.enforcer.evaluate(toolInfo);
      this.auditLogger.logEvaluation(toolInfo, decision);

      if (decision.action === "allow" || decision.action === "deny") {
        const outcome = this.enforcer.buildOutcome(decision, params.options);
        return { outcome };
      }
      // "ask" decision: fall through to autoApprove or cancelled
    }

    // Fallback: legacy autoApprove behavior
    if (this.options.autoApprove && params.options.length > 0) {
      const allowOption = params.options.find(
        (o) => o.kind === "allow_once" || o.kind === "allow_always",
      ) ?? params.options[0];
      if (!allowOption) return { outcome: { outcome: "cancelled" } };
      return { outcome: { outcome: "selected", optionId: allowOption.optionId } };
    }
    logger.warn({ sessionId: params.sessionId }, "Permission request denied (no handler)");
    return { outcome: { outcome: "cancelled" } };
  }

  private async localSessionUpdate(params: SessionNotification): Promise<void> {
    this.options.onSessionUpdate?.(params);
    this.dispatchToListeners(params);
  }

  private dispatchToListeners(params: SessionNotification): void {
    const listeners = this.updateListeners.get(params.sessionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(params);
        } catch (err) {
          logger.warn({ sessionId: params.sessionId, error: err }, "Listener threw during dispatchToListeners");
        }
      }
    }
  }

  private async localReadTextFile(
    params: ReadTextFileRequest,
  ): Promise<ReadTextFileResponse> {
    const { readFile } = await import("node:fs/promises");
    try {
      const raw = await readFile(params.path, "utf-8");

      if (params.line != null || params.limit != null) {
        const lines = raw.split("\n");
        const start = Math.max(0, (params.line ?? 1) - 1);
        const end = params.limit != null ? start + params.limit : lines.length;
        return { content: lines.slice(start, end).join("\n") };
      }
      return { content: raw };
    } catch {
      throw new Error(`Cannot read file: ${params.path}`);
    }
  }

  private async localWriteTextFile(
    params: WriteTextFileRequest,
  ): Promise<WriteTextFileResponse> {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    try {
      await mkdir(dirname(params.path), { recursive: true });
      await writeFile(params.path, params.content, "utf-8");
      return {};
    } catch {
      throw new Error(`Cannot write file: ${params.path}`);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Update listener management                                       */
  /* ---------------------------------------------------------------- */

  addUpdateListener(sessionId: string, listener: (n: SessionNotification) => void): void {
    const existing = this.updateListeners.get(sessionId) ?? [];
    existing.push(listener);
    this.updateListeners.set(sessionId, existing);
  }

  removeUpdateListener(sessionId: string, listener: (n: SessionNotification) => void): void {
    const existing = this.updateListeners.get(sessionId);
    if (existing) {
      const idx = existing.indexOf(listener);
      if (idx >= 0) existing.splice(idx, 1);
      if (existing.length === 0) this.updateListeners.delete(sessionId);
    }
  }
}

/**
 * Kill a child process and its entire process tree.
 * On Windows, `child.kill()` only terminates the direct `cmd.exe` shell
 * when `shell: true` was used, leaving the real backend process alive.
 * `taskkill /T /F` recursively kills the whole tree.
 */
function killProcessTree(child: ChildProcess): void {
  if (child.pid == null) return;
  if (isWindows()) {
    try {
      execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: "ignore" });
    } catch {
      child.kill("SIGKILL");
    }
  } else {
    child.kill("SIGTERM");
  }
}
