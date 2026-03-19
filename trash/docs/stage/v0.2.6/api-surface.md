# API Surface Snapshot

> **版本**: v0.2.6 | **生成时间**: 2026-02-27T16:11:33.820Z
> 本文档记录所有对外接口（RPC 方法、CLI 命令），用于版本间变更追踪。

---

## 1. JSON-RPC 方法 (92 个)

### activity.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `activity.sessions` | `ActivitySessionsParams` | `ActivitySessionsResult` |
| `activity.stream` | `ActivityStreamParams` | `ActivityStreamResult` |
| `activity.conversation` | `ActivityConversationParams` | `ActivityConversationResult` |
| `activity.blob` | `ActivityBlobParams` | `ActivityBlobResult` |

### agent.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `agent.create` | `AgentCreateParams` | `AgentCreateResult` |
| `agent.start` | `AgentStartParams` | `AgentStartResult` |
| `agent.stop` | `AgentStopParams` | `AgentStopResult` |
| `agent.destroy` | `AgentDestroyParams` | `AgentDestroyResult` |
| `agent.status` | `AgentStatusParams` | `AgentStatusResult` |
| `agent.list` | `AgentListParams` | `AgentListResult` |
| `agent.updatePermissions` | `AgentUpdatePermissionsParams` | `AgentUpdatePermissionsResult` |
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

### canvas.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `canvas.update` | `CanvasUpdateParams` | `CanvasUpdateResult` |
| `canvas.get` | `CanvasGetParams` | `CanvasGetResult` |
| `canvas.list` | `CanvasListParams` | `CanvasListResult` |
| `canvas.clear` | `CanvasClearParams` | `CanvasClearResult` |

### daemon.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `daemon.ping` | `DaemonPingParams` | `DaemonPingResult` |
| `daemon.shutdown` | `DaemonShutdownParams` | `DaemonShutdownResult` |

### events.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `events.recent` | `EventsRecentParams` | `EventsRecentResult` |

### gateway.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `gateway.lease` | `GatewayLeaseParams` | `GatewayLeaseResult` |

### internal.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `internal.validateToken` | `InternalValidateTokenParams` | `InternalValidateTokenResult` |
| `internal.canvasUpdate` | `InternalCanvasUpdateParams` | `InternalCanvasUpdateResult` |
| `internal.canvasClear` | `InternalCanvasClearParams` | `InternalCanvasClearResult` |

### mcp.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `mcp.list` | `McpListParams` | `McpListResult` |
| `mcp.get` | `McpGetParams` | `McpGetResult` |
| `mcp.add` | `ComponentAddParams` | `ComponentAddResult` |
| `mcp.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `mcp.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `mcp.import` | `ComponentImportParams` | `ComponentImportResult` |
| `mcp.export` | `ComponentExportParams` | `ComponentExportResult` |

### plugin.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `plugin.list` | `PluginListParams` | `PluginListResult` |
| `plugin.get` | `PluginGetParams` | `PluginGetResult` |
| `plugin.add` | `ComponentAddParams` | `ComponentAddResult` |
| `plugin.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `plugin.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `plugin.import` | `ComponentImportParams` | `ComponentImportResult` |
| `plugin.export` | `ComponentExportParams` | `ComponentExportResult` |
| `plugin.runtimeList` | `PluginRuntimeListParams` | `PluginRuntimeListResult` |
| `plugin.runtimeStatus` | `PluginRuntimeStatusParams` | `PluginRuntimeStatusResult` |

### preset.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `preset.list` | `PresetListParams` | `PresetListResult` |
| `preset.show` | `PresetShowParams` | `PresetShowResult` |
| `preset.apply` | `PresetApplyParams` | `PresetApplyResult` |

### prompt.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `prompt.list` | `PromptListParams` | `PromptListResult` |
| `prompt.get` | `PromptGetParams` | `PromptGetResult` |
| `prompt.add` | `ComponentAddParams` | `ComponentAddResult` |
| `prompt.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `prompt.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `prompt.import` | `ComponentImportParams` | `ComponentImportResult` |
| `prompt.export` | `ComponentExportParams` | `ComponentExportResult` |

### proxy.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `proxy.connect` | `ProxyConnectParams` | `ProxyConnectResult` |
| `proxy.disconnect` | `ProxyDisconnectParams` | `ProxyDisconnectResult` |
| `proxy.forward` | `ProxyForwardParams` | `ProxyForwardResult` |

### schedule.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `schedule.list` | `ScheduleListParams` | `ScheduleListResult` |

### session.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `session.create` | `SessionCreateParams` | `SessionCreateResult` |
| `session.prompt` | `SessionPromptParams` | `SessionPromptResult` |
| `session.cancel` | `SessionCancelParams` | `SessionCancelResult` |
| `session.close` | `SessionCloseParams` | `SessionCloseResult` |
| `session.list` | `SessionListParams` | `SessionListResult` |

### skill.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `skill.list` | `SkillListParams` | `SkillListResult` |
| `skill.get` | `SkillGetParams` | `SkillGetResult` |
| `skill.add` | `ComponentAddParams` | `ComponentAddResult` |
| `skill.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `skill.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `skill.import` | `ComponentImportParams` | `ComponentImportResult` |
| `skill.export` | `ComponentExportParams` | `ComponentExportResult` |

### source.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `source.list` | `SourceListParams` | `SourceListResult` |
| `source.add` | `SourceAddParams` | `SourceAddResult` |
| `source.remove` | `SourceRemoveParams` | `SourceRemoveResult` |
| `source.sync` | `SourceSyncParams` | `SourceSyncResult` |
| `source.validate` | `SourceValidateParams` | `SourceValidateResult` |

### template.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `template.list` | `TemplateListParams` | `TemplateListResult` |
| `template.get` | `TemplateGetParams` | `TemplateGetResult` |
| `template.load` | `TemplateLoadParams` | `TemplateLoadResult` |
| `template.unload` | `TemplateUnloadParams` | `TemplateUnloadResult` |
| `template.validate` | `TemplateValidateParams` | `TemplateValidateResult` |
| `template.create` | `TemplateCreateParams` | `TemplateCreateResult` |

### workflow.*

| 方法 | Params 类型 | Result 类型 |
|------|-----------|----------|
| `workflow.list` | `WorkflowListParams` | `WorkflowListResult` |
| `workflow.get` | `WorkflowGetParams` | `WorkflowGetResult` |
| `workflow.add` | `ComponentAddParams` | `ComponentAddResult` |
| `workflow.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `workflow.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `workflow.import` | `ComponentImportParams` | `ComponentImportResult` |
| `workflow.export` | `ComponentExportParams` | `ComponentExportResult` |

## 2. 错误码

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

## 3. CLI 命令 (65 个)

二进制入口: `actant`
