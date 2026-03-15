import type { StreamChunk } from "../communicator/agent-communicator";

/**
 * Actant-owned communication layer interface (ACP-Like).
 *
 * Concepts and terminology borrow from the ACP standard (session, prompt,
 * stream, cancel, notification) but ownership belongs to Actant.  Backend
 * adapters (Claude Agent SDK, Pi SDK, ACP bridge, custom) implement this
 * interface to provide a uniform internal communication contract.
 */
export interface ActantChannel {
  prompt(sessionId: string, text: string): Promise<ChannelPromptResult>;
  streamPrompt(sessionId: string, text: string): AsyncIterable<StreamChunk>;
  cancel(sessionId: string): Promise<void>;
  readonly isConnected: boolean;
}

export interface ChannelPromptResult {
  stopReason: string;
  text: string;
}

/**
 * Manages ActantChannel instances keyed by agent name.
 *
 * Replaces the former AcpConnectionManagerLike with a protocol-agnostic
 * contract.  The real implementations live in backend-specific packages
 * (e.g. @actant/channel-claude, @actant/acp).
 */
export interface ActantChannelManager {
  connect(name: string, options: ChannelConnectOptions): Promise<{ sessionId: string }>;

  has(name: string): boolean;
  getChannel(name: string): ActantChannel | undefined;
  getPrimarySessionId(name: string): string | undefined;

  /**
   * Set the active activity session ID for recording.
   * Pass null to clear (falls back to channel-level default).
   */
  setCurrentActivitySession?(name: string, id: string | null): void;

  disconnect(name: string): Promise<void>;
  disposeAll(): Promise<void>;
}

export interface ChannelConnectOptions {
  command: string;
  args: string[];
  cwd: string;
  resolvePackage?: string;
  connectionOptions?: {
    autoApprove?: boolean;
    env?: Record<string, string>;
  };
  activityRecorder?: unknown;
  mcpServers?: Array<{
    name: string;
    command: string;
    args: string[];
    env?: Array<{ name: string; value: string }>;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    rpcMethod: string;
    scope: string;
    context?: string;
  }>;
  sessionToken?: string;
  systemContext?: string[];
}
