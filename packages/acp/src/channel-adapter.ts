import {
  type ActantChannelManager,
  type ActantChannel,
  type ChannelConnectOptions,
  type ChannelPromptResult,
  type ChannelCapabilities,
  type ChannelHostServices,
  DEFAULT_CHANNEL_CAPABILITIES,
} from "@actant/core";
import type { StreamChunk } from "@actant/core";
import type { AcpConnectionManager } from "./connection-manager";
import type { AcpConnection } from "./connection";
import { AcpCommunicator } from "./communicator";

const ACP_CHANNEL_CAPABILITIES: ChannelCapabilities = {
  ...DEFAULT_CHANNEL_CAPABILITIES,
  streaming: true,
  cancel: true,
  resume: false,
  multiSession: true,
  callbacks: true,
  needsFileIO: true,
  needsTerminal: true,
  needsPermission: true,
  contentTypes: ["text"],
};

/**
 * Wraps an existing AcpConnectionManager to satisfy the ActantChannelManager
 * interface. This is the backward-compatibility bridge used during the #279
 * migration. Once all backends implement ActantChannelManager natively, this
 * adapter will be removed.
 */
export class AcpChannelManagerAdapter implements ActantChannelManager {
  constructor(private readonly inner: AcpConnectionManager) {}

  async connect(
    name: string,
    options: ChannelConnectOptions,
    hostServices: ChannelHostServices,
  ): Promise<{ sessionId: string; capabilities: ChannelCapabilities }> {
    const result = await this.inner.connect(name, {
      command: options.command ?? "",
      args: options.args ?? [],
      cwd: options.cwd,
      resolvePackage: options.resolvePackage,
      connectionOptions: {
        autoApprove: options.autoApprove ?? options.connectionOptions?.autoApprove,
        env: options.env ?? options.connectionOptions?.env,
      },
      activityRecorder: options.activityRecorder as never,
      mcpServers: options.mcpServers,
      tools: options.tools as never,
      sessionToken: options.sessionToken,
      systemContext: options.systemContext,
      hostServices,
    });
    return { sessionId: result.sessionId, capabilities: ACP_CHANNEL_CAPABILITIES };
  }

  has(name: string): boolean {
    return this.inner.has(name);
  }

  getChannel(name: string): ActantChannel | undefined {
    const conn = this.inner.getConnection(name);
    const sessionId = this.inner.getPrimarySessionId(name);
    if (!conn || !sessionId) return undefined;
    return new AcpChannelAdapter(conn, sessionId);
  }

  getPrimarySessionId(name: string): string | undefined {
    return this.inner.getPrimarySessionId(name);
  }

  getCapabilities(_name: string): ChannelCapabilities | undefined {
    return ACP_CHANNEL_CAPABILITIES;
  }

  setCurrentActivitySession(name: string, id: string | null): void {
    this.inner.setCurrentActivitySession(name, id);
  }

  async disconnect(name: string): Promise<void> {
    await this.inner.disconnect(name);
  }

  async disposeAll(): Promise<void> {
    await this.inner.disposeAll();
  }
}

/**
 * Wraps a single AcpConnection + sessionId to satisfy the ActantChannel
 * interface. Stream mapping reuses the existing AcpCommunicator logic.
 */
class AcpChannelAdapter implements ActantChannel {
  private readonly communicator: AcpCommunicator;
  readonly capabilities: ChannelCapabilities = ACP_CHANNEL_CAPABILITIES;

  constructor(
    private readonly conn: AcpConnection,
    private readonly sessionId: string,
  ) {
    this.communicator = new AcpCommunicator(conn, sessionId);
  }

  async prompt(_sessionId: string, text: string): Promise<ChannelPromptResult> {
    const result = await this.conn.prompt(this.sessionId, text);
    return { stopReason: result.stopReason, text: result.text };
  }

  async *streamPrompt(_sessionId: string, text: string): AsyncIterable<StreamChunk> {
    yield* this.communicator.streamPrompt("", text);
  }

  async cancel(_sessionId: string): Promise<void> {
    await this.conn.cancel(this.sessionId);
  }

  get isConnected(): boolean {
    return this.conn.isConnected;
  }
}
