# Actant v0.2.2 — API Surface Snapshot

## RPC Methods

| Method | Params | Result |
|--------|--------|--------|
| `template.list` | `TemplateListParams` (Record<string, never>) | `AgentTemplate[]` |
| `template.get` | `TemplateGetParams` (name: string) | `AgentTemplate` |
| `template.load` | `TemplateLoadParams` (filePath: string) | `AgentTemplate` |
| `template.unload` | `TemplateUnloadParams` (name: string) | `TemplateUnloadResult` |
| `template.validate` | `TemplateValidateParams` (filePath: string) | `TemplateValidateResult` |
| `agent.create` | `AgentCreateParams` | `AgentInstanceMeta` |
| `agent.start` | `AgentStartParams` (name: string) | `AgentInstanceMeta` |
| `agent.stop` | `AgentStopParams` (name: string) | `AgentInstanceMeta` |
| `agent.destroy` | `AgentDestroyParams` (name: string) | `AgentDestroyResult` |
| `agent.status` | `AgentStatusParams` (name: string) | `AgentInstanceMeta` |
| `agent.list` | `AgentListParams` (Record<string, never>) | `AgentInstanceMeta[]` |
| `agent.updatePermissions` | `AgentUpdatePermissionsParams` | `AgentUpdatePermissionsResult` |
| `agent.adopt` | `AgentAdoptParams` (path, rename?) | `AgentAdoptResult` |
| `agent.resolve` | `AgentResolveParams` | `ResolveResult` |
| `agent.open` | `AgentOpenParams` (name: string) | `AgentOpenResult` |
| `agent.attach` | `AgentAttachParams` (name, pid, metadata?) | `AgentInstanceMeta` |
| `agent.detach` | `AgentDetachParams` (name, cleanup?) | `DetachResult` |
| `agent.run` | `AgentRunParams` | `AgentRunResult` |
| `agent.prompt` | `AgentPromptParams` | `AgentPromptResult` |
| `agent.dispatch` | `AgentDispatchParams` | `AgentDispatchResult` |
| `agent.tasks` | `AgentTasksParams` (name: string) | `AgentTasksResult` |
| `agent.logs` | `AgentLogsParams` (name, limit?) | `unknown[]` |
| `schedule.list` | `ScheduleListParams` (name: string) | `ScheduleListResult` |
| `session.create` | `SessionCreateParams` | `SessionLeaseInfo` |
| `session.prompt` | `SessionPromptParams` | `SessionPromptResult` |
| `session.cancel` | `SessionCancelParams` | `SessionCancelResult` |
| `session.close` | `SessionCloseParams` | `SessionCloseResult` |
| `session.list` | `SessionListParams` (agentName?) | `SessionLeaseInfo[]` |
| `proxy.connect` | `ProxyConnectParams` | `ProxySession` |
| `proxy.disconnect` | `ProxyDisconnectParams` | `ProxyDisconnectResult` |
| `proxy.forward` | `ProxyForwardParams` | `Record<string, unknown>` |
| `skill.list` | `SkillListParams` | `SkillDefinition[]` |
| `skill.get` | `SkillGetParams` (name: string) | `SkillDefinition` |
| `skill.add` | `ComponentAddParams` | `ComponentAddResult` |
| `skill.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `skill.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `skill.import` | `ComponentImportParams` | `ComponentImportResult` |
| `skill.export` | `ComponentExportParams` | `ComponentExportResult` |
| `prompt.list` | `PromptListParams` | `PromptDefinition[]` |
| `prompt.get` | `PromptGetParams` (name: string) | `PromptDefinition` |
| `prompt.add` | `ComponentAddParams` | `ComponentAddResult` |
| `prompt.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `prompt.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `prompt.import` | `ComponentImportParams` | `ComponentImportResult` |
| `prompt.export` | `ComponentExportParams` | `ComponentExportResult` |
| `mcp.list` | `McpListParams` | `McpServerDefinition[]` |
| `mcp.get` | `McpGetParams` (name: string) | `McpServerDefinition` |
| `mcp.add` | `ComponentAddParams` | `ComponentAddResult` |
| `mcp.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `mcp.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `mcp.import` | `ComponentImportParams` | `ComponentImportResult` |
| `mcp.export` | `ComponentExportParams` | `ComponentExportResult` |
| `workflow.list` | `WorkflowListParams` | `WorkflowDefinition[]` |
| `workflow.get` | `WorkflowGetParams` (name: string) | `WorkflowDefinition` |
| `workflow.add` | `ComponentAddParams` | `ComponentAddResult` |
| `workflow.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `workflow.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `workflow.import` | `ComponentImportParams` | `ComponentImportResult` |
| `workflow.export` | `ComponentExportParams` | `ComponentExportResult` |
| `plugin.list` | `PluginListParams` | `PluginDefinition[]` |
| `plugin.get` | `PluginGetParams` (name: string) | `PluginDefinition` |
| `plugin.add` | `ComponentAddParams` | `ComponentAddResult` |
| `plugin.update` | `ComponentUpdateParams` | `ComponentUpdateResult` |
| `plugin.remove` | `ComponentRemoveParams` | `ComponentRemoveResult` |
| `plugin.import` | `ComponentImportParams` | `ComponentImportResult` |
| `plugin.export` | `ComponentExportParams` | `ComponentExportResult` |
| `source.list` | `SourceListParams` | `SourceEntry[]` |
| `source.add` | `SourceAddParams` | `SourceAddResult` |
| `source.remove` | `SourceRemoveParams` | `SourceRemoveResult` |
| `source.sync` | `SourceSyncParams` (name?) | `SourceSyncResult` |
| `source.validate` | `SourceValidateParams` | `SourceValidateResult` |
| `preset.list` | `PresetListParams` (packageName?) | `PresetDefinition[]` |
| `preset.show` | `PresetShowParams` (qualifiedName) | `PresetDefinition` |
| `preset.apply` | `PresetApplyParams` | `AgentTemplate` |
| `daemon.ping` | `DaemonPingParams` | `DaemonPingResult` |
| `daemon.shutdown` | `DaemonShutdownParams` | `DaemonShutdownResult` |
| `gateway.lease` | `GatewayLeaseParams` (agentName) | `GatewayLeaseResult` |

**Total: 62 RPC methods**

---

## CLI Commands

| Group | Command | Args | Options |
|-------|---------|------|---------|
| agent | create | `<name>` | `-t, --template <template>`, `--launch-mode <mode>`, `--work-dir <path>`, `--workspace <path>`, `--overwrite`, `--append`, `-f, --format <format>` |
| agent | start | `<name>` | — |
| agent | stop | `<name>` | — |
| agent | destroy | `<name>` | `--force` |
| agent | status | `[name]` | `-f, --format <format>` |
| agent | list | — | `-f, --format <format>` |
| agent | adopt | `<path>` | `--rename <name>`, `-f, --format <format>` |
| agent | resolve | `<name>` | `-t, --template <template>`, `-f, --format <format>` |
| agent | open | `<name>` | — |
| agent | attach | `<name>` | `--pid <pid>`, `--metadata <json>`, `-f, --format <format>` |
| agent | detach | `<name>` | `--cleanup` |
| agent | run | `<name>` | `--prompt <prompt>`, `--model <model>`, `--max-turns <turns>`, `--timeout <ms>`, `--session-id <id>`, `-f, --format <format>` |
| agent | prompt | `<name>` | `-m, --message <message>`, `--session-id <id>`, `-f, --format <format>` |
| agent | chat | `<name>` | `-t, --template <template>` |
| agent | dispatch | `<name>` | `-m, --message <message>`, `-p, --priority <priority>` |
| agent | tasks | `<name>` | `-f, --format <format>` |
| agent | logs | `<name>` | `--limit <n>`, `-f, --format <format>` |
| template | list | — | `-f, --format <format>` |
| template | show | `<name>` | `-f, --format <format>` |
| template | validate | `<file>` | — |
| template | load | `<file>` | — |
| template | install | `<spec>` | — |
| skill | list | — | `-f, --format <format>` |
| skill | show | `<name>` | `-f, --format <format>` |
| skill | add | `<file>` | — |
| skill | remove | `<name>` | — |
| skill | export | `<name>` | `-o, --out <file>` |
| prompt | list | — | `-f, --format <format>` |
| prompt | show | `<name>` | `-f, --format <format>` |
| prompt | add | `<file>` | — |
| prompt | remove | `<name>` | — |
| prompt | export | `<name>` | `-o, --out <file>` |
| mcp | list | — | `-f, --format <format>` |
| mcp | show | `<name>` | `-f, --format <format>` |
| mcp | add | `<file>` | — |
| mcp | remove | `<name>` | — |
| mcp | export | `<name>` | `-o, --out <file>` |
| workflow | list | — | `-f, --format <format>` |
| workflow | show | `<name>` | `-f, --format <format>` |
| workflow | add | `<file>` | — |
| workflow | remove | `<name>` | — |
| workflow | export | `<name>` | `-o, --out <file>` |
| plugin | list | — | `-f, --format <format>` |
| plugin | show | `<name>` | `-f, --format <format>` |
| plugin | add | `<file>` | — |
| plugin | remove | `<name>` | — |
| plugin | export | `<name>` | `-o, --out <file>` |
| source | list | — | `-f, --format <format>` |
| source | add | `<url-or-path>` | `--name <name>`, `--type <type>`, `--branch <branch>` |
| source | remove | `<name>` | — |
| source | sync | `[name]` | — |
| source | validate | `[name]` | `--path <dir>`, `-f, --format <format>`, `--strict`, `--compat <standard>` |
| preset | list | `[package]` | `-f, --format <format>` |
| preset | show | `<qualified-name>` | `-f, --format <format>` |
| preset | apply | `<qualified-name> <template>` | — |
| schedule | list | `<name>` | `-f, --format <format>` |
| daemon | start | — | `--foreground` |
| daemon | stop | — | — |
| daemon | status | — | `-f, --format <format>` |
| proxy | proxy | `<name>` | `--lease`, `-t, --template <template>` |
| setup | setup | — | `--skip-home`, `--skip-provider`, `--skip-source`, `--skip-agent`, `--skip-autostart`, `--skip-hello`, `--skip-update` |
| self-update | self-update | — | `--source <path>`, `--check`, `--force`, `--dry-run`, `--no-agent`, `--skip-build` |
| help | help | `[command]` | — |

**Total: 68 CLI subcommands**

---

## Error Codes

| Code | Name |
|------|------|
| -32700 | PARSE_ERROR |
| -32600 | INVALID_REQUEST |
| -32601 | METHOD_NOT_FOUND |
| -32602 | INVALID_PARAMS |
| -32603 | INTERNAL_ERROR |
| -32001 | TEMPLATE_NOT_FOUND |
| -32002 | CONFIG_VALIDATION |
| -32003 | AGENT_NOT_FOUND |
| -32004 | AGENT_ALREADY_RUNNING |
| -32005 | WORKSPACE_INIT |
| -32006 | COMPONENT_REFERENCE |
| -32007 | INSTANCE_CORRUPTED |
| -32008 | AGENT_LAUNCH |
| -32009 | AGENT_ALREADY_ATTACHED |
| -32010 | AGENT_NOT_ATTACHED |
| -32000 | GENERIC_BUSINESS |
