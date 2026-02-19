# CLI + Daemon 重构方案

> 将 AgentCraft 从 one-shot CLI 重构为 Daemon + Thin Client 架构。

---

## 当前问题

1. **每次 CLI 调用都是独立进程** — 状态无法跨命令保持，`template load` 后再 `agent create` 需要重新从磁盘加载
2. **CLI 直接依赖 Core** — 业务逻辑和表现层耦合，无法支持多客户端
3. **无法管理 Agent 进程** — 没有持久进程来监控 Agent 健康、实现崩溃重启
4. **CLI 没有自动化测试** — 缺少 stdio 控制模式的测试

## 目标架构

```
┌──────────────────┐
│ agentcraft CLI   │  薄客户端：解析参数 → RPC → 格式化输出
│ @agentcraft/cli  │
└────────┬─────────┘
         │ JSON-RPC over Unix Socket
         │ (~/.agentcraft/agentcraft.sock)
┌────────▼──────────────────────────────────────────┐
│              AgentCraft Daemon                      │
│              @agentcraft/api                        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ RPC Server (net.Server on Unix Socket)      │   │
│  │   route(method) → Handler → Response        │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │                                    │
│  ┌──────────────▼──────────────────────────────┐   │
│  │ Service Layer (AppContext)                    │   │
│  │   ├─ TemplateRegistry                        │   │
│  │   ├─ AgentInitializer                        │   │
│  │   ├─ AgentManager                            │   │
│  │   └─ DomainManagers                          │   │
│  └──────────────────────────────────────────────┘   │
│                 │                                    │
│  ┌──────────────▼──────────────────────────────┐   │
│  │ @agentcraft/core (纯业务逻辑，无变化)         │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## RPC 协议：JSON-RPC 2.0 over NDJSON

选 JSON-RPC 2.0 的理由：
- 标准协议，定义清晰（request/response/error/notification）
- 支持 batch 调用
- 错误码体系与 AgentCraftError 自然映射
- 未来可无缝升级为 HTTP JSON-RPC（Web UI 用）

传输层：Unix Domain Socket + Newline-Delimited JSON (NDJSON)
- 每条消息以 `\n` 分隔
- 纯文本，可 telnet 调试

### 协议类型定义 (`@agentcraft/shared`)

```typescript
// JSON-RPC 2.0 基础类型
interface RpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: RpcError;
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}
```

### 方法定义

#### template.*

| Method | Params | Result | 说明 |
|--------|--------|--------|------|
| `template.list` | `{}` | `AgentTemplate[]` | 列出所有模板 |
| `template.get` | `{ name }` | `AgentTemplate` | 查看模板详情 |
| `template.load` | `{ filePath }` | `AgentTemplate` | 从文件加载模板到 registry |
| `template.unload` | `{ name }` | `{ success }` | 从 registry 移除 |
| `template.validate` | `{ filePath }` | `{ valid, template?, errors? }` | 验证模板文件 |

#### agent.*

| Method | Params | Result | 说明 |
|--------|--------|--------|------|
| `agent.create` | `{ name, template, overrides? }` | `AgentInstanceMeta` | 创建实例 |
| `agent.start` | `{ name }` | `AgentInstanceMeta` | 启动 |
| `agent.stop` | `{ name }` | `AgentInstanceMeta` | 停止 |
| `agent.destroy` | `{ name }` | `{ success }` | 销毁 |
| `agent.status` | `{ name }` | `AgentInstanceMeta` | 查看状态 |
| `agent.list` | `{}` | `AgentInstanceMeta[]` | 列出所有 |

#### daemon.*

| Method | Params | Result | 说明 |
|--------|--------|--------|------|
| `daemon.ping` | `{}` | `{ uptime, version, agents }` | 健康检查 |
| `daemon.shutdown` | `{}` | `{ success }` | 优雅关闭 |

### 错误码映射

| AgentCraft Error | JSON-RPC code | 说明 |
|-----------------|---------------|------|
| `TemplateNotFoundError` | `-32001` | 模板不存在 |
| `ConfigValidationError` | `-32002` | 验证失败 |
| `AgentNotFoundError` | `-32003` | 实例不存在 |
| `AgentAlreadyRunningError` | `-32004` | 重复启动 |
| `WorkspaceInitError` | `-32005` | 工作目录初始化失败 |
| `ComponentReferenceError` | `-32006` | 组件引用解析失败 |
| 其他 AgentCraftError | `-32000` | 通用业务错误 |
| 未知错误 | `-32603` | 内部错误 |

---

## 实现分阶段

### Phase 8.1: 协议层 (`@agentcraft/shared`)

**新增文件**: `types/rpc.types.ts`

- `RpcRequest`, `RpcResponse`, `RpcError` 类型
- 各 method 的 params/result 类型（类型安全的 RPC 定义）
- 错误码常量 `RPC_ERROR_CODES`

**预计**: ~1 个文件，纯类型

### Phase 8.2: Daemon 实现 (`@agentcraft/api`)

**核心模块**:

```
packages/api/src/
├── daemon/
│   ├── daemon.ts              # Daemon 主类（启动/关闭/状态）
│   ├── pid-file.ts            # PID 文件管理（~/.agentcraft/daemon.pid）
│   └── socket-server.ts       # Unix Socket JSON-RPC server
├── handlers/
│   ├── template-handlers.ts   # template.* 方法处理
│   ├── agent-handlers.ts      # agent.* 方法处理
│   ├── daemon-handlers.ts     # daemon.* 方法处理
│   └── handler-registry.ts    # method → handler 路由
├── services/
│   └── app-context.ts         # 从 CLI 移过来，属于 daemon
└── index.ts
```

**关键行为**:
- `Daemon.start()`: 创建 socket → 绑定 handler → 写 PID 文件 → 监听
- `Daemon.stop()`: 优雅停止所有 Agent → 关闭 socket → 删除 PID/sock 文件
- Socket server: 按行读取 NDJSON → 解析 JSON-RPC → 路由到 handler → 返回响应
- Handler: 纯函数 `(params, ctx: AppContext) → result`，可独立单元测试

**测试**:
- Handler 单元测试（不涉及 socket，纯 request → response）
- Socket server 集成测试（in-process 创建 server + client）

### Phase 8.3: CLI 重构为 Thin Client (`@agentcraft/cli`)

**核心变更**:

```
packages/cli/src/
├── bin/agentcraft.ts           # 入口不变
├── program.ts                  # Commander 配置
├── client/
│   ├── rpc-client.ts           # Unix Socket JSON-RPC client
│   └── connection.ts           # 连接管理（检测 daemon、自动重连）
├── commands/
│   ├── daemon/                 # 新增：daemon start/stop/status
│   ├── template/               # 重构：调用 rpc-client 而非直接调用 core
│   └── agent/                  # 重构：同上
├── output/
│   ├── formatter.ts            # 不变（纯展示逻辑）
│   └── error-presenter.ts      # 增加 RPC error 展示
└── index.ts
```

**关键变更**:
- 移除对 `@agentcraft/core` 的直接依赖
- 所有命令改为: 构造 RPC request → 通过 client 发送 → 拿到 result → 用 formatter 展示
- `AppContext` 移到 `@agentcraft/api`
- 新增 daemon 子命令

**Daemon 检测策略** (类似 docker):
1. 检查 `~/.agentcraft/agentcraft.sock` 是否存在
2. 尝试发送 `daemon.ping`
3. 若失败 → 提示 "daemon is not running, start with: agentcraft daemon start"

**测试**:
- 客户端单元测试：mock socket，验证请求序列化和响应反序列化
- 输出格式化测试：给定 result 数据，断言 stdout 输出
- E2E 测试：启动真实 daemon → spawn CLI 进程 → 通过 stdin/stdout 断言

### Phase 8.4: REPL 模式

**触发方式**: `agentcraft` 无参数 或 `agentcraft repl`

**行为**:
- 建立到 daemon 的持久连接
- 显示 prompt (`agentcraft> `)
- 读取用户输入 → 解析为命令 → RPC 调用 → 输出
- 支持 readline（历史、补全）
- Ctrl+C 退出 REPL（不影响 daemon）

**实现**: 基于 Node.js `readline` 模块 + 复用已有 commander 解析逻辑

---

## 测试策略

### 分层测试

| 层 | 测试方式 | 关注点 |
|----|---------|--------|
| Handler | 纯函数 `handler(params, ctx)` | 业务正确性：正确调用 core、正确返回结果/错误 |
| RPC Server | 创建 in-process server + client | 协议正确性：NDJSON 解析、JSON-RPC 格式、错误码 |
| RPC Client | mock socket | 序列化/反序列化、超时、连接失败处理 |
| Output | 直接调用 formatter | 给定数据，输出格式符合预期 |
| E2E | 真实 daemon + spawn CLI 进程 | 全链路：命令 → 解析 → RPC → handler → core → 响应 → 格式化 → stdout |

### E2E 测试模式 (stdio 控制)

```typescript
import { spawn } from "node:child_process";

test("agent list shows table", async () => {
  // daemon 已启动（beforeAll）

  const cli = spawn("node", ["dist/bin/agentcraft.js", "agent", "list"]);
  const stdout = await collectStream(cli.stdout);
  const exitCode = await waitForExit(cli);

  expect(exitCode).toBe(0);
  expect(stdout).toContain("No agents found.");
});

test("REPL session", async () => {
  const cli = spawn("node", ["dist/bin/agentcraft.js", "repl"]);

  cli.stdin.write("agent list\n");
  const output1 = await readUntilPrompt(cli.stdout);
  expect(output1).toContain("No agents found.");

  cli.stdin.write("exit\n");
  const exitCode = await waitForExit(cli);
  expect(exitCode).toBe(0);
});
```

---

## 包依赖变化

```
之前:
  cli → core → shared

之后:
  cli → shared                  (只依赖类型，不依赖 core)
  api → core → shared           (daemon 依赖 core)
```

`@agentcraft/cli` 的 package.json 将移除 `@agentcraft/core` 依赖。

---

## 文件系统布局

```
~/.agentcraft/
├── agentcraft.sock        # Unix Domain Socket (daemon 监听)
├── daemon.pid             # Daemon PID 文件
├── templates/             # 持久化的模板 JSON 文件
├── instances/             # Agent 实例工作目录
│   ├── my-reviewer/
│   │   ├── .agentcraft.json
│   │   ├── AGENTS.md
│   │   └── ...
│   └── my-writer/
└── logs/                  # Daemon 日志（可选）
    └── daemon.log
```

---

## 执行顺序

| 序号 | 阶段 | 交付物 | 依赖 |
|------|------|--------|------|
| 1 | Phase 8.1 | RPC 类型定义 | 无 |
| 2 | Phase 8.2 | Daemon (socket server + handlers + tests) | 8.1 |
| 3 | Phase 8.3 | CLI 重构 (RPC client + 命令重构 + output tests) | 8.1, 8.2 |
| 4 | Phase 8.4 | REPL 模式 + E2E tests | 8.3 |
