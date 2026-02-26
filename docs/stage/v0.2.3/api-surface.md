# API Surface Snapshot

> **版本**: v0.1.0 | **生成时间**: 2026-02-26T01:13:41.782Z
> 本文档记录所有对外接口（RPC 方法、CLI 命令），用于版本间变更追踪。

---

## 1. JSON-RPC 方法 (76 个)

### template.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `template.list` | `TemplateListParams` | `TemplateListResult` |
| `template.get` | `TemplateGetParams` | `TemplateGetResult` |
| `template.load` | `TemplateLoadParams` | `TemplateLoadResult` |
| `template.unload` | `TemplateUnloadParams` | `TemplateUnloadResult` |
| `template.validate` | `TemplateValidateParams` | `TemplateValidateResult` |

### agent.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `agent.create` | `AgentCreateParams` | `AgentCreateResult` |
| `agent.start` | `AgentStartParams` | `AgentStartResult` |
| `agent.stop` | `AgentStopParams` | `AgentStopResult` |
| `agent.destroy` | `AgentDestroyParams` | `AgentDestroyResult` |
| `agent.status` | `AgentStatusParams` | `AgentStatusResult` |
| `agent.list` | `AgentListParams` | `AgentListResult` |
| `agent.adopt` | `AgentAdoptParams` | `AgentAdoptResult` |
| `agent.resolve` | `AgentResolveParams` | `AgentResolveResult` |
| `agent.open` | `AgentOpenParams` | `AgentOpenResult` |
| `agent.attach` | `AgentAttachParams` | `AgentAttachResult` |
| `agent.detach` | `AgentDetachParams` | `AgentDetachResult` |
| `agent.run` | `AgentRunParams` | `AgentRunResult` |
| `agent.prompt` | `AgentPromptParams` | `AgentPromptResult` |
| `agent.dispatch` | `AgentDispatchParams` | `AgentDispatchResult` |
| `agent.tasks` | `AgentTasksParams` | `AgentTasksResult` |
| `agent.logs` | `AgentLogsParams` | `AgentLogsResult` |

### schedule.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `schedule.list` | `ScheduleListParams` | `ScheduleListResult` |

### session.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `session.create` | `SessionCreateParams` | `SessionCreateResult` |
| `session.prompt` | `SessionPromptParams` | `SessionPromptResult` |
| `session.cancel` | `SessionCancelParams` | `SessionCancelResult` |
| `session.close` | `SessionCloseParams` | `SessionCloseResult` |
| `session.list` | `SessionListParams` | `SessionListResult` |

### proxy.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `proxy.connect` | `ProxyConnectParams` | `ProxyConnectResult` |
| `proxy.disconnect` | `ProxyDisconnectParams` | `ProxyDisconnectResult` |
| `proxy.forward` | `ProxyForwardParams` | `ProxyForwardResult` |

### skill.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `skill.list` | `SkillListParams` | `SkillListResult` |
| `skill.get` | `SkillGetParams` | `SkillGetResult` |
| `skill.add` | `ComponentAddParams` | `ComponentAddResult` |
| `skill.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `skill.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `skill.import` | `ComponentImportParams` | `ComponentImportResult` |
| `skill.export` | `ComponentExportParams` | `ComponentExportResult` |

### prompt.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `prompt.list` | `PromptListParams` | `PromptListResult` |
| `prompt.get` | `PromptGetParams` | `PromptGetResult` |
| `prompt.add` | `ComponentAddParams` | `ComponentAddResult` |
| `prompt.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `prompt.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `prompt.import` | `ComponentImportParams` | `ComponentImportResult` |
| `prompt.export` | `ComponentExportParams` | `ComponentExportResult` |

### mcp.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `mcp.list` | `McpListParams` | `McpListResult` |
| `mcp.get` | `McpGetParams` | `McpGetResult` |
| `mcp.add` | `ComponentAddParams` | `ComponentAddResult` |
| `mcp.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `mcp.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `mcp.import` | `ComponentImportParams` | `ComponentImportResult` |
| `mcp.export` | `ComponentExportParams` | `ComponentExportResult` |

### workflow.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `workflow.list` | `WorkflowListParams` | `WorkflowListResult` |
| `workflow.get` | `WorkflowGetParams` | `WorkflowGetResult` |
| `workflow.add` | `ComponentAddParams` | `ComponentAddResult` |
| `workflow.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `workflow.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `workflow.import` | `ComponentImportParams` | `ComponentImportResult` |
| `workflow.export` | `ComponentExportParams` | `ComponentExportResult` |

### plugin.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `plugin.list` | `PluginListParams` | `PluginListResult` |
| `plugin.get` | `PluginGetParams` | `PluginGetResult` |
| `plugin.add` | `ComponentAddParams` | `ComponentAddResult` |
| `plugin.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `plugin.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `plugin.import` | `ComponentImportParams` | `ComponentImportResult` |
| `plugin.export` | `ComponentExportParams` | `ComponentExportResult` |

### source.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `source.list` | `SourceListParams` | `SourceListResult` |
| `source.add` | `SourceAddParams` | `SourceAddResult` |
| `source.remove` | `SourceRemoveParams` | `SourceRemoveResult` |
| `source.sync` | `SourceSyncParams` | `SourceSyncResult` |
| `source.validate` | `SourceValidateParams` | `SourceValidateResult` |

### preset.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `preset.list` | `PresetListParams` | `PresetListResult` |
| `preset.show` | `PresetShowParams` | `PresetShowResult` |
| `preset.apply` | `PresetApplyParams` | `PresetApplyResult` |

### daemon.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `daemon.ping` | `DaemonPingParams` | `DaemonPingResult` |
| `daemon.shutdown` | `DaemonShutdownParams` | `DaemonShutdownResult` |

### gateway.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|-----------|
| `gateway.lease` | `GatewayLeaseParams` | `GatewayLeaseResult` |

## 2. RPC 类型签名

### Params 类型

#### `TemplateGetParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `TemplateLoadParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `filePath` | `string` | 是 |

#### `TemplateUnloadParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `TemplateValidateParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `filePath` | `string` | 是 |

#### `AgentCreateParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `template` | `string` | 是 |
| `overrides` | `{ launchMode?: LaunchMode` | 否 |
| `workspacePolicy` | `WorkspacePolicy` | 否 |
| `archetype` | `AgentArchetype` | 否 |
| `autoStart` | `boolean` | 否 |

#### `AgentStartParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `autoInstall` | `boolean` | 否 |

#### `AgentStopParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `AgentDestroyParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `AgentStatusParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `AgentUpdatePermissionsParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `permissions` | `PermissionsInput` | 是 |

#### `AgentAdoptParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `path` | `string` | 是 |
| `rename` | `string` | 否 |

#### `AgentResolveParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `template` | `string` | 否 |
| `overrides` | `{ launchMode?: LaunchMode` | 否 |
| `workspacePolicy` | `WorkspacePolicy` | 否 |
| `metadata` | `Record<string, string>` | 否 |

#### `AgentOpenParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `template` | `string` | 否 |
| `autoInstall` | `boolean` | 否 |

#### `AgentAttachParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `pid` | `number` | 是 |
| `metadata` | `Record<string, string>` | 否 |

#### `AgentDetachParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `cleanup` | `boolean` | 否 |

#### `AgentRunParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `prompt` | `string` | 是 |
| `options` | `{ systemPromptFile?: string` | 否 |
| `appendSystemPrompt` | `string` | 否 |
| `sessionId` | `string` | 否 |
| `timeoutMs` | `number` | 否 |
| `maxTurns` | `number` | 否 |
| `model` | `string` | 否 |

#### `AgentDispatchParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `prompt` | `string` | 是 |
| `priority` | `string` | 否 |

#### `AgentTasksParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `AgentLogsParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `limit` | `number` | 否 |

#### `ScheduleListParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `AgentPromptParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `message` | `string` | 是 |
| `sessionId` | `string` | 否 |

#### `SessionCreateParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `agentName` | `string` | 是 |
| `clientId` | `string` | 是 |
| `idleTtlMs` | `number` | 否 |

#### `SessionPromptParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |
| `text` | `string` | 是 |

#### `SessionCancelParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |

#### `SessionCloseParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |

#### `SessionListParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `agentName` | `string` | 否 |

#### `ProxyConnectParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `agentName` | `string` | 是 |
| `envPassthrough` | `boolean` | 否 |

#### `ProxyDisconnectParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |

#### `ProxyForwardParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |
| `acpMessage` | `Record<string, unknown>` | 是 |

#### `SkillGetParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `PromptGetParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `McpGetParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `WorkflowGetParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `PluginGetParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `GatewayLeaseParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `agentName` | `string` | 是 |

#### `ComponentAddParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `component` | `Record<string, unknown>` | 是 |

#### `ComponentUpdateParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `patch` | `Record<string, unknown>` | 是 |

#### `ComponentRemoveParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `ComponentImportParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `filePath` | `string` | 是 |

#### `ComponentExportParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `filePath` | `string` | 是 |

#### `SourceAddParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `config` | `SourceConfig` | 是 |

#### `SourceRemoveParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `SourceSyncParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 否 |

#### `SourceValidateParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 否 |
| `path` | `string` | 否 |
| `strict` | `boolean` | 否 |
| `compat` | `string` | 否 |
| `community` | `boolean` | 否 |

#### `PresetListParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `packageName` | `string` | 否 |

#### `PresetShowParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `qualifiedName` | `string` | 是 |

#### `PresetApplyParams`

| 字段 | 类型 | 必需 |
|------|------|------|
| `qualifiedName` | `string` | 是 |
| `templateName` | `string` | 是 |

### Result 类型

#### `TemplateUnloadResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `success` | `boolean` | 是 |

#### `TemplateValidateResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `valid` | `boolean` | 是 |
| `template` | `AgentTemplate` | 否 |
| `errors` | `Array<{ path: string` | 否 |
| `message` | `string` | 是 |

#### `AgentDestroyResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `success` | `boolean` | 是 |

#### `AgentUpdatePermissionsResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `effectivePermissions` | `PermissionsConfig` | 是 |

#### `AgentAdoptResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `template` | `string` | 是 |
| `workspacePath` | `string` | 是 |
| `location` | `"builtin" | "external"` | 是 |
| `createdAt` | `string` | 是 |
| `status` | `"stopped" | "running" | "orphaned"` | 是 |

#### `AgentOpenResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `command` | `string` | 是 |
| `args` | `string[]` | 是 |
| `cwd` | `string` | 否 |
| `openSpawnOptions` | `OpenSpawnOptions` | 否 |

#### `AgentRunResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `text` | `string` | 是 |
| `sessionId` | `string` | 否 |

#### `AgentDispatchResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `queued` | `boolean` | 是 |

#### `AgentTasksResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `queued` | `number` | 是 |
| `processing` | `boolean` | 是 |
| `tasks` | `unknown[]` | 是 |

#### `ScheduleListResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sources` | `Array<{ id: string` | 是 |
| `type` | `string` | 是 |
| `active` | `boolean` | 是 |

#### `AgentPromptResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `response` | `string` | 是 |
| `sessionId` | `string` | 是 |

#### `SessionLeaseInfo`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |
| `agentName` | `string` | 是 |
| `clientId` | `string | null` | 是 |
| `state` | `"active" | "idle" | "expired"` | 是 |
| `createdAt` | `string` | 是 |
| `lastActivityAt` | `string` | 是 |
| `idleTtlMs` | `number` | 是 |

#### `SessionPromptResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `stopReason` | `string` | 是 |
| `text` | `string` | 是 |

#### `SessionCancelResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `ok` | `boolean` | 是 |

#### `SessionCloseResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `ok` | `boolean` | 是 |

#### `ProxySession`

| 字段 | 类型 | 必需 |
|------|------|------|
| `sessionId` | `string` | 是 |
| `agentName` | `string` | 是 |
| `envPassthrough` | `boolean` | 是 |
| `connectedAt` | `string` | 是 |

#### `ProxyDisconnectResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `ok` | `boolean` | 是 |

#### `DaemonPingResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `version` | `string` | 是 |
| `uptime` | `number` | 是 |
| `agents` | `number` | 是 |

#### `DaemonShutdownResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `success` | `boolean` | 是 |

#### `GatewayLeaseResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `socketPath` | `string` | 是 |

#### `ComponentAddResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `ComponentUpdateResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `ComponentRemoveResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `success` | `boolean` | 是 |

#### `ComponentImportResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |

#### `ComponentExportResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `success` | `boolean` | 是 |

#### `SourceAddResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `components` | `{ skills: number` | 是 |
| `prompts` | `number` | 是 |
| `mcp` | `number` | 是 |
| `workflows` | `number` | 是 |
| `presets` | `number` | 是 |

#### `SourceRemoveResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `success` | `boolean` | 是 |

#### `SourceSyncResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `synced` | `string[]` | 是 |
| `report` | `{ addedCount: number` | 否 |
| `updatedCount` | `number` | 是 |
| `removedCount` | `number` | 是 |
| `hasBreakingChanges` | `boolean` | 是 |

#### `SourceValidateResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `valid` | `boolean` | 是 |
| `sourceName` | `string` | 是 |
| `rootDir` | `string` | 是 |
| `summary` | `{ pass: number` | 是 |
| `warn` | `number` | 是 |
| `error` | `number` | 是 |

## 3. 错误码

| 名称 | 代码 |
|------|------|
| `PARSE_ERROR` | -32700 |
| `INVALID_REQUEST` | -32600 |
| `METHOD_NOT_FOUND` | -32601 |
| `INVALID_PARAMS` | -32602 |
| `INTERNAL_ERROR` | -32603 |
| `TEMPLATE_NOT_FOUND` | -32001 |
| `CONFIG_VALIDATION` | -32002 |
| `AGENT_NOT_FOUND` | -32003 |
| `AGENT_ALREADY_RUNNING` | -32004 |
| `WORKSPACE_INIT` | -32005 |
| `COMPONENT_REFERENCE` | -32006 |
| `INSTANCE_CORRUPTED` | -32007 |
| `AGENT_LAUNCH` | -32008 |
| `AGENT_ALREADY_ATTACHED` | -32009 |
| `AGENT_NOT_ATTACHED` | -32010 |
| `GENERIC_BUSINESS` | -32000 |

## 4. CLI 命令 (62 个)

二进制入口: `actant`

### agent

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `adopt` | — | Adopt an existing agent workspace into the instance registry | `<path>` | `--rename <name>`, `-f, --format <format>` |
| `attach` | — | Attach an externally-spawned process to an agent | `<name>` | `--metadata <json>`, `-f, --format <format>`, `--pid <pid>` * |
| `chat` | — | Start an interactive chat session with an agent | `<name>` | `-t, --template <template>` |
| `create` | — | Create a new agent from a template | `<name>` | `--launch-mode <mode>`, `--archetype <type>`, `--no-auto-start`, `--work-dir <path>`, `--workspace <path>`, `--overwrite`, `--append`, `-f, --format <format>`, `-t, --template <template>` * |
| `destroy` | rm | Destroy an agent (removes workspace directory) | `<name>` | `--force` |
| `detach` | — | Detach an externally-managed process from an agent | `<name>` | `--cleanup` |
| `dispatch` | — |  | `<name>` | `-p, --priority <priority>`, `-m, --message <message>` * |
| `list` | ls | List all agents | — | `-f, --format <format>` |
| `logs` | — |  | `<name>` | `--limit <n>`, `-f, --format <format>` |
| `open` | — |  | `<name>` | `-t, --template <template>`, `--no-attach`, `--auto-install`, `--no-install` |
| `prompt` | — |  | `<name>` | `--session-id <id>`, `-f, --format <format>`, `-m, --message <message>` * |
| `resolve` | — | Resolve spawn info for an agent (external spawn support) | `<name>` | `-t, --template <template>`, `-f, --format <format>`, `--auto-install`, `--no-install` |
| `run` | — | Send a prompt to an agent and get the response | `<name>` | `--model <model>`, `--max-turns <turns>`, `--timeout <ms>`, `--session-id <id>`, `-f, --format <format>`, `--prompt <prompt>` * |
| `start` | — | Start an agent | `<name>` | `--auto-install`, `--no-install` |
| `status` | — | Show agent status (all agents if no name given) | `[name]` | `-f, --format <format>` |
| `stop` | — | Stop a running agent | `<name>` | — |
| `tasks` | — |  | `<name>` | `-f, --format <format>` |

### daemon

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `start` | — | Start the Actant daemon | — | `--foreground` |
| `status` | — | Check if the daemon is running | — | `-f, --format <format>` |
| `stop` | — | Stop the Actant daemon | — | — |

### help (独立命令)

描述: Show help information

**参数:**
- `[command]` — Command to get help for

### mcp

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `add` | — | Add an MCP server config from a JSON file | `<file>` | — |
| `export` | — | Export an MCP server config to a JSON file | `<name>` | `-o, --out <file>` |
| `list` | ls | List all loaded MCP server configs | — | `-f, --format <format>` |
| `remove` | rm | Remove a loaded MCP server config | `<name>` | — |
| `show` | — | Show MCP server config details | `<name>` | `-f, --format <format>` |

### plugin

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `add` | — | Add a plugin from a JSON file | `<file>` | — |
| `export` | — | Export a plugin to a JSON file | `<name>` | `-o, --out <file>` |
| `list` | ls | List all plugins | — | `-f, --format <format>` |
| `remove` | rm | Remove a loaded plugin | `<name>` | — |
| `show` | — | Show plugin details | `<name>` | `-f, --format <format>` |

### preset

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `apply` | — | Apply a preset to a template (adds all preset components) | `<qualified-name>`, `<template>` | — |
| `list` | ls | List available presets from registered sources | `[package]` | `-f, --format <format>` |
| `show` | — | Show preset details | `<qualified-name>` | `-f, --format <format>` |

### prompt

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `add` | — | Add a prompt from a JSON file | `<file>` | — |
| `export` | — | Export a prompt to a JSON file | `<name>` | `-o, --out <file>` |
| `list` | ls | List all loaded prompts | — | `-f, --format <format>` |
| `remove` | rm | Remove a loaded prompt | `<name>` | — |
| `show` | — | Show prompt details | `<name>` | `-f, --format <format>` |

### proxy (独立命令)

描述: Run an ACP proxy for an agent (stdin/stdout ACP protocol)

**参数:**
- `<name>` — Agent name to proxy

**选项:**
- `--lease` — Use Session Lease mode (requires running agent)
- `-t, --template <template>` — Template name (auto-creates instance if not found)

### schedule

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `list` | ls | List schedule sources for an agent | `<name>` | `-f, --format <format>` |

### self-update (独立命令)

描述: Update Actant from local source

**选项:**
- `--source <path>` — Source directory path
- `--check` — Only check for updates, don
- `--force` — Skip active session warnings
- `--dry-run` — Show what would be done without doing it
- `--no-agent` — Skip agent supervisor, run script directly
- `--skip-build` — Skip build step (use pre-built dist)

### skill

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `add` | — | Add a skill from a JSON file | `<file>` | — |
| `export` | — | Export a skill to a JSON file | `<name>` | `-o, --out <file>` |
| `list` | ls | List all loaded skills | — | `-f, --format <format>` |
| `remove` | rm | Remove a loaded skill | `<name>` | — |
| `show` | — | Show skill details | `<name>` | `-f, --format <format>` |

### source

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `add` | — | Register a component source | `<url-or-path>` | `--type <type>`, `--branch <branch>`, `--filter <glob>`, `--name <name>` * |
| `list` | ls | List registered component sources | — | `-f, --format <format>` |
| `remove` | rm | Remove a registered source | `<name>` | — |
| `sync` | — | Sync component source(s) | `[name]` | — |
| `validate` | — | Validate all assets in a component source | `[name]` | `--path <dir>`, `-f, --format <format>`, `--strict`, `--compat <standard>`, `--community` |

### template (alias: tpl)

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `install` | — | Install a template from a source (source@name or just name for default source) | — | — |
| `list` | ls | List all registered templates | — | `-f, --format <format>` |
| `load` | — | Load a template from a JSON file into the registry | `<file>` | — |
| `show` | — | Show template details | `<name>` | `-f, --format <format>` |
| `validate` | — | Validate a template JSON file | `<file>` | — |

### workflow

| 子命令 | 别名 | 说明 | 参数 | 选项 |
|--------|------|------|------|------|
| `add` | — | Add a workflow from a JSON file | `<file>` | — |
| `export` | — | Export a workflow to a JSON file | `<name>` | `-o, --out <file>` |
| `list` | ls | List all loaded workflows | — | `-f, --format <format>` |
| `remove` | rm | Remove a loaded workflow | `<name>` | — |
| `show` | — | Show workflow details | `<name>` | `-f, --format <format>` |

