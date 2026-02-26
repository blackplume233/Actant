import type { AgentInstanceMeta } from "@actant/shared";
import type { HookEventBus } from "../hooks/hook-event-bus";

/**
 * ACP McpServer (stdio variant) as expected by the ACP SDK's session/new.
 * Uses `{ name, value }` env format per the ACP spec.
 */
export interface AcpMcpServerStdio {
  name: string;
  command: string;
  args: string[];
  env?: Array<{ name: string; value: string }>;
}

/**
 * A provider that contributes MCP servers and/or system context
 * to be injected into ACP sessions.
 */
export interface ContextProvider {
  readonly name: string;
  getMcpServers(agentName: string, meta: AgentInstanceMeta): AcpMcpServerStdio[];
  getSystemContext?(agentName: string, meta: AgentInstanceMeta): string | undefined;
}

/**
 * Aggregated session context collected from all registered providers.
 */
export interface SessionContext {
  mcpServers: AcpMcpServerStdio[];
  systemContextAdditions: string[];
}

/**
 * Extensible module that collects dynamic context from registered providers
 * before an ACP session is created. Providers can contribute MCP servers
 * and system prompt additions.
 *
 * EventBus integration:
 * - Emits `session:preparing` before collection starts
 * - Emits `session:context-ready` after collection finishes
 */
export class SessionContextInjector {
  private providers = new Map<string, ContextProvider>();
  private eventBus: HookEventBus | null = null;

  setEventBus(eventBus: HookEventBus): void {
    this.eventBus = eventBus;
  }

  register(provider: ContextProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregister(name: string): void {
    this.providers.delete(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Collect MCP servers and system context from all registered providers.
   * De-duplicates MCP servers by name (first registration wins).
   */
  async prepare(agentName: string, meta: AgentInstanceMeta): Promise<SessionContext> {
    this.eventBus?.emit(
      "session:preparing",
      { callerType: "system", callerId: "SessionContextInjector" },
      agentName,
      { providerCount: this.providers.size },
    );

    const seenServers = new Map<string, AcpMcpServerStdio>();
    const systemContextAdditions: string[] = [];

    for (const provider of this.providers.values()) {
      const servers = provider.getMcpServers(agentName, meta);
      for (const srv of servers) {
        if (!seenServers.has(srv.name)) {
          seenServers.set(srv.name, srv);
        }
      }

      const ctx = provider.getSystemContext?.(agentName, meta);
      if (ctx) {
        systemContextAdditions.push(ctx);
      }
    }

    const mcpServers = Array.from(seenServers.values());

    this.eventBus?.emit(
      "session:context-ready",
      { callerType: "system", callerId: "SessionContextInjector" },
      agentName,
      { mcpServerCount: mcpServers.length, contextAdditions: systemContextAdditions.length },
    );

    return { mcpServers, systemContextAdditions };
  }
}
