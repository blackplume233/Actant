import { spawn, type ChildProcess } from "node:child_process";
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
} from "@agentclientprotocol/sdk";
import { createLogger } from "@agentcraft/shared";

const logger = createLogger("acp-connection");

export interface AcpConnectionOptions {
  /** Auto-approve all tool permission requests (workspace isolation mode). */
  autoApprove?: boolean;
  /** Callback for session update notifications (streaming). */
  onSessionUpdate?: (notification: SessionNotification) => void;
  /** Environment variables to pass to the agent subprocess. */
  env?: Record<string, string>;
}

export interface AcpSessionInfo {
  sessionId: string;
  modes?: NewSessionResponse["modes"];
}

/**
 * Wraps a ClientSideConnection + child process lifecycle.
 * Manages spawn → initialize → session/new → prompt → cancel → close.
 */
export class AcpConnection {
  private child: ChildProcess | null = null;
  private conn: ClientSideConnection | null = null;
  private initResponse: InitializeResponse | null = null;
  private sessions = new Map<string, AcpSessionInfo>();
  private updateListeners = new Map<string, ((n: SessionNotification) => void)[]>();
  private readonly options: AcpConnectionOptions;

  constructor(options?: AcpConnectionOptions) {
    this.options = options ?? {};
  }

  get isConnected(): boolean {
    return this.conn != null && !this.conn.signal.aborted;
  }

  get agentCapabilities(): InitializeResponse | null {
    return this.initResponse;
  }

  /**
   * Spawn the ACP agent subprocess and establish the ACP connection.
   */
  async spawn(command: string, args: string[], cwd: string): Promise<void> {
    if (this.child) {
      throw new Error("AcpConnection already spawned");
    }

    const env = { ...process.env, ...this.options.env };

    logger.info({ command, args, cwd }, "Spawning ACP agent subprocess");

    this.child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("Failed to create stdio pipes for ACP agent");
    }

    this.child.stderr?.on("data", (chunk: Buffer) => {
      logger.debug({ stderr: chunk.toString().trim() }, "ACP agent stderr");
    });

    this.child.on("error", (err) => {
      logger.error({ error: err }, "ACP agent process error");
    });

    const webWritable = Writable.toWeb(this.child.stdin) as WritableStream<Uint8Array>;
    const webReadable = Readable.toWeb(this.child.stdout) as ReadableStream<Uint8Array>;
    const stream = ndJsonStream(webWritable, webReadable);

    const onSessionUpdate = this.options.onSessionUpdate;
    const updateListeners = this.updateListeners;

    this.conn = new ClientSideConnection(
      (_agent: Agent): Client => ({
        requestPermission: async (params) => {
          if (this.options.autoApprove && params.options.length > 0) {
            const firstOption = params.options[0];
            if (!firstOption) return { outcome: { outcome: "cancelled" } };
            return { outcome: { outcome: "selected", optionId: firstOption.optionId } };
          }
          logger.warn({ sessionId: params.sessionId }, "Permission request denied (no handler)");
          return { outcome: { outcome: "cancelled" } };
        },

        sessionUpdate: async (params) => {
          onSessionUpdate?.(params);
          const listeners = updateListeners.get(params.sessionId);
          if (listeners) {
            for (const listener of listeners) {
              listener(params);
            }
          }
        },

        readTextFile: async (params) => {
          const { readFile } = await import("node:fs/promises");
          try {
            const content = await readFile(params.path, "utf-8");
            return { content };
          } catch {
            throw new Error(`Cannot read file: ${params.path}`);
          }
        },

        writeTextFile: async (params) => {
          const { writeFile, mkdir } = await import("node:fs/promises");
          const { dirname } = await import("node:path");
          try {
            await mkdir(dirname(params.path), { recursive: true });
            await writeFile(params.path, params.content, "utf-8");
            return {};
          } catch {
            throw new Error(`Cannot write file: ${params.path}`);
          }
        },
      }),
      stream,
    );

    this.conn.signal.addEventListener("abort", () => {
      logger.info("ACP connection closed");
    });
  }

  /**
   * Send the ACP `initialize` handshake.
   */
  async initialize(): Promise<InitializeResponse> {
    if (!this.conn) throw new Error("AcpConnection not spawned");

    this.initResponse = await this.conn.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: {
        name: "agentcraft",
        title: "AgentCraft Daemon",
        version: "0.1.0",
      },
    });

    logger.info({
      agentName: this.initResponse.agentInfo?.name,
      protocolVersion: this.initResponse.protocolVersion,
    }, "ACP initialized");

    return this.initResponse;
  }

  /**
   * Create a new ACP session for the given working directory.
   */
  async newSession(cwd: string): Promise<AcpSessionInfo> {
    if (!this.conn) throw new Error("AcpConnection not initialized");

    const response = await this.conn.newSession({ cwd, mcpServers: [] });
    const info: AcpSessionInfo = {
      sessionId: response.sessionId,
      modes: response.modes,
    };
    this.sessions.set(response.sessionId, info);

    logger.info({ sessionId: response.sessionId, cwd }, "ACP session created");
    return info;
  }

  /**
   * Send a prompt to an ACP session and wait for the complete response.
   * Returns the stop reason and collects text from session/update notifications.
   */
  async prompt(
    sessionId: string,
    text: string,
  ): Promise<{ stopReason: string; text: string }> {
    if (!this.conn) throw new Error("AcpConnection not initialized");

    let collectedText = "";
    const listener = (notification: SessionNotification) => {
      const update = notification.update;
      if (update.sessionUpdate === "agent_message_chunk") {
        if (update.content.type === "text") {
          collectedText += update.content.text;
        }
      }
    };

    this.addUpdateListener(sessionId, listener);

    try {
      const response: PromptResponse = await this.conn.prompt({
        sessionId,
        prompt: [{ type: "text", text }],
      });
      return {
        stopReason: response.stopReason,
        text: collectedText,
      };
    } finally {
      this.removeUpdateListener(sessionId, listener);
    }
  }

  /**
   * Send a prompt and yield session update notifications as they arrive.
   * The generator completes when the prompt response is received.
   */
  async *streamPrompt(
    sessionId: string,
    text: string,
  ): AsyncIterable<SessionNotification> {
    if (!this.conn) throw new Error("AcpConnection not initialized");

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
      prompt: [{ type: "text", text }],
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

  /**
   * Cancel an ongoing prompt in a session.
   */
  async cancel(sessionId: string): Promise<void> {
    if (!this.conn) return;
    await this.conn.cancel({ sessionId });
  }

  /**
   * Get or create a session for the given working directory.
   */
  getSession(sessionId: string): AcpSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active session IDs.
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Close the ACP connection and terminate the child process.
   */
  async close(): Promise<void> {
    if (this.child) {
      const child = this.child;
      this.child = null;

      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.end();
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);

        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });

        child.kill("SIGTERM");
      });

      logger.info("ACP agent subprocess terminated");
    }

    this.conn = null;
    this.initResponse = null;
    this.sessions.clear();
    this.updateListeners.clear();
  }

  private addUpdateListener(sessionId: string, listener: (n: SessionNotification) => void): void {
    const existing = this.updateListeners.get(sessionId) ?? [];
    existing.push(listener);
    this.updateListeners.set(sessionId, existing);
  }

  private removeUpdateListener(sessionId: string, listener: (n: SessionNotification) => void): void {
    const existing = this.updateListeners.get(sessionId);
    if (existing) {
      const idx = existing.indexOf(listener);
      if (idx >= 0) existing.splice(idx, 1);
      if (existing.length === 0) this.updateListeners.delete(sessionId);
    }
  }
}
