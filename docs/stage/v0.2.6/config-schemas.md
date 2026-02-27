# Config Schemas Snapshot

> **版本**: v0.2.6 | **生成时间**: 2026-02-28
> 本文档记录模板、调度、实例元数据的 Zod 与 TypeScript 类型定义。

## Zod Schemas

### template (template-schema.ts)
- McpServerRefSchema, DomainContextSchema, AgentBackendSchema, ModelProviderSchema
- InitializerStepSchema, InitializerSchema
- PermissionModeSchema, SandboxNetworkSchema, SandboxSchema, PermissionsObjectSchema, PermissionPresetSchema, PermissionsInputSchema
- ComponentOriginSchema, AgentTemplateSchema

### schedule (schedule-config.ts)
- HeartbeatConfigSchema, CronConfigSchema, HookConfigSchema, ScheduleConfigSchema

## TypeScript Interfaces

### agent.types.ts
- AgentInstanceMeta, AgentStatus, LaunchMode, ProcessOwnership, WorkspacePolicy
- ResolveResult, DetachResult

### template.types.ts
- PermissionMode, PermissionPreset, SandboxConfig, PermissionsConfig, PermissionsInput
- AgentArchetype, InteractionMode, AgentBackendConfig, AgentTemplate
