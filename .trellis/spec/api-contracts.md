# 接口契约 (API Contracts)

> 本文档定义 AgentCraft 的所有对外接口：IPC 协议、RPC 方法、CLI 命令、ACP Proxy 协议和 MCP Server 能力。
> **代码必须符合此契约。若代码行为与此文档不一致，以本文档为准。**

---

## 概述

AgentCraft 的接口架构：

```
                                   外部 ACP Client
                                        │
                                   ACP / stdio
                                        │
     CLI (agentcraft)           ACP Proxy (agentcraft proxy)
           │                            │
    RpcClient (JSON-RPC 2.0)    RpcClient (JSON-RPC 2.0)
           │                            │
           └────────────┬───────────────┘
                        │
             ┌──────────┼──────────┐
             │    Unix Socket /    │
             │    Named Pipe       │
             └──────────┼──────────┘
                        │
               Daemon (SocketServer)
                        │
                HandlerRegistry
           ┌────────┬───┼───┬────────┐
           ▼        ▼   ▼   ▼        ▼
        Agent   Template Daemon  Proxy      MCP Server
       Handlers Handlers Handlers Handlers  (MCP/stdio)
                                               │
                                          外部 Agent A
                                        (通过 MCP tool call)
```

### 协议分工

| 协议 | 用途 | 方向 |
|------|------|------|
| **JSON-RPC 2.0** | CLI / ACP Proxy ↔ Daemon 内部通信 | 内部 |
| **ACP / stdio** | 外部客户端 ↔ ACP Proxy；Daemon ↔ 托管 Agent | 外部 + 内部 |
| **MCP / stdio** | 外部 Agent ↔ AgentCraft MCP Server | 外部 |

### 四种外部接入模式

| 模式 | 协议 | 适用场景 | 参见 |
|------|------|---------|------|
| **CLI** | JSON-RPC via Socket | 开发者 / 脚本自动化 | §4 |
| **ACP Proxy** | ACP / stdio | IDE / 应用接入托管 Agent | §7 |
| **MCP Server** | MCP / stdio | Agent-to-Agent 通信 | §8 |
| **Self-spawn + Attach** | JSON-RPC via Socket | 外部客户端自己 spawn Agent，注册到 AgentCraft | §3.4 |

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
| `metadata` | `Record<string, string>` | 额外元数据 |

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

**返回 `ResolveResult`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 实例名 |
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

### 3.4 Agent 任务 API（需 ACP 集成）

供 ACP Proxy 或 MCP Server 向 AgentCraft 管理的 Agent 发送任务。**依赖 Daemon 与 Agent 间的 ACP 连接**（即 `processOwnership: "managed"`）。

| 方法 | 参数 | 返回 | 可能错误 |
|------|------|------|---------|
| `agent.run` | `{ template, prompt, cleanup? }` | `RunResult` | `TEMPLATE_NOT_FOUND`, `AGENT_LAUNCH` |
| `agent.prompt` | `{ name, message, sessionId? }` | `PromptResult` | `AGENT_NOT_FOUND`, `AGENT_NOT_ATTACHED` |

#### agent.run

一站式操作：创建 ephemeral 实例 → 启动 → 发送 prompt → 等待完成 → 可选清理。

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

向已运行的 managed Agent 发送消息。

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

### 3.5 Proxy Session 管理

ACP Proxy 进程与 Daemon 之间的内部 RPC 方法。外部用户不直接调用。

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `proxy.connect` | `{ agentName, envPassthrough }` | `ProxySession` | 建立 Proxy session |
| `proxy.disconnect` | `{ sessionId }` | `{ ok }` | 断开 Proxy session |
| `proxy.forward` | `{ sessionId, acpMessage }` | `AcpMessage` | 转发 ACP 消息给 Agent |
| `proxy.envCallback` | `{ sessionId, response }` | `{ ok }` | 回传环境请求的结果 |

### 3.6 守护进程

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

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent create <name>` | `name` | `-t, --template`（必填）, `--launch-mode`, `-f, --format` | `agent.create` |
| `agent start <name>` | `name` | — | `agent.start` |
| `agent stop <name>` | `name` | — | `agent.stop` |
| `agent status [name]` | `name`（可选） | `-f, --format` | `agent.status` / `agent.list` |
| `agent list` | — | `-f, --format` | `agent.list` |
| `agent destroy <name>` | `name` | `--force` | `agent.destroy` |

**输出格式**：`table`（默认）, `json`, `quiet`

**启动模式**：`direct`, `acp-background`, `acp-service`, `one-shot`

### 4.3 外部 Spawn 命令

| 命令 | 参数 | 选项 | 对应 RPC |
|------|------|------|---------|
| `agent resolve <name>` | `name` | `-t, --template`, `-f, --format` | `agent.resolve` |
| `agent attach <name>` | `name` | `--pid`（必填）, `--metadata` | `agent.attach` |
| `agent detach <name>` | `name` | `--cleanup` | `agent.detach` |

### 4.4 ACP Proxy 命令

| 命令 | 参数 | 选项 | 行为 |
|------|------|------|------|
| `proxy <name>` | Agent 实例名 | `--env-passthrough`, `-t, --template` | 启动 ACP Proxy 进程（详见 §7） |

**用法：** 外部 ACP Client 将 `agentcraft proxy <name>` 作为 Agent 可执行文件 spawn。

```bash
# 外部客户端配置示例
agentcraft proxy my-agent                    # workspace 隔离模式
agentcraft proxy my-agent --env-passthrough  # 环境穿透模式
agentcraft proxy my-agent -t review-template # 不存在则自动创建
```

### 4.5 守护进程命令 (`agentcraft daemon`)

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

### 5.4 CLI 错误展示

CLI 层按以下优先级处理错误：

1. `ConnectionError` → 提示 Daemon 未运行
2. `RpcCallError` → 显示错误码和消息
3. `AgentCraftError` → 显示 code、message、context
4. 通用 `Error` → 显示 message

---

## 7. ACP Proxy — 标准 ACP 协议网关

> 状态：**规范已定义，未实现**

ACP Proxy 是一个轻量进程（`agentcraft proxy`），对外暴露标准 ACP Agent 接口（stdio），对内通过 JSON-RPC 连接 AgentCraft Daemon。外部客户端（IDE / Unreal / Unity）无需了解 AgentCraft 内部实现，以标准 ACP 协议即可使用托管 Agent。

### 7.1 架构

```
外部 ACP Client (IDE / Unreal)
    │
    │  标准 ACP / stdio
    ▼
agentcraft proxy --agent <name>
    │
    │  JSON-RPC / Unix Socket
    ▼
AgentCraft Daemon
    │
    │  ACP / stdio (Daemon 拥有的连接)
    ▼
托管 Agent 进程
```

**从外部客户端视角**：`agentcraft proxy` 就是一个标准 ACP Agent。配置方式与 `claude` / `cursor-agent` 完全相同。

### 7.2 两种运行模式

| 模式 | 标志 | 行为 | 适用场景 |
|------|------|------|---------|
| **Workspace 隔离**（默认） | 无 | Agent 环境请求在 AgentCraft workspace 内闭环 | 纯任务委托 |
| **环境穿透** | `--env-passthrough` | Agent 环境请求穿透回外部客户端 | 远程 Agent 操作本地文件 |

#### Workspace 隔离模式

```
Client ──prompt──→ Proxy ──→ Daemon ──→ Agent
Client ←─result──  Proxy ←── Daemon ←── Agent

Agent 的 fs/readTextFile 等请求 → Daemon 在 workspace 内处理
```

#### 环境穿透模式

```
Client ──prompt──→ Proxy ──→ Daemon ──→ Agent
Client ←─result──  Proxy ←── Daemon ←── Agent

Agent ──fs/readTextFile──→ Daemon ──proxy.envCallback──→ Proxy ──ACP──→ Client
Client ──file content──→ Proxy ──proxy.envCallback──→ Daemon ──→ Agent
```

### 7.3 ACP 消息流

#### 初始化

```
Client                    Proxy                     Daemon
  │──initialize──────────→│                         │
  │                        │──proxy.connect(RPC)───→│
  │                        │←─ProxySession + caps───│
  │←─initialize/result────│                         │
  │  (标准 ACP 能力声明)    │                         │
```

#### 会话交互

```
Client                    Proxy                     Daemon            Agent
  │──session/prompt──────→│                         │                  │
  │                        │──proxy.forward(RPC)───→│                  │
  │                        │                         │──ACP prompt───→│
  │                        │                         │←─ACP update────│
  │                        │←─streaming response────│                  │
  │←─session/update───────│                         │                  │
```

### 7.4 外部客户端配置示例

```json
{
  "agent": {
    "command": "agentcraft",
    "args": ["proxy", "--agent", "my-agent"],
    "protocol": "acp/stdio"
  }
}
```

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
