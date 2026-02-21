# 接口契约 (API Contracts)

> 本文档定义 AgentCraft 的所有对外接口：IPC 协议、RPC 方法、CLI 命令、ACP Proxy 协议和 MCP Server 能力。
> **代码必须符合此契约。若代码行为与此文档不一致，以本文档为准。**

---

## 概述

AgentCraft 的接口架构（两层协议分工）：

```
     管理操作 (RPC)                          实时交互 (ACP)

  CLI (agentcraft)                 外部 ACP Client (IDE/Desktop)
        │                                    │
  RpcClient (JSON-RPC 2.0)             ACP / stdio
        │                                    │
  Unix Socket / Named Pipe          ACP Proxy (薄层 stdio↔socket)
        │                                    │
        │                             ACP / Unix socket
        │                                    │
        │                         agent chat (内置 ACP Client)
        │                                    │
        │                             ACP / Unix socket
        │                                    │
        └────────────────┬───────────────────┘
                         │
              ┌──────────▼──────────────────────┐
              │       AgentCraft Core (Daemon)    │
              │                                   │
              │  RPC: HandlerRegistry             │
              │   ├─ Agent/Template/Domain/Daemon │
              │   └─ Proxy(legacy) handlers       │
              │                                   │
              │  ACP Gateway: Session 多路复用     │
              │   ├─ AgentSideConnection (面向上游)│
              │   └─ ClientSideConnection (面向下游)│
              └──────────────┬────────────────────┘
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
| **MCP / stdio** | stdio | Agent-to-Agent 通信 | 外部 Agent 调用 |

**核心原则**：RPC 层处理管理操作，ACP Gateway 层处理实时交互。不存在"用 RPC 传 ACP 消息"的错位。

### 四种外部接入模式

| 模式 | 协议 | 适用场景 | 参见 |
|------|------|---------|------|
| **CLI** | JSON-RPC via Socket | 开发者 / 脚本自动化 | §4 |
| **ACP Proxy** | ACP / stdio → ACP Gateway | IDE / 应用接入托管 Agent | §7 |
| **agent chat** | ACP / Unix socket → ACP Gateway | 终端交互式聊天（流式） | §4.2, §7 |
| **MCP Server** | MCP / stdio | Agent-to-Agent 通信 | §8 |
| **Self-spawn + Attach** | JSON-RPC via Socket | 外部客户端自己 spawn Agent，注册到 AgentCraft | §3.3 |

- **传输层**：JSON-RPC 2.0，换行分隔，通过 Unix Socket（Windows Named Pipe）
- **客户端超时**：10 秒
- **Socket 路径**：`AGENTCRAFT_SOCKET` 环境变量或平台默认值（详见 [配置规范](./config-spec.md#5-平台与-ipc)）

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

`error.data.errorCode` 对应 `AgentCraftError.code`，`error.data.context` 携带结构化调试信息。

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

**映射规则**：`AgentCraftError` 子类在 Socket Server 边界处映射为对应 RPC 错误码；未映射的异常一律返回 `INTERNAL_ERROR`。

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
| `template.validate` | `{ filePath }` | `{ valid, template?, errors? }` | — |

### 3.2 Agent 生命周期

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.create` | `{ name, template, overrides? }` | `AgentInstanceMeta` | `TEMPLATE_NOT_FOUND`, `CONFIG_VALIDATION`, `WORKSPACE_INIT`, `COMPONENT_REFERENCE` |
| `agent.start` | `{ name }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND`, `AGENT_ALREADY_RUNNING`, `AGENT_LAUNCH` |
| `agent.stop` | `{ name }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND` |
| `agent.destroy` | `{ name }` | `{ success }` | `AGENT_NOT_FOUND`, `INSTANCE_CORRUPTED` |
| `agent.status` | `{ name }` | `AgentInstanceMeta` | `AGENT_NOT_FOUND` |
| `agent.list` | `{}` | `AgentInstanceMeta[]` | — |

#### agent.create 的 overrides 参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `launchMode` | `LaunchMode` | 覆盖模板默认启动模式 |
| `workspacePolicy` | `WorkspacePolicy` | 覆盖默认 workspace 策略 |
| `workDir` | `string` | 自定义 workspace 绝对路径（省略则默认 `{instancesDir}/{name}`） |
| `workDirConflict` | `"error" \| "overwrite" \| "append"` | workDir 已存在时的行为，默认 `"error"` |
| `metadata` | `Record<string, string>` | 额外元数据 |

**workDir 机制**：当指定 `workDir` 时，域上下文文件和 `.agentcraft.json` 写入该目录，同时在 `{instancesDir}/{name}` 创建指向它的链接以供 Manager 发现（macOS/Linux 使用 symlink，Windows 使用 junction）。Destroy 时仅移除链接和 `.agentcraft.json`，保留用户目录中的其余文件。

### 3.3 外部 Spawn 支持

供外部客户端（Unreal/Unity 等）自行 spawn Agent 进程，同时将状态注册到 AgentCraft 进行跟踪。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.resolve` | `{ name, template? }` | `ResolveResult` | `AGENT_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `WORKSPACE_INIT` |
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
       ← { workspaceDir: "/.../.agentcraft/instances/reviewer",
            command: "claude", args: ["--workspace", "..."], ... }
Client → 自行 spawn(command, args)
Client → agent.attach({ name: "reviewer", pid: 12345 })
```

#### agent.attach

告知 AgentCraft 某个实例的进程已由外部客户端启动。AgentCraft 将更新实例状态为 `running`，记录 PID，并开始 ProcessWatcher 监控。

**参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | **是** | 实例名 |
| `pid` | `number` | **是** | 外部 spawn 的进程 ID |
| `metadata` | `Record<string, string>` | 否 | 附加信息（如客户端 session ID） |

**行为：**
- 设置 `processOwnership: "external"`，`pid`，`status: "running"`
- 注册 ProcessWatcher 进行 PID 存活监控
- 若 ProcessWatcher 检测到 PID 死亡但客户端未 detach，状态变为 `"crashed"`

#### agent.detach

告知 AgentCraft 外部客户端已停止某个实例的进程。

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

> 状态：**已实现**（Phase 2 MVP）

查询 Daemon 已加载的领域组件（skills、prompts、MCP 配置、workflows）。组件定义在 Daemon 启动时从 `configs/` 目录自动加载。

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
```

> `CONFIG_NOT_FOUND` 错误映射到 `GENERIC_BUSINESS` (-32000) RPC 错误码。

> 实现参考：`packages/api/src/handlers/domain-handlers.ts`，类型定义见 `packages/shared/src/types/domain-component.types.ts`

### 3.6 Agent 任务 API（ACP 集成） ✅ 已实现

> 状态：**已实现**（Phase 3 — ACP 集成）

供 ACP Proxy 或 MCP Server 向 AgentCraft 管理的 Agent 发送任务。**依赖 Daemon 与 Agent 间的 ACP 连接**（即 `processOwnership: "managed"`）。`agent.prompt` 通过 Daemon 持有的 ACP 连接与已启动的 Agent 通信。`agent.run` 对已启动的 ACP Agent 优先使用 ACP 连接，对未启动的 Agent 仍回退到 CLI pipe 模式。

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

### 3.8 守护进程

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `daemon.ping` | `{}` | `{ version, uptime, agents }` | 健康检查 |
| `daemon.shutdown` | `{}` | `{ success }` | 优雅关闭 |

---

## 4. CLI 命令

CLI 是 RPC 方法的用户端映射。每条命令内部调用对应的 RPC 方法。

### 全局选项

| 选项 | 说明 |
|------|------|
| `-V, --version` | 显示版本号 |
| `-h, --help` | 显示帮助 |

无子命令时进入交互式 **REPL**。

### 4.1 模板命令 (`agentcraft template` / `agentcraft tpl`)

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `template list` | — | `-f, --format <table\|json\|quiet>` | `template.list` |
| `template show <name>` | `name` | `-f, --format` | `template.get` |
| `template validate <file>` | `file` | — | `template.validate` |
| `template load <file>` | `file` | — | `template.load` |

> `template.unload` 无 CLI 对应，仅通过 RPC 可用。

### 4.2 Agent 命令 (`agentcraft agent`)

#### 生命周期管理

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent create <name>` | `name` | `-t, --template`（必填）, `--launch-mode`, `--work-dir`, `--overwrite`, `--append`, `-f, --format` | `agent.create` |
| `agent start <name>` | `name` | — | `agent.start` |
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

- `agent run`：发送单次 prompt，输出结果后退出。对已启动（`agent start`）的 ACP Agent 优先使用 ACP 连接，否则回退到 CLI pipe 模式。支持 `--format text|json`。
- `agent prompt`：向已启动的 ACP Agent 发送消息。要求 Agent 已通过 `agent start` 启动。
- `agent chat`：进入交互式 REPL 模式。输入 `exit`/`quit` 或 Ctrl+C 退出。通过 `--session-id` 和 claude-code session 机制维护跨消息上下文。

### 4.3 外部 Spawn 命令

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent resolve <name>` | `name` | `-t, --template`, `-f, --format` | `agent.resolve` |
| `agent attach <name>` | `name` | `--pid`（必填）, `--metadata` | `agent.attach` |
| `agent detach <name>` | `name` | `--cleanup` | `agent.detach` |

### 4.4 Domain 组件命令（✅ 已实现）

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `skill list` | — | `-f, --format` | `skill.list` |
| `skill show <name>` | `name` | `-f, --format` | `skill.get` |
| `prompt list` | — | `-f, --format` | `prompt.list` |
| `prompt show <name>` | `name` | `-f, --format` | `prompt.get` |
| `mcp list` | — | `-f, --format` | `mcp.list` |
| `mcp show <name>` | `name` | `-f, --format` | `mcp.get` |
| `workflow list` | — | `-f, --format` | `workflow.list` |
| `workflow show <name>` | `name` | `-f, --format` | `workflow.get` |

组件定义文件从 `~/.agentcraft/configs/` 目录加载（可通过 `--configs-dir` 覆盖）：

```
~/.agentcraft/configs/
├── skills/          # SkillDefinition JSON
├── prompts/         # PromptDefinition JSON
├── mcp/             # McpServerDefinition JSON
├── workflows/       # WorkflowDefinition JSON
└── templates/       # AgentTemplate JSON
```

### 4.5 ACP Proxy 命令

| 命令 | 参数 | 选项 | 行为 |
|------|------|------|------|
| `proxy <name>` | Agent 实例名 | `--lease`, `-t, --template` | 启动 ACP Proxy 进程（详见 §7） |

**用法：** 外部 ACP Client 将 `agentcraft proxy <name>` 作为 Agent 可执行文件 spawn。

```bash
# 外部客户端配置示例
agentcraft proxy my-agent                    # Direct Bridge 模式（默认）
agentcraft proxy my-agent --lease            # Session Lease 模式（需预启动 Agent）
agentcraft proxy my-agent -t review-template # 不存在则自动创建
```

> `--env-passthrough` 选项 *(not yet implemented)*

### 4.6 守护进程命令 (`agentcraft daemon`)

| 命令 | 选项 | 行为 |
|------|------|------|
| `daemon start` | `--foreground` | 启动守护进程；`--foreground` 在当前进程运行 |
| `daemon stop` | — | 发送 `daemon.shutdown` RPC |
| `daemon status` | `-f, --format` | 发送 `daemon.ping` RPC |

> 实现参考：`packages/cli/src/commands/`

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

工厂函数 `createLauncher(config?)` 根据 `config.mode` 或 `AGENTCRAFT_LAUNCHER_MODE` 选择实现。

### 5.2 HandlerRegistry

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

### 5.3 RpcClient

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

### 5.4 AgentCommunicator

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
| `CursorCommunicator` | `cursor` | Stub — Cursor CLI 尚不支持 pipe 模式，调用时抛出错误 |

工厂函数 `createCommunicator(backendType)` 根据 `AgentBackendType` 选择实现。`AgentManager` 对已启动的 ACP Agent 优先使用 `AcpCommunicator`。

> 实现参考：`packages/core/src/communicator/`，`packages/acp/src/communicator.ts`

### 5.5 CLI 错误展示

CLI 层按以下优先级处理错误：

1. `ConnectionError` → 提示 Daemon 未运行
2. `RpcCallError` → 显示错误码和消息
3. `AgentCraftError` → 显示 code、message、context
4. 通用 `Error` → 显示 message

---

## 7. ACP 实时交互层 — Direct Bridge + Session Lease 双模式

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
IDE → agentcraft proxy my-agent
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
agentcraft agent start my-agent       # Daemon 启动 Agent（warm）
agentcraft proxy my-agent --lease     # IDE 通过 Session Lease 接入
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
| `session.create` | `{ agentName, clientId, idleTtlMs? }` | `SessionLeaseInfo` | 创建新会话 |
| `session.prompt` | `{ sessionId, text }` | `SessionPromptResult` | 发送消息（同步） |
| `session.cancel` | `{ sessionId }` | `{ ok }` | 取消正在进行的 prompt |
| `session.close` | `{ sessionId }` | `{ ok }` | 关闭会话 |
| `session.list` | `{ agentName? }` | `SessionLeaseInfo[]` | 列会话 |

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

`agentcraft agent chat <name>` 根据 Agent 状态自动选择模式：

1. **Agent 未运行** → Direct Bridge 模式
   - 自行 spawn Agent
   - 使用 `AcpConnection.streamPrompt()` 流式输出
   - 退出时清理进程

2. **Agent 已运行**（`agent start`）→ Daemon-managed 模式
   - 使用 `agent.prompt` RPC（同步）
   - 保留 session 上下文

### 7.7 外部客户端配置示例

**Direct Bridge 模式**（推荐用于 IDE）：

```json
{
  "agent": {
    "command": "agentcraft",
    "args": ["proxy", "my-agent"],
    "protocol": "acp/stdio"
  }
}
```

**Session Lease 模式**（需要预启动 Agent）：

```bash
agentcraft agent start my-agent
# 然后
agentcraft proxy my-agent --lease
```

### 7.8 Legacy Proxy（已废弃）

原 `proxy.connect` / `proxy.forward` RPC 方法（§3.7）已标记为 legacy，保留给兼容性场景。新代码应使用 Direct Bridge 或 Session Lease 模式。

---

## 8. MCP Server — Agent 间通信能力

> 状态：**规范已定义，未实现**

AgentCraft MCP Server 向其他 Agent 暴露 Agent 管理能力。Agent A 通过 MCP tool call 即可创建、调用、查询 AgentCraft 管理的 Agent。

### 8.1 协议栈

```
Agent A (在 IDE 中运行)
    │
    │  MCP tool call
    ▼
AgentCraft MCP Server (packages/mcp-server)
    │
    │  AgentCraft API (JSON-RPC / Unix Socket)
    ▼
AgentCraft Daemon
    │
    │  ACP / stdio
    ▼
Agent B (headless, 被 AgentCraft 管理)
```

**Agent A 不直接用 ACP 和 Agent B 通信**。ACP 连接被 AgentCraft Daemon 独占（Daemon 是 Agent B 的 ACP Client）。Agent A 通过 MCP 工具调用间接操作。

### 8.2 MCP Tools

| Tool 名称 | 参数 | 返回 | 说明 |
|-----------|------|------|------|
| `agentcraft_run_agent` | `{ template, prompt }` | `{ response, artifacts? }` | 创建 ephemeral Agent 执行任务后返回 |
| `agentcraft_prompt_agent` | `{ name, message, sessionId? }` | `{ response, sessionId }` | 向持久 Agent 发送消息 |
| `agentcraft_agent_status` | `{ name }` | `AgentInstanceMeta` | 查询 Agent 状态 |
| `agentcraft_create_agent` | `{ name, template }` | `{ name, workspaceDir, status }` | 创建实例（不启动） |
| `agentcraft_list_agents` | `{}` | `AgentInstanceMeta[]` | 列出所有 Agent |

### 8.3 为什么 Agent-to-Agent 用 MCP 而非 ACP

| 维度 | ACP | MCP |
|------|-----|-----|
| 设计用途 | Client ↔ Agent（不对称） | Agent ↔ Tools/Services |
| Client 角色 | 提供环境（文件系统、终端、权限） | 调用工具 |
| Agent 能当 Client 吗 | 不能（自身不拥有环境能力） | 能（工具调用是 Agent 的核心能力） |
| 连接占用 | Agent stdio 被 ACP Client 独占 | MCP 是无状态工具调用 |

---

## 9. 四种外部接入模式对比

| 维度 | CLI | ACP Proxy | MCP Server | Self-spawn + Attach |
|------|-----|-----------|------------|---------------------|
| **调用方** | 开发者 / 脚本 | IDE / 应用 | 其他 Agent | 应用（Unreal 等） |
| **协议** | JSON-RPC | ACP / stdio | MCP / stdio | JSON-RPC |
| **谁 spawn Agent** | Daemon | Daemon | Daemon | **调用方自己** |
| **谁拥有 ACP** | Daemon | Daemon (Proxy转发) | Daemon | **调用方** |
| **AgentCraft 感知** | 完全 | 完全 | 完全 | 通过 attach 注册 |
| **环境穿透** | N/A | 可选 | 不支持 | 调用方自己处理 |
| **调用方灵活度** | 低 | 中 | 中 | **高** |

```
控制权谱系：
AgentCraft 全权 ◄──────────────────────────────────► 调用方全权

 agent.run     ACP Proxy      Self-spawn+Attach    纯 resolve
 (Daemon管)    (Daemon管,      (调用方管进程,       (只要workspace,
              Proxy转发ACP)    attach注册状态)      不注册)
```

---

## 变更约定

> 对本文档所定义的任何 RPC 方法、CLI 命令、错误码或公共接口进行增删改时，**必须先更新本文档，再修改代码**，并在同一次提交中完成。
