import {
  type ActantChannelManager,
  type ActantChannel,
  type ChannelConnectOptions,
  type ChannelCapabilities,
  type ChannelHostServices,
  type McpServerSpec,
  DEFAULT_CHANNEL_CAPABILITIES,
} from "@actant/agent-runtime";
import { ClaudeChannelAdapter, type ClaudeChannelOptions } from "./claude-channel-adapter.js";
import { randomUUID } from "node:crypto";

interface ChannelEntry {
  adapter: ClaudeChannelAdapter;
  sessionId: string;
  options: ClaudeChannelOptions;
  capabilities: ChannelCapabilities;
}

const CLAUDE_MANAGER_CAPABILITIES: ChannelCapabilities = {
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
    hostServices: ChannelHostServices,
  ): Promise<{ sessionId: string; capabilities: ChannelCapabilities }> {
    const sessionId = randomUUID();

    const perms = options.permissions;
    const adapterOpts = options.adapterOptions;

    const channelOptions: ClaudeChannelOptions = {
      cwd: options.cwd,
      model: adapterOpts?.["model"] as string | undefined,
      permissionMode: (adapterOpts?.["permissionMode"] as ClaudeChannelOptions["permissionMode"])
        ?? perms?.mode
        ?? "acceptEdits",
      allowDangerouslySkipPermissions:
        (adapterOpts?.["allowDangerouslySkipPermissions"] as boolean | undefined)
        ?? (perms?.mode === "bypassPermissions" ? true : undefined),
      maxTurns: adapterOpts?.["maxTurns"] as number | undefined,
      thinking: adapterOpts?.["thinking"] as ClaudeChannelOptions["thinking"],
      effort: adapterOpts?.["effort"] as ClaudeChannelOptions["effort"],
      mcpServers: toClaudeMcpServers(adapterOpts?.["mcpServers"] as ClaudeChannelOptions["mcpServers"] | undefined, options.mcpServers),
      allowedTools:
        (adapterOpts?.["allowedTools"] as string[] | undefined) ?? perms?.allowedTools,
      disallowedTools:
        (adapterOpts?.["disallowedTools"] as string[] | undefined) ?? perms?.disallowedTools,
      env: options.env ?? options.connectionOptions?.env,
      hooks: adapterOpts?.["hooks"] as ClaudeChannelOptions["hooks"],
      agents: adapterOpts?.["agents"] as ClaudeChannelOptions["agents"],
    };

    if (!channelOptions.allowedTools && perms?.tools) {
      channelOptions.allowedTools = perms.tools;
    }

    const adapter = new ClaudeChannelAdapter(name, channelOptions);
    adapter.setCallbackHandler(hostServices);
    if (options.hostTools?.length) {
      await adapter.registerHostTools(options.hostTools);
    }
    if (options.mcpServers?.length) {
      await adapter.setMcpServers(Object.fromEntries(options.mcpServers.map((server) => [server.name, server.transport])));
    }

    this.channels.set(name, {
      adapter,
      sessionId,
      options: channelOptions,
      capabilities: CLAUDE_MANAGER_CAPABILITIES,
    });

    return { sessionId, capabilities: CLAUDE_MANAGER_CAPABILITIES };
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

  getCapabilities(name: string): ChannelCapabilities | undefined {
    return this.channels.get(name)?.capabilities;
  }

  setCurrentActivitySession(name: string, id: string | null): void {
    this.channels.get(name)?.adapter.setCurrentActivitySession(id);
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

function toClaudeMcpServers(
  adapterServers: ClaudeChannelOptions["mcpServers"] | undefined,
  protocolServers: McpServerSpec[] | undefined,
): ClaudeChannelOptions["mcpServers"] | undefined {
  if (adapterServers) return adapterServers;
  if (!protocolServers?.length) return undefined;
  const result: Record<string, { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string> }> = {};
  for (const server of protocolServers) {
    const t = server.transport;
    if (t.type !== "stdio") continue;
    result[server.name] = { type: "stdio", command: t.command, args: t.args, env: t.env };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
