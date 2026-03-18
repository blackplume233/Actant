import type {
  ActantChannel,
  ChannelPromptResult,
  ChannelCapabilities,
  ChannelHostServices,
  PromptOptions,
  HostToolDefinition,
  McpServerStatus,
  McpSetResult,
  McpTransportConfig,
} from "@actant/agent-runtime";
import { DEFAULT_CHANNEL_CAPABILITIES } from "@actant/agent-runtime";
import type { StreamChunk } from "@actant/agent-runtime";
import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mapSdkMessage } from "./message-mapper.js";

export interface ClaudeChannelOptions {
  cwd: string;
  model?: string;
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
  allowDangerouslySkipPermissions?: boolean;
  maxTurns?: number;
  thinking?: Options["thinking"];
  effort?: Options["effort"];
  mcpServers?: Options["mcpServers"];
  allowedTools?: string[];
  disallowedTools?: string[];
  env?: Record<string, string | undefined>;
  hooks?: Options["hooks"];
  agents?: Options["agents"];
}

const CLAUDE_CHANNEL_CAPABILITIES: ChannelCapabilities = {
  ...DEFAULT_CHANNEL_CAPABILITIES,
  streaming: true,
  cancel: true,
  resume: true,
  structuredOutput: true,
  thinking: true,
  dynamicMcp: true,
  dynamicTools: true,
  contentTypes: ["text"],
  extensions: ["hooks", "agents", "effort"],
};

/**
 * ActantChannel implementation backed by @anthropic-ai/claude-agent-sdk.
 *
 * Each prompt/streamPrompt call creates a new SDK query(). The SDK spawns
 * a claude-code subprocess for each query and manages its lifecycle.
 *
 * Multi-turn conversations use the SDK's `resume` option, passing the
 * session_id captured from the first query's result.
 */
export class ClaudeChannelAdapter implements ActantChannel {
  private currentAbort: AbortController | null = null;
  private sdkSessionId: string | null = null;
  private callbackHandler: ChannelHostServices | null = null;
  private currentActivitySessionId: string | null = null;
  private readonly hostTools = new Map<string, HostToolDefinition>();
  private mcpServerSpecs = new Map<string, McpTransportConfig>();

  readonly channelId: string;
  private readonly options: ClaudeChannelOptions;
  readonly capabilities: ChannelCapabilities = CLAUDE_CHANNEL_CAPABILITIES;

  constructor(channelId: string, options: ClaudeChannelOptions) {
    this.channelId = channelId;
    this.options = options;
  }

  async prompt(sessionId: string, text: string, promptOptions?: PromptOptions): Promise<ChannelPromptResult> {
    const textChunks: string[] = [];
    let resultText: string | undefined;
    let stopReason = "end_turn";

    for await (const chunk of this.streamPrompt(sessionId, text, promptOptions)) {
      if (chunk.type === "text") {
        textChunks.push(chunk.content);
      } else if (chunk.type === "result") {
        resultText = chunk.content;
        stopReason = chunk.event?.type === "x_result_success" ? chunk.event.stopReason : stopReason;
      } else if (chunk.type === "error") {
        stopReason = "error";
        if (textChunks.length === 0) textChunks.push(chunk.content);
      }
    }

    return {
      stopReason,
      text: resultText ?? textChunks.join(""),
    };
  }

  async *streamPrompt(
    _sessionId: string,
    text: string,
    promptOptions?: PromptOptions,
  ): AsyncIterable<StreamChunk> {
    const abort = new AbortController();
    this.currentAbort = abort;

    await this.emitSessionUpdate({
      type: "x_prompt_start",
      sessionId: this.sdkSessionId ?? this.currentActivitySessionId ?? this.channelId,
      prompt: text,
    });

    try {
      const opts: Options = {
        cwd: this.options.cwd,
        abortController: abort,
        permissionMode: this.options.permissionMode ?? "acceptEdits",
        allowDangerouslySkipPermissions:
          this.options.permissionMode === "bypassPermissions"
            ? (this.options.allowDangerouslySkipPermissions ?? true)
            : undefined,
      };

      if (this.options.model ?? promptOptions?.model) opts.model = promptOptions?.model ?? this.options.model;
      if (this.options.maxTurns ?? promptOptions?.maxTurns) {
        opts.maxTurns = promptOptions?.maxTurns ?? this.options.maxTurns;
      }
      if (this.options.thinking) opts.thinking = this.options.thinking;
      if (this.options.effort) opts.effort = this.options.effort;
      if (this.options.mcpServers) opts.mcpServers = this.options.mcpServers;
      if (this.options.allowedTools) opts.allowedTools = this.options.allowedTools;
      if (this.options.disallowedTools) opts.disallowedTools = this.options.disallowedTools;
      if (this.options.env) opts.env = this.options.env;
      if (this.options.hooks) opts.hooks = this.options.hooks;
      if (this.options.agents) opts.agents = this.options.agents;

      if (this.sdkSessionId) {
        opts.resume = this.sdkSessionId;
      }

      const q = sdkQuery({ prompt: text, options: opts });

      try {
        for await (const msg of q) {
          this.captureSessionId(msg);
          const chunks = mapSdkMessage(msg);
          for (const chunk of chunks) {
            if (chunk.event) {
              await this.emitSessionUpdate({ ...chunk.event, sessionId: this.sdkSessionId ?? chunk.event.sessionId });
            }
            yield chunk;
          }
        }
      } finally {
        q.close();
      }
    } catch (err) {
      if (abort.signal.aborted) {
        const event = {
          type: "x_result_error" as const,
          sessionId: this.sdkSessionId ?? this.currentActivitySessionId ?? this.channelId,
          errors: ["Cancelled"],
          stopReason: "cancelled",
        };
        await this.emitSessionUpdate(event);
        yield { type: "error", content: "Cancelled", event };
      } else {
        const message = err instanceof Error ? err.message : String(err);
        const event = {
          type: "x_result_error" as const,
          sessionId: this.sdkSessionId ?? this.currentActivitySessionId ?? this.channelId,
          errors: [message],
          stopReason: "error",
        };
        await this.emitSessionUpdate(event);
        yield {
          type: "error",
          content: message,
          event,
        };
      }
    } finally {
      await this.emitSessionUpdate({
        type: "x_prompt_end",
        sessionId: this.sdkSessionId ?? this.currentActivitySessionId ?? this.channelId,
        stopReason: abort.signal.aborted ? "cancelled" : "end_turn",
      });
      this.currentAbort = null;
    }
  }

  async cancel(_sessionId: string): Promise<void> {
    this.currentAbort?.abort();
  }

  async setMcpServers(servers: Record<string, McpTransportConfig>): Promise<McpSetResult> {
    this.mcpServerSpecs = new Map(Object.entries(servers));
    return { connected: Object.keys(servers), failed: [] };
  }

  async getMcpStatus(): Promise<McpServerStatus[]> {
    return [...this.mcpServerSpecs.keys()].map((name) => ({ name, connected: true }));
  }

  async registerHostTools(tools: HostToolDefinition[]): Promise<void> {
    for (const tool of tools) {
      this.hostTools.set(tool.name, tool);
    }
  }

  async unregisterHostTools(toolNames: string[]): Promise<void> {
    for (const toolName of toolNames) {
      this.hostTools.delete(toolName);
    }
  }

  setCallbackHandler(hostServices: ChannelHostServices | null): void {
    this.callbackHandler = hostServices;
  }

  setCurrentActivitySession(id: string | null): void {
    this.currentActivitySessionId = id;
    this.callbackHandler?.activitySetSession?.(id);
  }

  get isConnected(): boolean {
    return true;
  }

  get currentSessionId(): string | null {
    return this.sdkSessionId;
  }

  private captureSessionId(msg: SDKMessage): void {
    if ("session_id" in msg && typeof msg.session_id === "string" && msg.session_id) {
      this.sdkSessionId = msg.session_id;
    }
  }

  private async emitSessionUpdate(event: StreamChunk["event"]): Promise<void> {
    if (!event) return;
    await this.callbackHandler?.sessionUpdate?.(event);
  }
}
