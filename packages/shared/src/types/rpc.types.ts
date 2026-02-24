import type { AgentTemplate, PermissionsInput, PermissionsConfig, OpenSpawnOptions } from "./template.types";
import type { AgentInstanceMeta, LaunchMode, WorkspacePolicy, ResolveResult, DetachResult } from "./agent.types";
import type { SkillDefinition, PromptDefinition, McpServerDefinition, WorkflowDefinition, PluginDefinition } from "./domain-component.types";
import type { SourceEntry, SourceConfig, PresetDefinition } from "./source.types";

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
// Error codes — maps ActantError codes to JSON-RPC error codes
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
  /** Warnings that don't prevent loading but indicate potential issues (#119) */
  warnings?: Array<{ path: string; message: string }>;
}

// agent.*

export type WorkDirConflict = "error" | "overwrite" | "append";

export interface AgentCreateParams {
  name: string;
  template: string;
  overrides?: {
    launchMode?: LaunchMode;
    workspacePolicy?: WorkspacePolicy;
    /** Absolute path to use as workspace directory instead of the default {instancesDir}/{name}. */
    workDir?: string;
    /** Behavior when workDir already exists. Default: "error". */
    workDirConflict?: WorkDirConflict;
    /** Override template permissions. Completely replaces template.permissions when set. */
    permissions?: PermissionsInput;
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

export interface AgentUpdatePermissionsParams {
  name: string;
  permissions: PermissionsInput;
}

export interface AgentUpdatePermissionsResult {
  effectivePermissions: PermissionsConfig;
}

export interface AgentAdoptParams {
  path: string;
  rename?: string;
}

export interface AgentAdoptResult {
  name: string;
  template: string;
  workspacePath: string;
  location: "builtin" | "external";
  createdAt: string;
  status: "stopped" | "running" | "orphaned";
}

// agent.resolve / agent.attach / agent.detach (external spawn)

export interface AgentResolveParams {
  name: string;
  template?: string;
  overrides?: {
    launchMode?: LaunchMode;
    workspacePolicy?: WorkspacePolicy;
    metadata?: Record<string, string>;
  };
}

export type AgentResolveResult = ResolveResult;

export interface AgentOpenParams {
  name: string;
  /** When provided and agent doesn't exist, auto-create from this template. */
  template?: string;
}

export interface AgentOpenResult {
  command: string;
  args: string[];
  /** Working directory for the spawned process. */
  cwd?: string;
  /** Declarative spawn options — the CLI applies these directly without backend-specific branching. */
  openSpawnOptions?: OpenSpawnOptions;
}

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

// agent.dispatch

export interface AgentDispatchParams {
  name: string;
  prompt: string;
  priority?: string;
}
export interface AgentDispatchResult {
  queued: boolean;
}

// agent.tasks

export interface AgentTasksParams {
  name: string;
}
export interface AgentTasksResult {
  queued: number;
  processing: boolean;
  tasks: unknown[];
}

// agent.logs

export interface AgentLogsParams {
  name: string;
  limit?: number;
}
export type AgentLogsResult = unknown[];

// schedule.list

export interface ScheduleListParams {
  name: string;
}
export interface ScheduleListResult {
  sources: Array<{ id: string; type: string; active: boolean }>;
  running: boolean;
}

// agent.prompt (ACP session)

export interface AgentPromptParams {
  name: string;
  message: string;
  sessionId?: string;
}

export interface AgentPromptResult {
  response: string;
  sessionId: string;
}

// session.* (Session Lease mode)

export interface SessionCreateParams {
  agentName: string;
  clientId: string;
  idleTtlMs?: number;
}

export interface SessionLeaseInfo {
  sessionId: string;
  agentName: string;
  clientId: string | null;
  state: "active" | "idle" | "expired";
  createdAt: string;
  lastActivityAt: string;
  idleTtlMs: number;
}

export type SessionCreateResult = SessionLeaseInfo;

export interface SessionPromptParams {
  sessionId: string;
  text: string;
}

export interface SessionPromptResult {
  stopReason: string;
  text: string;
}

export interface SessionCancelParams {
  sessionId: string;
}

export interface SessionCancelResult {
  ok: boolean;
}

export interface SessionCloseParams {
  sessionId: string;
}

export interface SessionCloseResult {
  ok: boolean;
}

export interface SessionListParams {
  agentName?: string;
}

export type SessionListResult = SessionLeaseInfo[];

// proxy.* (legacy)

export interface ProxyConnectParams {
  agentName: string;
  envPassthrough?: boolean;
}

export interface ProxySession {
  sessionId: string;
  agentName: string;
  envPassthrough: boolean;
  connectedAt: string;
}

export type ProxyConnectResult = ProxySession;

export interface ProxyDisconnectParams {
  sessionId: string;
}

export interface ProxyDisconnectResult {
  ok: boolean;
}

export interface ProxyForwardParams {
  sessionId: string;
  acpMessage: Record<string, unknown>;
}

export type ProxyForwardResult = Record<string, unknown>;

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

// plugin.*

export type PluginListParams = Record<string, never>;
export type PluginListResult = PluginDefinition[];

export interface PluginGetParams {
  name: string;
}
export type PluginGetResult = PluginDefinition;

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
// Gateway lease — request an ACP Gateway socket for Session Lease
// ---------------------------------------------------------------------------

export interface GatewayLeaseParams {
  agentName: string;
}

export interface GatewayLeaseResult {
  socketPath: string;
}

export interface ComponentAddParams {
  component: Record<string, unknown>;
}

export interface ComponentAddResult {
  name: string;
}

export interface ComponentUpdateParams {
  name: string;
  patch: Record<string, unknown>;
}

export interface ComponentUpdateResult {
  name: string;
}

export interface ComponentRemoveParams {
  name: string;
}

export interface ComponentRemoveResult {
  success: boolean;
}

export interface ComponentImportParams {
  filePath: string;
}

export interface ComponentImportResult {
  name: string;
}

export interface ComponentExportParams {
  name: string;
  filePath: string;
}

export interface ComponentExportResult {
  success: boolean;
}

export type SourceListParams = Record<string, never>;
export type SourceListResult = SourceEntry[];

export interface SourceAddParams {
  name: string;
  config: SourceConfig;
}

export interface SourceAddResult {
  name: string;
  components: { skills: number; prompts: number; mcp: number; workflows: number; presets: number };
}

export interface SourceRemoveParams {
  name: string;
}

export interface SourceRemoveResult {
  success: boolean;
}

export interface SourceSyncParams {
  name?: string;
}

export interface SourceSyncResult {
  synced: string[];
  /** Sync report summary (aggregated when syncing multiple sources). */
  report?: {
    addedCount: number;
    updatedCount: number;
    removedCount: number;
    hasBreakingChanges: boolean;
  };
}

export interface SourceValidateParams {
  /** Validate a registered source by name. */
  name?: string;
  /** Validate an arbitrary directory path directly. */
  path?: string;
  /** Treat warnings as errors. */
  strict?: boolean;
  /** Enable compatibility checks against an external standard (e.g. "agent-skills"). */
  compat?: string;
}

export interface SourceValidationIssueDto {
  severity: "error" | "warning" | "info";
  path: string;
  component?: string;
  message: string;
  code?: string;
}

export interface SourceValidateResult {
  valid: boolean;
  sourceName: string;
  rootDir: string;
  summary: { pass: number; warn: number; error: number };
  issues: SourceValidationIssueDto[];
}

export interface PresetListParams {
  packageName?: string;
}

export type PresetListResult = PresetDefinition[];

export interface PresetShowParams {
  qualifiedName: string;
}

export type PresetShowResult = PresetDefinition;

export interface PresetApplyParams {
  qualifiedName: string;
  templateName: string;
}

export type PresetApplyResult = AgentTemplate;

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
  "agent.updatePermissions": { params: AgentUpdatePermissionsParams; result: AgentUpdatePermissionsResult };
  "agent.adopt": { params: AgentAdoptParams; result: AgentAdoptResult };
  "agent.resolve": { params: AgentResolveParams; result: AgentResolveResult };
  "agent.open": { params: AgentOpenParams; result: AgentOpenResult };
  "agent.attach": { params: AgentAttachParams; result: AgentAttachResult };
  "agent.detach": { params: AgentDetachParams; result: AgentDetachResult };
  "agent.run": { params: AgentRunParams; result: AgentRunResult };
  "agent.prompt": { params: AgentPromptParams; result: AgentPromptResult };
  "agent.dispatch": { params: AgentDispatchParams; result: AgentDispatchResult };
  "agent.tasks": { params: AgentTasksParams; result: AgentTasksResult };
  "agent.logs": { params: AgentLogsParams; result: AgentLogsResult };
  "schedule.list": { params: ScheduleListParams; result: ScheduleListResult };
  "session.create": { params: SessionCreateParams; result: SessionCreateResult };
  "session.prompt": { params: SessionPromptParams; result: SessionPromptResult };
  "session.cancel": { params: SessionCancelParams; result: SessionCancelResult };
  "session.close": { params: SessionCloseParams; result: SessionCloseResult };
  "session.list": { params: SessionListParams; result: SessionListResult };
  "proxy.connect": { params: ProxyConnectParams; result: ProxyConnectResult };
  "proxy.disconnect": { params: ProxyDisconnectParams; result: ProxyDisconnectResult };
  "proxy.forward": { params: ProxyForwardParams; result: ProxyForwardResult };
  "skill.list": { params: SkillListParams; result: SkillListResult };
  "skill.get": { params: SkillGetParams; result: SkillGetResult };
  "skill.add": { params: ComponentAddParams; result: ComponentAddResult };
  "skill.update": { params: ComponentUpdateParams; result: ComponentUpdateResult };
  "skill.remove": { params: ComponentRemoveParams; result: ComponentRemoveResult };
  "skill.import": { params: ComponentImportParams; result: ComponentImportResult };
  "skill.export": { params: ComponentExportParams; result: ComponentExportResult };
  "prompt.list": { params: PromptListParams; result: PromptListResult };
  "prompt.get": { params: PromptGetParams; result: PromptGetResult };
  "prompt.add": { params: ComponentAddParams; result: ComponentAddResult };
  "prompt.update": { params: ComponentUpdateParams; result: ComponentUpdateResult };
  "prompt.remove": { params: ComponentRemoveParams; result: ComponentRemoveResult };
  "prompt.import": { params: ComponentImportParams; result: ComponentImportResult };
  "prompt.export": { params: ComponentExportParams; result: ComponentExportResult };
  "mcp.list": { params: McpListParams; result: McpListResult };
  "mcp.get": { params: McpGetParams; result: McpGetResult };
  "mcp.add": { params: ComponentAddParams; result: ComponentAddResult };
  "mcp.update": { params: ComponentUpdateParams; result: ComponentUpdateResult };
  "mcp.remove": { params: ComponentRemoveParams; result: ComponentRemoveResult };
  "mcp.import": { params: ComponentImportParams; result: ComponentImportResult };
  "mcp.export": { params: ComponentExportParams; result: ComponentExportResult };
  "workflow.list": { params: WorkflowListParams; result: WorkflowListResult };
  "workflow.get": { params: WorkflowGetParams; result: WorkflowGetResult };
  "workflow.add": { params: ComponentAddParams; result: ComponentAddResult };
  "workflow.update": { params: ComponentUpdateParams; result: ComponentUpdateResult };
  "workflow.remove": { params: ComponentRemoveParams; result: ComponentRemoveResult };
  "workflow.import": { params: ComponentImportParams; result: ComponentImportResult };
  "workflow.export": { params: ComponentExportParams; result: ComponentExportResult };
  "plugin.list": { params: PluginListParams; result: PluginListResult };
  "plugin.get": { params: PluginGetParams; result: PluginGetResult };
  "plugin.add": { params: ComponentAddParams; result: ComponentAddResult };
  "plugin.update": { params: ComponentUpdateParams; result: ComponentUpdateResult };
  "plugin.remove": { params: ComponentRemoveParams; result: ComponentRemoveResult };
  "plugin.import": { params: ComponentImportParams; result: ComponentImportResult };
  "plugin.export": { params: ComponentExportParams; result: ComponentExportResult };
  "source.list": { params: SourceListParams; result: SourceListResult };
  "source.add": { params: SourceAddParams; result: SourceAddResult };
  "source.remove": { params: SourceRemoveParams; result: SourceRemoveResult };
  "source.sync": { params: SourceSyncParams; result: SourceSyncResult };
  "source.validate": { params: SourceValidateParams; result: SourceValidateResult };
  "preset.list": { params: PresetListParams; result: PresetListResult };
  "preset.show": { params: PresetShowParams; result: PresetShowResult };
  "preset.apply": { params: PresetApplyParams; result: PresetApplyResult };
  "daemon.ping": { params: DaemonPingParams; result: DaemonPingResult };
  "daemon.shutdown": { params: DaemonShutdownParams; result: DaemonShutdownResult };
  "gateway.lease": { params: GatewayLeaseParams; result: GatewayLeaseResult };
}

export type RpcMethod = keyof RpcMethodMap;
