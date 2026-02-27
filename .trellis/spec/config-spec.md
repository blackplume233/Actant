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
| `archetype` | [`AgentArchetype`](#agentarchetype) | 否 | 管理深度分类声明（repo / service / employee），驱动实例默认的 launchMode/interactionModes/autoStart |
| `launchMode` | [`LaunchMode`](#launchmode) | 否 | 模板级启动模式覆盖。设置后覆盖 archetype 推导的默认值，但仍可被 create-time override 覆盖。优先级：override > template.launchMode > archetype default |
| `schedule` | [`ScheduleConfig`](#scheduleconfig) | 否 | 雇员型调度配置（Phase 3c 新增） |
| `metadata` | `Record<string, string>` | 否 | 任意键值元数据 |

### AgentBackendConfig

定义 Agent 使用的后端运行时（IDE/CLI）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `AgentBackendType` | **是** | 后端类型 |
| `config` | `Record<string, unknown>` | 否 | 后端特定配置 |
| `interactionModes` | [`InteractionMode[]`](#interactionmode) | 否 | 该 Agent 支持的 CLI 交互命令。省略时使用 BackendDefinition 的 `defaultInteractionModes`，再缺省则默认 `["start"]` |

#### AgentBackendType

`AgentBackendType` 是开放类型：`KnownBackendType | (string & {})`。已知值提供 IDE 自动补全，同时允许任意自定义后端名称。

**已知后端**：

| 值 | 说明 | 支持 Backend Mode | ACP 通信 |
|----|------|------------------|---------|
| `"cursor"` | Cursor IDE（编辑器模式） | open, resolve | 否 |
| `"cursor-agent"` | Cursor Agent 模式 | open, resolve, acp | 是 |
| `"claude-code"` | Claude Code CLI | open, resolve, acp | 是（`open` → `claude` TUI；`resolve`/`acp` → `claude-agent-acp`） |
| `"pi"` | Pi Agent（基于 pi-agent-core） | acp | 是（ACP-only, in-process） |
| `"custom"` | 用户自定义可执行程序 | resolve | 否 |

> **开放类型说明**：`AgentBackendType` 不再是严格枚举。通过 actant-hub 或用户本地注册的自定义后端可使用任意字符串作为 `type`。Zod Schema 使用 `z.string().min(1)` 校验。已知值通过 `KnownBackendType` 类型别名提供 IDE 补全。

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

### InteractionMode

CLI 命令级别的交互模式，声明 Agent 支持哪些 CLI 命令。与后端协议级别的 `AgentOpenMode`（resolve/open/acp）互补。

| 值 | 对应 CLI 命令 | 说明 |
|----|-------------|------|
| `"open"` | `agent open` | 前台打开原生 TUI（需后端支持 `open` mode） |
| `"start"` | `agent start` | 通过 Daemon 后台启动（需后端支持 `acp` mode） |
| `"chat"` | `agent chat` | 交互式 REPL 会话 |
| `"run"` | `agent run` | 单次 prompt 执行 |
| `"proxy"` | `proxy` | ACP stdio 管道桥接（面向 IDE 集成） |

**各后端默认值**（`BackendDefinition.defaultInteractionModes`）：

| 后端 | 默认 interactionModes |
|------|----------------------|
| `cursor` | `["start"]` |
| `cursor-agent` | `["open", "start", "chat", "run", "proxy"]` |
| `claude-code` | `["open", "start", "chat", "run", "proxy"]` |
| `pi` | `["start", "chat", "run", "proxy"]` |
| `custom` | `["start"]` |

> **PI 没有 `"open"` 模式**：PI 后端无原生 TUI，`supportedModes` 不含 `open`，因此 `defaultInteractionModes` 排除 `"open"`。PI 的所有交互均通过 ACP 协议（由 `pi-acp-bridge` 桥接）。

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

> **✅ 已重构**：定时器（HeartbeatInput/CronInput）现在是纯**事件源**，同时 emit 到 HookEventBus（`heartbeat:tick` / `cron:<pattern>`）并通过 TaskQueue 串行派发内置 prompt（向后兼容）。
> TaskDispatcher 在队列排空时 emit `idle` 事件。EmployeeScheduler 接受可选 `hookEventBus` 参数完成集成。
> 详见 [event-system-unified-design.md](../../docs/design/event-system-unified-design.md)。

定义雇员型 Agent 的自动调度策略。**仅 `archetype: "employee"` 的 Agent 允许配置此字段**。`repo` 和 `service` 类型配置 `schedule` 时校验将报错。当模板包含 `schedule` 字段时，Agent 启动后自动初始化 EmployeeScheduler。

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
| `interactionModes` | [`InteractionMode[]`](#interactionmode) | **是** | `["start"]` | 支持的 CLI 交互命令（创建时从 template → backend defaults → `["start"]` 解析） |
| `providerConfig` | [`ModelProviderConfig`](#modelproviderconfig) | 否 | — | Provider 配置引用（type + protocol + baseUrl，**不含 apiKey**；启动时 Daemon 从 Registry 内存解析密钥并注入为环境变量） |
| `status` | [`AgentStatus`](#agentstatus) | **是** | — | 当前生命周期状态 |
| `launchMode` | [`LaunchMode`](#launchmode) | **是** | — | 启动模式 |
| `workspacePolicy` | [`WorkspacePolicy`](#workspacepolicy) | **是** | `"persistent"` | workspace 生命周期策略 |
| `processOwnership` | [`ProcessOwnership`](#processownership) | 否 | — | 进程管理方（运行时字段） |
| `createdAt` | `string` | **是** | — | ISO 8601 创建时间 |
| `updatedAt` | `string` | **是** | — | ISO 8601 更新时间 |
| `pid` | `number` | 否 | — | 运行时 OS 进程 ID |
| `effectivePermissions` | `PermissionsConfig` | 否 | — | 解析后的最终生效权限（创建时由 template + override 解析写入，运行时可通过 `agent.updatePermissions` RPC 更新） |
| `archetype` | [`AgentArchetype`](#agentarchetype) | 否 | `"repo"` | 实例管理深度分类，驱动 launchMode/interactionModes/autoStart 的默认值（L1: repo / L2: service / L3: employee） |
| `autoStart` | `boolean` | 否 | `false` | Daemon 启动时是否自动启动此实例（employee/service 默认 true） |
| `workspaceDir` | `string` | 否 | — | Agent workspace 的绝对路径。运行时由 AgentManager 在 `startAgent()` 时填充，持久化到 `.actant.json`，供 Dashboard 等外部系统读取 |
| `startedAt` | `string` | 否 | — | ISO 8601 时间戳，记录 Agent 进程最近一次启动的时间。由 AgentManager 在 `startAgent()` 时写入 |
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

### AgentArchetype

高层语义字段，描述 Actant 对该 Agent 的**管理深度**。三层分类以管理程度递进排列：

```
repo ──→ service ──→ employee
(L1)      (L2)       (L3)
```

Archetype 驱动 `launchMode`、`interactionModes`、`autoStart` 的默认值；用户 override 始终优先。

| 值 | 管理深度 | 默认 launchMode | 默认 interactionModes | 默认 autoStart | 典型场景 |
|----|---------|----------------|----------------------|---------------|---------|
| `"repo"` | L1 — 持续管理 workspace | `direct` | `open, start, chat` | `false` | Actant 持续管理工作目录，用户自行 open 或外部通过 actant 命令 acp direct 连接 |
| `"service"` | L2 — 进程管理 | `acp-service` | `proxy` | `true` | Actant 管理完整进程生命周期，被动响应请求，session 由调用者控制 |
| `"employee"` | L3 — 自治调度 | `acp-background` | `start, run, proxy` | `true` | service 超集 + heartbeat + 调度器 + 自主执行使命 |

#### 三层详细定义

**L1: `repo`（仓库型）**
- Actant **持续管理工作目录**：解析模板 → 物化组件（skills / prompts / mcp / permissions） → 持续响应模板/组件变更（热重载）
- Actant **不主动 spawn 进程**，但工作目录始终由 Actant 维护和管理
- 用户通过 `actant agent open` 在原生 IDE 中打开；外部也可通过 actant 命令经 ACP 直接连接（`acp direct`）
- **权限**：物化时写入 workspace 配置文件，Actant 不在运行时强制执行
- **进程管理**：不主动 spawn，但支持外部连接后的状态追踪（attach）
- **`schedule` 字段**：不允许（校验时报错）

**L2: `service`（服务型）**
- Actant **完全管理进程生命周期**：spawn、health check、crash recovery、graceful shutdown
- 具备完整的 ACP 通信能力，可通过 `proxy` 模式接收外部请求
- **Session 模型由调用者控制**：是否创建新 session 取决于请求来源和 service 配置，调用者可通过 API 显式管理 session 生命周期
- **不具备调度器**：无 heartbeat、cron、hooks —— 纯被动响应，无自主行为
- **权限**：Actant 运行时强制执行 PermissionsConfig，受 PolicyEnforcer 管控
- **工具**：`scope: "service"` 的工具对此类型开放（canvas、status、agent 间通信等）
- **进程管理**：ProcessWatcher 监控 + auto-restart（crash recovery）
- **`schedule` 字段**：不允许（校验时报错）

**L3: `employee`（雇员型）**
- 在 `service` 全部能力基础上，增加：
  - **心跳**：HeartbeatInput 定期 tick，汇报存活并驱动 prompt
  - **调度器**：EmployeeScheduler 管理 heartbeat + cron + hooks 三种 InputSource
  - **自我意识**：持续执行使命（mission prompt），具备主动行为能力
- 雇员是"有使命感的服务" —— 不仅响应请求，还主动巡检、执行定时任务
- **权限**：最严格的管控层级，`scope: "employee"` 的工具仅对此类型开放
- **进程管理**：ProcessWatcher + EmployeeScheduler + TaskQueue + TaskDispatcher
- **`schedule` 字段**：必须配置（至少包含 heartbeat）

#### 各层级能力矩阵

| 能力 | `repo` | `service` | `employee` |
|------|--------|-----------|------------|
| 工作目录持续管理 | ✅ | ✅ | ✅ |
| 主动 spawn 进程 | ❌ | ✅ | ✅ |
| ACP 通信（外部可 direct 连接） | ✅（按需） | ✅（常驻） | ✅（常驻） |
| 崩溃自动重启 | ❌ | ✅ | ✅ |
| Session 管理（调用者控制） | ❌ | ✅ | ✅ |
| 调度器（heartbeat/cron/hooks） | ❌ | ❌ | ✅ |
| TaskQueue 串行派发 | ❌ | ❌ | ✅ |
| Service-scope 工具（canvas、status 等） | ❌ | ✅ | ✅ |
| Employee-scope 工具（schedule、self-status 等） | ❌ | ❌ | ✅ |
| 权限运行时强制 | ❌ | ✅ | ✅ |

#### 工具暴露策略（CLI-first，#228）

所有对 Agent 暴露的系统能力统一通过 `actant internal <command> --token` CLI 暴露，MCP 仅作为可选封装层。

| 层级 | 可用工具 | 暴露方式 |
|------|---------|---------|
| `repo` | 无（Actant 不持有进程） | N/A |
| `service` | canvas、status、agent 间通信 | `actant internal` CLI |
| `employee` | service 全部 + schedule、email、self-status | `actant internal` CLI |

#### ToolScope 层级化模型（#228 实现）

工具通过 `scope` 属性声明最低访问层级。`SessionContextInjector` 使用数值层级比较过滤工具：

```typescript
type ToolScope = "employee" | "service" | "all";

const ARCHETYPE_LEVEL = { repo: 0, service: 1, employee: 2 };
const SCOPE_MIN_LEVEL = { all: 0, service: 1, employee: 2 };
```

过滤规则：`ARCHETYPE_LEVEL[agent.archetype] >= SCOPE_MIN_LEVEL[tool.scope]`。即 `scope: "service"` 的工具对 service 和 employee 均可用。

> 实现参考：`packages/core/src/context-injector/session-context-injector.ts`、`packages/core/src/initializer/archetype-defaults.ts`
>
> 设计决策：#228 (RFC: Agent 三层分类重定义)

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
  ├── WorkflowDefinition     ← Hook Package: + level, hooks[HookDeclaration] (#135, event-system-unified-design)
  ├── McpServerDefinition    ← + command, args, env
  ├── PluginDefinition       ← + type, source, config, enabled
  └── BackendDefinition      ← + supportedModes, resolveCommand?, openCommand?, existenceCheck?, install?
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
| `SCHEDULE_NOT_ALLOWED` | `schedule` | repo/service 类型 Agent 不允许配置 schedule |
| `EMPLOYEE_MISSING_SCHEDULE` | `schedule` | employee 类型 Agent 必须配置 schedule（至少 heartbeat） |

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

> **重新定义（#135, PR #196）**：Workflow 重新定义为 **Hook Package** —— 事件驱动的自动化声明。
> **Skill = 知识/能力注入（静态），Workflow = 事件自动化（动态）**，两者有清晰边界。
>
> 完整设计：[event-system-unified-design.md](../../docs/design/event-system-unified-design.md)
>
> Schema 已在 PR #196 中完成对齐：`content` 改为 optional，新增 `hooks`/`enabled`/`level` 字段。
> 纯内容 Workflow 和纯 Hook Workflow 均可通过校验。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `content` | `string` | 否 | 工作流内容（markdown 文本）。纯 Hook Workflow 可省略 |
| `hooks` | `HookDeclaration[]` | 否 | hook 声明列表。纯内容 Workflow 可省略 |
| `enabled` | `boolean` | 否 | 是否启用（默认 `true`） |
| `level` | `"actant" \| "instance"` | 否 | 作用层级：全局系统事件 或 绑定到实例（默认 `"actant"`） |

**HookDeclaration**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `on` | `string` | **是** | 事件名（见 [agent-lifecycle.md §1.3 统一事件系统](./agent-lifecycle.md#13-统一事件系统event-first-架构)） |
| `description` | `string` | 否 | 人类可读的意图描述 |
| `actions` | `HookAction[]` | **是** | 触发时执行的动作列表（有序） |
| `priority` | `number` | 否 | 执行优先级，数值越小越先执行（默认 `100`；系统内部 hook 使用 `< 50`） |
| `condition` | `string` | 否 | 模板表达式条件过滤（`${data.xxx}` truthy 判断） |
| `allowedCallers` | `HookCallerType[]` | 否 | 限制哪些 caller 类型触发的事件可激活此 hook（省略 = 不限制） |
| `retry` | `HookRetryPolicy` | 否 | 失败重试策略 |
| `timeoutMs` | `number` | 否 | 整个 hook 执行的最大超时毫秒数 |

**HookCallerType**（事件发射者身份）：

| 值 | 说明 |
|----|------|
| `"system"` | Actant daemon 内部（AgentManager 等） |
| `"agent"` | LLM 驱动的 Agent（通过 ACP session） |
| `"plugin"` | 用户安装的插件代码 |
| `"user"` | 人类通过 CLI 或 API |

**HookRetryPolicy**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `maxRetries` | `number` | **是** | 最大重试次数 |
| `backoffMs` | `number` | 否 | 重试间隔毫秒数（默认 `1000`） |

**HookAction**（三种类型）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `"shell" \| "builtin" \| "agent"` | 动作类型 |
| `run` | `string` | (shell) 要执行的 shell 命令，支持 `${data.xxx}` 占位符 |
| `action` | `string` | (builtin) Actant 内置动作名 |
| `target` | `string` | (agent) 目标 Agent 名称 |
| `prompt` | `string` | (agent) 发送给目标 Agent 的 prompt，支持 `${data.xxx}` 占位符 |
| `params` | `Record<string, unknown>` | (builtin) 动作参数 |

> **Archetype 感知**：当 `type: "agent"` 时，ActionRunner 根据目标 Agent 的 archetype 决定执行策略：
> - `repo` → 不可调度（repo 不持有进程，ActionRunner 跳过）
> - `service` → session 策略由调用者/配置决定（可复用现有 session 或创建新 session）
> - `employee` → 进入 TaskQueue 串行派发

**Actant-level Workflow 示例**：

```json
{
  "name": "ops-automation",
  "level": "actant",
  "hooks": [
    {
      "on": "agent:created",
      "description": "Log new agent creation and run smoke test",
      "priority": 10,
      "actions": [
        { "type": "shell", "run": "echo 'New agent: ${agent.name}' >> /var/log/actant.log" },
        { "type": "agent", "target": "qa-bot", "prompt": "Run smoke test for ${agent.name}" }
      ],
      "allowedCallers": ["system", "user"]
    },
    {
      "on": "cron:0 9 * * *",
      "description": "Daily health check",
      "actions": [
        { "type": "builtin", "action": "actant.healthcheck" }
      ],
      "retry": { "maxRetries": 2, "backoffMs": 5000 },
      "timeoutMs": 30000
    }
  ]
}
```

**Instance-level Workflow 示例**：

```json
{
  "name": "dev-guard",
  "level": "instance",
  "hooks": [
    {
      "on": "prompt:after",
      "description": "Show git diff after prompt completes",
      "actions": [
        { "type": "shell", "run": "git diff --stat" }
      ]
    }
  ]
}
```

> 实现参考：`packages/shared/src/types/hook.types.ts`（类型定义），`packages/core/src/hooks/`（EventBus、Registry、CategoryRegistry）

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

### ActantPlugin 接口（Phase 4 #14 — 已实现）

> **✅ 已实现**：六插口接口已在 Step 4 完成，通过 27 个单元测试。详见 `spec/backend/plugin-guidelines.md`。

Actant 系统级 Plugin，运行在 Daemon 进程内，具备六插口能力。与 Agent-side `PluginDefinition` (Phase 3a) 层级不同：

```
ActantPlugin = Daemon-side 系统级插件（Phase 4）
  ├─ domainContext 插口: 物化到 Agent workspace 的 DomainContextConfig
  ├─ runtime 插口: Daemon 运行时有状态逻辑（五阶段生命周期）
  ├─ hooks 插口: 注册 HookEventBus 事件监听器
  ├─ contextProviders 插口: 注入 SessionContextInjector
  ├─ subsystems 插口: 注册 SubsystemDefinition
  └─ sources 插口: 注册 SourceConfig 到 SourceManager

PluginDefinition = Agent-side 能力扩展（Phase 3a）
  └─ 通过 BackendBuilder 物化到 workspace（npm/file/config）
  └─ 通过 adaptLegacyPlugin() 可自动升级为 ActantPlugin
```

**ActantPlugin 类型定义**（`@actant/core/plugin/types.ts` + `@actant/shared/types/plugin.types.ts`）：

```typescript
// 完整接口见 packages/core/src/plugin/types.ts
interface ActantPlugin {
  readonly name: string;
  readonly scope: PluginScope;            // "actant" | "instance"
  readonly dependencies?: readonly string[];

  domainContext?: (ctx: PluginContext) => DomainContextConfig | undefined;
  runtime?: PluginRuntimeHooks;           // init/start/tick/stop/dispose
  hooks?: (bus: HookEventBus, ctx: PluginContext) => void;
  contextProviders?: (ctx: PluginContext) => ContextProvider[];
  subsystems?: (ctx: PluginContext) => SubsystemDefinition[];
  sources?: (ctx: PluginContext) => SourceConfig[];
}

// 基础类型在 packages/shared/src/types/plugin.types.ts
type PluginScope = 'actant' | 'instance';

interface PluginContext {
  agentName?: string;          // scope=instance 时有值
  config: Record<string, unknown>;
  eventBus: HookEventBus;
  getPlugin<T extends ActantPlugin>(name: string): T | undefined;
}
```

**PluginRef 配置**（AgentTemplate.plugins / AppConfig.plugins 中引用 ActantPlugin）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | Plugin 名称 |
| `enabled` | `boolean` | 否 | 是否启用（默认 `true`） |
| `config` | `Record<string, unknown>` | 否 | 传递给 PluginContext.config 的配置 |

**数据目录隔离**：

| scope | dataDir 路径 | 说明 |
|-------|-------------|------|
| `actant` | `{ACTANT_HOME}/plugins/{pluginName}/` | 全局 Plugin 数据 |
| `instance` | `{instanceDir}/.actant/plugins/{pluginName}/` | 实例级 Plugin 数据 |

**向后兼容**：旧 `PluginDefinition` (Phase 3a) 通过 `adaptLegacyPlugin()` 自动转换为纯 domainContext 的 `ActantPlugin`。

> 预定设计详见：[Plugin 预定设计](./backend/plugin-guidelines.md)（实施前须重新审查）

### HookEventName（#159 已定义）

事件名称联合类型，定义在 `@actant/shared/types/hook.types.ts`。

```typescript
type HookEventName =
  // System Layer (Global)
  | 'actant:start' | 'actant:stop'
  // Entity Layer (Global)
  | 'agent:created' | 'agent:destroyed' | 'agent:modified'
  | 'source:updated'
  // Runtime Layer (Instance scope)
  | 'process:start' | 'process:stop' | 'process:crash' | 'process:restart'
  | 'session:preparing' | 'session:context-ready'
  | 'session:start' | 'session:end'
  | 'prompt:before' | 'prompt:after'
  | 'error' | 'idle'
  // Schedule Layer (Configurable)
  | `cron:${string}`
  | 'heartbeat:tick'
  // User Layer (Configurable)
  | 'user:dispatch' | 'user:run' | 'user:prompt'
  // Extension Layer (Any)
  | 'subsystem:activated' | 'subsystem:deactivated' | 'subsystem:error'
  | `plugin:${string}`
  | `custom:${string}`;
```

每个内置事件携带 `HookEventMeta`，包含 `subscriptionModels` 标注支持的订阅模型（A: 系统强制 / B: 用户配置 / C: Agent 自注册）。

> 命名规范：`<scope>:<noun>` 或 `<scope>:<noun>:<verb>`。详见 [Plugin 预定设计 §Hook 事件规范](./backend/plugin-guidelines.md#hook-事件规范预定) 和 [event-system-unified-design.md §7](../../docs/design/event-system-unified-design.md)。
>
> 实现参考：`packages/shared/src/types/hook.types.ts`（`BUILTIN_EVENT_META` 包含所有 26 个内置事件的完整元数据，含 3 个 subsystem 事件）

### BackendDefinition

Agent 后端的纯数据配置，JSON 可序列化。由 `BackendManager` 管理，可通过 actant-hub 分发。

> 实现参考：`packages/shared/src/types/template.types.ts`，`packages/core/src/domain/backend/backend-manager.ts`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| *(继承)* | — | — | 见 [VersionedComponent](#3-versionedcomponent--组件基类119) |
| `supportedModes` | `AgentOpenMode[]` | **是** | 支持的交互模式（`open`, `resolve`, `acp`） |
| `resolveCommand` | [`PlatformCommand`](#platformcommand) | 否 | resolve/acp 模式的可执行命令 |
| `openCommand` | [`PlatformCommand`](#platformcommand) | 否 | open 模式的可执行命令 |
| `acpCommand` | [`PlatformCommand`](#platformcommand) | 否 | ACP 模式的可执行命令（省略时 fallback 到 `resolveCommand`） |
| `openWorkspaceDir` | `"arg" \| "cwd"` | 否 | open 模式的 workspace 传递方式（`"arg"` = 作为命令参数，`"cwd"` = 设为工作目录） |
| `openSpawnOptions` | [`OpenSpawnOptions`](#openspawnoptions) | 否 | open 模式的 spawn 选项（直接映射 Node.js `SpawnOptions` 子集） |
| `acpOwnsProcess` | `boolean` | 否 | 若 `true`，ACP 层全权管理进程生命周期（如 Pi） |
| `resolvePackage` | `string` | 否 | 提供 resolve/acp 可执行文件的 npm 包名 |
| `existenceCheck` | [`BackendExistenceCheck`](#backendexistencecheck) | 否 | 后端可执行文件的存在性验证规则 |
| `install` | [`BackendInstallMethod[]`](#backendinstallmethod) | 否 | 安装方式列表（按平台过滤） |
| `materialization` | [`MaterializationSpec`](#materializationspec158-新增) | 否 | 声明式 workspace 物化规范（#158 新增） |

> **数据与行为分离**：`BackendDefinition` 是纯数据对象，不含函数。非序列化的行为扩展（如 `acpResolver`、`buildProviderEnv` 函数）通过 `BackendManager.registerAcpResolver()` / `registerBuildProviderEnv()` 单独注册。旧版 `BackendDescriptor` 作为兼容层保留，但新代码应使用 `BackendDefinition` + `BackendManager`。
>
> **自动安装（#153）**：`BackendManager.ensureAvailable(name, { autoInstall })` 整合 existence check + auto-install 流程。当 `autoInstall: true` 时，按 `install` 声明的方法列表依次尝试安装。对于 `type: "npm"` 的安装方法，若 `npm` 不在 PATH 上，自动检测并回退到 `pnpm`/`yarn`/`bun`；若无任何 JS 包管理器，跳过该方法尝试下一个。`resolvePackage` 的二进制依赖同理通过 `ensureResolvePackageAvailable()` 自动安装。
>
> 实现参考：`packages/core/src/domain/backend/backend-installer.ts`

#### MaterializationSpec（#158 新增）

声明式 workspace 物化规范。存储在 `BackendDefinition.materialization`，JSON 可序列化，可通过 actant-hub 分发。当 `WorkspaceBuilder` 找不到手写的 `BackendBuilder` 时，会自动基于此 spec 创建 `DeclarativeBuilder`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `configDir` | `string` | **是** | 配置根目录（相对 workspaceDir，如 `.cursor`、`.claude`、`.pi`） |
| `components` | `object` | **是** | 各组件类型的物化策略（见下方子表） |
| `scaffoldDirs` | `string[]` | 否 | scaffold 阶段创建的目录列表 |
| `verifyChecks` | [`VerifyCheckSpec[]`](#verifycheckspec) | 否 | verify 阶段检查的路径列表 |

**components 子字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `skills` | `SkillMaterializationStrategy` | Skill 物化策略（`mode`: `"single-file"` / `"per-file"` / `"dual"`） |
| `prompts` | `PromptMaterializationStrategy` | Prompt 物化策略（`mode`: `"merged"` / `"per-file"`） |
| `mcpServers` | `McpMaterializationStrategy` | MCP 物化策略（`enabled` + `outputFile`） |
| `plugins` | `PluginMaterializationStrategy` | Plugin 物化策略（`format`: `"recommendations"` / `"entries"`） |
| `permissions` | `PermissionMaterializationStrategy` | 权限注入策略（`mode`: `"full"` / `"tools-only"` / `"best-effort"`） |
| `workflow` | `WorkflowMaterializationStrategy` | Workflow 输出路径 |

**各内置后端 MaterializationSpec**：

| 后端 | configDir | skills mode | prompts mode | MCP | plugins format | permissions mode |
|------|-----------|-------------|-------------|-----|---------------|-----------------|
| `cursor` | `.cursor` | `dual` (.mdc + AGENTS.md) | `merged` | 启用 | `recommendations` | `best-effort` |
| `cursor-agent` | `.cursor` | 同 cursor | 同 cursor | 启用 | `recommendations` | `best-effort` |
| `claude-code` | `.claude` | `single-file` (AGENTS.md + CLAUDE.md) | `merged` | 启用 | `entries` | `full` |
| `pi` | `.pi` | `dual` (.md + AGENTS.md) | `per-file` | 禁用 | 禁用 | `tools-only` |
| `custom` | `.cursor` | 同 cursor | 同 cursor | 启用 | `recommendations` | `best-effort` |

> 实现参考：`packages/shared/src/types/template.types.ts`（类型定义），`packages/core/src/builder/declarative-builder.ts`（通用 builder），`packages/core/src/manager/launcher/builtin-backends.ts`（各后端 spec）

#### VerifyCheckSpec

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | `string` | **是** | 检查路径（相对 workspaceDir） |
| `type` | `"file" \| "dir"` | **是** | 期望类型 |
| `severity` | `"error" \| "warning"` | 否 | 缺失严重度（默认 `"warning"`） |

#### PlatformCommand

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `win32` | `string` | 否 | Windows 可执行文件（如 `cursor.cmd`） |
| `default` | `string` | **是** | 其他平台的默认可执行文件（如 `cursor`） |

#### BackendExistenceCheck

用于编程验证后端可执行文件是否已安装。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `command` | `string` | **是** | 验证命令（如 `cursor`、`claude`） |
| `args` | `string[]` | 否 | 命令参数（默认 `["--version"]`） |
| `expectedExitCode` | `number` | 否 | 期望的退出码（默认 `0`） |
| `versionPattern` | `string` | 否 | 正则表达式，从 stdout 提取版本号 |

#### BackendInstallMethod

描述后端可执行文件的安装方式。支持多种安装渠道，按 `platforms` 过滤当前平台适用的方法。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"npm" \| "brew" \| "winget" \| "choco" \| "url" \| "manual"` | **是** | 安装方式类型 |
| `package` | `string` | 否 | 包名（适用于 `npm`, `brew`, `winget`, `choco`）或 URL（适用于 `url`） |
| `platforms` | `NodeJS.Platform[]` | 否 | 适用的操作系统平台（省略则表示全平台） |
| `label` | `string` | 否 | 简短安装提示（CLI 错误信息中展示） |
| `instructions` | `string` | 否 | 详细安装说明 |

#### OpenSpawnOptions

直接映射 Node.js `SpawnOptions` 子集，CLI 零逻辑 spread。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `stdio` | `"inherit" \| "ignore"` | `"ignore"` | 透传 `SpawnOptions.stdio` |
| `detached` | `boolean` | `true` | 透传 `SpawnOptions.detached` |
| `windowsHide` | `boolean` | `true` | 透传 `SpawnOptions.windowsHide` |
| `shell` | `boolean` | `false` | 透传 `SpawnOptions.shell` |

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

### SystemBudgetConfig（PR #253 新增）

`SystemBudgetManager` 追踪 **Service Agent**（`acp-service`）的运行时长，动态调整 keepAlive 窗口并在预算耗尽时自动停止。Employee Agent（`acp-background`）不受预算管理，始终无条件重启。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ceilingHours` | `number` | `Infinity` | 每个周期允许的最大 agent-hours 总量。`Infinity` 禁用上限 |
| `period` | `"daily" \| "monthly"` | `"daily"` | 预算统计周期 |
| `baseKeepAliveMs` | `number` | `3_600_000`（1h） | Service Agent 基础存活时长（ms）。预算使用率 ≥ `extendThreshold` 时生效 |
| `extendedKeepAliveMs` | `number` | `86_400_000`（1d） | 预算充足（使用率 < `extendThreshold`）时的扩展存活时长（ms） |
| `extendThreshold` | `number` | `0.5` | 使用率阈值（0~1），低于此值时使用 `extendedKeepAliveMs` |
| `hardCeilingThreshold` | `number` | `0.95` | 硬上限阈值。使用率 ≥ 此值时，Service Agent 不再重启且立即停止运行中实例 |

**运行逻辑**：
- `recordStart(name)` / `recordStop(name)` 追踪每个 Agent 的运行时段
- `startKeepAliveTimer(name)` 在 Agent 启动时设置定时器，到期后触发 `onKeepAliveExpired` 回调由 `AgentManager` 处理自动停止
- 周期切换时（日/月跨越），自动 roll over 重置消耗记录
- `getSnapshot()` 返回 `BudgetSnapshot`（当前 periodKey、consumedHours、usageRatio、effectiveKeepAliveMs 等）

> 实现参考：`packages/core/src/budget/system-budget-manager.ts`，类型定义：`packages/shared/src/types/budget.types.ts`

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
| `ACTANT_PROVIDER_TYPE` | `ACTANT_PROVIDER` 的别名（优先级更高） | 无 |
| `ACTANT_MODEL` | 统一 LLM 模型名称（如 `gpt-4o`、`claude-sonnet-4-20250514`） | 无 |
| `ACTANT_API_KEY` | 统一 API 密钥（由 Daemon 从 config.json 注入，fallback 到 provider-specific 变量） | 无 |
| `ACTANT_BASE_URL` | Provider API 端点（由 Daemon 从 config.json 注入） | 无 |
| `ACTANT_PROVIDER_BASE_URL` | `ACTANT_BASE_URL` 的别名（优先级更高） | 无 |
| `ACTANT_PROVIDER_PROTOCOL` | 覆盖 Provider API 协议（`openai` / `anthropic` / `custom`） | 按 type 自动推断 |
| `ACTANT_THINKING_LEVEL` | 统一 thinking/reasoning 级别 | 无 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥（兼容 fallback，推荐使用 `ACTANT_API_KEY`） | 无 |
| `ANTHROPIC_BASE_URL` | Anthropic API 端点（兼容 fallback） | 无 |
| `OPENAI_API_KEY` | OpenAI API 密钥（兼容 fallback，适用于 openai/deepseek） | 无 |
| `OPENAI_BASE_URL` | OpenAI API 端点（兼容 fallback，适用于 openai/deepseek） | 无 |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API 密钥（兼容 fallback） | 无 |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 端点（兼容 fallback） | 无 |
| `LOG_LEVEL` | Pino 日志级别 | `"info"`（CLI 中未设置时为 `"silent"`） |

### Provider 环境变量解析优先级（#133）

模板省略 `provider` 字段时，Actant 会依次查找环境变量和 Registry 默认值：

```
模板 provider 字段（显式配置）
  ↓ 未设置
ACTANT_PROVIDER_TYPE / ACTANT_PROVIDER（环境变量）
  ↓ 未设置
Registry 默认 Provider（actant setup 配置）
  ↓ 未设置
undefined（无 Provider）
```

**API Key 解析优先级**（用于 ACP 子进程注入）：

```
Registry descriptor.apiKey（config.json 加载）
  ↓ 未设置
ACTANT_API_KEY
  ↓ 未设置
上游原生变量（ANTHROPIC_API_KEY / OPENAI_API_KEY 等，按 provider type）
```

**Base URL 解析优先级**：

```
模板 providerConfig.baseUrl
  ↓ 未设置
Registry descriptor.defaultBaseUrl
  ↓ 未设置
上游原生变量（OPENAI_BASE_URL 等，按 provider type）
```

> **安全提示**：API Key 不要写入模板文件。推荐使用 `.env` + gitignore 或系统环境变量。
>
> 实现参考：`packages/core/src/provider/provider-env-resolver.ts`

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

### 后端感知的环境变量注入（#141 Phase 2 + #158，已实现）

不同后端的 ACP 子进程期望不同的环境变量。`BackendManager.registerBuildProviderEnv()` 策略让各后端自描述所需的原生变量映射，AgentManager 启动时查表调用。

| 后端 | 注入的变量 | 注册位置 |
|------|-----------|---------|
| Pi（自有 bridge） | `ACTANT_PROVIDER`、`ACTANT_MODEL`、`ACTANT_API_KEY`、`ACTANT_BASE_URL` | `app-context.ts` |
| Claude Code（第三方） | `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL` | `builtin-backends.ts` |
| 未注册 `buildProviderEnv` 的后端 | `ACTANT_*`（默认 fallback `buildDefaultProviderEnv`） | `agent-manager.ts` |

> **自动注入**：`actant setup` 配置的 Provider 信息（type、apiKey、baseUrl）持久化到 `~/.actant/config.json`。Daemon 启动时将 `config.json` 中的密钥加载到内存 Registry，启动 ACP 子进程时通过 `getBuildProviderEnv(backendType)`（或 fallback `buildDefaultProviderEnv`）注入环境变量。**密钥安全模型**：API Key 仅存在于 `config.json`（用户目录）和 Daemon 进程内存（Registry），不写入 Agent workspace 的任何文件（template、`.actant.json`），确保 LLM Agent 无法通过文件系统读取密钥。

---

## 12. Memory 配置（Phase 4/5 预定） 🚧

> 状态：**预定设计** — 实际开发前须重新审查
>
> **⚠️ 存储后端待讨论**：是否引入 LanceDB 或其他向量数据库尚未最终确认。
> 以下类型定义作为设计参考，`@agent-memory/core` 的接口层不依赖任何具体存储后端。

### MemoryRecord — 记忆记录（预定）

```typescript
interface MemoryRecord {
  uri: string;            // ac://<layer>/<namespace>/<path> 格式
  content: string;
  kind: MemoryKind;
  vector?: number[];      // embedding 向量（维度待定）
  confidence: number;     // 0.0 ~ 1.0
  contentHash: string;    // SHA-256, 用于去重和 promote 判断
  source: MemorySource;
  createdAt: string;      // ISO timestamp
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

type MemoryKind = 'insight' | 'error-pattern' | 'decision' | 'preference' | 'task-summary';

type MemorySource = {
  type: 'extraction' | 'promotion' | 'manual';
  sessionId?: string;
  agentName?: string;
};
```

### URI 安全校验规则

| 规则 | 说明 |
|------|------|
| Scheme | 只允许 `ac://` |
| 路径遍历 | 拒绝 `..`、`~`、绝对路径组件 |
| 查询安全 | 使用参数化绑定，不拼接 URI 到查询语句 |
| 长度限制 | 最大 512 字符 |

### 三层记忆架构（预定）

| Layer | URI 前缀 | 存储位置 | 作用域 |
|-------|---------|---------|-------|
| Instance | `ac://instance/<name>/` | `{instanceDir}/.memory/` | 单个 Agent 实例 |
| Template | `ac://template/<name>/` | `{ACTANT_HOME}/memory/template/` | 同模板的所有实例共享 |
| Actant | `ac://actant/` | `{ACTANT_HOME}/memory/actant/` | 全局共享 |

### Embedding 配置（预定）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider` | `'openai' \| 'onnx' \| 'none'` | 待定 | Embedding 提供者（ONNX 可行性待验证） |
| `model` | `string` | 待定 | 模型名称 |
| `dimensions` | `number` | 待定 | 向量维度 |
| `maxBatchSize` | `number` | `64` | 单次 batch 最大条数 |
| `maxPerSession` | `number` | `200` | 单 session 最大 embedding 次数 |

---

## 13. SubsystemDefinition — 子系统定义（Phase 4 新增） 🚧

> 状态：**规范已定义** — 详见 [subsystem-design.md](../../docs/design/subsystem-design.md)

Subsystem 是绑定到特定 Outer（宿主）的可热插拔功能模块，四种作用域对应不同生命周期。

### SubsystemDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 子系统唯一名称 |
| `scope` | `SubsystemScope` | **是** | 作用域 |
| `description` | `string` | 否 | 人类可读描述 |
| `dependencies` | `string[]` | 否 | 依赖的其他子系统名称 |
| `defaultEnabled` | `boolean` | 否 | 默认是否启用（默认 `true`） |

### SubsystemScope

| 值 | Outer 实体 | 生命周期 | UE5 等价物 |
|----|-----------|---------|-----------|
| `"actant"` | Daemon 进程 | daemon start → stop | `UEngineSubsystem` |
| `"instance"` | AgentInstance | create → destroy | `UGameInstanceSubsystem` |
| `"process"` | AgentProcess | process start → stop | `UWorldSubsystem` |
| `"session"` | AcpSession | session start → end | `ULocalPlayerSubsystem` |

### SubsystemRef（AgentTemplate 或 AppConfig 中引用）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 子系统名称 |
| `enabled` | `boolean` | 否 | 是否启用（覆盖 `defaultEnabled`） |
| `config` | `Record<string, unknown>` | 否 | 传递给子系统的运行时配置 |

### 四种注册途径

| 途径 | 发起者 | 生命周期 | 典型场景 |
|------|--------|---------|---------|
| Builtin | 系统代码 | 永久 | EmployeeScheduler、AutoStart |
| Plugin | Plugin 声明 | Plugin 启用期间 | Memory、Monitor |
| User Config | 模板 JSON | 实例存活期间 | 自定义定时检查 |
| Agent Self | Agent CLI 注册 | Ephemeral（进程存活期间） | 动态注册轮询 |

---

## 变更约定

> 对本文档所定义的任何配置结构、字段、枚举值或环境变量进行增删改时，**必须先更新本文档，再修改代码**，并在同一次提交中完成。
