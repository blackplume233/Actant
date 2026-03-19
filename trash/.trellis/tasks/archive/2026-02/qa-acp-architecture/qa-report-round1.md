# QA 集成测试报告 — Round 1

**场景**: 文档一致性验证 — `docs/design/acp-complete-server-architecture.md`
**测试工程师**: QA SubAgent
**时间**: 2026-02-21 20:01
**结果**: FAILED (51/56 PASS, 3 WARN, 4 FAIL — 单元测试 400/412)

---

## 摘要

| # | 检查项 | 文件 | 判定 | 说明 |
|---|--------|------|------|------|
| 1 | AcpGateway 类存在 | gateway.ts | PASS | 类定义、属性结构完整 |
| 2 | 桥接上下游 (upstream/downstream) | gateway.ts | PASS | AgentSideConnection + AcpConnection |
| 3 | ideCapabilities 属性 | gateway.ts | PASS | `ClientCapabilities \| null` |
| 4 | localCallbacks 属性 | gateway.ts | WARN | 通过 callbackRouter 间接使用，结构不同但行为等价 |
| 5 | handleInitialize 行为 | gateway.ts | PASS | 记录 IDE 能力，返回缓存 Agent 能力 |
| 6 | handlePrompt 行为 | gateway.ts | PASS | 转发到 downstream |
| 7 | handleAgentPermissionRequest | gateway.ts | PASS | 有租约→转发，无→本地 |
| 8 | handleAgentCreateTerminal | gateway.ts | PASS | 按 ideCapabilities.terminal 路由 |
| 9 | ClientCallbackRouter 类存在 | callback-router.ts | PASS | 实现 ClientCallbackHandler |
| 10 | 路由表 requestPermission | callback-router.ts | PASS | 转发+fallback |
| 11 | 路由表 sessionUpdate | callback-router.ts | PASS | 本地+转发双写 |
| 12 | 路由表 fs/read_text_file | callback-router.ts | PASS | 按能力转发或本地 |
| 13 | 路由表 fs/write_text_file | callback-router.ts | PASS | 按能力转发或本地 |
| 14 | 路由表 terminal/create | callback-router.ts | PASS | 按能力转发或本地 |
| 15 | **路由表 terminal/output** | gateway.ts | **FAIL** | UpstreamHandler 抛 "not yet supported" |
| 16 | **路由表 terminal/wait_for_exit** | gateway.ts | **FAIL** | UpstreamHandler 抛 "not yet supported" |
| 17 | **路由表 terminal/kill** | gateway.ts | **FAIL** | UpstreamHandler 抛 "not yet supported" |
| 18 | **路由表 terminal/release** | gateway.ts | **FAIL** | UpstreamHandler 抛 "not yet supported" |
| 19 | IDE→Agent initialize | gateway.ts | PASS | 返回缓存能力 |
| 20 | IDE→Agent authenticate | gateway.ts | PASS | 转发 |
| 21 | IDE→Agent session/new | gateway.ts | PASS | 转发 |
| 22 | IDE→Agent session/load | gateway.ts | PASS | 转发（检查能力） |
| 23 | IDE→Agent session/prompt | gateway.ts | PASS | 转发+流式 update |
| 24 | IDE→Agent session/cancel | gateway.ts | PASS | 转发 |
| 25 | IDE→Agent session/set_mode | gateway.ts | PASS | 转发 |
| 26 | IDE→Agent session/set_config_option | gateway.ts | PASS | 转发 |
| 27 | 能力协商（全能力声明） | connection.ts | PASS | terminal:true, fs:{read:true,write:true} |
| 28 | 租约状态切换 A↔B | callback-router.ts | PASS | attachUpstream/detachUpstream |
| 29 | readTextFile line/limit 分页 | connection.ts | PASS | 实现一致+防负索引 |
| 30 | requestPermission 智能选择 | connection.ts | PASS | allow_once/allow_always优先 |
| 31 | requestPermission cancelled 回退 | connection.ts | PASS | 非autoApprove或空options返回cancelled |
| 32 | sessionUpdate 通知解析 plan | communicator.ts | PASS | case "plan" |
| 33 | sessionUpdate 通知解析 tool_call | communicator.ts | PASS | case "tool_call" + "tool_call_update" |
| 34 | sessionUpdate 通知解析 modes | communicator.ts | PASS | case "current_mode_update" |
| 35 | sessionUpdate 通知解析 config | communicator.ts | PASS | case "config_option_update" |
| 36 | sessionUpdate 通知解析 commands | communicator.ts | PASS | case "available_commands_update" |
| 37 | sessionUpdate 通知解析 thought | communicator.ts | PASS | case "agent_thought_chunk" |
| 38 | 多内容类型 prompt | connection.ts | PASS | ContentBlock[] 透传 |
| 39 | session/load 支持 | connection.ts | PASS | 检查 loadSession 能力 |
| 40 | session/set_mode 支持 | connection.ts | PASS | 已实现 |
| 41 | session/set_config_option 支持 | connection.ts | PASS | 已实现 |
| 42 | configOptions 存储 | connection.ts | PASS | AcpSessionInfo 含 configOptions |
| 43 | LocalTerminalManager 类存在 | terminal-manager.ts | PASS | 5个方法完整 |
| 44 | createTerminal (cwd/args/env/outputByteLimit) | terminal-manager.ts | PASS | child_process.spawn |
| 45 | terminalOutput (output/truncated/exitStatus) | terminal-manager.ts | PASS | |
| 46 | waitForExit | terminal-manager.ts | PASS | exitPromise |
| 47 | killTerminal | terminal-manager.ts | PASS | SIGTERM→3s→SIGKILL |
| 48 | releaseTerminal | terminal-manager.ts | PASS | kill+dispose+Map删除 |
| 49 | Terminal ID 格式 | terminal-manager.ts | WARN | counter+timestamp 非 UUID |
| 50 | Proxy lease stdio↔socket 管道 | proxy.ts | PASS | runGatewayPipe |
| 51 | Legacy RPC 降级回退 | proxy.ts | PASS | gateway.lease失败时fallback |
| 52 | gateway.lease RPC 类型定义 | rpc.types.ts | PASS | GatewayLeaseParams/Result |
| 53 | connection-manager Gateway 模式 | connection-manager.ts | PASS | gateways Map + acceptLeaseSocket |
| 54 | session.cancel primary session ID | session-handlers.ts | PASS | getPrimarySessionId |
| 55 | index.ts 导出新模块 | index.ts | PASS | 4个新模块均导出 |
| 56 | 后端命令行对照 (3种类型) | backend-resolver.ts | PASS | claude-code/cursor/custom |

---

## 失败/警告分析

### 步骤 15–18 — terminal/output, wait_for_exit, kill, release IDE 转发 [FAIL]

- **期望**: 当 IDE 声明 `terminal: true` 时，4 个回调应转发到 IDE
- **实际观察**: `gateway.ts` L106-144 的 UpstreamHandler 实现均为 `throw new Error("... not yet supported")`
- **Fallback**: `ClientCallbackRouter` 有 try-catch，catch 后 fallback 到 `this.local.*`（LocalTerminalManager），功能不崩溃
- **影响**: Session Lease 模式下 IDE 终端面板无法集成，Agent 终端操作始终在 Daemon 本地执行
- **根因**: SDK 的 `AgentSideConnection` 不直接暴露 terminalOutput/waitForExit/kill/release 方法，需底层 JSON-RPC 扩展
- **文档问题**: Phase 2 标记为 "DONE" 但未注明此限制

### 步骤 4 — localCallbacks 属性 [WARN]

- **期望**: `AcpGateway` 直接持有 `localCallbacks: LocalClientCallbacks`
- **实际**: 通过 `callbackRouter: ClientCallbackRouter` 间接持有 `local: ClientCallbackHandler`
- **结论**: 行为等价，更好的职责分离

### 步骤 49 — Terminal ID 格式 [WARN]

- **期望**: `crypto.randomUUID()` 生成 UUID
- **实际**: `term_${++counter}_${Date.now()}` 格式
- **结论**: 唯一性有保障，不影响功能

---

## 完整执行日志

### [Step 1] 读取目标设计文档

```
$ Read docs/design/acp-complete-server-architecture.md
```

--- 输出 (460 行) ---

```
# ACP Complete Server Architecture Design

> Actant 作为完备 ACP Server 的架构设计
> 目标：外部 ACP Client 连接到 Actant 的 Agent 后，等价于连接到一个完备的 ACP Server

---

## 1. 核心问题

外部 ACP Client（IDE）通过 `actant proxy <name>` 连接到 Agent。
Agent 进程（如 `claude-agent-acp`）自身已经是一个完备的 ACP Server。
**Actant 的职责是确保这个连接路径上不丢失任何 ACP 能力。**

[... 省略中间内容，共 460 行 ...]

## 8. 文件清单
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| packages/acp/src/connection.ts | 重大修改 | 完整 Client 回调 + Terminal + 增强 fs + 多内容 |
| packages/acp/src/terminal-manager.ts | 新建 | 本地终端进程管理 |
| packages/acp/src/gateway.ts | 新建 | ACP Gateway（桥接上下游） |
| packages/acp/src/callback-router.ts | 新建 | Client 回调路由（转发 vs 伪装） |
| packages/acp/src/index.ts | 修改 | 导出新模块 |
| packages/cli/src/commands/proxy.ts | 重大修改 | Lease 模式改为 ACP 管道 |
| packages/api/src/handlers/session-handlers.ts | 修改 | 修复 cancel ID bug |
| packages/acp/src/connection-manager.ts | 修改 | 支持 Gateway 模式 |
| packages/acp/src/communicator.ts | 修改 | 增强通知映射 |
| .trellis/spec/api-contracts.md | 修改 | 更新 ACP 架构文档 |
| docs/design/acp-protocol-gap-analysis.md | 已完成 | 功能对比文档 |
```

**判断**: 文档结构完整，描述了 3 种连接模式、Gateway 架构、路由表、本地 Client 实现、5 阶段实现计划（全标 DONE）。需逐文件验证实际代码。

---

### [Step 2] 列出项目源码文件

```
$ Glob packages/*/src/**/*.ts
```

--- 输出 (161 files) ---

```
packages/acp/src/connection-manager.ts
packages/cli/src/commands/proxy.ts
packages/shared/src/types/rpc.types.ts
packages/acp/src/terminal-manager.ts
packages/acp/src/gateway.ts
packages/acp/src/communicator.ts
packages/api/src/handlers/session-handlers.ts
packages/acp/src/index.ts
packages/acp/src/callback-router.ts
packages/acp/src/connection.ts
[... 另 151 个文件 ...]
```

**判断**: 设计文档中提到的所有文件均存在于项目中。PASS。

---

### [Step 3] SubAgent 并行验证 — AcpGateway + CallbackRouter

```
$ Task(explore): 读取 gateway.ts 和 callback-router.ts，逐项对照设计文档
```

--- SubAgent 输出 ---

```
## 检查结果

| # | 检查项 | 判定 | 说明 |
|---|--------|------|------|
| 1 | AcpGateway 类存在 | PASS | packages/acp/src/gateway.ts 中存在 AcpGateway 类 |
| 2 | AcpGateway 桥接上下游 | PASS | 使用 upstream: AgentSideConnection（面向 IDE）和 downstream: AcpConnection（面向 Agent） |
| 3 | ideCapabilities 属性 | PASS | 存在 ideCapabilities: ClientCapabilities | null |
| 4 | localCallbacks 属性 | WARN | 设计中的 localCallbacks 由 ClientCallbackRouter 的 local 实现，Gateway 通过 callbackRouter 间接使用，结构不同但行为等价 |
| 5 | handleInitialize 行为 | PASS | initialize 中记录 IDE 能力并返回缓存的 Agent 能力（cachedInit） |
| 6 | handlePrompt 行为 | PASS | prompt 转发到 downstream.rawConnection.prompt(params) |
| 7 | handleAgentPermissionRequest | PASS | 由 ClientCallbackRouter.requestPermission 实现，有租约时转发到 IDE，否则本地处理 |
| 8 | handleAgentCreateTerminal | PASS | 由 ClientCallbackRouter.createTerminal 实现，按 ideCapabilities?.terminal 转发或本地处理 |
| 9 | ClientCallbackRouter 类存在 | PASS | packages/acp/src/callback-router.ts 中存在 ClientCallbackRouter |
| 10 | 路由表 requestPermission | PASS | 有租约时转发，否则本地 auto-approve |
| 11 | 路由表 sessionUpdate | PASS | 有租约时转发，否则仅本地事件总线 |
| 12 | 路由表 fs/read_text_file | PASS | 按 ideCapabilities?.fs?.readTextFile 转发或本地 fs.readFile |
| 13 | 路由表 fs/write_text_file | PASS | 按 ideCapabilities?.fs?.writeTextFile 转发或本地 fs.writeFile |
| 14 | 路由表 terminal/create | PASS | 按 ideCapabilities?.terminal 转发或本地 child_process.spawn |
| 15 | 路由表 terminal/output | FAIL | gateway.ts 中 upstreamHandler.terminalOutput 抛出 "Terminal output forwarding not yet supported" |
| 16 | 路由表 terminal/wait_for_exit | FAIL | upstreamHandler.waitForTerminalExit 抛出 "Terminal waitForExit forwarding not yet supported" |
| 17 | 路由表 terminal/kill | FAIL | upstreamHandler.killTerminal 抛出 "Terminal kill forwarding not yet supported" |
| 18 | 路由表 terminal/release | FAIL | upstreamHandler.releaseTerminal 抛出 "Terminal release forwarding not yet supported" |
| 19 | IDE→Agent initialize | PASS | 返回 Agent 能力，不转发到 Agent |
| 20 | IDE→Agent authenticate | PASS | 转发到 downstream.authenticate |
| 21 | IDE→Agent session/new | PASS | 转发到 downstream.newSession |
| 22 | IDE→Agent session/load | PASS | 转发到 downstream.loadSession（connection 中检查 loadSession 能力） |
| 23 | IDE→Agent session/prompt | PASS | 转发到 downstream.rawConnection.prompt |
| 24 | IDE→Agent session/cancel | PASS | 转发到 downstream.cancel |
| 25 | IDE→Agent session/set_mode | PASS | 转发到 downstream.setSessionMode |
| 26 | IDE→Agent session/set_config_option | PASS | 转发到 downstream.setSessionConfigOption |
| 27 | 能力协商策略（Agent 全能力） | PASS | connection.ts:168-171 声明 fs: { readTextFile: true, writeTextFile: true } 和 terminal: true |
| 28 | 租约状态切换 Mode A ↔ Mode B | PASS | attachUpstream / detachUpstream 实现租约切换，isLeaseActive 反映当前状态 |

总结：25 PASS, 1 WARN, 4 FAIL
主要缺口：terminal 相关 4 个回调的 IDE 转发未实现
```

---

### [Step 4] SubAgent 并行验证 — connection.ts 回调实现

```
$ Task(explore): 读取 connection.ts，验证 Phase 1 所有实施清单
```

--- SubAgent 输出 ---

```
## 检查结果

| # | 检查项 | 判定 | 说明 |
|---|--------|------|------|
| 1 | readTextFile 实现 line/limit 分页逻辑 | PASS | 实现与设计一致，并增加 Math.max(0, ...) 防止负索引 |
| 2 | requestPermission 智能 allow option 选择 + cancelled 回退 | PASS | 优先选择 allow_once/allow_always，回退到 options[0]，并处理空 options |
| 3 | sessionUpdate 通知解析（plan, tool_call, modes, config, commands, thought） | PASS | connection 透传完整通知；AcpCommunicator 负责解析并映射 |
| 4 | 支持多内容类型 prompt（image, audio, resource, resource_link） | PASS | prompt/streamPrompt 接受 ContentBlock[]，并透传给 SDK |
| 5 | 支持 session/load、session/set_mode、session/set_config_option | PASS | 三个方法均已实现 |
| 6 | configOptions 存储 | PASS | AcpSessionInfo 含 configOptions，newSession 时写入 |
| 7 | AcpCommunicator 增强通知映射 | PASS | 在 communicator.ts 中实现，覆盖 plan、tool_call、thought、modes、config、commands 等 |

### 关键代码段

readTextFile (L324-341):
  private async localReadTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    const { readFile } = await import("node:fs/promises");
    try {
      const raw = await readFile(params.path, "utf-8");
      if (params.line != null || params.limit != null) {
        const lines = raw.split("\n");
        const start = Math.max(0, (params.line ?? 1) - 1);
        const end = params.limit != null ? start + params.limit : lines.length;
        return { content: lines.slice(start, end).join("\n") };
      }
      return { content: raw };
    } catch {
      throw new Error(`Cannot read file: ${params.path}`);
    }
  }

requestPermission (L403-413):
  private async localRequestPermission(params): Promise<RequestPermissionResponse> {
    if (this.options.autoApprove && params.options.length > 0) {
      const allowOption = params.options.find(
        (o) => o.kind === "allow_once" || o.kind === "allow_always",
      ) ?? params.options[0];
      if (!allowOption) return { outcome: { outcome: "cancelled" } };
      return { outcome: { outcome: "selected", optionId: allowOption.optionId } };
    }
    return { outcome: { outcome: "cancelled" } };
  }

总结：7/7 PASS
```

---

### [Step 5] SubAgent 并行验证 — terminal-manager + proxy + rpc + session-handlers

```
$ Task(explore): 读取 terminal-manager.ts, proxy.ts, rpc.types.ts, connection-manager.ts, session-handlers.ts，逐项验证
```

--- SubAgent 输出 ---

```
## 检查结果

| # | 检查项 | 文件 | 判定 | 说明 |
|---|--------|------|------|------|
| 1 | LocalTerminalManager 类存在 | terminal-manager.ts | PASS | 第 33 行定义 export class LocalTerminalManager |
| 2 | 5 个方法完整实现 | terminal-manager.ts | PASS | createTerminal、terminalOutput、waitForExit、killTerminal、releaseTerminal 均已实现 |
| 3 | createTerminal 支持 cwd/args/env/outputByteLimit | terminal-manager.ts | PASS | 第 47–54 行使用 cwd、args、env；第 54 行支持 outputByteLimit |
| 4 | 使用 Map 管理 terminal 进程 | terminal-manager.ts | PASS | 第 34 行 private terminals = new Map<string, ManagedTerminal>() |
| 5 | Lease 模式实现 stdio ↔ socket 管道桥接 | proxy.ts | PASS | runGatewayPipe 中 process.stdin.pipe(socket) 与 socket.pipe(process.stdout) |
| 6 | 保留 Legacy RPC 翻译层作为降级 | proxy.ts | PASS | gateway.lease 失败时调用 runLegacySessionLease |
| 7 | Proxy 保持极薄层（不做 ACP 解析） | proxy.ts | PASS | runGatewayPipe 仅做字节流桥接，无 ACP 解析 |
| 8 | gateway.lease RPC 类型定义 | rpc.types.ts | PASS | GatewayLeaseParams、GatewayLeaseResult 及 RpcMethodMap 中定义 |
| 9 | connection-manager 支持 Gateway 模式 | connection-manager.ts | PASS | 预创建 AcpGateway，并维护 gateways Map |
| 10 | connection-manager 支持 lease socket 接入 | connection-manager.ts | PASS | acceptLeaseSocket(name, socket) 调用 gateway.acceptSocket(socket) |
| 11 | session.cancel 使用 Agent primary ACP session ID | session-handlers.ts | PASS | 使用 getPrimarySessionId(lease.agentName) 并传给 conn.cancel(acpSessionId) |
| 12 | cancel ID 错位 bug 已修复 | session-handlers.ts | PASS | 注释与实现均明确使用 primary ACP session ID，而非 lease sessionId |

### 关键代码段

rpc.types.ts (L326-332):
  export interface GatewayLeaseParams {
    agentName: string;
  }
  export interface GatewayLeaseResult {
    socketPath: string;
  }

session-handlers.ts (L114-121):
  const acpSessionId = ctx.acpConnectionManager.getPrimarySessionId(lease.agentName);
  if (!acpSessionId) {
    throw new Error(`Agent "${lease.agentName}" has no primary ACP session`);
  }
  try {
    await conn.cancel(acpSessionId);

总结：12/12 PASS
```

---

### [Step 6] SubAgent 并行验证 — index.ts 导出 + communicator 通知映射

```
$ Task(explore): 读取 index.ts, communicator.ts，验证导出和通知映射完整性
```

--- SubAgent 输出 ---

```
## 检查结果

| # | 检查项 | 文件 | 判定 | 说明 |
|---|--------|------|------|------|
| 1 | 导出 gateway 模块 | index.ts | PASS | 第 6 行：export { AcpGateway, type GatewayOptions } from "./gateway"; |
| 2 | 导出 callback-router 模块 | index.ts | PASS | 第 5 行：export { ClientCallbackRouter, type UpstreamHandler } from "./callback-router"; |
| 3 | 导出 terminal-manager 模块 | index.ts | PASS | 第 4 行：export { LocalTerminalManager } from "./terminal-manager"; |
| 4 | 导出 connection-manager 模块 | index.ts | PASS | 第 2 行：export { AcpConnectionManager, type ConnectOptions } from "./connection-manager"; |
| 5 | AcpCommunicator 类存在 | communicator.ts | PASS | 第 18 行：export class AcpCommunicator implements AgentCommunicator |
| 6 | sessionUpdate 映射 plan | communicator.ts | PASS | 第 90–96 行：case "plan" 已处理 |
| 7 | sessionUpdate 映射 tool_call | communicator.ts | PASS | 第 67–72 行：case "tool_call"，第 74–88 行：case "tool_call_update" |
| 8 | sessionUpdate 映射 modes | communicator.ts | PASS | 第 101–105 行：case "current_mode_update" 对应 modes |
| 9 | sessionUpdate 映射 config | communicator.ts | PASS | 第 107–108 行：case "config_option_update" 对应 config |
| 10 | sessionUpdate 映射 commands | communicator.ts | PASS | 第 98–99 行：case "available_commands_update" 对应 commands |
| 11 | sessionUpdate 映射 thought | communicator.ts | PASS | 第 59–63 行：case "agent_thought_chunk" 对应 thought |
| 12 | 多种 session update 类型处理 | communicator.ts | PASS | 共 10 种 |
| 13 | 能力协商 clientCapabilities 全能力 | connection.ts | PASS | 第 166–170 行：clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true } |
| 14 | 后端类型映射 claude-code | backend-resolver.ts | PASS | 第 17 行："claude-code": () => (IS_WINDOWS ? "claude-agent-acp.cmd" : "claude-agent-acp") |
| 15 | 后端类型映射 cursor | backend-resolver.ts | PASS | 第 16 行：cursor: () => (IS_WINDOWS ? "cursor.cmd" : "cursor") |
| 16 | 后端类型映射 custom | backend-resolver.ts | PASS | 第 18–20 行：需 executablePath，否则抛错 |

### 关键代码段

index.ts (全文):
  export { AcpConnection, type AcpConnectionOptions, type AcpSessionInfo, type ClientCallbackHandler } from "./connection";
  export { AcpConnectionManager, type ConnectOptions } from "./connection-manager";
  export { AcpCommunicator } from "./communicator";
  export { LocalTerminalManager } from "./terminal-manager";
  export { ClientCallbackRouter, type UpstreamHandler } from "./callback-router";
  export { AcpGateway, type GatewayOptions } from "./gateway";
  export type { SessionNotification, ContentBlock } from "@agentclientprotocol/sdk";

能力协商 connection.ts (L166-177):
  this.initResponse = await this.conn.initialize({
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
    clientInfo: {
      name: "actant",
      title: "Actant Daemon",
      version: "0.1.0",
    },
  });

总结：16/16 PASS
```

---

### [Step 7] 搜索已有 terminal 转发 Issue

```
$ Grep pattern="terminal.*forward|forward.*terminal|not yet supported"
  path=.trellis/issues/
```

--- 输出 ---

```
No matches found
```

```
$ Grep pattern="terminal" path=.trellis/issues/ output_mode=files_with_matches
```

--- 输出 ---

```
.trellis/issues/0018-acp-fleet-extension.json
```

**判断**: #18 是 ACP-Fleet 扩展协议的长期愿景 Issue，与 terminal 转发 stub 无关。无已有 Issue 跟踪此问题。

---

### [Step 8] 读取 gateway.ts 中 terminal stub 代码

```
$ Read packages/acp/src/gateway.ts offset=100 limit=55
```

--- 输出 ---

```
      readTextFile: (p) => conn.readTextFile(p),
      writeTextFile: (p) => conn.writeTextFile(p),
      createTerminal: async (p) => {
        const handle = await conn.createTerminal(p);
        return { terminalId: handle.id };
      },
      terminalOutput: async (_p) => {
        // SDK's TerminalHandle wraps this, but we need raw access.
        // The AgentSideConnection.createTerminal returns a TerminalHandle on the agent side.
        // For forwarding, we relay the raw request to IDE and get raw response.
        // Since we're using AgentSideConnection methods which are meant for Agent→Client,
        // the SDK handles the JSON-RPC routing automatically.
        // However, terminalOutput/waitForExit/kill/release are separate methods
        // on the Client interface, not on AgentSideConnection directly.
        // We need to use the underlying extension mechanism or handle differently.
        //
        // Actually, looking at the SDK: AgentSideConnection.createTerminal returns a
        // TerminalHandle whose methods (currentOutput, waitForExit, kill, release) internally
        // call the respective terminal/* methods on the Client.
        // So for the Gateway, we can't directly call terminalOutput on the connection.
        // Instead, terminal callbacks are handled at the Client level automatically.
        //
        // This means: when the downstream Agent creates a terminal, if we're forwarding
        // createTerminal to the IDE, the SDK on the Agent side will call terminal/output etc
        // on the Client (us). We need to forward those to the IDE.
        //
        // The callback router already handles this at the Client level.
        // This upstream handler is called BY the router when it decides to forward.
        // For terminal/* callbacks from the Agent, they go through the Client interface
        // which is handled by the router.
        //
        // So this method on UpstreamHandler is for the router to call when forwarding.
        // We need a way to forward terminal/output to the IDE.
        // Since AgentSideConnection doesn't expose terminalOutput directly,
        // we use extMethod as a workaround, or we need to send the raw JSON-RPC.
        throw new Error("Terminal output forwarding not yet supported via UpstreamHandler");
      },
      waitForTerminalExit: async () => {
        throw new Error("Terminal waitForExit forwarding not yet supported");
      },
      killTerminal: async () => {
        throw new Error("Terminal kill forwarding not yet supported");
      },
      releaseTerminal: async () => {
        throw new Error("Terminal release forwarding not yet supported");
      },
```

**判断**: 4 个 terminal 方法确认为 stub，抛出 "not yet supported" 错误。注释详尽解释了根因。FAIL。

---

### [Step 9] 读取 callback-router.ts 验证 fallback 机制

```
$ Read packages/acp/src/callback-router.ts
```

--- 输出 (192 行) ---

```
[... import 语句 ...]

export interface UpstreamHandler {
  requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  sessionUpdate(params: SessionNotification): Promise<void>;
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse>;
  releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse>;
}

export class ClientCallbackRouter implements ClientCallbackHandler {
  private upstream: UpstreamHandler | null = null;
  private ideCapabilities: ClientCapabilities | null = null;
  constructor(private readonly local: ClientCallbackHandler) {}

  attachUpstream(handler: UpstreamHandler, capabilities: ClientCapabilities): void { ... }
  detachUpstream(): void { ... }
  get isLeaseActive(): boolean { return this.upstream != null; }

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    if (this.upstream && this.ideCapabilities?.terminal) {
      try {
        return await this.upstream.terminalOutput(params);
      } catch (err) {
        logger.warn({ error: err }, "IDE terminalOutput failed, falling back");
      }
    }
    if (this.local.terminalOutput) return this.local.terminalOutput(params);
    throw new Error("Terminal not supported");
  }

  [... waitForTerminalExit, killTerminal, releaseTerminal 结构相同 ...]
}
```

**判断**: Router 中 4 个 terminal 方法都有 try-catch fallback 到 local 实现。当 upstream 抛错时不会崩溃，而是降级到 LocalTerminalManager。功能可用但 IDE 集成不可用。

---

### [Step 10] 运行完整单元测试套件

```
$ npx vitest --reporter=verbose
  working_directory: g:\Workspace\AgentWorkSpace\Actant
```

--- 输出 ---

```
 RUN  v4.0.18 G:/Workspace/AgentWorkSpace/Actant

 ✓ packages/cli/src/client/__tests__/rpc-client.test.ts (6 tests) 3ms
 ✓ packages/cli/src/output/__tests__/formatter.test.ts (15 tests) 20ms
 ✓ packages/shared/src/errors/errors.test.ts (11 tests) 2ms
 ✓ packages/core/src/template/schema/template-schema.test.ts (21 tests) 4ms
 [... 36 个测试文件通过 ...]

 ✗ packages/cli/src/__tests__/e2e-cli.test.ts (12 tests)

 FAIL  packages/cli/src/__tests__/e2e-cli.test.ts > CLI E2E (stdio) > ping returns pong
   AssertionError: expected 1 to be +0

 FAIL  packages/cli/src/__tests__/e2e-cli.test.ts > CLI E2E (stdio) > daemon status shows running
   AssertionError: expected 1 to be +0

 FAIL  ... (共 12 个 E2E 测试失败)

 Error [ERR_MODULE_NOT_FOUND]: Cannot find module
 'G:\Workspace\AgentWorkSpace\Actant\packages\shared\dist\types\index'
 imported from G:\Workspace\AgentWorkSpace\Actant\packages\shared\dist\index.js

 Test Files  1 failed | 40 passed (41)
      Tests  12 failed | 400 passed (412)
   Duration  6.84s
```

**判断**: 400/412 通过。12 个失败全部在 E2E CLI 测试中，根因是 `packages/shared/dist/` 中存在 tsc 残留散文件（非 tsup 打包产物），ESM 模块解析要求显式 `.js` 扩展名。

---

### [Step 11] 检查构建产物状态

```
$ ls packages/shared/dist/types
```

--- 输出 ---

```
agent.types.d.ts       agent.types.js         agent.types.js.map
domain-component.types.d.ts  domain-component.types.js  ...
index.d.ts             index.js               index.js.map
rpc.types.d.ts         rpc.types.js           rpc.types.js.map
template.types.d.ts    template.types.js      template.types.js.map
```

```
$ ls packages/cli/dist/bin
```

--- 输出 ---

```
actant.d.ts    actant.js    actant.js.map
```

**判断**: `shared/dist/types/` 下存在散文件（`index.js` 等），这是 tsc 的产物而非 tsup。tsup 应打包为单个 `dist/index.js`。散文件中的 `export * from "./types/index"` 缺少 `.js` 扩展名，导致 ESM 解析失败。

---

### [Step 12] 检查构建配置

```
$ Read packages/shared/tsup.config.ts
```

--- 输出 ---

```
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  sourcemap: true,
});
```

```
$ Read packages/shared/package.json
```

--- 输出 ---

```
{
  "name": "@actant/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": { "build": "tsup" },
  ...
}
```

```
$ Read packages/shared/dist/index.js
```

--- 输出 ---

```
export * from "./types/index";
export * from "./errors/index";
export * from "./logger/logger";
export * from "./platform/index";
```

**判断**: `dist/index.js` 内容是 tsc 的 re-export 输出（散文件），而非 tsup 的打包输出。tsup 配置有 `clean: true`，重新 build 可清理。

---

### [Step 13] 搜索已有 Issue 并创建新 Issue

```
$ Read .trellis/issues/0018-acp-fleet-extension.json
```

--- 输出 ---

确认 #18 是长期愿景，与 terminal 转发无关。

```
$ Write .trellis/issues/0043-gateway-terminal-forwarding-stub.json
```

创建 Issue #43: ACP Gateway Terminal 回调 IDE 转发未实现（4 个方法为 stub），优先级 P2。

```
$ Write .trellis/issues/0044-e2e-cli-esm-module-resolution.json
```

创建 Issue #44: E2E CLI 测试 ESM 模块解析失败，优先级 P1。

---

## 创建的 Issue

| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| #43 | ACP Gateway: Terminal 回调 IDE 转发未实现（4 个方法为 stub） | bug | P2 |
| #44 | E2E CLI 测试: ESM 模块解析失败 (dist 产物陈旧) | bug | P1 |
