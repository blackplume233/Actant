import type { AgentInstanceMeta } from "@actant/shared";

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
 * Used by the plugin system (plug 4: contextProviders).
 */
export interface ContextProvider {
  readonly name: string;
  getMcpServers?(agentName: string, meta: AgentInstanceMeta): AcpMcpServerStdio[];
  getSystemContext?(agentName: string, meta: AgentInstanceMeta): string | undefined;
  getTools?(agentName: string, meta: AgentInstanceMeta): ActantToolDefinition[];
}
