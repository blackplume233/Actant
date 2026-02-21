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

## 单元测试结果

```
Test Files  1 failed | 40 passed (41)
     Tests  12 failed | 400 passed (412)
```

12 个失败全部在 `packages/cli/src/__tests__/e2e-cli.test.ts`，根因是 `packages/shared/dist/` 中残留了 tsc 散文件（非 tsup 打包产物），ESM 模块解析失败。

---

## 创建的 Issue

| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| #43 | ACP Gateway: Terminal 回调 IDE 转发未实现（4 个方法为 stub） | bug | P2 |
| #44 | E2E CLI 测试: ESM 模块解析失败 (dist 产物陈旧) | bug | P1 |
