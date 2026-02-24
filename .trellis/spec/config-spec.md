# 配置规范 (Configuration Specification)

> 本文档定义 Actant 中所有配置结构、Schema 和环境变量。
> **代码必须符合此规范。若代码与此文档冲突，以本文档为准。**

---

## 概述

Actant 的配置体系分为三层：

```
VersionedComponent     所有可共享组件的基类（#119）
    │
    ├── AgentTemplate          用户编写的模板文件，定义 Agent 的组成
    │       │
    │       │  validate + create
    │       ▼
    │   AgentInstanceMeta      运行时实例的持久化状态（.actant.json）
    │       │
    │       │  resolve
    │       ▼
    │   AppConfig              守护进程的运行时配置（路径、环境变量）
    │
    ├── SkillDefinition
    ├── PromptDefinition
    ├── WorkflowDefinition
    ├── McpServerDefinition
    └── PluginDefinition
```

所有配置在入口处使用 **Zod** 进行运行时校验。校验结果统一返回 [`ConfigValidationResult`](#4-configvalidationresult--统一校验结果119)，包含结构化的错误和警告。TypeScript 类型从 Zod Schema 推导或手动对齐。

---

## 1. AgentTemplate — 模板配置

模板是用户定义 Agent 组成的核心配置文件。JSON 格式，通过 CLI 加载。

AgentTemplate 继承自 [`VersionedComponent`](#versionedcomponent)（#119），与所有领域组件共享版本跟踪和来源元数据的基础字段。

> 实现参考：`packages/shared/src/types/template.types.ts`, `packages/core/src/template/schema/template-schema.ts`

### 顶层结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 模板唯一名称（1–100 字符） |
| `version` | `string` | **是** | 语义化版本号（`x.y.z`）；覆盖 VersionedComponent 的可选 version |
| `description` | `string` | 否 | 人类可读描述 |
| `$type` | `string` | 否 | 组件类型标识符（继承自 VersionedComponent） |
| `$version` | `number` | 否 | 清单 schema 版本号（继承自 VersionedComponent） |
| `origin` | [`ComponentOrigin`](#componentorigin) | 否 | 组件来源跟踪（继承自 VersionedComponent） |
| `tags` | `string[]` | 否 | 分类标签（继承自 VersionedComponent） |
| `backend` | [`AgentBackendConfig`](#agentbackendconfig) | **是** | Agent 后端运行时 |
| `provider` | [`ModelProviderConfig`](#modelproviderconfig) | 否 | 模型提供商（省略时使用 config.json 默认 Provider） |
| `domainContext` | [`DomainContextConfig`](#domaincontextconfig) | **是** | 领域上下文组合 |
| `permissions` | [`PermissionsInput`](#permissionsinput) | 否 | 工具/文件/网络权限控制 |
| `initializer` | [`InitializerConfig`](#initializerconfig) | 否 | 自定义初始化流程 |
| `schedule` | [`ScheduleConfig`](#scheduleconfig) | 否 | 雇员型调度配置（Phase 3c 新增） |
| `metadata` | `Record<string, string>` | 否 | 任意键值元数据 |

### AgentBackendConfig

定义 Agent 使用的后端运行时（IDE/CLI）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `AgentBackendType` | **是** | 后端类型 |
| `config` | `Record<string, unknown>` | 否 | 后端特定配置 |

#### AgentBackendType

| 值 | 说明 | 支持 Backend Mode | ACP 通信 |
|----|------|------------------|---------|
| `"cursor"` | Cursor IDE（编辑器模式） | open, resolve | 否 |
| `"cursor-agent"` | Cursor Agent 模式 | open, resolve, acp | 是 |
| `"claude-code"` | Claude Code CLI | open, resolve, acp | 是（`open` → `claude` TUI；`resolve`/`acp` → `claude-agent-acp`） |
| `"pi"` | Pi Agent（基于 pi-agent-core） | acp | 是（ACP-only） |
| `"custom"` | 用户自定义可执行程序 | resolve | 否 |

> **Backend Mode**：每个后端在 BackendRegistry 中声明自己支持的交互模式。详见 [agent-lifecycle.md §5](./agent-lifecycle.md#5-backend-mode--后端交互模式)。
> - **open** — 直接打开原生 UI（不走 ACP）
> - **resolve** — 输出 ACP 连接命令供外部调用方使用
> - **acp** — Actant 托管的 ACP 生命周期（除 open/resolve 外的所有操作）
>
> **ACP-only 后端**：`pi` 后端的 `acpOwnsProcess: true`，进程完全由 `AcpConnectionManager` spawn，不经过 `ProcessLauncher.launch()`。详见 [api-contracts.md §5.1](./api-contracts.md#51-agentlauncher)。

#### config 可用字段

| 字段 | 适用类型 | 说明 |
|------|---------|------|
| `executablePath` | 全部 | 覆盖平台默认可执行路径 |
| `args` | `custom` | 自定义启动参数（不设则默认 `[workspaceDir]`） |

### ModelProviderConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | **是** | Provider 名称（任何已注册的 Provider，如 `"anthropic"`、`"groq"`） |
| `protocol` | `ModelApiProtocol` | 否 | API 协议格式，按 `type` 自动推断（见下表） |
| `baseUrl` | `string` | 否 | 覆盖默认 API 端点 |
| `config` | `Record<string, unknown>` | 否 | 提供商特定配置 |

> **安全约束**：`ModelProviderConfig` **不含 `apiKey` 字段**。API 密钥仅存储在 `~/.actant/config.json`（用户目录），Daemon 启动时加载到内存中的 `ModelProviderRegistry`，运行时注入为 `ACTANT_API_KEY` 环境变量。Template 文件和 Agent workspace 中的 `.actant.json` 永远不包含密钥，确保 LLM Agent 无法读取。
>
> `type` 不再限定为固定枚举值，而是通过 `ModelProviderRegistry` 语义校验。未注册的 type 产生 warning 并降级为 custom。

**内置 Provider（`ModelProviderDescriptor`）**：

| type | displayName | 默认 Protocol | 默认 Base URL |
|------|-------------|--------------|---------------|
| `"anthropic"` | Anthropic (Claude) | `"anthropic"` | `https://api.anthropic.com` |
| `"openai"` | OpenAI | `"openai"` | `https://api.openai.com/v1` |
| `"deepseek"` | DeepSeek | `"openai"` | `https://api.deepseek.com/v1` |
| `"ollama"` | Ollama (Local) | `"openai"` | `http://localhost:11434/v1` |
| `"azure"` | Azure OpenAI | `"openai"` | 用户指定 |
| `"bedrock"` | AWS Bedrock | `"anthropic"` | 用户指定 |
| `"vertex"` | Google Vertex AI | `"anthropic"` | 用户指定 |
| `"custom"` | Custom | `"custom"` | 用户指定 |

用户可通过 `config.json` 的 `providers` 字段注册额外 Provider（如 Groq、OpenRouter、Mistral 等），无需修改源码。

**ModelApiProtocol**（API 协议格式）：

| 值 | 说明 |
|----|------|
| `"openai"` | OpenAI Chat Completions API 兼容格式 |
| `"anthropic"` | Anthropic Messages API 格式 |
| `"custom"` | 用户自定义协议适配器 |

> `protocol` 省略时根据 `type` 自动推断（如 `deepseek` → `openai`）。仅当默认推断不符合实际需求时才需显式指定。

### ModelProviderDescriptor（#141 新增）

Provider 注册表中每个 Provider 的描述符。内置 Provider 在 Daemon 启动时自动注册；用户可通过 `config.json` 注册额外 Provider。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | **是** | Provider 唯一标识符 |
| `displayName` | `string` | **是** | CLI 显示名称 |
| `protocol` | `ModelApiProtocol` | **是** | 默认 API 协议 |
| `defaultBaseUrl` | `string` | 否 | 默认 API 端点 |
| `apiKey` | `string` | 否 | API 密钥（**仅存在于 Daemon 进程内存**，从 `config.json` 加载，不落盘到 workspace） |
| `models` | `string[]` | 否 | 支持的模型列表（信息性） |

### 默认 Provider vs 注册 Provider

Provider 存在两个层次：

- **默认 Provider**（`config.provider` 单数）：全局唯一，由 `actant setup` 配置。Daemon 和所有未指定 Provider 的 Agent 使用它。Setup 完成后自动注册到 Registry。
- **注册 Provider**（`config.providers` 复数 + 内置 + 默认自动注册）：多个并存，Template 通过 `provider.type` 按名称引用。

> 实现参考：`packages/core/src/provider/model-provider-registry.ts`，`packages/core/src/provider/builtin-providers.ts`

### DomainContextConfig

通过名称引用组合 Agent 的领域上下文。所有字段均为**引用**，不内嵌完整配置。

> **概念说明**: "DomainContext" 是 skills、prompts、mcp、templates、presets 等组件的统称，不是独立的组件类型。不存在 `DomainContextDefinition`。`DomainContextConfig` 仅是 AgentTemplate 中的一个配置字段，用于按名称引用和组合各类组件。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `skills` | `string[]` | `[]` | Skill 名称列表 |
| `prompts` | `string[]` | `[]` | Prompt 名称列表 |
| `mcpServers` | [`McpServerRef[]`](#mcpserverref) | `[]` | MCP 服务器引用 |
| `workflow` | `string` | — | Workflow 名称（**deprecated** — 将归并为 skill, #132） |
| `plugins` | `string[]` | `[]` | Plugin 名称列表（Phase 3a 新增） |
| `subAgents` | `string[]` | `[]` | 子 Agent 模板名称 |

### McpServerRef

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 服务器标识符 |
| `command` | `string` | **是** | 可执行命令 |
| `args` | `string[]` | 否 | 命令参数（默认 `[]`） |
| `env` | `Record<string, string>` | 否 | 环境变量（默认 `{}`） |

### InitializerConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `steps` | `InitializerStep[]` | **是** | 有序初始化步骤（至少 1 步） |

### InitializerStep

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | **是** | 步骤类型标识符 |
| `config` | `Record<string, unknown>` | 否 | 步骤特定配置 |

### ScheduleConfig（Phase 3c 新增）

定义雇员型 Agent 的自动调度策略。当模板包含 `schedule` 字段时，Agent 启动后自动初始化 EmployeeScheduler。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `heartbeat` | `HeartbeatConfig` | 否 | 心跳定时任务 |
| `cron` | `CronConfig[]` | 否 | Cron 定时任务列表（默认 `[]`） |
| `hooks` | `HookConfig[]` | 否 | 事件驱动任务列表（默认 `[]`） |

#### HeartbeatConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `intervalMs` | `number` | **是** | 间隔毫秒数（≥1000） |
| `prompt` | `string` | **是** | 每次心跳发送的 prompt |
| `priority` | `"low" \| "normal" \| "high" \| "critical"` | 否 | 任务优先级 |

#### CronConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pattern` | `string` | **是** | Cron 表达式（6 位，使用 croner 库） |
| `prompt` | `string` | **是** | 触发时发送的 prompt |
| `timezone` | `string` | 否 | 时区（如 `"Asia/Shanghai"`） |
| `priority` | `"low" \| "normal" \| "high" \| "critical"` | 否 | 任务优先级 |

#### HookConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventName` | `string` | **是** | 事件名称 |
| `prompt` | `string` | **是** | 触发时发送的 prompt（支持 `{{payload}}` 占位符） |
| `priority` | `"low" \| "normal" \| "high" \| "critical"` | 否 | 任务优先级 |

> 实现参考：`packages/core/src/scheduler/schedule-config.ts`

### 示例

```json
{
  "name": "code-review-agent",
  "version": "1.0.0",
  "description": "Code review specialist",
  "tags": ["review", "quality"],
  "backend": {
    "type": "cursor",
    "config": {}
  },
  "provider": {
    "type": "anthropic",
    "config": {}
  },
  "domainContext": {
    "skills": ["code-review-rules", "typescript-standards"],
    "prompts": ["review-system-prompt"],
    "mcpServers": [
      { "name": "filesystem", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"] }
    ],
    "workflow": "review-workflow",
    "plugins": ["memory-plugin"]
  },
  "schedule": {
    "cron": [
      { "pattern": "0 9 * * 1-5", "prompt": "Check for pending PRs and review them", "timezone": "Asia/Shanghai" }
    ],
    "hooks": [
      { "eventName": "pr.opened", "prompt": "Review the new PR: {{payload}}" }
    ]
  }
}
```

---

## 2. AgentInstanceMeta — 实例元数据

实例创建后持久化为 `{instanceDir}/.actant.json`，记录实例的完整运行时状态。

> 实现参考：`packages/shared/src/types/agent.types.ts`, `packages/core/src/state/instance-meta-schema.ts`

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `string` | **是** | — | 实例 UUID |
| `name` | `string` | **是** | — | 实例名称 |
| `templateName` | `string` | **是** | — | 来源模板名 |
| `templateVersion` | `string` | **是** | — | 来源模板版本 |
| `backendType` | `AgentBackendType` | **是**\* | `"cursor"` | 后端类型（创建时从模板写入） |
| `backendConfig` | `Record<string, unknown>` | 否 | — | 后端配置快照（创建时从模板写入） |
| `providerConfig` | [`ModelProviderConfig`](#modelproviderconfig) | 否 | — | Provider 配置引用（type + protocol + baseUrl，**不含 apiKey**；启动时 Daemon 从 Registry 内存解析密钥并注入为环境变量） |
| `status` | [`AgentStatus`](#agentstatus) | **是** | — | 当前生命周期状态 |
| `launchMode` | [`LaunchMode`](#launchmode) | **是** | — | 启动模式 |
| `workspacePolicy` | [`WorkspacePolicy`](#workspacepolicy) | **是** | `"persistent"` | workspace 生命周期策略 |
| `processOwnership` | [`ProcessOwnership`](#processownership) | 否 | — | 进程管理方（运行时字段） |
| `createdAt` | `string` | **是** | — | ISO 8601 创建时间 |
| `updatedAt` | `string` | **是** | — | ISO 8601 更新时间 |
| `pid` | `number` | 否 | — | 运行时 OS 进程 ID |
| `effectivePermissions` | `PermissionsConfig` | 否 | — | 解析后的最终生效权限（创建时由 template + override 解析写入，运行时可通过 `agent.updatePermissions` RPC 更新） |
| `metadata` | `Record<string, string>` | 否 | — | 任意元数据 |

\* Zod Schema 中标记 optional 以兼容旧文件；读取时缺失则默认 `"cursor"`。`"pi"` 类型实例的 `processOwnership` 始终为 `"managed"`。

### AgentStatus

| 值 | 说明 | 允许的转换 |
|----|------|-----------|
| `"created"` | 已创建，未启动 | → `starting` |
| `"starting"` | 启动中 | → `running` / `error` |
| `"running"` | 进程活跃 | → `stopping` / `error` / `crashed` |
| `"stopping"` | 关闭中 | → `stopped` / `error` |
| `"stopped"` | 正常终止 | → `starting` |
| `"error"` | 异常终止（启动/终止阶段失败） | → `starting` |
| `"crashed"` | 进程意外死亡（ProcessWatcher 检测到） | → `starting` |

**`error` vs `crashed` 的区别**：`error` 发生在 Actant 主动操作（start/stop）过程中；`crashed` 发生在 Agent 正常运行期间，由 ProcessWatcher 通过 PID 监控发现。对于 `processOwnership: "external"` 的 Agent，若 ProcessWatcher 发现 PID 不存在但客户端未 detach，状态变为 `crashed`。

### LaunchMode

定义 Agent 进程的生命周期语义。

| 值 | 生命周期所有者 | 场景 |
|----|--------------|------|
| `"direct"` | 用户 | 直接打开 IDE / TUI |
| `"acp-background"` | 调用方 | 外部客户端通过 ACP 管理 |
| `"acp-service"` | Actant | 持久化员工 Agent，崩溃自动重启 |
| `"one-shot"` | Actant | 执行后自动终止，可选自动清理 workspace |

### WorkspacePolicy

定义 workspace（文件系统）的生命周期策略。**独立于进程生命周期**。

| 值 | 说明 | 典型 LaunchMode |
|----|------|----------------|
| `"persistent"` | workspace 持久保留，多次 spawn 复用 | `direct`, `acp-service` |
| `"ephemeral"` | 任务完成后可清理 workspace | `one-shot` |

### ProcessOwnership

运行时字段，标识当前进程由谁管理。仅在 `status` 为 `running` / `crashed` 时有值。

| 值 | 说明 | 谁 spawn 的 | Actant 能做什么 |
|----|------|-----------|-------------------|
| `"managed"` | Actant Daemon spawn 的 | Daemon | 发 ACP 消息、重启、终止 |
| `"external"` | 外部客户端 spawn 的（通过 `agent.attach` 注册） | 外部客户端 | PID 监控、状态追踪，**不能**发 ACP 消息 |

---

## 3. VersionedComponent — 组件基类（#119）

所有可共享组件的公共基类接口。AgentTemplate 和全部领域组件（Skill、Prompt、Workflow、McpServer、Plugin）都继承自此接口，共享版本跟踪和来源元数据。

> 实现参考：`packages/shared/src/types/domain-component.types.ts`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 组件唯一名称 |
| `version` | `string` | 否 | 语义化版本号；未设则默认 `"0.0.0"` |
| `description` | `string` | 否 | 人类可读描述 |
| `$type` | `string` | 否 | 组件类型标识符（用于 manifest.json 信封，#58） |
| `$version` | `number` | 否 | 清单 Schema 版本号（#58） |
| `origin` | [`ComponentOrigin`](#componentorigin) | 否 | 组件来源跟踪 |
| `tags` | `string[]` | 否 | 分类标签 |

### ComponentOrigin

记录组件的来源信息，用于 Source Registry 同步和版本追踪。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"builtin" \| "source" \| "local"` | **是** | 来源类型 |
| `sourceName` | `string` | 否 | Source 包名（`type: "source"` 时） |
| `syncHash` | `string` | 否 | 上次同步时的内容 hash |
| `syncedAt` | `string` | 否 | ISO 8601 同步时间 |
| `modified` | `boolean` | 否 | 用户是否本地修改过同步副本 |

### 继承关系

```
VersionedComponent           ← 基类
  ├── AgentTemplate          ← version 字段必填（覆盖基类的可选）
  ├── SkillDefinition        ← + content, license?, compatibility?, allowedTools?
  ├── PromptDefinition       ← + content, variables
  ├── WorkflowDefinition     ← Hook Package: + level, hooks[] (#135)
  ├── McpServerDefinition    ← + command, args, env
  └── PluginDefinition       ← + type, source, config, enabled
```

---

## 4. ConfigValidationResult — 统一校验结果（#119）

所有配置校验（模板、领域组件、子配置）均返回此统一结构，包含结构化的错误和警告。

> 实现参考：`packages/shared/src/types/validation.types.ts`

### ConfigValidationResult\<T\>

| 字段 | 类型 | 说明 |
|------|------|------|
| `valid` | `boolean` | 校验是否通过 |
| `data` | `T` | 校验通过时的有效数据 |
| `errors` | `ValidationIssue[]` | 致命错误列表（`valid = false` 时非空） |
| `warnings` | `ValidationIssue[]` | 非致命警告列表（不阻止加载） |

### ValidationIssue

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | `string` | **是** | 问题字段的点分路径（如 `"domainContext.skills"`） |
| `message` | `string` | **是** | 人类可读描述 |
| `severity` | `"error" \| "warning" \| "info"` | **是** | 严重程度 |
| `code` | `string` | 否 | 机器可读代码（如 `"PERMISSION_OVERLAP"`） |

### 内置语义警告代码

以下是 `validateTemplate()` 和各子配置校验器可能返回的语义警告：

| 代码 | 路径 | 含义 |
|------|------|------|
| `PERMISSION_OVERLAP` | `permissions` | allow 和 deny 中存在重复规则 |
| `SHORT_HEARTBEAT_INTERVAL` | `schedule.heartbeat.intervalMs` | 心跳间隔 < 5000ms，可能导致过多 API 调用 |
| `EMPTY_DOMAIN_WITH_SUBAGENTS` | `domainContext` | 定义了 subAgents 但无 skills/prompts |
| `CUSTOM_BACKEND_NO_CONFIG` | `backend.config` | 自定义后端类型但未提供 config |
| `CUSTOM_PROVIDER_NO_CONFIG` | `provider.config` | 自定义提供商但未提供 config |

### 独立子配置校验器

可单独校验模板的各子配置块：

| 函数 | 校验目标 | 返回类型 |
|------|---------|---------|
| `validateBackendConfig(data)` | `AgentBackendConfig` | `ConfigValidationResult<AgentBackendConfig>` |
| `validateProviderConfig(data)` | `ModelProviderConfig` | `ConfigValidationResult<ModelProviderConfig>` |
| `validatePermissionsConfig(data)` | `PermissionsInput` | `ConfigValidationResult<PermissionsInput>` |
| `validateScheduleConfig(data)` | `ScheduleConfig` | `ConfigValidationResult<ScheduleConfig>` |
| `validateDomainContextConfig(data)` | `DomainContextConfig` | `ConfigValidationResult<DomainContextConfig>` |
| `validateTemplate(data)` | `AgentTemplate` | `ConfigValidationResult<AgentTemplate>` |

> 实现参考：`packages/core/src/template/schema/config-validators.ts`

---

## 5. Domain Context 组件定义

领域上下文由五类组件组成，通过名称引用、由 Manager 统一管理。所有组件类型均继承自 [`VersionedComponent`](#3-versionedcomponent--组件基类119)，共享 `name`、`version`、`description`、`origin`、`tags` 等字段。

> 实现参考：`packages/shared/src/types/domain-component.types.ts`, `packages/core/src/domain/`

以下仅列出各类型**自有字段**（继承字段见 VersionedComponent）。

### SkillDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `content` | `string` | **是** | 规则/知识内容 |
| `license` | `string` | 否 | SPDX 许可证标识符（Agent Skills 标准字段） |
| `compatibility` | `string` | 否 | 环境要求描述（Agent Skills 标准字段，max 500 字符） |
| `allowedTools` | `string[]` | 否 | 预授权工具列表（Agent Skills 标准字段，实验性） |

### PromptDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `content` | `string` | **是** | 提示词文本（支持 `{{variable}}` 插值） |
| `variables` | `string[]` | 否 | 声明的变量名 |

### WorkflowDefinition

> **重新定义（#135）**：Workflow 不再废弃。#132 的合并提议已关闭。
> Workflow 重新定义为 **Hook Package** —— 事件驱动的自动化声明。
> **Skill = 知识/能力注入（静态），Workflow = 事件自动化（动态）**，两者有清晰边界。
>
> 当前代码仍使用旧结构（`name + content`），待 #135 实施后升级为下方新结构。

**当前结构**（旧，待迁移）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `content` | `string` | **是** | 工作流内容（markdown 文本） |

**目标结构**（#135 Hook Package，待实现）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `level` | `"actant" \| "instance"` | **是** | 作用层级：全局系统事件 或 绑定到实例 |
| `hooks` | `HookDeclaration[]` | **是** | hook 声明列表 |

**HookDeclaration**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `on` | `string` | **是** | 事件名（见 agent-lifecycle.md §1.3 Hook 三层架构） |
| `actions` | `HookAction[]` | **是** | 触发时执行的动作列表 |

**HookAction**（三种类型）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `"shell" \| "builtin" \| "agent"` | 动作类型 |
| `run` | `string` | (shell) 要执行的 shell 命令 |
| `action` | `string` | (builtin) Actant 内置动作名 |
| `target` | `string` | (agent) 目标 Agent 名称 |
| `prompt` | `string` | (agent) 发送给目标 Agent 的 prompt |
| `params` | `Record<string, unknown>` | (builtin) 动作参数 |

### McpServerDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `command` | `string` | **是** | 可执行命令 |
| `args` | `string[]` | 否 | 命令参数 |
| `env` | `Record<string, string>` | 否 | 环境变量 |

### PluginDefinition（Phase 3a 新增）

Agent 侧能力扩展（Claude Code 插件、Cursor 扩展等），通过 BackendBuilder 物化到 workspace。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `type` | `"npm" \| "file" \| "config"` | **是** | 安装方式 |
| `source` | `string` | 否 | npm 包名 / 文件路径 / 配置 ID |
| `config` | `Record<string, unknown>` | 否 | 插件特定配置 |
| `enabled` | `boolean` | 否 | 是否启用（默认 `true`） |

> 注意：这是 Agent 侧 Plugin（Phase 3a），不同于 Actant 系统级 Plugin（Phase 4 #13）。

> 实现参考：`packages/core/src/domain/plugin/plugin-manager.ts`，类型定义见 `packages/shared/src/types/domain-component.types.ts`

---

## 6. AppConfig — 应用运行时配置

守护进程启动时的配置项，决定数据存储位置和运行模式。

> 实现参考：`packages/api/src/services/app-context.ts`

### 配置字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `homeDir` | `string` | `~/.actant` | 数据根目录 |
| `launcherMode` | `"mock" \| "real"` | `"real"` | Launcher 模式 |

### 派生路径

| 路径 | 规则 | 说明 |
|------|------|------|
| `templatesDir` | `{homeDir}/templates` | 模板存储 |
| `instancesDir` | `{homeDir}/instances` | 实例工作区 |
| `socketPath` | 平台相关（见下） | IPC 通信地址 |
| `pidFilePath` | `{homeDir}/daemon.pid` | 守护进程 PID 文件 |

### ProcessLauncher 选项

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `terminateTimeoutMs` | `number` | `5000` | SIGTERM 后等待多久发送 SIGKILL |
| `spawnVerifyDelayMs` | `number` | `500` | spawn 后等待多久验证进程存活 |

---

## 7. 平台与 IPC

### Socket 路径规则

| 平台 | 默认路径 | 自定义 homeDir |
|------|---------|---------------|
| macOS / Linux | `~/.actant/actant.sock` | `{homeDir}/actant.sock` |
| Windows | `\\.\pipe\actant` | `\\.\pipe\actant-{safeName}` |

### 平台工具函数

| 函数 | 说明 |
|------|------|
| `getDefaultIpcPath()` | 当前平台的默认 IPC 路径 |
| `getIpcPath(homeDir)` | 指定 homeDir 的 IPC 路径 |
| `ipcRequiresFileCleanup()` | Unix 为 `true`（需清理 socket 文件），Windows 为 `false` |
| `onShutdownSignal(cb)` | 注册 `SIGINT` / `SIGTERM`（Unix 含 `SIGHUP`）清理回调 |
| `isWindows()` | 平台检测 |

> 实现参考：`packages/shared/src/platform/platform.ts`

---

## 8. 后端解析规则

根据 `backendType` 确定可执行命令和启动参数。

### 平台默认可执行路径

| backendType | macOS / Linux | Windows |
|-------------|--------------|---------|
| `cursor` | `cursor` | `cursor.cmd` |
| `claude-code` | `claude-agent-acp` | `claude-agent-acp.cmd` |
| `pi` | `pi-acp-bridge` | `pi-acp-bridge.cmd` |
| `custom` | 必须通过 `backendConfig.executablePath` 指定 | 同左 |

### 覆盖机制

- `backendConfig.executablePath` → 覆盖平台默认命令
- `backendConfig.args`（仅 `custom`）→ 自定义启动参数；未设则默认 `[workspaceDir]`
- `cursor` 默认参数为 `[workspaceDir]`
- `claude-code` / `pi` 默认参数为 `[]`（ACP session 的 `cwd` 参数处理 workspace）

> 实现参考：`packages/core/src/manager/launcher/backend-resolver.ts`

---

## 9. EnvChannel — 环境请求路由

Daemon 内部配置，决定 Agent 的环境请求（`fs/readTextFile` 等 ACP 回调）如何处理。

```typescript
type EnvChannel =
  | { type: "local"; workspaceDir: string }
  | { type: "passthrough"; proxySessionId: string }
```

| 类型 | 说明 | 触发条件 |
|------|------|---------|
| `"local"` | Daemon 在 Agent workspace 内本地处理 | 默认；ACP Proxy 未启用 `--env-passthrough` |
| `"passthrough"` | 转发给 ACP Proxy → 穿透回外部客户端 | ACP Proxy 启用 `--env-passthrough` |

---

## 10. ProxySession — Proxy 会话状态

Daemon 侧维护的 ACP Proxy 连接状态（运行时，不持久化）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `sessionId` | `string` | 唯一会话 ID |
| `agentName` | `string` | 关联的 Agent 实例名 |
| `envPassthrough` | `boolean` | 是否开启环境穿透 |
| `rpcChannel` | `JsonRpcChannel` | Proxy ↔ Daemon 的 RPC 连接 |
| `connectedAt` | `string` | ISO 8601 连接时间 |

---

## 11. 环境变量

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `ACTANT_HOME` | 覆盖数据根目录（homeDir） | `~/.actant` |
| `ACTANT_SOCKET` | 覆盖 IPC Socket 路径 | 平台默认 |
| `ACTANT_LAUNCHER_MODE` | 设定 Launcher 模式（`"mock"` / `"real"`） | `"real"` |
| `ACTANT_PROVIDER` | 统一 LLM Provider 标识（如 `openai`、`anthropic`） | 无（由 Daemon 从 config.json 注入） |
| `ACTANT_MODEL` | 统一 LLM 模型名称（如 `gpt-4o`、`claude-sonnet-4-20250514`） | 无 |
| `ACTANT_API_KEY` | 统一 API 密钥（由 Daemon 从 config.json 注入，fallback 到 provider-specific 变量） | 无 |
| `ACTANT_BASE_URL` | Provider API 端点（由 Daemon 从 config.json 注入） | 无 |
| `ACTANT_THINKING_LEVEL` | 统一 thinking/reasoning 级别 | 无 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥（兼容 fallback，推荐使用 `ACTANT_API_KEY`） | 无 |
| `LOG_LEVEL` | Pino 日志级别 | `"info"`（CLI 中未设置时为 `"silent"`） |

### ACTANT_* 后端通用环境变量约定

自有 bridge（如 Pi）统一使用 `ACTANT_` 前缀读取 LLM provider / model 配置。

| 变量 | 用途 | 来源 |
|------|------|------|
| `ACTANT_PROVIDER` | LLM 服务提供商标识 | config.json → Daemon 注入 ACP |
| `ACTANT_API_KEY` | 统一 API 密钥 | config.json → Daemon 注入 ACP |
| `ACTANT_BASE_URL` | Provider API 端点 | config.json → Daemon 注入 ACP |
| `ACTANT_MODEL` | LLM 模型名称 | 手动设置或 template config |
| `ACTANT_THINKING_LEVEL` | Thinking / reasoning 级别 | 手动设置 |

> **设计决策**：自有 bridge 使用 `ACTANT_*` 前缀，确保在切换 Provider 时无需修改环境配置。但**第三方后端（如 `claude-agent-acp`）是独立二进制程序，只认自身原生环境变量**（如 `ANTHROPIC_API_KEY`），不认识 `ACTANT_*`。因此环境变量注入必须分两层处理。
>
> **ACP 协议层面**：ACP `SessionConfigOption`（category: `model` / `thinking_level`）可用于协议层面动态切换 model 和 thinking level，但**不覆盖 API Key 等凭证**。凭证只能通过 spawn 时的环境变量传递。

### 后端感知的环境变量注入（计划中，#141 Phase 2）

不同后端的 ACP 子进程期望不同的环境变量。`BackendDescriptor.buildProviderEnv` 策略让各后端自描述所需的原生变量映射，AgentManager 查表调用。

| 后端 | 注入的变量 | 说明 |
|------|-----------|------|
| Pi（自有 bridge） | `ACTANT_PROVIDER`、`ACTANT_MODEL`、`ACTANT_API_KEY`、`ACTANT_BASE_URL` | 我们控制 bridge 代码 |
| Claude Code（第三方） | `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL` | 只认原生变量 |
| 未注册 `buildProviderEnv` 的后端 | `ACTANT_*`（默认 fallback） | 兼容兜底 |

> **自动注入（#141）**：`actant setup` 配置的 Provider 信息（type、apiKey、baseUrl）持久化到 `~/.actant/config.json`。Daemon 启动时将 `config.json` 中的密钥加载到内存 Registry，启动 ACP 子进程时通过 `BackendDescriptor.buildProviderEnv`（或 fallback）注入环境变量。**密钥安全模型**：API Key 仅存在于 `config.json`（用户目录）和 Daemon 进程内存（Registry），不写入 Agent workspace 的任何文件（template、`.actant.json`），确保 LLM Agent 无法通过文件系统读取密钥。

---

## 变更约定

> 对本文档所定义的任何配置结构、字段、枚举值或环境变量进行增删改时，**必须先更新本文档，再修改代码**，并在同一次提交中完成。
