import type { ActantChannelManager, ActantChannel, ChannelConnectOptions } from "@actant/core";
import { ClaudeChannelAdapter, type ClaudeChannelOptions } from "./claude-channel-adapter.js";
import { randomUUID } from "node:crypto";

interface ChannelEntry {
  adapter: ClaudeChannelAdapter;
  sessionId: string;
  options: ClaudeChannelOptions;
}

/**
 * Manages multiple ClaudeChannelAdapter instances keyed by name.
 *
 * The Claude Agent SDK is stateless per query() call — there is no persistent
 * subprocess to manage between prompts. connect() stores configuration and
 * generates a session ID; the real SDK subprocess is spawned on each
 * prompt()/streamPrompt() call.
 */
export class ClaudeChannelManagerAdapter implements ActantChannelManager {
  private readonly channels = new Map<string, ChannelEntry>();

  async connect(
    name: string,
    options: ChannelConnectOptions,
  ): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();

    const perms = options.permissions;
    const adapterOpts = (options as unknown as Record<string, unknown>)["adapterOptions"] as
      | Record<string, unknown>
      | undefined;

    const channelOptions: ClaudeChannelOptions = {
      cwd: options.cwd,
      model: adapterOpts?.["model"] as string | undefined,
      // Permission chain: adapterOptions override > protocol permissions > default
      permissionMode: (adapterOpts?.["permissionMode"] as ClaudeChannelOptions["permissionMode"])
        ?? perms?.mode
        ?? "acceptEdits",
      allowDangerouslySkipPermissions:
        (adapterOpts?.["allowDangerouslySkipPermissions"] as boolean | undefined)
        ?? (perms?.mode === "bypassPermissions" ? true : undefined),
      maxTurns: adapterOpts?.["maxTurns"] as number | undefined,
      thinking: adapterOpts?.["thinking"] as ClaudeChannelOptions["thinking"],
      effort: adapterOpts?.["effort"] as ClaudeChannelOptions["effort"],
      mcpServers: adapterOpts?.["mcpServers"] as ClaudeChannelOptions["mcpServers"],
      allowedTools:
        (adapterOpts?.["allowedTools"] as string[] | undefined) ?? perms?.allowedTools,
      disallowedTools:
        (adapterOpts?.["disallowedTools"] as string[] | undefined) ?? perms?.disallowedTools,
      env: options.connectionOptions?.env,
      hooks: adapterOpts?.["hooks"] as ClaudeChannelOptions["hooks"],
      agents: adapterOpts?.["agents"] as ClaudeChannelOptions["agents"],
    };

    // Protocol-level tool restriction → SDK tools option
    if (!channelOptions.allowedTools && perms?.tools) {
      channelOptions.allowedTools = perms.tools;
    }

    const adapter = new ClaudeChannelAdapter(name, channelOptions);
    this.channels.set(name, { adapter, sessionId, options: channelOptions });

    return { sessionId };
  }

  has(name: string): boolean {
    return this.channels.has(name);
  }

  getChannel(name: string): ActantChannel | undefined {
    return this.channels.get(name)?.adapter;
  }

  getPrimarySessionId(name: string): string | undefined {
    return this.channels.get(name)?.sessionId;
  }

  setCurrentActivitySession(_name: string, _id: string | null): void {
    // Activity recording integration deferred to Phase 2.
  }

  async disconnect(name: string): Promise<void> {
    const entry = this.channels.get(name);
    if (entry) {
      await entry.adapter.cancel(entry.sessionId).catch(() => {});
      this.channels.delete(name);
    }
  }

  async disposeAll(): Promise<void> {
    const names = [...this.channels.keys()];
    await Promise.all(names.map((n) => this.disconnect(n)));
  }
}
