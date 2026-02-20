# 配置规范 (Configuration Specification)

> 本文档定义 AgentCraft 中所有配置结构、Schema 和环境变量。
> **代码必须符合此规范。若代码与此文档冲突，以本文档为准。**

---

## 概述

AgentCraft 的配置体系分为三层：

```
AgentTemplate          用户编写的模板文件，定义 Agent 的组成
    │
    │  validate + create
    ▼
AgentInstanceMeta      运行时实例的持久化状态（.agentcraft.json）
    │
    │  resolve
    ▼
AppConfig              守护进程的运行时配置（路径、环境变量）
```

所有配置在入口处使用 **Zod** 进行运行时校验。TypeScript 类型从 Zod Schema 推导或手动对齐。

---

## 1. AgentTemplate — 模板配置

模板是用户定义 Agent 组成的核心配置文件。JSON 格式，通过 CLI 加载。

> 实现参考：`packages/shared/src/types/template.types.ts`, `packages/core/src/template/schema/template-schema.ts`

### 顶层结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 模板唯一名称（1–100 字符） |
| `version` | `string` | **是** | 语义化版本号（`x.y.z`） |
| `description` | `string` | 否 | 人类可读描述 |
| `backend` | [`AgentBackendConfig`](#agentbackendconfig) | **是** | Agent 后端运行时 |
| `provider` | [`ModelProviderConfig`](#modelproviderconfig) | **是** | 模型提供商 |
| `domainContext` | [`DomainContextConfig`](#domaincontextconfig) | **是** | 领域上下文组合 |
| `initializer` | [`InitializerConfig`](#initializerconfig) | 否 | 自定义初始化流程 |
| `metadata` | `Record<string, string>` | 否 | 任意键值元数据 |

### AgentBackendConfig

定义 Agent 使用的后端运行时（IDE/CLI）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `AgentBackendType` | **是** | 后端类型 |
| `config` | `Record<string, unknown>` | 否 | 后端特定配置 |

#### AgentBackendType

| 值 | 说明 |
|----|------|
| `"cursor"` | Cursor IDE |
| `"claude-code"` | Claude Code CLI |
| `"custom"` | 用户自定义可执行程序 |

#### config 可用字段

| 字段 | 适用类型 | 说明 |
|------|---------|------|
| `executablePath` | 全部 | 覆盖平台默认可执行路径 |
| `args` | `custom` | 自定义启动参数（不设则默认 `[workspaceDir]`） |

### ModelProviderConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `ModelProviderType` | **是** | `"anthropic"` \| `"openai"` \| `"custom"` |
| `config` | `Record<string, unknown>` | 否 | 提供商特定配置 |

### DomainContextConfig

通过名称引用组合 Agent 的领域上下文。所有字段均为**引用**，不内嵌完整配置。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `skills` | `string[]` | `[]` | Skill 名称列表 |
| `prompts` | `string[]` | `[]` | Prompt 名称列表 |
| `mcpServers` | [`McpServerRef[]`](#mcpserverref) | `[]` | MCP 服务器引用 |
| `workflow` | `string` | — | Workflow 名称 |
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

### 示例

```json
{
  "name": "code-review-agent",
  "version": "1.0.0",
  "description": "Code review specialist",
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
    "workflow": "review-workflow"
  }
}
```

---

## 2. AgentInstanceMeta — 实例元数据

实例创建后持久化为 `{instanceDir}/.agentcraft.json`，记录实例的完整运行时状态。

> 实现参考：`packages/shared/src/types/agent.types.ts`, `packages/core/src/state/instance-meta-schema.ts`

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | `string` | **是** | — | 实例 UUID |
| `name` | `string` | **是** | — | 实例名称 |
| `templateName` | `string` | **是** | — | 来源模板名 |
| `templateVersion` | `string` | **是** | — | 来源模板版本 |
| `backendType` | `AgentBackendType` | **是**\* | `"cursor"` | 后端类型（创建时从模板写入） |
| `backendConfig` | `Record<string, unknown>` | 否 | — | 后端配置快照（创建时从模板写入） |
| `status` | [`AgentStatus`](#agentstatus) | **是** | — | 当前生命周期状态 |
| `launchMode` | [`LaunchMode`](#launchmode) | **是** | — | 启动模式 |
| `workspacePolicy` | [`WorkspacePolicy`](#workspacepolicy) | **是** | `"persistent"` | workspace 生命周期策略 |
| `processOwnership` | [`ProcessOwnership`](#processownership) | 否 | — | 进程管理方（运行时字段） |
| `createdAt` | `string` | **是** | — | ISO 8601 创建时间 |
| `updatedAt` | `string` | **是** | — | ISO 8601 更新时间 |
| `pid` | `number` | 否 | — | 运行时 OS 进程 ID |
| `metadata` | `Record<string, string>` | 否 | — | 任意元数据 |

\* Zod Schema 中标记 optional 以兼容旧文件；读取时缺失则默认 `"cursor"`。

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

**`error` vs `crashed` 的区别**：`error` 发生在 AgentCraft 主动操作（start/stop）过程中；`crashed` 发生在 Agent 正常运行期间，由 ProcessWatcher 通过 PID 监控发现。对于 `processOwnership: "external"` 的 Agent，若 ProcessWatcher 发现 PID 不存在但客户端未 detach，状态变为 `crashed`。

### LaunchMode

定义 Agent 进程的生命周期语义。

| 值 | 生命周期所有者 | 场景 |
|----|--------------|------|
| `"direct"` | 用户 | 直接打开 IDE / TUI |
| `"acp-background"` | 调用方 | 外部客户端通过 ACP 管理 |
| `"acp-service"` | AgentCraft | 持久化员工 Agent，崩溃自动重启 |
| `"one-shot"` | AgentCraft | 执行后自动终止，可选自动清理 workspace |

### WorkspacePolicy

定义 workspace（文件系统）的生命周期策略。**独立于进程生命周期**。

| 值 | 说明 | 典型 LaunchMode |
|----|------|----------------|
| `"persistent"` | workspace 持久保留，多次 spawn 复用 | `direct`, `acp-service` |
| `"ephemeral"` | 任务完成后可清理 workspace | `one-shot` |

### ProcessOwnership

运行时字段，标识当前进程由谁管理。仅在 `status` 为 `running` / `crashed` 时有值。

| 值 | 说明 | 谁 spawn 的 | AgentCraft 能做什么 |
|----|------|-----------|-------------------|
| `"managed"` | AgentCraft Daemon spawn 的 | Daemon | 发 ACP 消息、重启、终止 |
| `"external"` | 外部客户端 spawn 的（通过 `agent.attach` 注册） | 外部客户端 | PID 监控、状态追踪，**不能**发 ACP 消息 |

---

## 3. Domain Context 组件定义

领域上下文由四类组件组成，通过名称引用、由 Manager 统一管理。

> 实现参考：`packages/shared/src/types/domain-component.types.ts`, `packages/core/src/domain/`

### SkillDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 唯一名称 |
| `description` | `string` | 否 | 描述 |
| `content` | `string` | **是** | 规则/知识内容 |
| `tags` | `string[]` | 否 | 分类标签 |

### PromptDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 唯一名称 |
| `description` | `string` | 否 | 描述 |
| `content` | `string` | **是** | 提示词文本（支持 `{{variable}}` 插值） |
| `variables` | `string[]` | 否 | 声明的变量名 |

### WorkflowDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 唯一名称 |
| `description` | `string` | 否 | 描述 |
| `content` | `string` | **是** | 工作流内容 |

### McpServerDefinition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 服务器标识符 |
| `description` | `string` | 否 | 描述 |
| `command` | `string` | **是** | 可执行命令 |
| `args` | `string[]` | 否 | 命令参数 |
| `env` | `Record<string, string>` | 否 | 环境变量 |

---

## 4. AppConfig — 应用运行时配置

守护进程启动时的配置项，决定数据存储位置和运行模式。

> 实现参考：`packages/api/src/services/app-context.ts`

### 配置字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `homeDir` | `string` | `~/.agentcraft` | 数据根目录 |
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

## 5. 平台与 IPC

### Socket 路径规则

| 平台 | 默认路径 | 自定义 homeDir |
|------|---------|---------------|
| macOS / Linux | `~/.agentcraft/agentcraft.sock` | `{homeDir}/agentcraft.sock` |
| Windows | `\\.\pipe\agentcraft` | `\\.\pipe\agentcraft-{safeName}` |

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

## 6. 后端解析规则

根据 `backendType` 确定可执行命令和启动参数。

### 平台默认可执行路径

| backendType | macOS / Linux | Windows |
|-------------|--------------|---------|
| `cursor` | `cursor` | `cursor.cmd` |
| `claude-code` | `claude` | `claude.cmd` |
| `custom` | 必须通过 `backendConfig.executablePath` 指定 | 同左 |

### 覆盖机制

- `backendConfig.executablePath` → 覆盖平台默认命令
- `backendConfig.args`（仅 `custom`）→ 自定义启动参数；未设则默认 `[workspaceDir]`
- `cursor` / `claude-code` 默认参数为 `["--workspace", workspaceDir]`

> 实现参考：`packages/core/src/manager/launcher/backend-resolver.ts`

---

## 7. EnvChannel — 环境请求路由

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

## 8. ProxySession — Proxy 会话状态

Daemon 侧维护的 ACP Proxy 连接状态（运行时，不持久化）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `sessionId` | `string` | 唯一会话 ID |
| `agentName` | `string` | 关联的 Agent 实例名 |
| `envPassthrough` | `boolean` | 是否开启环境穿透 |
| `rpcChannel` | `JsonRpcChannel` | Proxy ↔ Daemon 的 RPC 连接 |
| `connectedAt` | `string` | ISO 8601 连接时间 |

---

## 9. 环境变量

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `AGENTCRAFT_SOCKET` | 覆盖 IPC Socket 路径 | 平台默认 |
| `AGENTCRAFT_LAUNCHER_MODE` | 设定 Launcher 模式（`"mock"` / `"real"`） | `"real"` |
| `LOG_LEVEL` | Pino 日志级别 | `"info"`（CLI 中未设置时为 `"silent"`） |

---

## 变更约定

> 对本文档所定义的任何配置结构、字段、枚举值或环境变量进行增删改时，**必须先更新本文档，再修改代码**，并在同一次提交中完成。
