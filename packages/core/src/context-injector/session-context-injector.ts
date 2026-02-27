import type { AgentArchetype, AgentInstanceMeta } from "@actant/shared";
import type { HookEventBus } from "../hooks/hook-event-bus";
import type { SessionTokenStore } from "./session-token-store";
import { loadTemplate, renderTemplate } from "../prompts/template-engine";

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

/** Minimum archetype level required: "all" (any managed) < "service" < "employee". */
export type ToolScope = "employee" | "service" | "all";

const ARCHETYPE_LEVEL: Record<AgentArchetype, number> = { repo: 0, service: 1, employee: 2 };
const SCOPE_MIN_LEVEL: Record<ToolScope, number> = { all: 0, service: 1, employee: 2 };

/**
 * Definition of an internal tool that can be provided to managed agents.
 * Tools are registered by ContextProviders and delivered via ToolRegistry
 * (Pi: direct injection, ACP/Claude Code: CLI + token auth).
 */
export interface ActantToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Daemon RPC method to invoke, e.g. "canvas.update" */
  rpcMethod: string;
  /** Minimum archetype level required to use this tool */
  scope: ToolScope;
  /** Extended usage instructions injected into agent system context */
  context?: string;
}

/**
 * A provider that contributes MCP servers, internal tools, and/or system context
 * to be injected into ACP sessions.
 *
 * All methods are optional — implement only what the provider needs.
 * `getMcpServers` is kept for backward compatibility / external MCP use cases.
 */
export interface ContextProvider {
  readonly name: string;
  getMcpServers?(agentName: string, meta: AgentInstanceMeta): AcpMcpServerStdio[];
  getSystemContext?(agentName: string, meta: AgentInstanceMeta): string | undefined;
  getTools?(agentName: string, meta: AgentInstanceMeta): ActantToolDefinition[];
}

/**
 * Aggregated session context collected from all registered providers.
 */
export interface SessionContext {
  mcpServers: AcpMcpServerStdio[];
  systemContextAdditions: string[];
  tools: ActantToolDefinition[];
  /** Per-session token for internal tool authentication */
  token: string;
}

/**
 * Extensible module that collects dynamic context from registered providers
 * before an ACP session is created. Providers can contribute MCP servers,
 * internal tools, and system prompt additions.
 *
 * When a SessionTokenStore is attached, `prepare()` generates a per-session
 * token and includes tool usage instructions (with token) in system context.
 *
 * EventBus integration:
 * - Emits `session:preparing` before collection starts
 * - Emits `session:context-ready` after collection finishes
 */
export class SessionContextInjector {
  private providers = new Map<string, ContextProvider>();
  private eventBus: HookEventBus | null = null;
  private tokenStore: SessionTokenStore | null = null;

  setEventBus(eventBus: HookEventBus): void {
    this.eventBus = eventBus;
  }

  setTokenStore(tokenStore: SessionTokenStore): void {
    this.tokenStore = tokenStore;
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

  /** Revoke all session tokens for an agent (called on stopAgent). */
  revokeTokens(agentName: string): void {
    this.tokenStore?.revokeByAgent(agentName);
  }

  /**
   * Collect MCP servers, tools, and system context from all providers.
   * De-duplicates MCP servers and tools by name (first registration wins).
   * Filters tools by scope against the agent's archetype.
   * Generates a per-session token when a TokenStore is attached.
   */
  async prepare(agentName: string, meta: AgentInstanceMeta, sessionId?: string): Promise<SessionContext> {
    this.eventBus?.emit(
      "session:preparing",
      { callerType: "system", callerId: "SessionContextInjector" },
      agentName,
      { providerCount: this.providers.size },
    );

    const seenServers = new Map<string, AcpMcpServerStdio>();
    const seenTools = new Map<string, ActantToolDefinition>();
    const systemContextAdditions: string[] = [];

    for (const provider of this.providers.values()) {
      const servers = provider.getMcpServers?.(agentName, meta) ?? [];
      for (const srv of servers) {
        if (!seenServers.has(srv.name)) {
          seenServers.set(srv.name, srv);
        }
      }

      const tools = provider.getTools?.(agentName, meta) ?? [];
      for (const tool of tools) {
        if (seenTools.has(tool.name)) continue;
        const level = ARCHETYPE_LEVEL[meta.archetype] ?? 0;
        if (level < SCOPE_MIN_LEVEL[tool.scope]) continue;
        seenTools.set(tool.name, tool);
      }

      const ctx = provider.getSystemContext?.(agentName, meta);
      if (ctx) {
        systemContextAdditions.push(ctx);
      }
    }

    const mcpServers = Array.from(seenServers.values());
    const tools = Array.from(seenTools.values());

    const sid = sessionId ?? `${agentName}-${Date.now()}`;
    const token = this.tokenStore?.generate(agentName, sid) ?? "";

    if (tools.length > 0 && token) {
      systemContextAdditions.push(buildToolContextBlock(tools, token));
    }

    this.eventBus?.emit(
      "session:context-ready",
      { callerType: "system", callerId: "SessionContextInjector" },
      agentName,
      {
        mcpServerCount: mcpServers.length,
        toolCount: tools.length,
        contextAdditions: systemContextAdditions.length,
      },
    );

    return { mcpServers, systemContextAdditions, tools, token };
  }
}

/**
 * Build a system context block describing available internal tools
 * and how to call them via the `actant internal` CLI with a session token.
 * Template is loaded from `prompts/tool-instructions.md`.
 */
function buildToolContextBlock(tools: ActantToolDefinition[], token: string): string {
  const toolList = tools.map((t) => {
    const params = Object.entries(t.parameters ?? {})
      .map(([k, v]) => {
        const vType = typeof v === "object" && v !== null ? (v as Record<string, string>).type : undefined;
        return `--${k} <${vType ?? "value"}>`;
      })
      .join(" ");
    const desc = `  - ${t.name}: ${t.description}`;
    const usage = `    Usage: actant internal ${t.name.replace(/_/g, " ")} --token $ACTANT_SESSION_TOKEN ${params}`;
    const extra = t.context ? `\n    ${t.context}` : "";
    return `${desc}\n${usage}${extra}`;
  }).join("\n");

  const template = loadTemplate("tool-instructions.md");
  return renderTemplate(template, { toolList, token });
}
