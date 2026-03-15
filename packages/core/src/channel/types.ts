import type {
  StreamChunk,
  ChannelEvent,
} from "../communicator/agent-communicator";

export interface ChannelCapabilities {
  streaming: boolean;
  cancel: boolean;
  resume: boolean;
  multiSession: boolean;
  configurable: boolean;
  callbacks: boolean;
  needsFileIO: boolean;
  needsTerminal: boolean;
  needsPermission: boolean;
  structuredOutput: boolean;
  thinking: boolean;
  dynamicMcp: boolean;
  dynamicTools: boolean;
  contentTypes: string[];
  extensions: string[];
}

export const DEFAULT_CHANNEL_CAPABILITIES: ChannelCapabilities = {
  streaming: false,
  cancel: false,
  resume: false,
  multiSession: false,
  configurable: false,
  callbacks: false,
  needsFileIO: false,
  needsTerminal: false,
  needsPermission: false,
  structuredOutput: false,
  thinking: false,
  dynamicMcp: false,
  dynamicTools: false,
  contentTypes: [],
  extensions: [],
};

export interface PromptOptions {
  model?: string;
  maxTurns?: number;
  outputFormat?: unknown;
  metadata?: Record<string, unknown>;
}

export interface SessionOptions {
  cwd?: string;
  systemContext?: string[];
  mcpServers?: McpServerSpec[];
}

export interface ResumeOptions extends SessionOptions {
  sessionId: string;
}

export interface HostToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  scope?: "all" | "service" | "employee";
  instructions?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export type McpTransportConfig =
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      type: "sse";
      url: string;
      headers?: Record<string, string>;
    }
  | {
      type: "http";
      url: string;
      headers?: Record<string, string>;
    }
  | {
      type: "x_sdk";
      name: string;
    };

export interface McpServerSpec {
  name: string;
  transport: McpTransportConfig;
}

export interface McpSetResult {
  connected: string[];
  failed: Array<{ name: string; error: string }>;
}

export interface McpServerStatus {
  name: string;
  connected: boolean;
  error?: string;
}

export interface ChannelActivityRecord {
  type: string;
  data: unknown;
  timestamp?: number;
  category?: string;
}

export interface ReadTextFileRequest {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
}

export interface ReadTextFileResponse {
  content: string;
}

export interface WriteTextFileRequest {
  sessionId: string;
  path: string;
  content: string;
}

export type WriteTextFileResponse = Record<string, never>;

export interface RequestPermissionRequest {
  sessionId: string;
  toolCall?: {
    toolCallId: string;
    title?: string;
    kind?: string;
  };
  options: Array<{
    optionId: string;
    kind: string;
    name: string;
  }>;
}

export interface RequestPermissionResponse {
  outcome: {
    outcome: string;
    optionId?: string;
  };
}

export interface CreateTerminalRequest {
  sessionId: string;
  command: string;
  args?: string[];
  env?: Array<{ name: string; value: string }>;
  cwd?: string;
  outputByteLimit?: number;
}

export interface CreateTerminalResponse {
  terminalId: string;
}

export interface TerminalOutputRequest {
  sessionId: string;
  terminalId: string;
}

export interface TerminalOutputResponse {
  output: string;
  truncated: boolean;
  exitStatus?: { exitCode: number | null; signal: string | null };
}

export interface WaitForTerminalExitRequest {
  sessionId: string;
  terminalId: string;
}

export interface WaitForTerminalExitResponse {
  exitCode: number | null;
  signal: string | null;
}

export interface KillTerminalCommandRequest {
  sessionId: string;
  terminalId: string;
}

export type KillTerminalCommandResponse = Record<string, never>;

export interface ReleaseTerminalRequest {
  sessionId: string;
  terminalId: string;
}

export type ReleaseTerminalResponse = Record<string, never>;

export interface ChannelHostServices {
  sessionUpdate?(event: ChannelEvent): Promise<void>;
  requestPermission?(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  readTextFile?(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile?(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  createTerminal?(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  waitForTerminalExit?(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal?(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse>;
  releaseTerminal?(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse>;
  executeTool?(toolName: string, params: Record<string, unknown>): Promise<ToolExecutionResult>;
  activityRecord?(event: ChannelActivityRecord): Promise<void>;
  activitySetSession?(id: string | null): void;
  vfsRead?(path: string): Promise<{ content: string }>;
  vfsWrite?(path: string, content: string): Promise<void>;
  invoke?(method: string, params: unknown): Promise<unknown>;
}

/**
 * Actant-owned communication layer interface (ACP-Like).
 *
 * Concepts and terminology borrow from the ACP standard (session, prompt,
 * stream, cancel, notification) but ownership belongs to Actant. Backend
 * adapters (Claude Agent SDK, Pi SDK, ACP bridge, custom) implement this
 * interface to provide a uniform internal communication contract.
 */
export interface ActantChannel {
  readonly capabilities: ChannelCapabilities;
  prompt(sessionId: string, text: string, options?: PromptOptions): Promise<ChannelPromptResult>;
  streamPrompt(sessionId: string, text: string, options?: PromptOptions): AsyncIterable<StreamChunk>;
  cancel(sessionId: string): Promise<void>;
  newSession?(options?: SessionOptions): Promise<{ sessionId: string }>;
  resumeSession?(options: ResumeOptions): Promise<{ sessionId: string }>;
  configure?(options: SessionOptions): Promise<void>;
  setMcpServers?(servers: Record<string, McpTransportConfig>): Promise<McpSetResult>;
  getMcpStatus?(): Promise<McpServerStatus[]>;
  registerHostTools?(tools: HostToolDefinition[]): Promise<void>;
  unregisterHostTools?(toolNames: string[]): Promise<void>;
  setCallbackHandler?(hostServices: ChannelHostServices | null): void;
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
 * contract. The real implementations live in backend-specific packages
 * (e.g. @actant/channel-claude, @actant/acp).
 */
export interface ActantChannelManager {
  connect(
    name: string,
    options: ChannelConnectOptions,
    hostServices: ChannelHostServices,
  ): Promise<{ sessionId: string; capabilities: ChannelCapabilities }>;

  has(name: string): boolean;
  getChannel(name: string): ActantChannel | undefined;
  getPrimarySessionId(name: string): string | undefined;
  getCapabilities?(name: string): ChannelCapabilities | undefined;

  /**
   * Set the active activity session ID for recording.
   * Pass null to clear (falls back to channel-level default).
   */
  setCurrentActivitySession?(name: string, id: string | null): void;

  disconnect(name: string): Promise<void>;
  disposeAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Channel permission model — protocol-level declaration
// ---------------------------------------------------------------------------

/**
 * Permission mode controlling how tool execution requests are handled.
 *
 * Maps to the shared `PermissionMode` type but declared here as the
 * authoritative protocol-level definition. Backend adapters translate
 * this to their native permission semantics.
 *
 * - `"default"` — Backend decides (typically interactive approval)
 * - `"acceptEdits"` — Auto-approve file read/write, ask for others
 * - `"plan"` — Read-only analysis mode, no writes
 * - `"bypassPermissions"` — Auto-approve ALL tools (dangerous)
 * - `"dontAsk"` — Deny anything that would require approval
 */
export type ChannelPermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "bypassPermissions"
  | "dontAsk";

/**
 * Protocol-level permission declaration for channel connections.
 *
 * This is the **single source of truth** for what an agent is allowed to do
 * through its communication channel. Backend adapters MUST respect these
 * constraints, translating them to backend-specific permission mechanisms.
 *
 * Resolved from `AgentTemplate.permissions` during `agent start` and passed
 * through `ChannelConnectOptions.permissions`.
 */
export interface ChannelPermissions {
  /**
   * Base permission mode governing the overall tool execution policy.
   * When omitted, defaults to `"acceptEdits"`.
   */
  mode?: ChannelPermissionMode;

  /**
   * Tool names that execute automatically without user confirmation.
   * Takes precedence over `mode` for listed tools.
   *
   * Example: `["Bash", "Read", "Write", "WebFetch"]`
   */
  allowedTools?: string[];

  /**
   * Tool names completely removed from the agent's context.
   * The backend MUST NOT expose these tools to the LLM.
   *
   * Example: `["WebSearch"]` to prevent internet access.
   */
  disallowedTools?: string[];

  /**
   * Restrict the available tool set to only these tools.
   * When set, only listed tools are available; all others are removed.
   * Mutually exclusive intent with `disallowedTools` (if both set,
   * `tools` takes precedence).
   *
   * Example: `["Read", "Grep", "Glob"]` for a read-only agent.
   */
  tools?: string[];

  /**
   * Filesystem directories the agent is allowed to access beyond its
   * workspace root. Backend-specific: Claude Code uses `additionalDirectories`.
   */
  additionalDirectories?: string[];

  /**
   * Sandbox configuration for process/network isolation.
   * Backend-specific support varies.
   */
  sandbox?: {
    enabled?: boolean;
    allowedDomains?: string[];
  };
}

// ---------------------------------------------------------------------------
// Channel connect options
// ---------------------------------------------------------------------------

export interface ChannelConnectOptions {
  command?: string;
  args?: string[];
  cwd: string;
  resolvePackage?: string;
  env?: Record<string, string>;
  autoApprove?: boolean;

  /**
   * Protocol-level permission declaration.
   * Resolved from the agent's template `permissions` field.
   * Backend adapters MUST translate this to their native permission model.
   */
  permissions?: ChannelPermissions;

  connectionOptions?: {
    autoApprove?: boolean;
    env?: Record<string, string>;
  };
  activityRecorder?: unknown;
  mcpServers?: McpServerSpec[];
  hostTools?: HostToolDefinition[];
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
  adapterOptions?: Record<string, unknown>;
}
