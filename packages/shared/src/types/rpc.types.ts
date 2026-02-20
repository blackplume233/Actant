import type { AgentTemplate } from "./template.types";
import type { AgentInstanceMeta, LaunchMode, WorkspacePolicy, ResolveResult, DetachResult } from "./agent.types";
import type { SkillDefinition, PromptDefinition, McpServerDefinition, WorkflowDefinition } from "./domain-component.types";

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 base types
// ---------------------------------------------------------------------------

export interface RpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface RpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Error codes — maps AgentCraftError codes to JSON-RPC error codes
// ---------------------------------------------------------------------------

export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  TEMPLATE_NOT_FOUND: -32001,
  CONFIG_VALIDATION: -32002,
  AGENT_NOT_FOUND: -32003,
  AGENT_ALREADY_RUNNING: -32004,
  WORKSPACE_INIT: -32005,
  COMPONENT_REFERENCE: -32006,
  INSTANCE_CORRUPTED: -32007,
  AGENT_LAUNCH: -32008,
  AGENT_ALREADY_ATTACHED: -32009,
  AGENT_NOT_ATTACHED: -32010,
  GENERIC_BUSINESS: -32000,
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

// ---------------------------------------------------------------------------
// Method-specific param/result types
// ---------------------------------------------------------------------------

// template.*

export type TemplateListParams = Record<string, never>;

export type TemplateListResult = AgentTemplate[];

export interface TemplateGetParams {
  name: string;
}

export type TemplateGetResult = AgentTemplate;

export interface TemplateLoadParams {
  filePath: string;
}

export type TemplateLoadResult = AgentTemplate;

export interface TemplateUnloadParams {
  name: string;
}

export interface TemplateUnloadResult {
  success: boolean;
}

export interface TemplateValidateParams {
  filePath: string;
}

export interface TemplateValidateResult {
  valid: boolean;
  template?: AgentTemplate;
  errors?: Array<{ path: string; message: string }>;
}

// agent.*

export interface AgentCreateParams {
  name: string;
  template: string;
  overrides?: {
    launchMode?: LaunchMode;
    workspacePolicy?: WorkspacePolicy;
    metadata?: Record<string, string>;
  };
}

export type AgentCreateResult = AgentInstanceMeta;

export interface AgentStartParams {
  name: string;
}

export type AgentStartResult = AgentInstanceMeta;

export interface AgentStopParams {
  name: string;
}

export type AgentStopResult = AgentInstanceMeta;

export interface AgentDestroyParams {
  name: string;
}

export interface AgentDestroyResult {
  success: boolean;
}

export interface AgentStatusParams {
  name: string;
}

export type AgentStatusResult = AgentInstanceMeta;

export type AgentListParams = Record<string, never>;

export type AgentListResult = AgentInstanceMeta[];

// agent.resolve / agent.attach / agent.detach (external spawn)

export interface AgentResolveParams {
  name: string;
  template?: string;
}

export type AgentResolveResult = ResolveResult;

export interface AgentAttachParams {
  name: string;
  pid: number;
  metadata?: Record<string, string>;
}

export type AgentAttachResult = AgentInstanceMeta;

export interface AgentDetachParams {
  name: string;
  cleanup?: boolean;
}

export type AgentDetachResult = DetachResult;

// agent.run

export interface AgentRunParams {
  name: string;
  prompt: string;
  options?: {
    systemPromptFile?: string;
    appendSystemPrompt?: string;
    sessionId?: string;
    timeoutMs?: number;
    maxTurns?: number;
    model?: string;
  };
}

export interface AgentRunResult {
  text: string;
  sessionId?: string;
}

// skill.*

export type SkillListParams = Record<string, never>;
export type SkillListResult = SkillDefinition[];

export interface SkillGetParams {
  name: string;
}
export type SkillGetResult = SkillDefinition;

// prompt.*

export type PromptListParams = Record<string, never>;
export type PromptListResult = PromptDefinition[];

export interface PromptGetParams {
  name: string;
}
export type PromptGetResult = PromptDefinition;

// mcp.*

export type McpListParams = Record<string, never>;
export type McpListResult = McpServerDefinition[];

export interface McpGetParams {
  name: string;
}
export type McpGetResult = McpServerDefinition;

// workflow.*

export type WorkflowListParams = Record<string, never>;
export type WorkflowListResult = WorkflowDefinition[];

export interface WorkflowGetParams {
  name: string;
}
export type WorkflowGetResult = WorkflowDefinition;

// daemon.*

export type DaemonPingParams = Record<string, never>;

export interface DaemonPingResult {
  version: string;
  uptime: number;
  agents: number;
}

export type DaemonShutdownParams = Record<string, never>;

export interface DaemonShutdownResult {
  success: boolean;
}

// ---------------------------------------------------------------------------
// Method registry type — maps method name to params/result for type safety
// ---------------------------------------------------------------------------

export interface RpcMethodMap {
  "template.list": { params: TemplateListParams; result: TemplateListResult };
  "template.get": { params: TemplateGetParams; result: TemplateGetResult };
  "template.load": { params: TemplateLoadParams; result: TemplateLoadResult };
  "template.unload": { params: TemplateUnloadParams; result: TemplateUnloadResult };
  "template.validate": { params: TemplateValidateParams; result: TemplateValidateResult };
  "agent.create": { params: AgentCreateParams; result: AgentCreateResult };
  "agent.start": { params: AgentStartParams; result: AgentStartResult };
  "agent.stop": { params: AgentStopParams; result: AgentStopResult };
  "agent.destroy": { params: AgentDestroyParams; result: AgentDestroyResult };
  "agent.status": { params: AgentStatusParams; result: AgentStatusResult };
  "agent.list": { params: AgentListParams; result: AgentListResult };
  "agent.resolve": { params: AgentResolveParams; result: AgentResolveResult };
  "agent.attach": { params: AgentAttachParams; result: AgentAttachResult };
  "agent.detach": { params: AgentDetachParams; result: AgentDetachResult };
  "agent.run": { params: AgentRunParams; result: AgentRunResult };
  "skill.list": { params: SkillListParams; result: SkillListResult };
  "skill.get": { params: SkillGetParams; result: SkillGetResult };
  "prompt.list": { params: PromptListParams; result: PromptListResult };
  "prompt.get": { params: PromptGetParams; result: PromptGetResult };
  "mcp.list": { params: McpListParams; result: McpListResult };
  "mcp.get": { params: McpGetParams; result: McpGetResult };
  "workflow.list": { params: WorkflowListParams; result: WorkflowListResult };
  "workflow.get": { params: WorkflowGetParams; result: WorkflowGetResult };
  "daemon.ping": { params: DaemonPingParams; result: DaemonPingResult };
  "daemon.shutdown": { params: DaemonShutdownParams; result: DaemonShutdownResult };
}

export type RpcMethod = keyof RpcMethodMap;
