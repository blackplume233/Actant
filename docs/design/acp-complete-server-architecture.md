# ACP Complete Server Architecture Design

> Actant 作为完备 ACP Server 的架构设计
> 目标：外部 ACP Client 连接到 Actant 的 Agent 后，等价于连接到一个完备的 ACP Server

---

## 1. 核心问题

外部 ACP Client（IDE）通过 `actant proxy <name>` 连接到 Agent。
Agent 进程（如 `claude-agent-acp`）自身已经是一个完备的 ACP Server。
**Actant 的职责是确保这个连接路径上不丢失任何 ACP 能力。**

---

## 2. 三种连接模式

### 2.1 Direct Bridge（直连网关）— 默认模式

```
IDE (ACP Client)
    │ ACP / stdio
    ▼
actant proxy <name>     ← 纯字节流网关
    │ ACP / stdio (pipe)
    ▼
Agent Process (ACP Server)  ← 已是完备 ACP Server
```

**原理：** Proxy 是一个零解析的透明字节流网关。IDE 的每个字节原样传给 Agent，Agent 的每个字节原样传回 IDE。

**结论：Direct Bridge 天然就是完备的 ACP Server。**
- IDE 直接与 Agent 对话，所有 ACP 方法和通知完整保留
- `requestPermission` → IDE 直接处理
- `fs/*`、`terminal/*` → IDE 直接处理
- `session/update` → IDE 直接接收
- 无需 Actant 做任何 ACP 解析

**Actant 仅负责生命周期：**
1. `agent.resolve` → 获取 spawn 信息
2. spawn Agent 进程
3. `agent.attach` → 注册到 Daemon
4. 桥接 stdio
5. 退出时 `agent.detach` + cleanup

**改进点：无。已完备。**

### 2.2 Session Lease — 租约模式

当 Daemon 通过 `agent start` 持有一个长驻 Agent 进程时，多个客户端可通过租约共享该 Agent。
此时 Daemon 持有唯一的 ACP stdio 连接，客户端不能直接对话 Agent。

**关键洞察：租约连接有两个子状态。**

#### 状态 A：无活跃租约（Self-managed）

```
actant agent start <name>
    ↓
Daemon ──── AcpConnection (ClientSideConnection) ──── Agent
             │
             └── Client callbacks 全部由本地处理
                 ├── requestPermission → auto-approve
                 ├── sessionUpdate → 本地事件总线
                 ├── readTextFile → Node.js fs.readFile
                 ├── writeTextFile → Node.js fs.writeFile
                 └── terminal/* → Node.js child_process.spawn
```

Actant 自己是 ACP Client，需要**完整实现**所有 Client 回调。

**使用者：** `agent.run`、`agent.prompt`、`agent chat`（daemon-managed 模式）、MCP Server

#### 状态 B：有活跃租约（Lease-forwarding）

```
IDE (ACP Client)
    │ ACP / stdio
    ▼
actant proxy <name> --lease
    │ ACP / Unix socket (双向)
    ▼
Daemon (ACP Gateway)
    │
    ├── AgentSideConnection ← 面向 IDE（上游）
    │   接收 IDE 的 ACP 请求，转发给 Agent
    │   将 Agent 的通知/回调 转发给 IDE
    │
    └── ClientSideConnection ← 面向 Agent（下游）
        接收 Agent 的回调请求
        根据 IDE 能力决定：转发 or 本地处理（伪装）
```

**ACP Gateway 核心逻辑：**

```
Agent 发起回调 → ClientCallbackRouter 判断：
    │
    ├── IDE 支持该能力？
    │   YES → 转发给 IDE，等待 IDE 响应，返回给 Agent
    │   NO  → 本地处理（伪装），返回给 Agent
    │
    └── 能力判断基于 IDE 在 initialize 时声明的 clientCapabilities
```

**具体路由表：**

| Agent 回调 | IDE 支持时 | IDE 不支持时（伪装） |
|-----------|-----------|-------------------|
| `requestPermission` | **转发** → IDE 显示 UI，用户选择 | 本地 auto-approve（选第一个 option） |
| `sessionUpdate` | **转发** → IDE 显示内容 | 本地事件总线（无 UI） |
| `fs/read_text_file` | **转发** → IDE 读编辑器缓冲区（含未保存内容） | 本地 `fs.readFile` |
| `fs/write_text_file` | **转发** → IDE 写文件（可跟踪变更） | 本地 `fs.writeFile` |
| `terminal/create` | **转发** → IDE 在面板中创建终端 | 本地 `child_process.spawn` |
| `terminal/output` | **转发** → IDE 返回终端输出 | 本地读取进程输出 |
| `terminal/wait_for_exit` | **转发** → IDE 等待终端退出 | 本地等待进程退出 |
| `terminal/kill` | **转发** → IDE 终止终端命令 | 本地发送 SIGTERM |
| `terminal/release` | **转发** → IDE 释放终端 | 本地清理进程 |

**IDE → Agent 方向的 ACP 方法转发：**

| IDE 发送的 ACP 方法 | Gateway 处理 |
|-------------------|-------------|
| `initialize` | 返回 Agent 的能力（缓存自 Daemon 初始化） |
| `authenticate` | 转发给 Agent |
| `session/new` | 转发给 Agent |
| `session/load` | 转发给 Agent（如果 Agent 支持 loadSession） |
| `session/prompt` | 转发给 Agent，同时流式转发所有 session/update |
| `session/cancel` | 转发给 Agent |
| `session/set_mode` | 转发给 Agent |
| `session/set_config_option` | 转发给 Agent |

**能力协商策略：**

```
Agent 初始化时，Daemon 声明的 clientCapabilities = 全能力集合
（terminal: true, fs: { readTextFile: true, writeTextFile: true }）

原因：不管 IDE 是否连接，Daemon 本地都能兜底处理所有回调。
Agent 永远看到完整能力，不需要因租约切换而重新协商。
```

### 2.3 Self-managed（无外部连接）

即状态 A。Daemon 持有 ACP 连接，完整的本地 Client 实现。
无需 Proxy 参与。

---

## 3. Proxy-Daemon 双向通道设计

Session Lease 的核心挑战是 **Proxy 与 Daemon 之间需要双向通信**。

### 3.1 通道需求

| 方向 | 消息类型 | 场景 |
|------|---------|------|
| Proxy → Daemon | ACP 请求 | IDE 发送 `session/prompt` 等 |
| Daemon → Proxy | ACP 通知 | Agent 发送 `session/update` |
| Daemon → Proxy | ACP 回调请求 | Agent 请求 `requestPermission`、`fs/*`、`terminal/*` |
| Proxy → Daemon | ACP 回调响应 | IDE 对回调的响应 |

### 3.2 方案：ACP-over-Socket

**最简设计：Proxy 与 Daemon 之间直接使用 ACP 协议（JSON-RPC over Unix socket）。**

```
IDE ──ACP/stdio──► Proxy ──ACP/socket──► Daemon ──ACP/stdio──► Agent
     (Client)      (thin pipe)           (Gateway)              (Server)
```

Daemon 内部结构：

```
                    ┌──────────────────────────────────────────┐
                    │              ACP Gateway                  │
                    │                                          │
IDE ◄──ACP──► Proxy ◄──ACP──► AgentSideConnection             │
                    │            (面向上游)                     │
                    │               │                          │
                    │         ClientCallbackRouter             │
                    │          ┌────┴────┐                     │
                    │      Forward   Impersonate               │
                    │       to IDE    locally                   │
                    │          │         │                      │
                    │         ClientSideConnection              │
                    │            (面向下游)                     │
Agent ◄──ACP────────┤                                          │
                    └──────────────────────────────────────────┘
```

### 3.3 Proxy 实现（极薄层）

Session Lease 模式的 Proxy 变成一个**极薄的 ACP 管道**：

```typescript
// Proxy 核心逻辑（伪代码）
const daemonSocket = connectToSocket(ACTANT_SOCKET);
const daemonStream = ndJsonStream(daemonSocket);

// IDE stdin → Daemon socket
process.stdin.pipe(daemonSocket);

// Daemon socket → IDE stdout
daemonSocket.pipe(process.stdout);
```

实际上就是 IDE 的 ACP 消息通过 socket 转发给 Daemon 的 ACP Gateway，
Daemon 的 ACP Gateway 的响应通过 socket 转发回 IDE。

Proxy 不做 ACP 解析，只做传输层桥接（stdio ↔ socket）。

### 3.4 Gateway 实现

Gateway 是核心，它桥接上游（IDE）和下游（Agent）两个 ACP 连接：

```typescript
class AcpGateway {
  private upstream: AgentSideConnection;   // 面向 IDE
  private downstream: ClientSideConnection; // 面向 Agent
  private ideCapabilities: ClientCapabilities | null = null;
  private localCallbacks: LocalClientCallbacks; // 本地兜底

  // IDE 发来 initialize → 记录 IDE 能力，返回 Agent 能力
  handleInitialize(params) {
    this.ideCapabilities = params.clientCapabilities;
    return this.cachedAgentCapabilities;
  }

  // IDE 发来 session/prompt → 转发给 Agent
  handlePrompt(params) {
    return this.downstream.prompt(params);
  }

  // Agent 调用 requestPermission → 转发给 IDE 或本地处理
  handleAgentPermissionRequest(params) {
    if (this.ideCapabilities) {
      return this.upstream.requestPermission(params); // 转发
    }
    return this.localCallbacks.requestPermission(params); // 伪装
  }

  // Agent 调用 terminal/create → 根据 IDE 能力决定
  handleAgentCreateTerminal(params) {
    if (this.ideCapabilities?.terminal) {
      return this.upstream.createTerminal(params); // 转发
    }
    return this.localCallbacks.createTerminal(params); // 伪装
  }
}
```

---

## 4. 本地 Client 回调实现（伪装层）

无论是状态 A（Self-managed）还是状态 B 的兜底，都需要完整的本地 Client 实现。

### 4.1 Terminal 回调

```typescript
class LocalTerminalManager {
  private terminals = new Map<string, TerminalProcess>();

  createTerminal(params: CreateTerminalRequest): CreateTerminalResponse {
    const id = `term_${crypto.randomUUID()}`;
    const proc = spawn(params.command, params.args ?? [], {
      cwd: params.cwd ?? undefined,
      env: mergeEnv(params.env),
    });
    const terminal = new TerminalProcess(id, proc, params.outputByteLimit);
    this.terminals.set(id, terminal);
    return { terminalId: id };
  }

  terminalOutput(params): TerminalOutputResponse {
    const term = this.terminals.get(params.terminalId);
    return {
      output: term.getOutput(),
      truncated: term.isTruncated(),
      exitStatus: term.getExitStatus(),
    };
  }

  waitForExit(params): WaitForTerminalExitResponse {
    const term = this.terminals.get(params.terminalId);
    return term.waitForExit(); // Promise
  }

  kill(params): void {
    this.terminals.get(params.terminalId)?.kill();
  }

  release(params): void {
    const term = this.terminals.get(params.terminalId);
    term?.kill();
    term?.dispose();
    this.terminals.delete(params.terminalId);
  }
}
```

### 4.2 文件系统回调（增强版）

```typescript
readTextFile(params: ReadTextFileRequest): ReadTextFileResponse {
  const content = await readFile(params.path, "utf-8");
  if (params.line != null || params.limit != null) {
    const lines = content.split("\n");
    const start = (params.line ?? 1) - 1; // 1-based → 0-based
    const end = params.limit != null ? start + params.limit : lines.length;
    return { content: lines.slice(start, end).join("\n") };
  }
  return { content };
}
```

### 4.3 权限回调（增强版）

```typescript
requestPermission(params: RequestPermissionRequest): RequestPermissionResponse {
  if (this.autoApprove) {
    // 选择第一个 allow 类型的 option，而非盲选第一个
    const allowOption = params.options.find(
      o => o.kind === "allow_once" || o.kind === "allow_always"
    ) ?? params.options[0];
    return { outcome: { outcome: "selected", optionId: allowOption.optionId } };
  }
  return { outcome: { outcome: "cancelled" } };
}
```

---

## 5. Resolve 与后端启动

### 5.1 `agent.resolve` 返回的启动信息

```json
{
  "instanceName": "my-agent",
  "workspaceDir": "/home/user/.actant/instances/my-agent",
  "backendType": "claude-code",
  "command": "claude-agent-acp",
  "args": [],
  "env": {},
  "created": false
}
```

### 5.2 后端命令行对照

| 后端类型 | ACP 支持 | 命令 | 参数 | 说明 |
|---------|---------|------|------|------|
| `claude-code` | **是** | `claude-agent-acp` (Linux/Mac) / `claude-agent-acp.cmd` (Windows) | 无参数 | 工作目录通过 ACP `session/new` 的 `cwd` 传递 |
| `cursor` | 否 | `cursor` / `cursor.cmd` | `[workspaceDir]` | 不支持 ACP，打开 Cursor IDE |
| `custom` | 取决于配置 | 用户指定 | 用户指定 | 需 `backend.executablePath` |

### 5.3 外部客户端 spawn 流程

```bash
# 1. Resolve 获取启动信息
$ actant agent resolve my-agent -t claude-code-template -f json
# → { command: "claude-agent-acp", args: [], workspaceDir: "..." }

# 2. IDE/客户端 spawn 进程
spawn("claude-agent-acp", [], { cwd: workspaceDir, stdio: ["pipe","pipe","pipe"] })

# 3. 在 stdio 上直接使用 ACP 协议
# → initialize → session/new → session/prompt → ...
```

或使用 Direct Bridge（推荐）：

```bash
# IDE 配置 actant proxy 作为 Agent 可执行文件
{
  "command": "actant",
  "args": ["proxy", "my-agent", "-t", "claude-code-template"]
}
# Proxy 自动处理 resolve → spawn → attach → bridge → detach
```

---

## 6. 实现计划

### Phase 1: 本地 Client 完整实现（AcpConnection 增强） -- DONE

**文件：** `packages/acp/src/connection.ts`, `packages/acp/src/terminal-manager.ts`

- [x] 实现 `LocalTerminalManager`（terminal/create, output, wait_for_exit, kill, release）
- [x] 增强 `readTextFile`（支持 line/limit 参数）
- [x] 增强 `requestPermission`（智能选择 allow option，取消处理）
- [x] 完整 `sessionUpdate` 通知解析（plan, tool_call, modes, config, commands, thought）
- [x] 支持多内容类型 prompt（image, audio, resource, resource_link）
- [x] 支持 `session/load`、`session/set_mode`、`session/set_config_option`
- [x] 接收并存储 `configOptions`
- [x] `AcpCommunicator` 增强通知映射

### Phase 2: ACP Gateway 实现 -- DONE (部分限制)

**新文件：** `packages/acp/src/gateway.ts`, `packages/acp/src/callback-router.ts`

- [x] `AcpGateway` 类：桥接上游（AgentSideConnection）和下游（ClientSideConnection）
- [x] `ClientCallbackRouter`：根据 IDE 能力路由回调（转发 vs 伪装）
- [x] 支持租约状态切换（Mode A ↔ Mode B）
- [x] `AcpConnectionManager` 更新：支持 Gateway 预创建和 lease socket 接入
- [x] **临时方案**（#95）：`terminal/output`、`terminal/wait_for_exit`、`terminal/kill`、`terminal/release` 4 个回调通过 `TerminalHandle` map 适配转发。**根因**：SDK `AgentSideConnection` 对 fs 暴露扁平方法（`readTextFile`/`writeTextFile`），但 terminal 操作封装在 `TerminalHandle` 对象中，不提供扁平方法。Gateway 理应无状态转发（IDE 自管 terminal 状态），handle map 是 SDK API 不对称的权宜之计。长期跟踪见 #116。

### Phase 3: Session Lease Proxy 重写 -- DONE (Daemon handler 缺失)

**文件：** `packages/cli/src/commands/proxy.ts`

- [x] Lease 模式 Proxy 改为 ACP 管道（stdio ↔ socket via gateway.lease RPC）
- [x] 保留 Legacy RPC 翻译层作为降级回退
- [x] 新增 `gateway.lease` RPC 类型定义（`rpc.types.ts`）
- [ ] **阻塞**：`gateway.lease` RPC 的 Daemon 端 handler 未实现（#117）。Proxy 永远 fallback 到 Legacy RPC 翻译。类型定义和客户端调用就绪，需在 `packages/api/src/handlers/` 新增 `gateway-handlers.ts`。

### Phase 4: Bug 修复 -- DONE

- [x] 修复 `session.cancel` Session ID 错位（使用 Agent 的 primary ACP session ID）
- [x] Terminal 能力声明完整（有实现，保留声明）

### Phase 5: 文档更新 -- DONE

- [x] 更新本设计文档实施状态

---

## 7. 性能考量

| 路径 | 延迟 | 说明 |
|------|------|------|
| Direct Bridge | **最低** | 零解析字节流，仅 pipe 系统调用 |
| Session Lease (forwarded) | 中等 | 多一跳 socket 转发，ACP 消息解析 |
| Session Lease (impersonated) | 最低 | 本地处理，无网络开销 |

**优化原则：**
- Direct Bridge 保持零开销
- Gateway 避免不必要的消息序列化/反序列化
- Terminal 输出使用 `outputByteLimit` 控制内存
- 大文件传输使用 line/limit 分页

---

## 8. 文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/acp/src/connection.ts` | **重大修改** | 完整 Client 回调 + Terminal + 增强 fs + 多内容 |
| `packages/acp/src/terminal-manager.ts` | **新建** | 本地终端进程管理 |
| `packages/acp/src/gateway.ts` | **新建** | ACP Gateway（桥接上下游） |
| `packages/acp/src/callback-router.ts` | **新建** | Client 回调路由（转发 vs 伪装） |
| `packages/acp/src/index.ts` | 修改 | 导出新模块 |
| `packages/cli/src/commands/proxy.ts` | **重大修改** | Lease 模式改为 ACP 管道 |
| `packages/api/src/handlers/session-handlers.ts` | 修改 | 修复 cancel ID bug |
| `packages/acp/src/connection-manager.ts` | 修改 | 支持 Gateway 模式 |
| `packages/acp/src/communicator.ts` | 修改 | 增强通知映射 |
| `.trellis/spec/api-contracts.md` | 修改 | 更新 ACP 架构文档 |
| `docs/design/acp-protocol-gap-analysis.md` | 已完成 | 功能对比文档 |
