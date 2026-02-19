import type { AgentTemplate } from "./template.types";
import type { AgentInstanceMeta, LaunchMode } from "./agent.types";

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
  GENERIC_BUSINESS: -32000,
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

// ---------------------------------------------------------------------------
// Method-specific param/result types
// ---------------------------------------------------------------------------

// template.*

export interface TemplateListParams {}

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

export interface AgentListParams {}

export type AgentListResult = AgentInstanceMeta[];

// daemon.*

export interface DaemonPingParams {}

export interface DaemonPingResult {
  version: string;
  uptime: number;
  agents: number;
}

export interface DaemonShutdownParams {}

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
  "daemon.ping": { params: DaemonPingParams; result: DaemonPingResult };
  "daemon.shutdown": { params: DaemonShutdownParams; result: DaemonShutdownResult };
}

export type RpcMethod = keyof RpcMethodMap;
