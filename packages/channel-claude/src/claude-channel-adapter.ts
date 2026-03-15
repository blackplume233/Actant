import type { ActantChannel, ChannelPromptResult } from "@actant/core";
import type { StreamChunk } from "@actant/core";
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

  readonly channelId: string;
  private readonly options: ClaudeChannelOptions;

  constructor(channelId: string, options: ClaudeChannelOptions) {
    this.channelId = channelId;
    this.options = options;
  }

  async prompt(sessionId: string, text: string): Promise<ChannelPromptResult> {
    const textChunks: string[] = [];
    let resultText: string | undefined;
    let stopReason = "end_turn";

    for await (const chunk of this.streamPrompt(sessionId, text)) {
      if (chunk.type === "text") {
        textChunks.push(chunk.content);
      } else if (chunk.type === "result") {
        resultText = chunk.content;
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
  ): AsyncIterable<StreamChunk> {
    const abort = new AbortController();
    this.currentAbort = abort;

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

      if (this.options.model) opts.model = this.options.model;
      if (this.options.maxTurns) opts.maxTurns = this.options.maxTurns;
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
            yield chunk;
          }
        }
      } finally {
        q.close();
      }
    } catch (err) {
      if (abort.signal.aborted) {
        yield { type: "error", content: "Cancelled" };
      } else {
        yield {
          type: "error",
          content: err instanceof Error ? err.message : String(err),
        };
      }
    } finally {
      this.currentAbort = null;
    }
  }

  async cancel(_sessionId: string): Promise<void> {
    this.currentAbort?.abort();
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
}
