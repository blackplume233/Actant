---
id: 35
title: ACP Proxy + Agent Chat — Direct Bridge 与 Session Lease 双模式
status: closed
labels:
  - acp
  - feature
  - protocol
  - "priority:P1"
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 16
  - 12
  - 37
relatedFiles:
  - packages/core/src/session/session-registry.ts
  - packages/api/src/daemon/acp-relay-server.ts
  - packages/cli/src/commands/proxy.ts
  - packages/cli/src/commands/agent/chat.ts
  - packages/cli/src/output/stream-renderer.ts
  - packages/api/src/handlers/proxy-handlers.ts
  - packages/acp/src/connection.ts
  - packages/acp/src/connection-manager.ts
  - packages/acp/src/index.ts
  - docs/design/agent-launch-scenarios.md
  - .trellis/spec/agent-lifecycle.md
  - .trellis/spec/api-contracts.md
taskRef: null
githubRef: "blackplume233/Actant#18"
closedAs: completed
createdAt: "2026-02-20T18:30:00"
updatedAt: "2026-02-21T08:00:00"
closedAt: "2026-02-21T17:30:00"
---

**Related Issues**: [[0016-acp-proxy]], [[0012-acp-endpoint]], [[0037-employee-agent-scheduling]]
**Related Files**: `packages/core/src/session/session-registry.ts`, `packages/api/src/daemon/acp-relay-server.ts`, `packages/cli/src/commands/proxy.ts`, `packages/cli/src/commands/agent/chat.ts`, `packages/cli/src/output/stream-renderer.ts`, `packages/api/src/handlers/proxy-handlers.ts`, `packages/acp/src/connection.ts`, `packages/acp/src/connection-manager.ts`, `packages/acp/src/index.ts`, `docs/design/agent-launch-scenarios.md`, `.trellis/spec/agent-lifecycle.md`, `.trellis/spec/api-contracts.md`

---

## 目标

重新设计 ACP Proxy 和 agent chat，支持两种连接模式：**Direct Bridge**（客户端直连）和 **Session Lease**（会话租约）。废弃原计划的 ACP Gateway 架构。

## 设计原则

1. **CWD 永远是 agent workspace** — 消除 cwd 映射问题
2. **1 Instance : 1 Process（严格 1:1）** — 永远不会出现一个 Instance 对应多个 Process
3. **两种并发策略** — 多 Session（Session Lease）或自动实例化（Direct Bridge）
4. **两种连接模式可选** — Direct Bridge（隔离 + 自动实例化）和 Session Lease（warm + 多客户端共享进程）

## 背景与设计演进

> 完整讨论记录见 `docs/design/acp-gateway-deprecation-discussion.md`

1. 原方案：ACP Gateway + Session 多路复用 → 发现 CWD 传递链断裂问题
2. 第二方案：纯 Direct Bridge → 每次连接冷启动，无法多客户端轮流交互
3. 引入雇员型 Agent 需求 → Daemon 必须能持有 AcpConnection
4. 最终方案：**Direct Bridge（默认）+ Session Lease（可选，`--lease`）**

### 关键洞察：Session 级租约

原本考虑 Agent 级租约（整个 agent 同时只有一个客户端），但发现 AcpConnection 原生支持多 Session：
- Daemon 初始化一次，调用 `newSession()` 为每个客户端创建独立 Session
- `sessionUpdate` 通知自带 sessionId，路由仅需 `Map<sessionId, clientId>`
- 客户端断开 → session idle（可恢复），Agent 进程不受影响

这比原 Gateway 简单得多：不需要透明代理，不需要 cwd 重写，不需要处理 double-init。

## 模式 A：Direct Bridge + 自动实例化

**Client 自己 spawn + 持有 AcpConnection。进程随连接走。并发通过自动实例化解决。**

```
IDE → actant proxy my-agent --direct
     → Daemon.resolve(name) → workspace + command
     → 如果 Instance 已被占用 → 自动从 Template 创建临时 Instance（ephemeral）
     → Proxy spawn Agent（cwd = instance workspace）
     → Daemon.attach(instanceName, pid)
     → stdio 双向桥接：IDE ←→ Proxy ←→ Agent
     → 断开时：terminate Agent → Daemon.detach() → 临时 Instance 自动销毁
```

**自动实例化**：当目标 Instance 已被占用时，Daemon 从同一 Template 创建一个 ephemeral Instance（独立 workspace、独立进程），客户端断开后自动清理。这维持了 1:1 不变量的同时支持了并发。

适用：需要完全隔离的并发连接、一次性使用、不需要 Daemon 管理 ACP。

## 模式 B：Session Lease（可选，`--lease`）

**Daemon 持有 Agent 进程和 AcpConnection。客户端租借 Session。需先 `agent start`。**

```
actant agent start my-agent       # Daemon 启动 Agent（warm）
actant proxy my-agent --lease     # IDE 通过 Session Lease 接入
actant agent chat my-agent        # Agent 已运行 → 自动走 Session Lease
  → Daemon 调用 newSession(agentWorkspace) → sessionId
  → 建立 streaming relay：Client ←→ Daemon ←→ Agent
  → 断开时：session 进入 idle，Agent 保持运行
```

### IDE 接入：Proxy ACP 适配器

IDE 只会说 ACP 协议，因此 Proxy 在 Session Lease 模式下做 ACP 协议翻译：
- IDE 发 `initialize` → Proxy 返回 Daemon 缓存的 Agent 能力声明（不转发）
- IDE 发 `session/new` → Proxy 调用 Daemon `session.create` → 返回 sessionId
- IDE 发 `session/prompt` → Proxy 调用 Daemon `session.prompt` → 流式转发为 ACP 通知
- IDE 发 `session/cancel` → Proxy 调用 Daemon `session.cancel`

非 ACP 客户端（CLI chat、Web UI）直接使用 Daemon 结构化 API，无需适配层。

### Session Registry

```typescript
interface SessionLease {
  sessionId: string;
  agentName: string;
  clientId: string | null;    // null = idle
  state: "active" | "idle" | "expired";
  createdAt: string;
  lastActivityAt: string;
  idleTtlMs: number;          // idle 后多久过期，默认 30min
}
```

### Session 路由

Daemon 使用 AcpConnection 的结构化 API 而非透明代理：
- Client 发 prompt → `conn.prompt(sessionId, text)`
- Agent 发通知 → `sessionUpdate { sessionId }` → 按 sessionId 路由到对应 Client
- Client 发 cancel → `conn.cancel(sessionId)`

### Session 生命周期

```
创建: 客户端连接 → newSession(agentWorkspace) → 分配 sessionId
活跃: prompt / sessionUpdate 双向流
空闲: 客户端断开 → session 保留（idle）
恢复: 客户端重连 + sessionId → 恢复映射
过期: idle 超 TTL → session 关闭
```

## 实现计划

### Phase 1: Proxy Direct Bridge（默认模式）

**重写 `packages/cli/src/commands/proxy.ts`**

1. 调用 `Daemon.resolve(name)` 获取 workspace + command + args
2. spawn Agent 子进程（cwd = agent workspace）
3. 调用 `Daemon.attach(name, pid)` 注册进程
4. 建立双向 stdio bridge：IDE stdin → Agent stdin, Agent stdout → IDE stdout
5. 不做 ACP 消息解析，纯字节流转发
6. 退出时：terminate Agent → `Daemon.detach(name)`
7. 自动实例化：Instance 已占用时从 Template 创建 ephemeral Instance

### Phase 2: Agent Chat 直连 + 流式渲染

1. **`packages/cli/src/commands/agent/chat.ts`**（重写）— 自己 spawn Agent（Direct Bridge）
2. **`packages/cli/src/output/stream-renderer.ts`**（新增）— 终端流式渲染器
3. 建立 ACP connection（initialize + newSession），readline 循环 + 流式渲染
4. Agent 已通过 `agent start` 运行时 → 自动走 Session Lease（通过 Daemon API）

### Phase 3: Session Lease 支持

1. **`packages/core/src/session/session-registry.ts`**（新增）— Session 注册表 + 生命周期管理
2. **`packages/api/src/daemon/acp-relay-server.ts`**（新增）— ACP streaming relay 服务端
3. **RPC 新方法**：`session.create` / `session.close` / `session.list`
4. **Proxy `--lease` 模式**：ACP 协议适配器（IDE ACP ↔ Daemon 结构化 API 翻译）
5. `packages/api/src/handlers/proxy-handlers.ts`: 标注 legacy
6. 文档更新

## 需要修改的文件

| 文件 | 变更 |
|------|------|
| `packages/core/src/session/session-registry.ts` | **新增** — Session 注册表 |
| `packages/api/src/daemon/acp-relay-server.ts` | **新增** — Streaming relay |
| `packages/cli/src/commands/proxy.ts` | **重写** — 双模式 |
| `packages/cli/src/commands/agent/chat.ts` | **重写** — Session Lease 交互 |
| `packages/cli/src/output/stream-renderer.ts` | **新增** — 终端流式渲染器 |
| `packages/api/src/handlers/proxy-handlers.ts` | 标注 legacy |

## 验收标准

### Session Lease 模式
- [ ] `agent start` 启动 Agent 后，多个客户端可通过 `proxy` / `chat` 获取独立 Session
- [ ] 客户端断开后 session 进入 idle，Agent 进程保持运行
- [ ] 客户端重连可恢复 idle session
- [ ] sessionUpdate 按 sessionId 正确路由到对应客户端
- [ ] Session idle TTL 过期后自动清理
- [ ] 流式输出：逐 chunk 实时渲染
- [ ] Ctrl+C 触发 cancel(sessionId)

### Direct Bridge 模式
- [ ] `proxy --direct` 自行 spawn Agent，IDE 通过 stdio 完成完整 ACP 交互
- [ ] Proxy 退出时 Agent 进程终止，Daemon 状态正确清理
- [ ] 自动实例化：Instance 已被占用时自动从 Template 创建 ephemeral Instance
- [ ] 临时 Instance 在客户端断开后自动销毁（workspace + 元数据）
- [ ] 无 Template 引用的 Instance 被占用时返回 AGENT_ALREADY_ATTACHED（无法自动实例化）

### 两种模式共通
- [ ] cwd 始终为 agent workspace，domain context 完整可见
- [ ] 与 Claude Desktop / Cursor 等标准 ACP Client 联调通过
- [ ] 向后兼容：RPC `agent.run` / `agent.prompt` 保留

---

## Comments

### cursor-agent — 2026-02-21T02:30:00

方案更新：从增强 proxy.forward（Daemon 中继）改为 Proxy Direct Bridge（双连接桥接）。Proxy 进程直接持有 AgentSideConnection + ClientSideConnection，透明桥接所有 ACP 方法，Daemon 仅做 resolve/attach/detach 生命周期管理。详细设计见 body 更新。

### human — 2026-02-21T03:00:00

范围扩展：将 agent chat 直连 ACP Client 纳入本 Issue。

### human — 2026-02-21T03:30:00

架构重设计：从 Proxy Direct Bridge 演进为 Core ACP Gateway。Core 持有 AcpConnection，Session 多路复用。已创建 docs/design/agent-launch-scenarios.md（9 种场景），已更新 api-contracts.md Section 7 和 spec/index.md。

### human — 2026-02-21T04:00:00

架构修正：(1) ACP Gateway 极简化——只做 sessionId 路由转发，不解析/修改/拦截 ACP 消息内容，不含业务逻辑。(2) 所有 ACP Client（外部 IDE via Proxy、agent chat 内置、Web UI、IM Adapter）是并行 peers，地位平等，独立连接 Gateway，互不依赖。Proxy 不是 Gateway 的一部分，是外部 Client 的 transport 层。Chat 与 Proxy 同级。

### human — 2026-02-21T06:00:00

**架构决策：废弃 ACP Gateway，回归 Direct Bridge**

发现 Gateway 致命 CWD 问题 → 简单策略：cwd 永远是 agent workspace → 进程隔离替代 session 多路复用 → 雇员型 Agent 拆为 #37

### human — 2026-02-21T08:00:00

**演进：从 Agent 级租约到 Session 级租约**

1. Direct Bridge 存在冷启动问题 → 引入租约模型（Daemon 保持进程 warm）
2. Agent 级租约仍有阻塞问题（一个客户端占住整个 agent）
3. 发现 AcpConnection 原生支持多 Session → Session 级租约自然解决并发
4. 与原 Gateway 的本质区别：不做透明代理，Daemon 用结构化 API 与 Agent 交互，仅做 sessionId → clientId 路由

最终架构：
- Direct Bridge（默认）：Client 自己 spawn，端到端 ACP，进程随连接走
- Session Lease（可选 --lease）：Daemon 持有 AcpConnection，客户端租借 Session
- Daemon Managed（#37）：雇员型，Daemon 调度

### human — 2026-02-21T09:00:00

**默认模式确认 + IDE ACP 接入方案**

Direct Bridge 确认为默认模式（大多数时候使用）。Session Lease 通过 --lease 选项启用。

IDE（Cursor/Claude Desktop）在 Session Lease 模式下的接入方案：Proxy 做 ACP 协议适配器。IDE 侧说 ACP，Proxy 翻译为 Daemon 结构化 API（session.create/prompt/cancel）。Daemon 不需要实现 ACP Server。

实现优先级调整：Phase 1 先做 Direct Bridge（最常用），Phase 2 做 Chat 直连 + 流式渲染，Phase 3 再做 Session Lease。

### claude-agent — 2026-02-21T17:30:00

**完成 Issue #35 待办**

1. ✅ 实现 `session.cancel` 与 ACP cancel 集成 — 调用 `acpConnectionManager.getConnection()` 获取连接并执行 `conn.cancel(sessionId)`
2. ✅ 更新 `api-contracts.md` 第 7 节 — 反映 Direct Bridge + Session Lease 双模式的实际实现
3. ✅ Issue #35 标记为完成

主要变更文件：
- `packages/api/src/handlers/session-handlers.ts` — 实现 `handleSessionCancel`
- `.trellis/spec/api-contracts.md` — 更新 §7 架构文档
