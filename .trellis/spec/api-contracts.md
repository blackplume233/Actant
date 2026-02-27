# 接口契约 (API Contracts)

> 本文档定义 Actant 的所有对外接口：IPC 协议、RPC 方法、CLI 命令、ACP Proxy 协议和 MCP Server 能力。
> **代码必须符合此契约。若代码行为与此文档不一致，以本文档为准。**

---

## 概述

Actant 的接口架构（三层协议分工）：

```
     管理操作 (RPC)             Agent-to-Agent (Email)       实时交互 (ACP)

  CLI (actant)              CLI (actant email)      外部 ACP Client (IDE/Desktop)
        │                         │                            │
  RpcClient (JSON-RPC 2.0)  RpcClient (email.*)          ACP / stdio
        │                         │                            │
  Unix Socket / Named Pipe   Unix Socket              ACP Proxy (薄层 stdio↔socket)
        │                         │                            │
        │                         │                      ACP / Unix socket
        │                         │                            │
        │                         │                  agent chat (内置 ACP Client)
        │                         │                            │
        └─────────────────┬───────┴────────────────────────────┘
                          │
              ┌───────────▼───────────────────────┐
              │        Actant Core (Daemon)        │
              │                                    │
              │  RPC: HandlerRegistry              │
              │   ├─ Agent/Template/Domain/Daemon  │
              │   ├─ Hook handlers (subscribe/list)│
              │   ├─ Email handlers (#136)         │
              │   └─ Proxy(legacy) handlers        │
              │                                    │
              │  Email Hub: 路由 + 投递 + 持久化    │
              │                                    │
              │  ACP Gateway: Session 多路复用      │
              │   ├─ AgentSideConnection (面向上游) │
              │   └─ ClientSideConnection (面向下游)│
              └───────────────┬────────────────────┘
                              │ ACP / stdio (唯一连接)
                              ▼
                       Agent 子进程
                       (claude-agent-acp)
```

> 详细场景分析参见 [Agent 启动场景与 ACP 架构](../../docs/design/agent-launch-scenarios.md)

### 协议分工

| 协议层 | 传输 | 用途 | 场景 |
|--------|------|------|------|
| **JSON-RPC 2.0** | Unix socket, request/response | 管理操作：create/start/stop/list/resolve/attach/detach | 所有场景 |
| **ACP** | Unix socket (上游) / stdio (下游), streaming | 实时交互：prompt/stream/cancel/notifications | Agent start + chat/proxy |
| **Email (JSON-RPC)** | Unix socket, async | Agent-to-Agent 异步通信（#136, P1 通道） | Agent 协作、任务委派 |
| **MCP / stdio** | stdio | Agent-to-Agent 通信（#16, P4 可选） | IDE 内 Agent 调用 |

**核心原则**：RPC 层处理管理操作，ACP Gateway 层处理实时交互。不存在"用 RPC 传 ACP 消息"的错位。

### 四种外部接入模式

| 模式 | 协议 | 适用场景 | 参见 |
|------|------|---------|------|
| **CLI** | JSON-RPC via Socket | 开发者 / 脚本自动化 | §4 |
| **ACP Proxy** | ACP / stdio → ACP Gateway | IDE / 应用接入托管 Agent | §7 |
| **agent chat** | ACP / Unix socket → ACP Gateway | 终端交互式聊天（流式） | §4.2, §7 |
| **Email (Agent-to-Agent)** | JSON-RPC (email.*) | Agent 间异步 Email 通信（#136） | §8 |
| **MCP Server (P4)** | MCP / stdio | 可选 MCP 接入（#16） | §8.6 |
| **Self-spawn + Attach** | JSON-RPC via Socket | 外部客户端自己 spawn Agent，注册到 Actant | §3.3 |

- **传输层**：JSON-RPC 2.0，换行分隔，通过 Unix Socket（Windows Named Pipe）
- **客户端超时**：默认 10 秒（普通管理操作）；`agent.prompt`/`agent.run`/`session.prompt` 等长耗时 RPC 需调用方显式传入更长超时
- **Socket 路径**：`ACTANT_SOCKET` 环境变量或平台默认值（详见 [配置规范](./config-spec.md#5-平台与-ipc)）

---

## 1. JSON-RPC 2.0 协议

### 请求

```json
{
  "jsonrpc": "2.0",
  "id": <number | string>,
  "method": "<namespace>.<action>",
  "params": { ... }
}
```

### 成功响应

```json
{
  "jsonrpc": "2.0",
  "id": <id>,
  "result": <method-specific>
}
```

### 错误响应

```json
{
  "jsonrpc": "2.0",
  "id": <id>,
  "error": {
    "code": <number>,
    "message": "<human-readable>",
    "data": {
      "errorCode": "<CONSTANT_NAME>",
      "context": { ... }
    }
  }
}
```

`error.data.errorCode` 对应 `ActantError.code`，`error.data.context` 携带结构化调试信息。

---

## 2. 错误码

### 协议级错误（JSON-RPC 标准）

| 常量 | 值 | 说明 |
|------|-----|------|
| `PARSE_ERROR` | -32700 | 无效 JSON |
| `INVALID_REQUEST` | -32600 | 非法 JSON-RPC 2.0 请求 |
| `METHOD_NOT_FOUND` | -32601 | 未知方法 |
| `INVALID_PARAMS` | -32602 | 参数无效 |
| `INTERNAL_ERROR` | -32603 | 未处理的服务端错误 |

### 业务级错误

| 常量 | 值 | 说明 |
|------|-----|------|
| `GENERIC_BUSINESS` | -32000 | 未分类业务错误 |
| `TEMPLATE_NOT_FOUND` | -32001 | 模板不存在 |
| `CONFIG_VALIDATION` | -32002 | Schema 校验失败 |
| `AGENT_NOT_FOUND` | -32003 | Agent 实例不存在 |
| `AGENT_ALREADY_RUNNING` | -32004 | Agent 已在运行 |
| `WORKSPACE_INIT` | -32005 | 工作区初始化失败 |
| `COMPONENT_REFERENCE` | -32006 | 领域组件引用失败 |
| `INSTANCE_CORRUPTED` | -32007 | 实例元数据损坏 |
| `AGENT_LAUNCH` | -32008 | 后端进程启动失败 |
| `AGENT_ALREADY_ATTACHED` | -32009 | 实例已被外部进程 attach |
| `AGENT_NOT_ATTACHED` | -32010 | 实例未被 attach（detach 时） |
| `PROXY_SESSION_CONFLICT` | -32011 | Proxy session 冲突（同名 Agent 已有活跃 Proxy） |
| `HOOK_EVENT_NOT_SUBSCRIBABLE` | -32012 | 事件不允许 Agent 自注册（订阅模型 C 不支持） |
| `HOOK_SUBSCRIPTION_NOT_FOUND` | -32013 | 动态订阅 ID 不存在 |
| `SUBSYSTEM_NOT_FOUND` | -32014 | 子系统不存在 |

**映射规则**：`ActantError` 子类在 Socket Server 边界处映射为对应 RPC 错误码；未映射的异常一律返回 `INTERNAL_ERROR`。

> 实现参考：`packages/shared/src/types/rpc.types.ts`

---

## 3. RPC 方法

### 3.1 模板管理

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `template.list` | `{}` | `AgentTemplate[]` | — |
| `template.get` | `{ name }` | `AgentTemplate` | `TEMPLATE_NOT_FOUND` |
| `template.load` | `{ filePath }` | `AgentTemplate` | `CONFIG_VALIDATION` |
| `template.unload` | `{ name }` | `{ success }` | — |
| `template.validate` | `{ filePath }` | `{ valid, template?, errors?, warnings? }` | — |

#### template.validate 返回值（#119 增强）

除 `valid`、`template`、`errors` 外，新增 `warnings` 字段。执行两层校验：
1. **Schema 校验** — Zod 结构验证，失败时 `valid: false` + `errors`
2. **语义校验** — 通过 `validateTemplate()` 执行跨字段检查，结果写入 `warnings`

```typescript
interface TemplateValidateResult {
  valid: boolean;
  template?: AgentTemplate;
  errors?: Array<{ path: string; message: string }>;
  warnings?: Array<{ path: string; message: string }>;
}
```

CLI `template validate <file>` 输出格式：
- 校验通过时：`Valid — <name>@<version>`，有警告时逐条输出
- 校验失败时：显示错误列表

> 实现参考：`packages/api/src/handlers/template-handlers.ts`，`packages/cli/src/commands/template/validate.ts`

### 3.2 Agent 生命周期

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.create` | `{ name, template, overrides? }` | `AgentInstanceMeta` | `TEMPLATE_NOT_FOUND`, `CONFIG_VALIDATION`, `WORKSPACE_INIT`, `COMPONENT_REFERENCE` |
| `agent.start` | `{ name, autoInstall? }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND`, `AGENT_ALREADY_RUNNING`, `AGENT_LAUNCH`, `INTERACTION_MODE` |
| `agent.stop` | `{ name }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND` |
| `agent.destroy` | `{ name }` | `{ success }` | `AGENT_NOT_FOUND`, `INSTANCE_CORRUPTED` |
| `agent.status` | `{ name }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND` |
| `agent.list` | `{}` | `AgentInstanceMeta[]` | — |
| `agent.updatePermissions` | `{ name, permissions }` | `{ effectivePermissions }` | `AGENT_NOT_FOUND` |

#### agent.create 的 overrides 参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `launchMode` | `LaunchMode` | 覆盖模板默认启动模式 |
| `workspacePolicy` | `WorkspacePolicy` | 覆盖默认 workspace 策略 |
| `workDir` | `string` | 自定义 workspace 绝对路径（省略则默认 `{instancesDir}/{name}`） |
| `workDirConflict` | `"error" \| "overwrite" \| "append"` | workDir 已存在时的行为，默认 `"error"` |
| `archetype` | `AgentArchetype` | 覆盖模板管理深度分类（`repo` / `service` / `employee`） |
| `autoStart` | `boolean` | 覆盖 archetype 推导的 autoStart 默认值 |
| `permissions` | `PermissionsInput` | 覆盖模板权限配置，完全替代 `template.permissions` |
| `metadata` | `Record<string, string>` | 额外元数据 |

#### agent.updatePermissions

运行时更新 Agent 实例的工具权限策略。同时刷新双层权限：
- **Layer 1**：重写后端 settings 文件（`settings.local.json` / `settings.json`）
- **Layer 2**：热更新 ACP Client 的 `PermissionPolicyEnforcer` allowlist

`permissions` 参数类型为 `PermissionsInput`，可以是预设名（`"permissive"` | `"standard"` | `"restricted"` | `"readonly"`）或完整的 `PermissionsConfig` 对象。

返回值包含解析后的 `effectivePermissions: PermissionsConfig`。

**workDir 机制**：当指定 `workDir` 时，域上下文文件和 `.actant.json` 写入该目录，同时在 `{instancesDir}/{name}` 创建指向它的链接以供 Manager 发现（macOS/Linux 使用 symlink，Windows 使用 junction）。Destroy 时仅移除链接和 `.actant.json`，保留用户目录中的其余文件。

#### autoInstall 参数（#153）

`agent.start`、`agent.resolve`、`agent.open` 均支持可选的 `autoInstall?: boolean` 参数。当 `true` 时，Daemon 在 spawn 前执行 `BackendManager.ensureAvailable()`，按 `BackendDefinition.install` 声明的方法列表自动安装缺失的后端 CLI 依赖。

安装策略（按优先级）：
1. 对 `type: "npm"` 方法，自动检测可用的 JS 包管理器：`npm` → `pnpm` → `yarn` → `bun`。若无任何 JS 包管理器可用，跳过此方法。
2. 对 `type: "brew"/"winget"/"choco"` 方法，仅在对应平台且命令可用时尝试。
3. `type: "url"` / `"manual"` 不自动执行，其说明文字包含在错误信息中供用户参考。

安装成功后自动 re-check 验证；失败时抛出 `AGENT_LAUNCH` 错误并附带详细的失败原因和手动安装指引。

CLI 标志：
- `--auto-install`：设置 `autoInstall: true`
- `--no-install`：设置 `autoInstall: false`（禁止自动安装，仅报错）
- 未指定：`autoInstall` 为 `undefined`（不尝试安装，报错并提示安装方法）

### 3.3 外部 Spawn 支持

供外部客户端（Unreal/Unity 等）自行 spawn Agent 进程，同时将状态注册到 Actant 进行跟踪。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.resolve` | `{ name, template?, autoInstall? }` | `ResolveResult` | `AGENT_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `WORKSPACE_INIT` |
| `agent.open` | `{ name, template?, autoInstall? }` | `AgentOpenResult` | `AGENT_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `AGENT_ALREADY_RUNNING`, `AGENT_LAUNCH` |
| `agent.attach` | `{ name, pid, metadata? }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND`, `AGENT_ALREADY_RUNNING`, `AGENT_ALREADY_ATTACHED` |
| `agent.detach` | `{ name, cleanup? }` | `DetachResult` | `AGENT_NOT_FOUND`, `AGENT_NOT_ATTACHED` |

#### agent.resolve

获取 spawn Agent 所需的全部信息，不启动进程。若实例不存在但提供了 `template`，则自动创建实例（含 workspace 物化）。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | Agent 实例名 |
| `template` | `string` | 否 | 若实例不存在，使用此模板自动创建 |
| `overrides` | `object` | 否 | 覆盖模板默认配置（见下表） |

**overrides 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `launchMode` | `LaunchMode` | 覆盖模板默认启动模式 |
| `workspacePolicy` | `WorkspacePolicy` | 覆盖默认 workspace 策略 |
| `metadata` | `Record<string, string>` | 额外元数据 |

**返回 `ResolveResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `instanceName` | `string` | 实例名 |
| `workspaceDir` | `string` | 已物化的 workspace 绝对路径 |
| `backendType` | `AgentBackendType` | 后端类型 |
| `command` | `string` | 可执行文件路径 |
| `args` | `string[]` | 启动参数（含 workspace 路径） |
| `env` | `Record<string, string>` | 推荐的环境变量 |
| `created` | `boolean` | 是否本次新建了实例 |

**典型流程：**

```
Client → agent.resolve({ name: "reviewer", template: "code-review" })
       ← { workspaceDir: "/.../.actant/instances/reviewer",
            command: "claude", args: ["--workspace", "..."], ... }
Client → 自行 spawn(command, args)
Client → agent.attach({ name: "reviewer", pid: 12345 })
```

#### agent.attach

告知 Actant 某个实例的进程已由外部客户端启动。Actant 将更新实例状态为 `running`，记录 PID，并开始 ProcessWatcher 监控。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 实例名 |
| `pid` | `number` | **是** | 外部 spawn 的进程 ID |
| `metadata` | `Record<string, string>` | 否 | 附加信息（如客户端 session ID） |

**行为：**
- **PID 验证**：通过 `process.kill(pid, 0)` 验证进程存在性。若 PID 不存在（`ESRCH`），抛出 `AGENT_LAUNCH` 错误
- 设置 `processOwnership: "external"`，`pid`，`status: "running"`
- 注册 ProcessWatcher 进行 PID 存活监控
- 若 ProcessWatcher 检测到 PID 死亡但客户端未 detach，状态变为 `"crashed"`

#### agent.detach

告知 Actant 外部客户端已停止某个实例的进程。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 实例名 |
| `cleanup` | `boolean` | 否 | `true` 时删除 ephemeral workspace（默认 `false`） |

**返回 `DetachResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | `boolean` | 操作是否成功 |
| `workspaceCleaned` | `boolean` | workspace 是否已清理 |

**行为：**
- 清除 `processOwnership`、`pid`，状态变为 `"stopped"`
- 若 `cleanup: true` 且 `workspacePolicy: "ephemeral"`，删除 workspace 目录并销毁实例

#### agent.open

打开 Agent 后端的原生 TUI（前台交互模式）。验证 `interactionModes` 包含 `"open"` 以及后端支持 `open` mode。支持通过 `template` 参数自动创建实例。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | Agent 实例名 |
| `template` | `string` | 否 | 模板名（实例不存在时自动创建） |

**返回 `AgentOpenResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | `string` | 实际执行的命令 |
| `args` | `string[]` | 命令参数 |
| `cwd` | `string?` | 工作目录 |
| `openSpawnOptions` | `OpenSpawnOptions?` | spawn 选项（stdio/detached/windowsHide/shell） |

**行为：**
- 若实例不存在且提供了 `template`，自动创建实例
- 通过 `requireInteractionMode(meta, "open")` 验证 Agent 支持 `open` 交互模式
- 若实例已在运行状态，抛出 `AGENT_ALREADY_RUNNING`
- 从 BackendRegistry 获取后端描述符，通过 `requireMode(type, "open")` 验证支持 `open` mode
- 使用描述符的 `openCommand` 解析为平台命令

**CLI 侧流程（`actant agent open <name> [-t template] [--no-attach]`）：**

```
CLI → agent.open({ name, template })
    ← { command, args, cwd, openSpawnOptions }
CLI → agent.attach({ name, pid })   (默认；--no-attach 跳过，失败降级为 warning)
CLI → spawn(command, args, { cwd, stdio: "inherit" })  (前台 TUI)
CLI → 等待进程退出
CLI → agent.detach({ name })        (如果 attach 了)
```

### 3.4 Agent 通信（MVP — print 模式） ✅ 已实现

> 状态：**已实现**（Phase 2 MVP）

通过 Agent 后端 CLI 的 print 模式（`claude -p`）发送 prompt 并接收 response。每次调用 spawn 一个独立进程，**不依赖** `agent.start` 启动的长驻进程。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.run` | `{ name, prompt, options? }` | `AgentRunResult` | `AGENT_NOT_FOUND` |

#### agent.run

向已创建的 Agent 发送单次 prompt，通过后端 CLI print 模式执行，返回完整结果。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 已创建的 Agent 实例名 |
| `prompt` | `string` | **是** | 发送给 Agent 的消息 |
| `options` | `object` | 否 | 可选配置（见下表） |

**options 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `systemPromptFile` | `string` | 系统提示词文件路径 |
| `appendSystemPrompt` | `string` | 追加到系统提示词的内容 |
| `sessionId` | `string` | 复用 claude-code session（`--resume`） |
| `timeoutMs` | `number` | 超时时间（默认 300000ms） |
| `maxTurns` | `number` | 最大 agentic turns |
| `model` | `string` | 指定模型（如 `claude-sonnet-4-20250514`） |

**返回 `AgentRunResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | Agent 回复内容 |
| `sessionId` | `string?` | 可复用的 session ID（用于后续 `agent.run` 延续上下文） |

**通信机制：**

```
CLI / 外部调用
    │
    │  agent.run RPC
    ▼
Daemon → AgentManager.runPrompt()
    │
    │  spawn("claude", ["-p", "--output-format", "json", prompt])
    │  cwd = agent workspace directory
    ▼
临时 claude -p 进程
    │
    │  stdout JSON: { result, session_id }
    ▼
返回 AgentRunResult
```

> **注意**：`agent.run` 不依赖 `agent.start`。它在 agent 的 workspace 目录下 spawn 独立的 `claude -p` 进程。`agent start` 启动的长驻进程用于未来 ACP Proxy 集成（Phase 3）。

> 实现参考：`packages/core/src/communicator/claude-code-communicator.ts`

### 3.5 Domain 组件管理 ✅ 已实现

> 状态：**已实现**（Phase 2 MVP + Phase 3a 增强）

查询、增删改 Daemon 已加载的领域组件（skills、prompts、MCP 配置、workflows、plugins）。组件定义在 Daemon 启动时从 `configs/` 目录自动加载。

#### 组件查询

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `skill.list` | `{}` | `SkillDefinition[]` | — |
| `skill.get` | `{ name }` | `SkillDefinition` | `CONFIG_NOT_FOUND` |
| `prompt.list` | `{}` | `PromptDefinition[]` | — |
| `prompt.get` | `{ name }` | `PromptDefinition` | `CONFIG_NOT_FOUND` |
| `mcp.list` | `{}` | `McpServerDefinition[]` | — |
| `mcp.get` | `{ name }` | `McpServerDefinition` | `CONFIG_NOT_FOUND` |
| `workflow.list` | `{}` | `WorkflowDefinition[]` | — |
| `workflow.get` | `{ name }` | `WorkflowDefinition` | `CONFIG_NOT_FOUND` |
| `plugin.list` | `{}` | `PluginDefinition[]` | — |
| `plugin.get` | `{ name }` | `PluginDefinition` | `CONFIG_NOT_FOUND` |

#### 组件 CRUD（Phase 3a 新增） ✅ 已实现

通用 CRUD 操作适用于所有组件类型。以 `plugin` 为例（`skill`/`prompt`/`mcp`/`workflow` 同理）：

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `plugin.add` | `{ filePath }` | `{ name, success }` | `CONFIG_VALIDATION` |
| `plugin.update` | `{ name, data }` | `{ name, success }` | `CONFIG_NOT_FOUND` |
| `plugin.remove` | `{ name }` | `{ name, success }` | `CONFIG_NOT_FOUND` |
| `plugin.import` | `{ filePath }` | `{ name, success }` | `CONFIG_VALIDATION` |
| `plugin.export` | `{ name, filePath }` | `{ filePath, success }` | `CONFIG_NOT_FOUND` |

> `createCrudHandlers` 工厂函数为每种组件类型生成统一的 CRUD handlers。校验由 `BaseComponentManager.add()` 内部调用 `validateOrThrow()` 完成，失败时抛出 `ConfigValidationError`。

#### 组件类型定义

```typescript
interface SkillDefinition {
  name: string;
  description?: string;
  content: string;       // 技能规则内容（markdown/text）
  tags?: string[];
}

interface PromptDefinition {
  name: string;
  description?: string;
  content: string;       // 提示词内容，支持 {{variable}} 占位符
  variables?: string[];  // 内容中预期的变量名
}

interface McpServerDefinition {
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface WorkflowDefinition {
  name: string;
  description?: string;
  content: string;       // 工作流内容（markdown）
}

interface PluginDefinition {
  name: string;
  description?: string;
  type: "npm" | "file" | "config";  // 安装方式
  source?: string;                   // npm 包名 / 文件路径 / 配置 ID
  config?: Record<string, unknown>;  // 插件配置
  enabled?: boolean;                 // 是否启用（默认 true）
}
```

> `CONFIG_NOT_FOUND` 错误映射到 `GENERIC_BUSINESS` (-32000) RPC 错误码。

> 实现参考：`packages/api/src/handlers/domain-handlers.ts`，类型定义见 `packages/shared/src/types/domain-component.types.ts`

### 3.6 Agent 任务 API（ACP 集成） ✅ 已实现

> 状态：**已实现**（Phase 3 — ACP 集成）

供 ACP Proxy 或 MCP Server 向 Actant 管理的 Agent 发送任务。**依赖 Daemon 与 Agent 间的 ACP 连接**（即 `processOwnership: "managed"`）。`agent.prompt` 通过 Daemon 持有的 ACP 连接与已启动的 Agent 通信。`agent.run` 对已启动的 ACP Agent 优先使用 ACP 连接，对未启动的 Agent 仍回退到 CLI pipe 模式。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.run` | `{ template, prompt, cleanup? }` | `RunResult` | `TEMPLATE_NOT_FOUND`, `AGENT_LAUNCH` |
| `agent.prompt` | `{ name, message, sessionId? }` | `PromptResult` | `AGENT_NOT_FOUND`, `AGENT_NOT_ATTACHED` |

#### agent.run (ACP 版本)

一站式操作：创建 ephemeral 实例 → 启动 → 通过 ACP 发送 prompt → 等待完成 → 可选清理。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `template` | `string` | **是** | 使用的模板名 |
| `prompt` | `string` | **是** | 发送给 Agent 的任务描述 |
| `cleanup` | `boolean` | 否 | 完成后是否自动清理 workspace（默认 `true`） |

**返回 `RunResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `response` | `string` | Agent 的完成回复 |
| `instanceName` | `string` | 使用的实例名（调试用） |
| `artifacts` | `string[]` | 产出文件路径列表 |

#### agent.prompt

向已运行的 managed Agent 发送消息（通过 Daemon 持有的 ACP 连接）。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 目标实例名 |
| `message` | `string` | **是** | 消息内容 |
| `sessionId` | `string` | 否 | 复用已有 ACP session |

**返回 `PromptResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `response` | `string` | Agent 回复 |
| `sessionId` | `string` | 可复用的 session ID |

### 3.7 Proxy Session 管理 ✅ 已实现

> 状态：**已实现**（Phase 3 — ACP 集成）

ACP Proxy 进程与 Daemon 之间的内部 RPC 方法。外部用户不直接调用。

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `proxy.connect` | `{ agentName, envPassthrough }` | `ProxySession` | 建立 Proxy session |
| `proxy.disconnect` | `{ sessionId }` | `{ ok }` | 断开 Proxy session |
| `proxy.forward` | `{ sessionId, acpMessage }` | `AcpMessage` | 转发 ACP 消息给 Agent |
| `proxy.envCallback` | `{ sessionId, response }` | `{ ok }` | 回传环境请求的结果 *(not yet implemented)* |

### 3.8 调度器管理（Phase 3c 新增） ✅ 已实现

> 状态：**已实现**（Phase 3c — Employee Agent Scheduler）

管理雇员型 Agent 的任务调度。调度器在 Agent 启动时根据 template 的 `schedule` 配置自动初始化。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.dispatch` | `{ name, prompt, priority? }` | `{ queued }` | `AGENT_NOT_FOUND` |
| `agent.tasks` | `{ name }` | `{ queued, processing, tasks }` | `AGENT_NOT_FOUND` |
| `agent.logs` | `{ name, limit? }` | `ExecutionRecord[]` | `AGENT_NOT_FOUND` |
| `agent.processLogs` | `{ name, stream?, lines? }` | `{ lines, stream, logDir }` | `AGENT_NOT_FOUND` |
| `schedule.list` | `{ name }` | `{ sources, running }` | `AGENT_NOT_FOUND` |

#### agent.dispatch

手动向 Agent 的任务队列推送一次性任务。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | Agent 实例名 |
| `prompt` | `string` | **是** | 任务 prompt |
| `priority` | `"low" \| "normal" \| "high" \| "critical"` | 否 | 优先级（默认 `"normal"`） |

#### agent.tasks

查看 Agent 的当前任务队列状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `queued` | `number` | 队列中等待的任务数 |
| `processing` | `boolean` | 是否正在处理任务 |
| `tasks` | `AgentTask[]` | 排队中的任务列表 |

#### agent.logs

查看 Agent 的任务执行历史。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | Agent 实例名 |
| `limit` | `number` | 否 | 返回最近 N 条记录 |

#### agent.processLogs

查看 Agent 后端进程的 stdout/stderr 日志文件。日志文件位于 `{instanceDir}/logs/`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | Agent 实例名 |
| `stream` | `"stdout" \| "stderr"` | 否 | 日志流类型，默认 `"stdout"` |
| `lines` | `number` | 否 | 返回最近 N 行，默认 50 |

**返回**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `lines` | `string[]` | 日志行内容 |
| `stream` | `string` | 实际查询的流类型 |
| `logDir` | `string` | 日志目录路径 |

> 实现参考：`packages/api/src/handlers/agent-handlers.ts`，`packages/core/src/manager/launcher/process-log-writer.ts`

#### schedule.list

查看 Agent 的输入源（Heartbeat/Cron/Hook）状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `sources` | `Array<{ id, type, active }>` | 已注册的输入源列表 |
| `running` | `boolean` | 调度器是否正在运行 |

> 实现参考：`packages/api/src/handlers/schedule-handlers.ts`，`packages/core/src/scheduler/`

### 3.9 组件源管理 ✅ 已实现

管理组件源（GitHub 仓库、本地目录）。通过 `package@name` 命名空间将远程组件注入到各 domain manager。

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `source.list` | `{}` | `SourceEntry[]` | 列出已注册源 |
| `source.add` | `{ name, config }` | `{ name, components }` | 添加并 fetch 源 |
| `source.remove` | `{ name }` | `{ success }` | 移除源及缓存 |
| `source.sync` | `{ name? }` | `{ synced[], report? }` | 同步单个或全部源 |
| `source.validate` | `{ name?, path?, strict?, compat? }` | `SourceValidateResult` | 递归校验源中所有资产 |

#### source.validate 详细说明

提供 `name`（已注册源名称）或 `path`（任意本地目录路径）之一。校验四层：

1. **Manifest 层** — `actant.json` 存在性、schema 完整性、文件引用存在性
2. **组件层** — 递归扫描各子目录，JSON 文件用 Zod schema 校验，SKILL.md 检查 frontmatter
3. **引用层** — Preset 中引用的组件名称是否在该源中存在
4. **Template 语义校验** — 复用 `validateTemplate()` 检查权限、provider、backend 配置

`compat` 参数可选值为 `"agent-skills"`，启用后对 SKILL.md 执行 [Agent Skills](https://agentskills.io/specification) 标准兼容性检查：
- `name` 必须为小写字母+连字符，1-64 字符，不含连续连字符，且须匹配父目录名
- `description` 为必填项（error 级别）
- `compatibility` 字段不超过 500 字符
- SKILL.md body 超过 500 行时发出 warning
- 识别 `scripts/`、`references/`、`assets/` 目录约定（info 级别）

```typescript
interface SourceValidateResult {
  valid: boolean;         // strict 模式下 warn 也算失败
  sourceName: string;
  rootDir: string;
  summary: { pass: number; warn: number; error: number };
  issues: SourceValidationIssueDto[];
}
```

> 实现参考：`packages/core/src/source/source-validator.ts`, `packages/api/src/handlers/source-handlers.ts`

### 3.10 守护进程

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `daemon.ping` | `{}` | `{ version, uptime, agents }` | 健康检查 |
| `daemon.shutdown` | `{}` | `{ success }` | 优雅关闭 |

### 3.11 Plugin 管理（Phase 4 新增） 🚧

> 状态：**待实现** — Step 3 (PluginHost + PluginRegistry)

管理 Actant-level 和 Instance-level 的 Plugin 生命周期状态。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `plugin.list` | `{ scope? }` | `PluginStatusDto[]` | — |
| `plugin.status` | `{ name }` | `PluginStatusDto` | `PLUGIN_NOT_FOUND` |

#### PluginStatusDto

```typescript
interface PluginStatusDto {
  name: string;
  version: string;
  scope: 'actant' | 'instance';
  state: 'inactive' | 'initializing' | 'running' | 'error' | 'stopped';
  instanceName?: string;         // scope=instance 时绑定的 Agent 名
  lastTickAt?: string;           // ISO timestamp
  consecutiveFailures: number;
  config: Record<string, unknown>;
}
```

### 3.12 Canvas 管理（Phase 4 Step 3b 新增） ✅ 已实现

> 状态：**已实现** — Step 3b (动态上下文注入 + Canvas)
> 关联 Issue: #210, #211

Agent 的 Live Canvas HTML 内容管理。Agent 通过内置 Actant MCP Server 的 `actant_canvas_update` 工具间接调用这些 RPC 方法。Dashboard 通过 SSE 实时广播 canvas 数据。

**Archetype 限制**：Canvas 对 `service` 和 `employee` archetype 的 Agent 开放。`canvas.update` 在写入 CanvasStore 前校验 `agentName` 对应的 Agent archetype，`repo` 类型返回 `INVALID_PARAMS` 错误。Dashboard 侧同步过滤，仅展示 `service`/`employee` Agent 的 canvas slots。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `canvas.update` | `{ agentName, html, title? }` | `{ ok }` | `INVALID_PARAMS`（含 archetype 不匹配） |
| `canvas.get` | `{ agentName }` | `CanvasGetResult` | `AGENT_NOT_FOUND` |
| `canvas.list` | `{}` | `{ entries: CanvasGetResult[] }` | — |
| `canvas.clear` | `{ agentName }` | `{ ok }` | — |

#### CanvasGetResult

```typescript
interface CanvasGetResult {
  agentName: string;
  html: string;
  title?: string;
  updatedAt: number;
}
```

#### 数据流

```
Agent Process → actant_canvas_update (MCP Tool)
  → Built-in Actant MCP Server (stdio)
    → canvas.update RPC (via ACTANT_SOCKET)
      → CanvasStore (in-memory)
        → SSE broadcast → Dashboard iframe sandbox
```

**内存存储**：Canvas 内容存储在 `CanvasStore`（内存 Map），Daemon 重启后丢失。每个 Agent 最多一个 canvas entry。

> 实现参考：`packages/api/src/handlers/canvas-handlers.ts`，`packages/api/src/services/canvas-store.ts`

### 3.12b MCP Canvas Tools（Phase 4 Step 3b 新增） ✅ 已实现

内置 Actant MCP Server（`packages/mcp-server/`）通过 ACP `session/new` 的 `mcpServers` 参数自动注入到 Agent 进程。Agent 无需配置即可使用以下工具：

| Tool | 参数 | 返回 | 说明 |
|------|------|------|------|
| `actant_canvas_update` | `{ html: string, title?: string }` | success/error text | 更新 Agent 的 Live Canvas HTML |
| `actant_canvas_clear` | `{}` | success/error text | 清除 Canvas |

**注入机制**：`SessionContextInjector` 在 ACP session 创建前收集所有 `ContextProvider` 注册的 MCP servers，通过 `newSession(cwd, mcpServers)` 传参。内置 MCP Server 以 stdio 模式运行，通过 `ACTANT_SOCKET` 环境变量连接回 Daemon RPC。

> 实现参考：`packages/mcp-server/src/index.ts`，`packages/core/src/context-injector/session-context-injector.ts`

### 3.12c Activity 查询（Phase 4 Step 3 新增） ✅ 已实现

> 状态：**已实现** — Step 3 (Dashboard v0)

查询 Agent 的活动会话和对话历史。Dashboard 使用这些方法渲染 Chat 界面和 Activity 页面。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `activity.sessions` | `{ agentName }` | `SessionSummary[]` | `AGENT_NOT_FOUND` |
| `activity.conversation` | `{ agentName, sessionId }` | `ConversationTurn[]` | `AGENT_NOT_FOUND` |

#### activity.sessions

列出 Agent 的所有活动记录会话（按时间倒序）。

#### activity.conversation

获取单个会话的对话轮次。内部由 `assembleConversation()` 将原始 `ActivityRecord` 流组装为结构化的 `ConversationTurn[]`。

**支持的 Activity Record 类型**：

| record.type | 处理方式 |
|-------------|---------|
| `prompt_sent` | 提取 `data.content`（或 `data.contentRef.preview`）生成 `role: "user"` 轮次 |
| `prompt_complete` | 结束当前轮次（重置 currentTurn） |
| `session_update` | 根据 `data.sessionUpdate` 生成 `role: "assistant"` 轮次（含 `text_chunk`、`tool_use`、`tool_result`、`completion` 等） |

> 实现参考：`packages/api/src/handlers/activity-handlers.ts`

### 3.13 事件查询（Phase 4 新增） ✅ 已实现

> 状态：**已实现** — Step 3 (Dashboard v0)

Dashboard 和 CLI 查询最近发生的 Hook 事件。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `events.recent` | `{ limit?, since?, scope? }` | `HookEventDto[]` | — |
| `events.subscribe` | `{ patterns? }` | `{ subscriptionId }` | — |
| `events.unsubscribe` | `{ subscriptionId }` | `{ success }` | — |

#### HookEventDto

```typescript
interface HookEventDto {
  id: string;                      // 事件唯一 ID
  event: HookEventName;
  scope: 'actant' | 'instance';
  agentName?: string;
  data: Record<string, unknown>;
  timestamp: string;               // ISO timestamp
}
```

#### events.recent

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | `number` | 否 | 返回最近 N 条，默认 50，最大 500 |
| `since` | `string` | 否 | ISO timestamp，只返回此时间之后的事件 |
| `scope` | `'actant' \| 'instance'` | 否 | 过滤作用域 |

### 3.13 Hook 订阅管理（Phase 4 新增） 🚧

> 状态：**待实现** — 统一事件系统 (event-system-unified-design.md)

Agent 运行时通过 `actant internal hook subscribe --token` CLI 动态注册/取消事件订阅（遵循 CLI-first 原则，使用 session token 认证）。这是**事件订阅模型 C（Agent 自注册）**的 RPC 入口。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `hook.subscribe` | `{ agent, event, prompt, interval?, condition? }` | `{ subscriptionId }` | `AGENT_NOT_FOUND`, `HOOK_EVENT_NOT_SUBSCRIBABLE` |
| `hook.unsubscribe` | `{ agent, subscriptionId }` | `{ success }` | `AGENT_NOT_FOUND`, `HOOK_SUBSCRIPTION_NOT_FOUND` |
| `hook.list` | `{ agent, dynamic? }` | `HookSubscriptionDto[]` | `AGENT_NOT_FOUND` |

#### hook.subscribe

Agent（通过 `Bash("actant internal hook subscribe --token $T ...")`）或用户在运行时动态注册事件监听。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `agent` | `string` | **是** | 目标 Agent 实例名（`"self"` 自动解析为调用者） |
| `event` | `string` | **是** | 事件名（如 `heartbeat:tick`、`prompt:after`） |
| `prompt` | `string` | **是** | 事件触发时发送给 Agent 的 prompt |
| `interval` | `number` | 否 | 对于 `heartbeat:tick` 事件，指定轮询间隔毫秒数（≥1000） |
| `condition` | `string` | 否 | 模板表达式条件过滤（`${data.xxx}` truthy 判断） |

**行为：**
- 通过 `HookCategoryRegistry.isAgentSubscribable(event)` 验证该事件允许 Agent 自注册
- 不允许时抛出 `HOOK_EVENT_NOT_SUBSCRIBABLE` 错误
- 若 `event` 为 `heartbeat:tick` 且提供了 `interval`，自动创建 `EventSourceManager` 定时器
- 订阅绑定到 Agent 进程生命周期：进程停止时自动取消（Ephemeral 语义）

**返回 `{ subscriptionId }`：** 用于后续 unsubscribe。

#### hook.unsubscribe

取消动态订阅。同时清理关联的 EventSource（如 heartbeat timer）。

#### hook.list

列出 Agent 的所有事件订阅。`dynamic: true` 只返回 Agent 运行时自注册的订阅。

**返回 `HookSubscriptionDto`：**

```typescript
interface HookSubscriptionDto {
  subscriptionId: string;
  event: string;
  prompt: string;
  source: 'workflow' | 'dynamic';
  createdAt: string;
}
```

**CLI 映射：**

```bash
actant internal hook subscribe --token $ACTANT_SESSION_TOKEN --event heartbeat:tick \
  --interval 300000 --prompt "Check for new PRs"

actant internal hook unsubscribe --token $ACTANT_SESSION_TOKEN --id <subscriptionId>

actant internal hook list --token $ACTANT_SESSION_TOKEN --dynamic
```

> 设计依据：事件订阅模型 C。通信通道选择 CLI 而非 MCP。详见 [event-system-unified-design.md §7](../../docs/design/event-system-unified-design.md)。

### 3.14 MCP Schedule Tools（Phase 4 新增） 🚧

> 状态：**待实现** — Step 2 (Scheduler Enhancement)
>
> **⚠️ 注意**：在统一事件系统架构下，Schedule Tools 将整合到 EventBus 中。`actant_schedule_wait` 和 `actant_schedule_cron` 的底层实现由独立 TaskQueue 改为 emit 到 EventBus + ActionRunner 分派。

Agent 通过 MCP Tools 操作自身的 Scheduler。这些不是 RPC 方法，而是 MCP Server 暴露的 Tools。

| Tool Name | 参数 | 返回 | 说明 |
|-----------|------|------|------|
| `actant_schedule_wait` | `{ delayMs, prompt }` | `{ taskId }` | 创建一次性定时任务（emit to EventBus） |
| `actant_schedule_cron` | `{ cron, prompt, name? }` | `{ sourceId }` | 创建 Cron 事件源（emit to EventBus） |
| `actant_schedule_cancel` | `{ id }` | `{ success }` | 取消事件源 |

#### actant_schedule_wait

Agent 自主请求延迟执行。内部创建 `DelayInput` 实例，到期后 emit 到 EventBus。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `delayMs` | `number` | **是** | 延迟毫秒数，最小 1000 |
| `prompt` | `string` | **是** | 到期后执行的 prompt |

#### actant_schedule_cron

Agent 自主注册周期性任务。Cron 定时器作为事件源 emit `cron:<expr>` 到 EventBus。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cron` | `string` | **是** | 标准 cron 表达式 (5 段) |
| `prompt` | `string` | **是** | 每次触发执行的 prompt |
| `name` | `string` | 否 | 输入源名称，用于取消时引用 |

### 3.15 Subsystem 管理（Phase 4 新增） 🚧

> 状态：**待实现** — 统一事件系统 + Subsystem 框架
> 设计文档：[subsystem-design.md](../../docs/design/subsystem-design.md)

管理子系统的注册、启停和运行时状态查询。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `subsystem.list` | `{ scope?, agentName? }` | `SubsystemStatusDto[]` | — |
| `subsystem.status` | `{ name, scope?, agentName? }` | `SubsystemStatusDto` | `SUBSYSTEM_NOT_FOUND` |
| `subsystem.enable` | `{ name, scope?, agentName?, config? }` | `{ success }` | `SUBSYSTEM_NOT_FOUND` |
| `subsystem.disable` | `{ name, scope?, agentName? }` | `{ success }` | `SUBSYSTEM_NOT_FOUND` |

#### SubsystemStatusDto

```typescript
interface SubsystemStatusDto {
  name: string;
  scope: 'actant' | 'instance' | 'process' | 'session';
  state: 'inactive' | 'initializing' | 'running' | 'error' | 'stopped';
  agentName?: string;
  description?: string;
  dependencies: string[];
  config: Record<string, unknown>;
  activatedAt?: string;
  lastError?: string;
}
```

#### subsystem.list

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | `SubsystemScope` | 否 | 过滤作用域 |
| `agentName` | `string` | 否 | 过滤绑定到指定 Agent 的子系统（instance/process/session scope） |

#### subsystem.enable / subsystem.disable

运行时启用/禁用子系统。启用时可传入 `config` 覆盖默认配置。对于 `instance`/`process`/`session` scope 的子系统需指定 `agentName`。

### 3.16 Email 统计（Phase 4 新增） 🚧

> 状态：**待实现** — Step 5 (Agent-to-Agent Email)

Dashboard 和 CLI 查询 Email 系统的统计信息。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `email.stats` | `{ name? }` | `EmailStatsDto` | — |

#### EmailStatsDto

```typescript
interface EmailStatsDto {
  totalSent: number;
  totalReceived: number;
  pendingDelivery: number;
  agents: Array<{
    name: string;
    sent: number;
    received: number;
    unread: number;
  }>;
}
```

### 3.17 Memory 统计（Phase 4/5 新增） 🚧

> 状态：**待实现** — Step 8+ (Memory Core) 之后

Dashboard 和 CLI 查询 Memory 系统的统计信息。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `memory.stats` | `{ name? }` | `MemoryStatsDto` | — |

#### MemoryStatsDto

```typescript
interface MemoryStatsDto {
  totalRecords: number;
  instanceRecords: number;
  templateRecords: number;
  actantRecords: number;
  storageBackend: string;    // 'in-memory' | 实际存储后端名（待定）
  agents: Array<{
    name: string;
    records: number;
    lastExtractedAt?: string;
  }>;
}
```

---

## 4. CLI 命令

CLI 是 RPC 方法的用户端映射。每条命令内部调用对应的 RPC 方法。

### 全局选项

| 选项 | 说明 |
|------|------|
| `-V, --version` | 显示版本号 |
| `-h, --help` | 显示帮助 |

无子命令时进入交互式 **REPL**。

### 4.0 Setup 向导 (`actant setup`)

| 命令 | 选项 | 行为 |
|------|------|------|
| `setup` | `--skip-home`, `--skip-provider`, `--skip-source`, `--skip-agent`, `--skip-autostart`, `--skip-hello`, `--skip-update` | 交互式设置向导，7 个步骤均可独立跳过 |

**步骤详情：**

| 步骤 | Skip 标志 | 交互方式 | 跳过时行为 |
|------|-----------|---------|-----------|
| 1. 选择 ACTANT_HOME | `--skip-home` | `select` + `input` | 使用 `$ACTANT_HOME` 环境变量或 `~/.actant`，创建目录结构和 `config.json` |
| 2. 配置 Model Provider | `--skip-provider` | `select` + `input` + `password` + `confirm` | 跳过 |
| 3. 配置组件源 | `--skip-source` | `confirm` + `select` + `input` | 跳过（需 Daemon 运行） |
| 4. 创建 Agent | `--skip-agent` | `checkbox` + `input` | 跳过（需 Daemon 运行） |
| 5. 配置自动启动 | `--skip-autostart` | `confirm` | 跳过 |
| 6. Hello World 验证 | `--skip-hello` | 无（自动） | 跳过（需 Daemon 运行） |
| 7. 更新选项 | `--skip-update` | `confirm` + `input` | 跳过 |

**幂等性**: 多次运行 `setup`（含全跳过模式）不产生错误，已存在的 `config.json` 和目录结构不被破坏。

**非 TTY 行为**: 未跳过的交互步骤在非 TTY 环境下会挂起（`@inquirer/prompts` 等待 stdin）。`isUserCancellation()` 捕获取消事件并优雅退出。QA 自动化必须使用 `--skip-*` 标志。

> 实现参考：`packages/cli/src/commands/setup/setup.ts`

### 4.1 模板命令 (`actant template` / `actant tpl`)

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `template list` | — | `-f, --format <table\|json\|quiet>` | `template.list` |
| `template show <name>` | `name` | `-f, --format` | `template.get` |
| `template validate <file>` | `file` | — | `template.validate` |
| `template load <file>` | `file` | — | `template.load` |
| `template install <spec>` | `spec` | — | `source.sync` + `template.get` |

`template install` 接受 `source@name` 格式（如 `actant-hub@code-reviewer`）。省略 `source@` 前缀时默认使用 `actant-hub`。命令先同步指定源，再验证模板可用性。

> `template.unload` 无 CLI 对应，仅通过 RPC 可用。

### 4.2 Agent 命令 (`actant agent`)

#### 生命周期管理

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent create <name>` | `name` | `-t, --template`（必填）, `--launch-mode`, `--work-dir`, `--overwrite`, `--append`, `-f, --format` | `agent.create` |
| `agent start <name>` | `name` | `--auto-install`, `--no-install` | `agent.start` |
| `agent stop <name>` | `name` | — | `agent.stop` |
| `agent status [name]` | `name`（可选） | `-f, --format` | `agent.status` / `agent.list` |
| `agent list` | — | `-f, --format` | `agent.list` |
| `agent destroy <name>` | `name` | `--force` | `agent.destroy` |

**输出格式**：`table`（默认）, `json`, `quiet`

**启动模式**：`direct`, `acp-background`, `acp-service`, `one-shot`

#### Agent 交互（✅ 已实现）

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent run <name>` | `name` | `--prompt`（必填）, `--model`, `--max-turns`, `--timeout`, `--session-id`, `--format` | `agent.run` |
| `agent prompt <name>` | `name` | `-m, --message`（必填）, `--session-id`, `--format` | `agent.prompt` |
| `agent chat <name>` | `name` | `--model`, `--max-turns`, `--session-id` | `agent.run`（循环调用） |

- `agent run`：发送单次 prompt，输出结果后退出（**acp 模式**）。对已启动（`agent start`）的 ACP Agent 优先使用 ACP 连接，否则回退到 CLI pipe 模式。支持 `--format text|json`。
- `agent prompt`：向已启动的 ACP Agent 发送消息（**acp 模式**）。要求 Agent 已通过 `agent start` 启动。
- `agent chat`：进入交互式 REPL 模式（**acp 模式**）。Agent 未运行时 CLI 自行 spawn ACP bridge 并建立 ACP 连接（Direct Bridge）；Agent 已运行时使用已有 ACP 连接。输入 `exit`/`quit` 或 Ctrl+C 退出。

> **Backend Mode 映射**：`run`/`prompt`/`chat` 均走 **acp** 模式。后端通过 `BackendDescriptor.resolvePackage` 自声明所需的 npm 包（如 `@zed-industries/claude-agent-acp`），该字段经 `ResolveResult` 传递到 CLI。`binary-resolver` 是泛型解析器——接受 `resolvePackage` 参数，在 PATH 查找失败时自动从 `node_modules` 定位 bin 脚本。详见 [agent-lifecycle.md §5.4](./agent-lifecycle.md#54-后端依赖解析resolvepackage-与-binary-resolver)。

### 4.3 外部 Spawn 与直接打开命令

| 命令 | 参数 | 选项 | 对应 RPC | Backend Mode |
|------|------|------|---------|-------------|
| `agent resolve <name>` | `name` | `-t, --template`, `-f, --format`, `--auto-install`, `--no-install` | `agent.resolve` | **resolve** — 输出 ACP 连接命令 |
| `agent open <name>` | `name` | `-t, --template`, `--no-attach`, `--auto-install`, `--no-install` | `agent.open` | **open** — 前台 TUI 交互（attach/detach 生命周期） |
| `agent attach <name>` | `name` | `--pid`（必填）, `--metadata` | `agent.attach` | （配合 resolve 使用） |
| `agent detach <name>` | `name` | `--cleanup` | `agent.detach` | （配合 resolve 使用） |

### 4.4 Domain 组件命令（✅ 已实现）

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `skill list` | — | `-f, --format` | `skill.list` |
| `skill show <name>` | `name` | `-f, --format` | `skill.get` |
| `skill add <file>` | `file` | — | `skill.add` |
| `skill remove <name>` | `name` | — | `skill.remove` |
| `skill export <name>` | `name` | `-o, --output <file>` | `skill.export` |
| `prompt list` | — | `-f, --format` | `prompt.list` |
| `prompt show <name>` | `name` | `-f, --format` | `prompt.get` |
| `prompt add <file>` | `file` | — | `prompt.add` |
| `prompt remove <name>` | `name` | — | `prompt.remove` |
| `prompt export <name>` | `name` | `-o, --output <file>` | `prompt.export` |
| `mcp list` | — | `-f, --format` | `mcp.list` |
| `mcp show <name>` | `name` | `-f, --format` | `mcp.get` |
| `workflow list` | — | `-f, --format` | `workflow.list` |
| `workflow show <name>` | `name` | `-f, --format` | `workflow.get` |
| `plugin list` | — | `-f, --format` | `plugin.list` |
| `plugin show <name>` | `name` | `-f, --format` | `plugin.get` |
| `plugin add <file>` | `file` | — | `plugin.add` |
| `plugin remove <name>` | `name` | — | `plugin.remove` |
| `plugin export <name>` | `name` | `-o, --output <file>` | `plugin.export` |

组件定义文件从 `~/.actant/configs/` 目录加载（可通过 `--configs-dir` 覆盖）：

```
~/.actant/configs/
├── skills/          # SkillDefinition JSON
├── prompts/         # PromptDefinition JSON
├── mcp/             # McpServerDefinition JSON
├── workflows/       # WorkflowDefinition JSON
├── plugins/         # PluginDefinition JSON
└── templates/       # AgentTemplate JSON
```

### 4.5 组件源命令 (`actant source`)

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `source list` | — | `-f, --format` | `source.list` |
| `source add <name>` | `name` | `--github <url>`, `--local <path>`, `--type <github\|local\|community>`, `--filter <glob>`, `--branch <branch>` | `source.add` |
| `source remove <name>` | `name` | — | `source.remove` |
| `source sync [name]` | `name?` | — | `source.sync` |
| `source validate [name]` | `name?` | `--path <dir>`, `-f, --format`, `--strict`, `--compat <standard>`, `--community` | `source.validate` |

`source validate` 提供 `name`（已注册源）或 `--path`（任意目录）。`--strict` 模式下 warnings 也视为失败（exit code 1）。`--compat agent-skills` 启用 Agent Skills 标准兼容性检查。`--community` 启用社区源验证模式（跳过 manifest 校验，递归扫描 SKILL.md）。

#### Community 源类型（#145 新增） ✅ 已实现

新增 `community` 源类型，支持注册社区 Agent Skills 仓库（如 `anthropics/skills`），无需 `actant.json` manifest。通过递归扫描 `SKILL.md` 文件自动发现技能。

**`CommunitySourceConfig`：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"community"` | **是** | 源类型标识 |
| `url` | `string` | **是** | Git 仓库 URL |
| `branch` | `string` | 否 | 指定分支（默认 main） |
| `filter` | `string` | 否 | glob 过滤（匹配技能名或相对路径） |

**CLI 用法：** `actant source add my-skills --type community --github https://github.com/org/skills --filter "code-*"`

> 实现参考：`packages/core/src/source/community-source.ts`

> 实现参考：`packages/cli/src/commands/source/`

### 4.6 调度器命令（Phase 3c 新增）

#### Agent 任务调度

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent dispatch <name>` | `name` | `-m, --message`（必填）, `-p, --priority` | `agent.dispatch` |
| `agent tasks <name>` | `name` | `-f, --format` | `agent.tasks` |
| `agent logs <name>` | `name` | `--limit <n>`, `-f, --format` | `agent.logs` |

#### 调度源管理

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `schedule list <name>` | `name` | `-f, --format` | `schedule.list` |

> 实现参考：`packages/cli/src/commands/agent/dispatch.ts`, `packages/cli/src/commands/schedule/`

### 4.7 Subsystem 命令 (`actant subsystem` / `actant ss`) 🚧

> 状态：**待实现** — Subsystem 框架

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `subsystem list` | — | `--scope <scope>`, `--agent <name>`, `-f, --format` | `subsystem.list` |
| `subsystem status <name>` | `name` | `--scope`, `--agent`, `-f, --format` | `subsystem.status` |
| `subsystem enable <name>` | `name` | `--scope`, `--agent`, `--config <json>` | `subsystem.enable` |
| `subsystem disable <name>` | `name` | `--scope`, `--agent` | `subsystem.disable` |

### 4.8 Hook 命令 (`actant hook`) 🚧

> 状态：**待实现** — 统一事件系统

Agent 和用户在运行时管理事件订阅。Agent 通过 shell 工具调用这些命令实现动态监听（订阅模型 C）。

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `internal hook subscribe` | — | `--token <t>`（必填）, `--event <name>`（必填）, `--prompt <text>`（必填）, `--interval <ms>`, `--condition <expr>` | `hook.subscribe` |
| `internal hook unsubscribe` | — | `--token <t>`（必填）, `--id <subscriptionId>`（必填） | `hook.unsubscribe` |
| `internal hook list` | — | `--token <t>`（必填）, `--dynamic`, `-f, --format` | `hook.list` |

`--agent self` 在 Agent 进程内部调用时自动解析为当前 Agent 实例名。

### 4.9 ACP Proxy 命令

| 命令 | 参数 | 选项 | 行为 |
|------|------|------|------|
| `proxy <name>` | Agent 实例名 | `--lease`, `-t, --template` | 启动 ACP Proxy 进程（详见 §7） |

**用法：** 外部 ACP Client 将 `actant proxy <name>` 作为 Agent 可执行文件 spawn。

```bash
# 外部客户端配置示例
actant proxy my-agent                    # Direct Bridge 模式（默认）
actant proxy my-agent --lease            # Session Lease 模式（需预启动 Agent）
actant proxy my-agent -t review-template # 不存在则自动创建
```

> `--env-passthrough` 选项 *(not yet implemented)*

### 4.10 守护进程命令 (`actant daemon`)

| 命令 | 选项 | 行为 |
|------|------|------|
| `daemon start` | `--foreground` | 启动守护进程；`--foreground` 在当前进程运行 |
| `daemon stop` | — | 发送 `daemon.shutdown` RPC |
| `daemon status` | `-f, --format` | 发送 `daemon.ping` RPC |

### 4.12 Dashboard 和 API 服务器

| 命令 | 选项 | 行为 |
|------|------|------|
| `dashboard` | `-p, --port <port>` (默认 3200), `--no-open` | 启动 Web Dashboard（SPA + REST API），自动打开浏览器 |
| `api` | `-p, --port <port>` (默认 3100), `-H, --host <host>` (默认 0.0.0.0), `-k, --api-key <key>` | 启动独立 REST API 服务器（无 SPA），用于 n8n / IM / 外部集成 |

`api` 命令的 API Key 也可通过 `ACTANT_API_KEY` 环境变量设置。

> 实现参考：`packages/cli/src/commands/dashboard/`, `packages/cli/src/commands/api/`

---

## 4A. REST API（`@actant/rest-api`）

独立的 RESTful HTTP 服务器，覆盖所有 Daemon RPC 方法。可被 Dashboard、n8n、Slack/Discord/WeChat 等 IM 机器人、以及任意 HTTP 客户端访问。

### 架构

```
HTTP Client (Dashboard / n8n / IM Bot / curl)
      │
      │ HTTP (REST + SSE)
      │
┌─────▼──────────────────────────┐
│     @actant/rest-api           │
│  Router → Route Handlers       │
│  Middleware (CORS, API Key)    │
│  RpcBridge (JSON-RPC 2.0)     │
└─────┬──────────────────────────┘
      │ Unix Socket / Named Pipe
      │
┌─────▼──────────────────────────┐
│     Actant Daemon              │
└────────────────────────────────┘
```

Dashboard（`@actant/dashboard`）在内部挂载 `@actant/rest-api` 的 handler，并额外提供 SPA 静态文件服务。

### 端点概览

所有端点均以 `/v1/` 为前缀。

| 分类 | 方法 | 端点 | 对应 RPC |
|------|------|------|---------|
| **System** | GET | `/v1/status` | `daemon.ping` |
| | POST | `/v1/shutdown` | `daemon.shutdown` |
| | GET | `/v1/sse` | SSE 实时流（每 2s 轮询） |
| | GET | `/v1/openapi` | 自描述 OpenAPI 路由目录 |
| **Agents** | GET | `/v1/agents` | `agent.list` |
| | POST | `/v1/agents` | `agent.create` |
| | GET | `/v1/agents/:name` | `agent.status` |
| | DELETE | `/v1/agents/:name` | `agent.destroy` |
| | POST | `/v1/agents/:name/start` | `agent.start` |
| | POST | `/v1/agents/:name/stop` | `agent.stop` |
| | POST | `/v1/agents/:name/prompt` | `agent.prompt` |
| | POST | `/v1/agents/:name/run` | `agent.run` |
| | PUT | `/v1/agents/:name/permissions` | `agent.updatePermissions` |
| | POST | `/v1/agents/:name/attach` | `agent.attach` |
| | POST | `/v1/agents/:name/detach` | `agent.detach` |
| | POST | `/v1/agents/:name/dispatch` | `agent.dispatch` |
| | GET | `/v1/agents/:name/sessions` | `activity.sessions` |
| | GET | `/v1/agents/:name/sessions/:id` | `activity.conversation` |
| | GET | `/v1/agents/:name/logs` | `agent.processLogs` |
| | GET | `/v1/agents/:name/tasks` | `agent.tasks` |
| | GET | `/v1/agents/:name/schedule` | `schedule.list` |
| **Templates** | GET | `/v1/templates` | `template.list` |
| | GET | `/v1/templates/:name` | `template.get` |
| **Domain** | GET | `/v1/skills`, `prompts`, `mcp-servers`, `workflows`, `plugins` | 各 `*.list` |
| **Sources** | GET | `/v1/sources` | `source.list` |
| | POST | `/v1/sources` | `source.add` |
| | DELETE | `/v1/sources/:name` | `source.remove` |
| **Sessions** | GET | `/v1/sessions` | `session.list` |
| | POST | `/v1/sessions` | `session.create` |
| **Canvas** | GET | `/v1/canvas` | `canvas.list` |
| | GET/POST/DELETE | `/v1/canvas/:agent` | `canvas.get/update/clear` |
| **Events** | GET | `/v1/events` | `events.recent` |
| **Webhooks** | POST | `/v1/webhooks/message` | `agent.prompt`（简化入口） |
| | POST | `/v1/webhooks/run` | `agent.run`（简化入口） |
| | POST | `/v1/webhooks/event` | `gateway.lease` |

### 认证

设置 API Key（`--api-key` 或 `ACTANT_API_KEY`）后，所有请求须携带 `Authorization: Bearer <key>` 或 `X-API-Key: <key>` 头。SSE 端点免认证（浏览器 EventSource 无法设置自定义 header）。

### Webhook 集成模式

`/v1/webhooks/message` 端点是 IM 集成的推荐入口：

```json
// Request
POST /v1/webhooks/message
{ "agent": "my-agent", "message": "用户消息" }

// Response
{ "agent": "my-agent", "response": "Agent 回复", "sessionId": "..." }
```

**n8n 集成**：HTTP Request 节点 → `POST http://actant:3100/v1/webhooks/message`，Body 携带 `agent` 和 `message` 字段。

### RPC 错误 → HTTP 状态码映射

| RPC 错误码 | HTTP 状态码 | 含义 |
|-----------|-----------|------|
| -32001 (TEMPLATE_NOT_FOUND) | 404 | 模板不存在 |
| -32003 (AGENT_NOT_FOUND) | 404 | Agent 不存在 |
| -32002 (CONFIG_VALIDATION) | 400 | 配置校验失败 |
| -32004 (AGENT_ALREADY_RUNNING) | 409 | Agent 已在运行 |
| -32601 (METHOD_NOT_FOUND) | 404 | 方法不存在 |
| 其他 | 500 | 内部错误 |

### RpcBridge 超时约定

REST API 通过 `RpcBridge` 调用 Daemon RPC。默认 RPC 超时较短（10s），适合快速管理操作（list、status 等）。对于 **长耗时** 操作（prompt、run），路由 handler 必须显式传入更长的 `timeoutMs`：

| 端点 | RPC 方法 | 推荐 timeoutMs | 原因 |
|------|----------|---------------|------|
| `POST /v1/agents/:name/prompt` | `agent.prompt` | 305_000 | LLM 调用可达 300s |
| `POST /v1/agents/:name/run` | `agent.run` | 305_000 | 多轮 agentic 调用 |
| `POST /v1/sessions/:id/prompt` | `session.prompt` | 305_000 | 同 agent.prompt |
| 其他管理类端点 | 各种 | 默认（10s） | 操作应秒级完成 |

```typescript
// 示例：agents.ts route handler
const result = await ctx.bridge.call("agent.prompt", params, { timeoutMs: 305_000 });
```

> **超时梯度原则**：Core 层 promptAgent 超时 (300s) < RPC 超时 (305s) < HTTP socket 超时 (310s)。各层依次递增 5s，确保下层错误能正常传播到上层，而非上层先断开。

> 实现参考：`packages/rest-api/src/`

---

## 5. 内部契约

以下接口为模块间的内部契约。外部用户无需关心，但实现者必须遵守。

### 5.1 AgentLauncher

Agent 后端进程的启动/终止契约。

```typescript
interface AgentProcess {
  pid: number;
  workspaceDir: string;
  instanceName: string;
  /** Present when the process uses ACP stdio protocol. */
  stdio?: {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
  };
}

interface AgentLauncher {
  launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess>;
  terminate(process: AgentProcess): Promise<void>;
}
```

| 实现 | 模式 | 说明 |
|------|------|------|
| `MockLauncher` | `"mock"` | 返回假 PID，terminate 无操作。用于测试。 |
| `ProcessLauncher` | `"real"` | `child_process.spawn` 启动真实进程。SIGTERM → 超时 → SIGKILL。 |

工厂函数 `createLauncher(config?)` 根据 `config.mode` 或 `ACTANT_LAUNCHER_MODE` 选择实现。

#### ACP-only 后端

部分后端类型（`pi`）不使用 `AgentLauncher`，而由 `AcpConnectionManager` 通过 `BackendResolver.resolve()` 获取命令后自行 spawn 进程。`isAcpOnlyBackend(type)` 函数判断一个后端类型是否为 ACP-only。

**ACP-only 启动流程**：
```
AgentManager.startAgent()
  → isAcpOnlyBackend(backendType)?
    → true: AcpConnectionManager.spawnAndConnect(resolve(...))
    → false: ProcessLauncher.launch() + optional AcpConnectionManager
```

> 实现参考：`packages/core/src/manager/launcher/backend-resolver.ts`，`packages/core/src/manager/agent-manager.ts`

### 5.2 BaseComponentManager（#119 重构）

所有领域组件 Manager（SkillManager、PromptManager、WorkflowManager、McpConfigManager、PluginManager）和 TemplateRegistry 的公共基类。提供 CRUD、持久化、目录加载等通用操作。

```typescript
abstract class BaseComponentManager<T extends NamedComponent> {
  abstract validate(data: unknown, source: string): ConfigValidationResult<T>;
  protected validateOrThrow(data: unknown, source: string): T;

  register(component: T): void;
  unregister(name: string): boolean;
  get(name: string): T | undefined;
  has(name: string): boolean;
  resolve(names: string[]): T[];
  list(): T[];

  async add(component: T, persist?: boolean): Promise<void>;
  async update(name: string, patch: Partial<T>, persist?: boolean): Promise<T>;
  async remove(name: string, persist?: boolean): Promise<boolean>;

  async importFromFile(filePath: string): Promise<T>;
  async exportToFile(name: string, filePath: string): Promise<void>;
  async loadFromDirectory(dirPath: string): Promise<number>;
}
```

**校验机制**（#119）：
- `validate()` — 公共方法，返回 `ConfigValidationResult<T>`，包含结构化的 errors 和 warnings
- `validateOrThrow()` — 内部方法，校验失败时抛出 `ConfigValidationError`；被 `add()`、`update()`、`importFromFile()`、`loadFromDirectory()` 使用

| 实现 | 管理对象 | 说明 |
|------|---------|------|
| `SkillManager` | `SkillDefinition` | — |
| `PromptManager` | `PromptDefinition` | — |
| `WorkflowManager` | `WorkflowDefinition` | — |
| `McpConfigManager` | `McpServerDefinition` | — |
| `PluginManager` | `PluginDefinition` | — |
| `BackendManager` | `BackendDefinition` | 额外管理 `acpResolvers: Map<string, AcpResolverFn>`（行为扩展）；提供 `checkAvailability()`、`getInstallMethods()` |
| `TemplateRegistry` | `AgentTemplate` | 继承 BaseComponentManager；自定义 `loadFromDirectory()`（使用 TemplateLoader）和重复检查逻辑 |

> 实现参考：`packages/core/src/domain/base-component-manager.ts`, `packages/core/src/template/registry/template-registry.ts`

### 5.2b SourceManager（默认源自动注册）

管理组件源（GitHub 仓库、本地目录）。通过 `package@name` 命名空间将远程组件注入到各 domain manager。

**支持的组件类型**: skills, prompts, mcp, templates, presets, **backends**。`PackageManifest`（`actant.json`）的 `components` 对象包含 `backends?: string[]` 字段。`SourceManager.injectComponents()` 将从 hub 加载的 `BackendDefinition` 注册到 `BackendManager`。

**默认源行为**: `SourceManager.initialize()` 在启动时自动注册 `actant-hub`（`https://github.com/blackplume233/actant-hub.git`）为默认源。若网络不可用或仓库无法访问，静默跳过。该行为可通过构造时 `{ skipDefaultSource: true }` 禁用（测试场景下 `launcherMode === "mock"` 自动禁用）。

> 实现参考：`packages/core/src/source/source-manager.ts`

### 5.3 HandlerRegistry

RPC 方法与处理函数的注册表。

```typescript
type RpcHandler = (params: Record<string, unknown>, ctx: AppContext) => Promise<unknown>;

interface HandlerRegistry {
  register(method: string, handler: RpcHandler): void;
  get(method: string): RpcHandler | undefined;
  has(method: string): boolean;
  methods(): string[];
}
```

### 5.4 RpcClient

CLI 端的 RPC 客户端。

```typescript
interface RpcClient {
  call<M extends RpcMethod>(method: M, params: RpcMethodMap[M]["params"]): Promise<RpcMethodMap[M]["result"]>;
  ping(): Promise<boolean>;
}
```

**错误类型**：
- `RpcCallError` — RPC 返回错误：`{ message, code, data? }`
- `ConnectionError` — Socket 连接失败：`{ socketPath, cause }`

### 5.5 AgentCommunicator

Agent 后端通信的抽象接口。不同 backend（claude-code、cursor）实现各自的通信协议。

```typescript
interface AgentCommunicator {
  runPrompt(workspaceDir: string, prompt: string, options?: RunPromptOptions): Promise<PromptResult>;
  streamPrompt(workspaceDir: string, prompt: string, options?: RunPromptOptions): AsyncIterable<StreamChunk>;
}

interface PromptResult {
  text: string;
  sessionId?: string;
}

interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
}

interface RunPromptOptions {
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  sessionId?: string;
  timeoutMs?: number;
  maxTurns?: number;
  model?: string;
}
```

| 实现 | Backend | 说明 |
|------|---------|------|
| `ClaudeCodeCommunicator` | `claude-code` | `claude -p --output-format json\|stream-json`，stdin/stdout 通信（fallback） |
| `AcpCommunicator` | `claude-code` (ACP) | 通过 ACP session 发送 prompt，用于已 start 的 Agent |
| `PiCommunicator` | `pi` | 通过 pi-agent-core SDK 发送 prompt；由 `@actant/pi` 包提供 |
| `CursorCommunicator` | `cursor` | Stub — Cursor CLI 尚不支持 pipe 模式，调用时抛出错误 |

工厂函数 `createCommunicator(backendType)` 根据 `AgentBackendType` 选择实现。外部包可通过 `registerCommunicator(type, factory)` 注册自定义通信器（如 `@actant/pi` 在 AppContext 初始化时注册 `PiCommunicator`）。`AgentManager` 对已启动的 ACP Agent 优先使用 `AcpCommunicator`。

> 实现参考：`packages/core/src/communicator/`，`packages/acp/src/communicator.ts`，`packages/pi/src/pi-communicator.ts`

### 5.6 CLI 错误展示

CLI 层按以下优先级处理错误：

1. `ConnectionError` → 提示 Daemon 未运行
2. `RpcCallError` → 显示错误码和消息
3. `ActantError` → 显示 code、message、context
4. 通用 `Error` → 显示 message

---

## 7. ACP 实时交互层 — Direct Bridge + Session Lease 双模式

> **⚠️ ACP 协议权威来源**: 一切 ACP 协议类型和行为以官方文档为准 — https://agentclientprotocol.com/protocol/schema
> 修改 ACP 相关代码/文档前，先查阅官方最新定义。完整文档索引: https://agentclientprotocol.com/llms.txt
> ACP 类型的全接口参考见 [`docs/reference/acp-interface-reference.md`](../../docs/reference/acp-interface-reference.md)。
>
> 状态：**已实现**（参见 [Issue #35](../../.trellis/issues/0035-acp-proxy-full-protocol.json)、[启动场景文档](../../docs/design/agent-launch-scenarios.md)）
>
> 最终架构：**Direct Bridge（默认）+ Session Lease（`--lease`）**。废弃原 ACP Gateway 架构。

### 7.1 架构概述

Issue #35 经过多轮演进，最终采用双模式架构：

| 模式 | 命令 | 谁持有进程 | 谁持有 ACP | 适用场景 |
|------|------|-----------|-----------|---------|
| **Direct Bridge**（默认） | `proxy <name>` | Proxy 进程 | Proxy 进程 | IDE 接入、完全隔离 |
| **Session Lease** | `proxy <name> --lease` | Daemon | Daemon | 多客户端共享、会话保持 |

**核心设计原则**：
1. **CWD 永远是 agent workspace** — 消除 cwd 映射问题
2. **1 Instance : 1 Process（严格 1:1）** — 永远不会出现一个 Instance 对应多个 Process
3. **并发通过自动实例化** — Instance 被占用时自动创建 ephemeral 副本

### 7.2 Direct Bridge 模式（默认）

**流程**：Proxy 自行 spawn Agent，建立 stdio 桥接，Daemon 仅做生命周期管理。

```
IDE → actant proxy my-agent
     → Daemon.resolve(name) → workspace + command
     → 如果 Instance 已被占用 → 自动从 Template 创建 ephemeral Instance
     → Proxy spawn Agent（cwd = instance workspace）
     → Daemon.attach(instanceName, pid)
     → stdio 双向桥接：IDE ←→ Proxy ←→ Agent
     → 断开时：terminate Agent → Daemon.detach() → ephemeral Instance 自动销毁
```

**特点**：
- 纯字节流转发，不做 ACP 消息解析
- 进程随连接走，完全隔离
- 支持自动实例化（并发连接）

### 7.3 Session Lease 模式（`--lease`）

**流程**：Daemon 持有 Agent 进程和 AcpConnection，客户端租借 Session。

```
actant agent start my-agent       # Daemon 启动 Agent（warm）
actant proxy my-agent --lease     # IDE 通过 Session Lease 接入
  → Daemon 调用 newSession(agentWorkspace) → sessionId
  → 建立 streaming relay：Client ←→ Daemon ←→ Agent
  → 断开时：session 进入 idle，Agent 保持运行
```

**Session Registry** 管理会话生命周期：
- `active` → `idle` → `expired` 状态转换
- Idle TTL 默认 30 分钟，超时自动清理
- 支持会话恢复（客户端重连）

### 7.4 Session Lease API

Session Lease 模式使用以下 RPC 方法：

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `gateway.lease` | `{ agentName }` | `{ socketPath }` | 创建 per-agent 命名管道/Unix socket，IDE 通过该 socket 与 ACP Gateway 通信 |
| `session.create` | `{ agentName, clientId, idleTtlMs? }` | `SessionLeaseInfo` | 创建新会话 |
| `session.prompt` | `{ sessionId, text }` | `SessionPromptResult` | 发送消息（同步） |
| `session.cancel` | `{ sessionId }` | `{ ok }` | 取消正在进行的 prompt |
| `session.close` | `{ sessionId }` | `{ ok }` | 关闭会话 |
| `session.list` | `{ agentName? }` | `SessionLeaseInfo[]` | 列会话 |

#### gateway.lease ✅ 已实现

为指定 Agent 创建专用命名管道（Windows）或 Unix socket，IDE 连接后桥接到 AcpGateway。

**参数 `GatewayLeaseParams`：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `agentName` | `string` | **是** | 目标 Agent 实例名（必须处于 `running` 状态且有 ACP 连接） |

**返回 `GatewayLeaseResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `socketPath` | `string` | 创建的命名管道/Unix socket 路径（Windows: `\\.\pipe\actant-gw-<name>-<id>`，Unix: `/tmp/actant-gw-<name>-<id>.sock`） |

**行为：**
- Agent 必须处于 `running` 状态且有活跃的 ACP 连接
- 同一 Agent 的多次 lease 请求会复用已有 socket（如果上游未连接）
- 如果上游已连接（单 IDE 独占），先断开旧连接再创建新 lease
- Daemon 关闭时自动清理所有 lease socket（`disposeAllLeases()`）

**可能错误：** `AGENT_NOT_FOUND`（Agent 不存在）、通用 Error（Agent 未运行、无 ACP 连接、无 Gateway）

> 实现参考：`packages/api/src/handlers/gateway-handlers.ts`

**SessionLeaseInfo** 结构：

```typescript
interface SessionLeaseInfo {
  sessionId: string;
  agentName: string;
  clientId: string | null;    // null when idle
  state: "active" | "idle" | "expired";
  createdAt: string;
  lastActivityAt: string;
  idleTtlMs: number;
}
```

### 7.5 Proxy ACP 协议适配器（Session Lease 模式）

IDE 只会说 ACP 协议，Proxy 在 Session Lease 模式下做协议翻译：

| IDE ACP 消息 | Proxy 处理 | Daemon RPC |
|-------------|-----------|-----------|
| `initialize` | 返回缓存的 Agent 能力 | （不转发） |
| `session/new` | 调用 | `session.create` |
| `session/prompt` | 调用 | `session.prompt` |
| `session/cancel` | 调用 | `session.cancel` |

**非 ACP 客户端**（CLI chat、Web UI）直接使用 Daemon 结构化 API，无需适配层。

### 7.6 agent chat 实现

`actant agent chat <name>` 始终通过 **acp** 模式与 Agent 交互，根据 Agent 状态自动选择 ACP 连接方式：

1. **Agent 未运行** → Direct Bridge（CLI 自行建立 ACP 连接）
   - CLI 调用 `agent.resolve` 获取 spawn info → `AcpConnection.spawn()` 启动 ACP bridge
   - ACP bridge 命令自动解析：优先查找 PATH 上的全局命令，回退到 `@actant/acp` 依赖的 `node_modules` 内安装
   - 使用 `AcpConnection.streamPrompt()` 流式输出
   - 退出时清理进程

2. **Agent 已运行**（`agent start`）→ Daemon-managed ACP
   - 使用 `agent.prompt` RPC（复用 Daemon 持有的 ACP 连接）
   - 保留 session 上下文

### 7.7 外部客户端配置示例

**Direct Bridge 模式**（推荐用于 IDE）：

```json
{
  "agent": {
    "command": "actant",
    "args": ["proxy", "my-agent"],
    "protocol": "acp/stdio"
  }
}
```

**Session Lease 模式**（需要预启动 Agent）：

```bash
actant agent start my-agent
# 然后
actant proxy my-agent --lease
```

### 7.8 Legacy Proxy（已废弃）

原 `proxy.connect` / `proxy.forward` RPC 方法（§3.7）已标记为 legacy，保留给兼容性场景。新代码应使用 Direct Bridge 或 Session Lease 模式。

---

## 8. Agent-to-Agent 通信 — Email 范式（#136）

> 状态：**规范已定义，未实现**

Agent 间通信采用异步 **Email 范式**，通过 CLI / JSON-RPC API 作为主要通道。

### 8.1 通信通道优先级

| 优先级 | 通道 | 协议 | 使用者 |
|--------|------|------|--------|
| **P1** | CLI | `actant email send/inbox/reply/threads` | 人、Agent（通过 shell 调用）、脚本 |
| **P1** | JSON-RPC | `email.send` / `email.inbox` / `email.reply` | Agent 进程、外部应用 |
| P4 | MCP (可选) | `actant_send_email` 等 (#16) | Agent 从 IDE 内部通过 MCP tool call |

### 8.2 协议栈

```
人 / Agent / 外部应用
    │
    ├── CLI:  actant email send --to agent-b --subject "..." --body "..."
    ├── RPC:  email.send { to: ["agent-b"], subject: "...", body: "..." }
    │
    ▼
Actant Daemon
    │
    ├── Email Hub（路由 + 投递 + 持久化 + 状态追踪）
    │     ├── 收件人解析 → Agent Instance
    │     ├── CC/群发路由
    │     ├── 排队（Agent 未运行时）
    │     └── Email 记录持久化
    │
    ├── 雇员 Agent → EmailInput → TaskQueue → 主 Session 处理
    └── 普通 Agent → 启动新进程/Session → 处理 → 自动回复
```

### 8.3 Email RPC Methods（规划）

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `email.send` | `{ to, cc?, subject, body, sourceType, replyTo?, inReplyTo?, priority?, callback? }` | `{ emailId, status }` | 发送 Email |
| `email.inbox` | `{ agentName, status?, limit? }` | `AgentEmail[]` | 查看收件箱 |
| `email.reply` | `{ emailId, body }` | `{ emailId, status }` | 回复 Email |
| `email.fork` | `{ forkFrom, reason, compressedContext, body }` | `{ emailId, obsoleted }` | 时间线分叉（见 §8.7） |
| `email.threads` | `{ agentName?, threadId? }` | `EmailThread[]` | 列出 threads（含分叉） |
| `email.status` | `{ emailId }` | `AgentEmail` | 查询单封 Email 状态 |

### 8.4 Email CLI Commands（规划）

```bash
actant email send --to <agent> [--cc <agent>...] --subject "..." --body "..." [--reply-to <target>] [--callback <endpoint>]
actant email inbox <agent-name> [--status pending|delivered|replied]
actant email reply <email-id> --body "..."
actant email fork --from <email-id> --reason context-compression|direction-change --context "..." --body "..."
actant email threads [<agent-name>] [--show-forks]
actant email show <email-id>
```

### 8.5 来源与回复路由

`sourceType` 为必填字段，Email Hub 据此决定回复投递策略：

| sourceType | 回复行为 |
|-----------|---------|
| `agent` | 回复投递到发送方 Agent 收件箱 |
| `human` | 回复标记为已完成，人通过 `actant email inbox` 查看 |
| `system` | 回复投递到 system inbox（hook/cron 触发的自动 Email） |
| `external` | 回复投递 + 触发 `callback` 通知外部应用 |

- **`replyTo`**：覆盖回复投递目标。缺省时回复发往 `from`。
- **`callback`**：`{ type: 'webhook' | 'rpc', endpoint: string, headers?: Record<string, string> }`。Email Hub 投递回复后额外触发通知。

### 8.6 CLI-first 工具暴露原则（#228 设计决策）

> **核心原则：所有对 Agent 暴露的系统能力统一通过 `actant internal <command> --token` CLI 暴露，MCP 仅作为可选封装层。**

#### 为什么 CLI/API 优先而非 MCP

| 维度 | CLI (`actant internal`) | MCP (`@actant/mcp-server`) |
|------|------------------------|----------------------------|
| 基础设施 | 复用现有 Daemon RPC + CLI 框架 | 需要额外的 mcp-server 进程 |
| 适用范围 | **所有 backend**（Cursor / Claude Code / Pi / Custom） | 仅支持 MCP 协议的 backend |
| 使用门槛 | Agent shell 内直接调用，零额外依赖 | 需 MCP SDK + Server 配置 |
| 测试 | 人/Agent/脚本均可直接测试 | 需 MCP client 环境 |
| 审计 | `ToolCallInterceptor` 已能捕获 Bash 调用 | 需额外 MCP 层审计 |
| 实现成本 | 低（复用现有 RPC handler 注册模式） | 中（新包 + 新进程 + 新协议层） |

#### `actant internal` 工具暴露体系

所有 Agent 可调用的系统能力通过 `actant internal` 子命令暴露，使用 session token 认证：

```
Agent (Bash/Shell)
  └─ actant internal <command> --token $ACTANT_SESSION_TOKEN [args]
       └─ CLI → Daemon JSON-RPC
            └─ RPC Handler → 业务逻辑

MCP (可选封装层, 非必需)
  └─ @actant/mcp-server 将 CLI 包装为 MCP tools
       └─ 内部仍调 Daemon RPC（同路径）
```

| 工具类别 | CLI 命令 | RPC 方法 | 可用 archetype |
|---------|---------|---------|---------------|
| Canvas 更新 | `actant internal canvas update --token $T --html <h>` | `internal.canvasUpdate` | service, employee |
| Canvas 清除 | `actant internal canvas clear --token $T` | `internal.canvasClear` | service, employee |
| 延迟调度 | `actant internal schedule wait --token $T --delay <ms> --prompt <p>` | `schedule.wait` | employee |
| Cron 调度 | `actant internal schedule cron --token $T --pattern <p> --prompt <p>` | `schedule.cron` | employee |
| 取消调度 | `actant internal schedule cancel --token $T --task-id <id>` | `schedule.cancel` | employee |
| 发送 Email | `actant internal email send --token $T --to <agent> --body <b>` | `email.send` | service, employee |
| 查看收件箱 | `actant internal email inbox --token $T` | `email.inbox` | service, employee |
| 回复 Email | `actant internal email reply --token $T --id <id> --body <b>` | `email.reply` | service, employee |
| 自身状态 | `actant internal status self --token $T` | `internal.selfStatus` | service, employee |
| 调度 Agent | `actant internal agent prompt --token $T --target <name> --message <m>` | `agent.prompt` | service, employee |
| 动态订阅事件 | `actant internal hook subscribe --token $T --event <e> --prompt <p>` | `hook.subscribe` | service, employee |
| 取消订阅 | `actant internal hook unsubscribe --token $T --id <id>` | `hook.unsubscribe` | service, employee |
| 查看订阅 | `actant internal hook list --token $T --dynamic` | `hook.list` | service, employee |

#### 按 Archetype 分层暴露

| 层级 | 可用系统工具 | 暴露方式 |
|------|------------|---------|
| `repo` | 无（Actant 不持有进程，不注入 token） | N/A |
| `service` | canvas、status、email、agent 间通信 | `actant internal` CLI |
| `employee` | service 全部 + schedule（wait/cron/cancel）、self-status | `actant internal` CLI |

#### Session Token 安全模型

- `SessionContextInjector.prepare()` 为每个 ACP session 生成唯一 token
- Token 通过 `$ACTANT_SESSION_TOKEN` 环境变量注入 Agent 进程
- `actant internal` 命令使用 `--token` 参数认证，Daemon 校验 token 合法性
- Token 生命周期跟随 session，session 结束后 token 失效
- Token 不写入 workspace 文件，仅存在于进程环境变量和 Daemon 内存

### 8.7 时间线分叉 — "发往过去的 Email"

Email 链形成因果时间线（DAG）。特异能力：Agent 或人可以**向过去的某个节点发送 Email，创建新分叉**。

**语义**：新分叉从过去节点开始，但携带了未来的压缩知识（带记忆的 time travel）。原时间线中被分叉覆盖的后续 Email 标记为 `obsolete`。

**两种分叉原因**：

| forkReason | 语义 | 压缩内容 |
|------------|------|---------|
| `context-compression` | 方向正确，但上下文消耗过多 | 压缩后的正确结论，跳过中间推导 |
| `direction-change` | 方向错误，需要换方案 | 压缩后的失败教训 + "换方案"指令 |

**触发方式**：
- **人为指定**：`actant email fork --from <emailId> --reason direction-change --context "方案A失败因为..." --body "请尝试方案B"`
- **Agent 自发**：Agent 在处理过程中检测到上下文浪费或方向错误，调用 `email.fork` RPC

**`email.fork` 行为**：
1. 找到 `forkFrom` 指向的目标 Email
2. 将目标 Email 之后的同一 thread 中的后续 Email 标记为 `obsolete`
3. 创建新 Email，`inReplyTo` 设为 `forkFrom`，携带 `compressedContext`
4. 新 Email 投递给目标 Email 的收件人，开启新分叉时间线
5. 返回 `{ emailId, obsoleted: string[] }`

**时间线 DAG 示例**：
```
E1[需求] → E2[方案A] → E3[实现] → E4[产出] → E5[发现问题]
                │                                     │
                │         fork(reason=direction-change)│
                │◄────────────────────────────────────┘
                │
                └→ E2'[换方案B + 失败教训] → E3'[方案B实现] → ...
                   (E3,E4,E5 marked obsolete)
```

### 8.8 MCP Server（#16, P4 可选封装层）

> 长期保留。MCP Server 不是主通道，而是对 `actant internal` CLI 的**可选封装层**，内部仍调 Daemon RPC（#228 CLI-first 设计决策）。

当 Agent 的 backend 原生支持 MCP（如 Pi），可通过 `@actant/mcp-server` 将 CLI 能力包装为 MCP tools：

| MCP Tool 名称 | 对应 CLI | 说明 |
|---------------|---------|------|
| `actant_send_email` | `actant internal email send` | 发送 Email |
| `actant_check_inbox` | `actant internal email inbox` | 查看收件箱 |
| `actant_reply_email` | `actant internal email reply` | 回复 Email |
| `actant_agent_status` | `actant internal status self` | 查询 Agent 状态 |
| `actant_schedule_wait` | `actant internal schedule wait` | 延迟调度 |

> **实现约束**：每个 MCP tool 的 handler 内部必须调用对应的 Daemon RPC handler，不允许直接实现业务逻辑。确保 CLI 和 MCP 两条路径行为一致。

---

## 9. REST API Server (`@actant/rest-api`)

独立的 RESTful HTTP API 服务器，供 Dashboard、n8n、IM 机器人等外部系统访问。

**启动方式**：`actant api [-p 3100] [-k <api-key>]`

**认证**：可选 API Key，通过 `Authorization: Bearer <key>` 或 `X-API-Key` header 传递，或 `ACTANT_API_KEY` 环境变量配置。

### 端点总览

所有端点前缀 `/v1/`。

| 分类 | 方法 | 路径 | RPC 映射 |
|------|------|------|----------|
| System | GET | `/v1/status` | `daemon.ping` |
| System | POST | `/v1/shutdown` | `daemon.shutdown` |
| System | GET | `/v1/sse` | SSE 实时流 |
| System | GET | `/v1/openapi` | 自描述端点目录 |
| Agents | GET | `/v1/agents` | `agent.list` |
| Agents | POST | `/v1/agents` | `agent.create` |
| Agents | GET | `/v1/agents/:name` | `agent.status` |
| Agents | DELETE | `/v1/agents/:name` | `agent.destroy` |
| Agents | POST | `/v1/agents/:name/start` | `agent.start` |
| Agents | POST | `/v1/agents/:name/stop` | `agent.stop` |
| Agents | POST | `/v1/agents/:name/prompt` | `agent.prompt` |
| Agents | POST | `/v1/agents/:name/run` | `agent.run` |
| Agents | PUT | `/v1/agents/:name/permissions` | `agent.updatePermissions` |
| Activity | GET | `/v1/agents/:name/sessions` | `activity.sessions` |
| Activity | GET | `/v1/agents/:name/sessions/:id` | `activity.conversation` |
| Activity | GET | `/v1/agents/:name/logs` | `agent.processLogs` |
| Templates | GET | `/v1/templates` | `template.list` |
| Templates | GET | `/v1/templates/:name` | `template.get` |
| Domain | GET | `/v1/skills` | `skill.list` |
| Domain | GET | `/v1/prompts` | `prompt.list` |
| Domain | GET | `/v1/mcp-servers` | `mcp.list` |
| Domain | GET | `/v1/workflows` | `workflow.list` |
| Domain | GET | `/v1/plugins` | `plugin.list` |
| Events | GET | `/v1/events` | `events.recent` |
| Canvas | GET | `/v1/canvas` | `canvas.list` |
| Canvas | GET | `/v1/canvas/:agent` | `canvas.get` |
| Sessions | GET | `/v1/sessions` | `session.list` |
| Sessions | POST | `/v1/sessions` | `session.create` |
| Webhooks | POST | `/v1/webhooks/message` | `agent.prompt`（简化封装） |
| Webhooks | POST | `/v1/webhooks/run` | `agent.run`（简化封装） |

### Webhook 接口

为 n8n / IM 集成设计的简化接口：

**POST `/v1/webhooks/message`**
```json
{ "agent": "my-agent", "message": "Hello", "metadata": {} }
→ { "agent": "my-agent", "response": "...", "sessionId": "..." }
```

**POST `/v1/webhooks/run`**
```json
{ "agent": "my-agent", "prompt": "Analyze this", "template": "analyst" }
→ { "agent": "my-agent", "response": "...", "sessionId": null }
```

### 错误映射

| RPC 错误码 | HTTP 状态码 | 含义 |
|-----------|------------|------|
| -32001 (TEMPLATE_NOT_FOUND) | 404 | 模板未找到 |
| -32003 (AGENT_NOT_FOUND) | 404 | Agent 未找到 |
| -32002 (CONFIG_VALIDATION) | 400 | 参数校验失败 |
| -32004 (AGENT_ALREADY_RUNNING) | 409 | Agent 已在运行 |
| -32601 (METHOD_NOT_FOUND) | 404 | 方法不存在 |
| 其他 | 500 | 内部错误 |

---

## 10. 六种外部接入模式对比

| 维度 | CLI / RPC | REST API | ACP Proxy | Email (#136) | MCP Server (#16, P4) | Self-spawn + Attach |
|------|-----------|----------|-----------|--------------|---------------------|---------------------|
| **调用方** | 开发者 / 脚本 | n8n / IM / Web | IDE / 应用 | Agent / 人 / 应用 | IDE 内 Agent | 应用（Unreal 等） |
| **协议** | JSON-RPC | HTTP/SSE | ACP / stdio | JSON-RPC (email.*) | MCP / stdio | JSON-RPC |
| **通信模式** | 同步 | 同步+SSE | 同步/流式 | **异步** | 同步 | 同步 |
| **谁 spawn Agent** | Daemon | Daemon | Daemon | Daemon | Daemon | **调用方自己** |
| **认证** | 无 | API Key | 无 | 无 | 无 | 无 |
| **CC/群发** | 否 | 否 | 否 | **是** | 否 | 否 |
| **持久化记录** | 否 | 否 | 否 | **是（Email Hub）** | 否 | 否 |
| **实现状态** | 已实现 | 已实现 | 已实现 | 规划中 | P4 长期 | 已实现 |

```
通信模式谱系：
同步 ◄──────────────────────────────────────────────► 异步

 agent.run     ACP Proxy    REST API     agent.prompt     Email
 (一次性)      (流式交互)   (HTTP+SSE)    (单次提问)       (异步投递,
                           n8n/IM/Web                     跨时间线,
                                                         CC/群发)
```

---

## 变更约定

> 对本文档所定义的任何 RPC 方法、CLI 命令、错误码或公共接口进行增删改时，**必须先更新本文档，再修改代码**，并在同一次提交中完成。
