/**
 * Types extracted from agent-runtime context-injector for cross-package use.
 */

import type { AgentInstanceMeta } from "./agent.types";

export interface AcpMcpServerStdio {
  name: string;
  command: string;
  args: string[];
  env?: Array<{ name: string; value: string }>;
}

export type ToolScope = "employee" | "service" | "all";

export interface ActantToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  rpcMethod: string;
  scope: ToolScope;
  context?: string;
}

export interface ContextProvider {
  readonly name: string;
  getMcpServers?(agentName: string, meta: AgentInstanceMeta): AcpMcpServerStdio[];
  getSystemContext?(agentName: string, meta: AgentInstanceMeta): string | undefined;
  getTools?(agentName: string, meta: AgentInstanceMeta): ActantToolDefinition[];
}

export interface SessionToken {
  token: string;
  agentName: string;
  sessionId: string;
  pid?: number;
  createdAt: number;
}

export interface SessionTokenValidator {
  validate(token: string): SessionToken | null;
}
