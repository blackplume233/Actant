# Config Schema Snapshot

> **版本**: v0.1.0 | **生成时间**: 2026-02-22T00:22:08.416Z
> 本文档记录所有配置结构（Zod Schema + TypeScript 接口），用于版本间变更追踪。

---

## 1. Zod Schemas（运行时校验）

### AgentTemplate 模板结构

#### `McpServerRefSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `name` | `z.string().min(1)` |
| `command` | `z.string().min(1)` |
| `args` | `z.array(z.string()).optional().default([])` |
| `env` | `z.record(z.string(), z.string()).optional().default({})` |

#### `DomainContextSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `skills` | `z.array(z.string()).optional().default([])` |
| `prompts` | `z.array(z.string()).optional().default([])` |
| `mcpServers` | `z.array(McpServerRefSchema).optional().default([])` |
| `workflow` | `z.string().optional()` |
| `subAgents` | `z.array(z.string()).optional().default([])` |
| `plugins` | `z.array(z.string()).optional().default([])` |

#### `AgentBackendSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `config` | `z.record(z.string(), z.unknown()).optional()` |

#### `ModelProviderSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `config` | `z.record(z.string(), z.unknown()).optional()` |

#### `InitializerStepSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `config` | `z.record(z.string(), z.unknown()).optional()` |

#### `InitializerSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `steps` | `z.array(InitializerStepSchema).min(1)` |

#### `AgentTemplateSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `name` | `z.string().min(1).max(100)` |
| `version` | `z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g. 1.0.0)")` |
| `description` | `z.string().optional()` |
| `backend` | `AgentBackendSchema` |
| `provider` | `ModelProviderSchema` |
| `domainContext` | `DomainContextSchema` |
| `initializer` | `InitializerSchema.optional()` |
| `schedule` | `ScheduleConfigSchema.optional()` |
| `metadata` | `z.record(z.string(), z.string()).optional()` |

### AgentInstanceMeta 实例元数据

#### `AgentStatusSchema` (enum)

值: `created,starting,running,stopping,stopped,error,crashed,`

#### `LaunchModeSchema` (enum)

值: `direct,acp-background,acp-service,one-shot,`

#### `ProcessOwnershipSchema` (enum)

值: `managed,external`

#### `WorkspacePolicySchema` (enum)

值: `persistent,ephemeral`

#### `AgentInstanceMetaSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `id` | `z.string().min(1)` |
| `name` | `z.string().min(1)` |
| `templateName` | `z.string().min(1)` |
| `templateVersion` | `z.string().regex(/^\d+\.\d+\.\d+$/)` |
| `backendType` | `AgentBackendTypeSchema.default("cursor")` |
| `backendConfig` | `z.record(z.string(), z.unknown()).optional()` |
| `status` | `AgentStatusSchema` |
| `launchMode` | `LaunchModeSchema` |
| `workspacePolicy` | `WorkspacePolicySchema.default("persistent")` |
| `processOwnership` | `ProcessOwnershipSchema.default("managed")` |
| `createdAt` | `z.string().datetime()` |
| `updatedAt` | `z.string().datetime()` |
| `pid` | `z.number().int().positive().optional()` |
| `metadata` | `z.record(z.string(), z.string()).optional()` |

### ScheduleConfig 调度配置

#### `HeartbeatConfigSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `intervalMs` | `z.number().min(1000)` |
| `prompt` | `z.string().min(1)` |
| `priority` | `z.enum(["low", "normal", "high", "critical"]).optional()` |

#### `CronConfigSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `pattern` | `z.string().min(1)` |
| `prompt` | `z.string().min(1)` |
| `timezone` | `z.string().optional()` |
| `priority` | `z.enum(["low", "normal", "high", "critical"]).optional()` |

#### `HookConfigSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `eventName` | `z.string().min(1)` |
| `prompt` | `z.string().min(1)` |
| `priority` | `z.enum(["low", "normal", "high", "critical"]).optional()` |

#### `ScheduleConfigSchema` (object)

| 字段 | Zod 类型 |
|------|---------|
| `heartbeat` | `HeartbeatConfigSchema.optional()` |
| `cron` | `z.array(CronConfigSchema).optional().default([])` |
| `hooks` | `z.array(HookConfigSchema).optional().default([])` |

## 2. TypeScript 接口（类型定义）

### Agent 实例类型

#### `AgentInstanceMeta`

| 字段 | 类型 | 必需 |
|------|------|------|
| `id` | `string` | 是 |
| `name` | `string` | 是 |
| `templateName` | `string` | 是 |
| `templateVersion` | `string` | 是 |
| `backendType` | `AgentBackendType` | 是 |
| `backendConfig` | `Record<string, unknown>` | 否 |
| `status` | `AgentStatus` | 是 |
| `launchMode` | `LaunchMode` | 是 |
| `workspacePolicy` | `WorkspacePolicy` | 是 |
| `processOwnership` | `ProcessOwnership` | 是 |
| `createdAt` | `string` | 是 |
| `updatedAt` | `string` | 是 |
| `pid` | `number` | 否 |
| `metadata` | `Record<string, string>` | 否 |

#### `AgentStatus`

```typescript
type AgentStatus = | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error"
  | "crashed"
```

#### `LaunchMode`

```typescript
type LaunchMode = | "direct"
  | "acp-background"
  | "acp-service"
  | "one-shot"
```

#### `ProcessOwnership`

```typescript
type ProcessOwnership = "managed" | "external"
```

#### `WorkspacePolicy`

```typescript
type WorkspacePolicy = "persistent" | "ephemeral"
```

#### `ResolveResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `workspaceDir` | `string` | 是 |
| `command` | `string` | 是 |
| `args` | `string[]` | 是 |
| `env` | `Record<string, string>` | 否 |
| `instanceName` | `string` | 是 |
| `backendType` | `AgentBackendType` | 是 |
| `created` | `boolean` | 是 |

#### `DetachResult`

| 字段 | 类型 | 必需 |
|------|------|------|
| `ok` | `boolean` | 是 |
| `workspaceCleaned` | `boolean` | 是 |

### Template 模板类型

#### `AgentTemplate`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `version` | `string` | 是 |
| `description` | `string` | 否 |
| `backend` | `AgentBackendConfig` | 是 |
| `provider` | `ModelProviderConfig` | 是 |
| `domainContext` | `DomainContextConfig` | 是 |
| `initializer` | `InitializerConfig` | 否 |
| `schedule` | `{ heartbeat?: { intervalMs: number` | 否 |
| `prompt` | `string` | 是 |
| `priority` | `string` | 否 |

#### `AgentBackendConfig`

| 字段 | 类型 | 必需 |
|------|------|------|
| `type` | `AgentBackendType` | 是 |
| `config` | `Record<string, unknown>` | 否 |

#### `AgentBackendType`

```typescript
type AgentBackendType = "cursor" | "claude-code" | "custom"
```

#### `ModelProviderConfig`

| 字段 | 类型 | 必需 |
|------|------|------|
| `type` | `ModelProviderType` | 是 |
| `config` | `Record<string, unknown>` | 否 |

#### `ModelProviderType`

```typescript
type ModelProviderType = "anthropic" | "openai" | "custom"
```

#### `InitializerConfig`

| 字段 | 类型 | 必需 |
|------|------|------|
| `steps` | `InitializerStep[]` | 是 |

#### `InitializerStep`

| 字段 | 类型 | 必需 |
|------|------|------|
| `type` | `string` | 是 |
| `config` | `Record<string, unknown>` | 否 |

### DomainContext 领域上下文

#### `DomainContextConfig`

| 字段 | 类型 | 必需 |
|------|------|------|
| `skills` | `string[]` | 否 |
| `prompts` | `string[]` | 否 |
| `mcpServers` | `McpServerRef[]` | 否 |
| `workflow` | `string` | 否 |
| `subAgents` | `string[]` | 否 |
| `plugins` | `string[]` | 否 |

#### `McpServerRef`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `command` | `string` | 是 |
| `args` | `string[]` | 否 |
| `env` | `Record<string, string>` | 否 |

### DomainComponent 领域组件

#### `SkillDefinition`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `description` | `string` | 否 |
| `content` | `string` | 是 |
| `tags` | `string[]` | 否 |

#### `PromptDefinition`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `description` | `string` | 否 |

#### `WorkflowDefinition`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `description` | `string` | 否 |
| `content` | `string` | 是 |

#### `McpServerDefinition`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `description` | `string` | 否 |
| `command` | `string` | 是 |
| `args` | `string[]` | 否 |
| `env` | `Record<string, string>` | 否 |

#### `PluginDefinition`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `description` | `string` | 否 |
| `type` | `npm package, local file, or JSON config */ type: "npm" | "file" | "config"` | 是 |
| `npm` | `package specifier (e.g. "@anthropic/memory"). For file: relative path. */ source?: string` | 是 |
| `config` | `Record<string, unknown>` | 否 |
| `enabled` | `boolean` | 否 |

### Source 组件源

#### `SourceConfig`

```typescript
type SourceConfig = | GitHubSourceConfig
  | LocalSourceConfig
```

#### `GitHubSourceConfig`

| 字段 | 类型 | 必需 |
|------|------|------|
| `type` | `"github"` | 是 |
| `url` | `string` | 是 |
| `branch` | `string` | 否 |

#### `LocalSourceConfig`

| 字段 | 类型 | 必需 |
|------|------|------|
| `type` | `"local"` | 是 |
| `path` | `string` | 是 |

#### `SourceEntry`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `config` | `SourceConfig` | 是 |
| `syncedAt` | `string` | 否 |

#### `PackageManifest`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `version` | `string` | 否 |
| `description` | `string` | 否 |
| `components` | `{ skills?: string[]` | 否 |
| `prompts` | `string[]` | 否 |
| `mcp` | `string[]` | 否 |
| `workflows` | `string[]` | 否 |

#### `PresetDefinition`

| 字段 | 类型 | 必需 |
|------|------|------|
| `name` | `string` | 是 |
| `description` | `string` | 否 |
| `skills` | `string[]` | 否 |
| `prompts` | `string[]` | 否 |
| `mcpServers` | `string[]` | 否 |
| `workflows` | `string[]` | 否 |

## 3. 枚举值

### `AgentStatus`

值: `created` | `starting` | `running` | `stopping` | `stopped` | `error` | `crashed`

### `LaunchMode`

值: `direct` | `acp-background` | `acp-service` | `one-shot`

### `ProcessOwnership`

值: `managed` | `external`

### `WorkspacePolicy`

值: `persistent` | `ephemeral`

