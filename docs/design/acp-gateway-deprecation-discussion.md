# 设计讨论：ACP 连接架构演进

> **日期**：2026-02-21
> **参与者**：human, cursor-agent
> **影响 Issue**：#35（ACP Proxy / Chat）、#37（雇员型 Agent）
> **最终决策**：Session Lease（默认）+ Direct Bridge（可选），废弃 ACP Gateway

---

## 1. 问题发现：CWD 传递链断裂

### 触发

在评审 Issue #35（ACP 完整协议层 — Core ACP Gateway + Proxy/Chat 接入）时，提出了一个关键问题：

> **"当使用 ACP Proxy 时你如何传递当前工作目录？"**

### 分析

追踪完整的 CWD 传递链，发现存在多层断裂：

**当前 Proxy 实现（`proxy.ts`）**：

- `proxy.connect` RPC 调用中完全没有传递 cwd
- `proxy.forward` 只处理 `session/prompt` 和 `session/cancel`
- Agent 永远使用 Daemon 在 `startAgent()` 时创建的 primary session（cwd = agent workspace）
- IDE 的项目目录从未进入系统

**原计划 Gateway 架构的问题**：

1. **CWD 分裂**：
   - Agent 子进程由 Daemon 启动，cwd = agent workspace（如 `~/.actant/instances/my-agent/`）
   - IDE 通过 `session/new { cwd }` 传递自己的项目目录（如 `/Users/foo/project/`）
   - Domain context（AGENTS.md、prompts/）物化在 agent workspace，用户代码在 IDE 项目
   - 如果用 IDE 的 cwd，Agent 看不到 domain context；如果用 agent workspace，Agent 看不到用户代码

2. **Gateway "不修改消息" 原则与 CWD 重写的矛盾**：
   - Gateway 设计为 "极简路由器，不解析/修改/拦截 ACP 消息内容"
   - 但 workspace isolation 模式需要将 IDE 的 cwd 重写为 agent workspace
   - 两种模式（workspace isolation vs env passthrough）需要不同的 cwd，Gateway 无法区分

3. **Double Initialize**：
   - Daemon 在 `startAgent()` 时已完成 `initialize()` + `newSession()`
   - Client 通过 Gateway 发送第二次 `initialize` 导致协议冲突
   - Agent 子进程只有一条 stdio 连接，无法为多 Client 各自独立初始化

4. **claude-code 的特殊性**：
   - `backend-resolver.ts` 注释：`claude-code: no args needed (ACP session's cwd parameter handles workspace)`
   - claude-code 完全依赖 `session/new` 的 cwd 参数来确定工作目录
   - CWD 传递不是可选的，是 Agent 知道"在哪里工作"的唯一途径

## 2. 第一次决策：废弃 Gateway，采用 Direct Bridge

### 提出

> **"简单策略：均使用 agent 自身的 workspace。当需要指定别的 workspace 时 agent 可以创建新的 agent instance。那这样其实还是无法多个连接同时接到同一个 Agent 进程上，所以需要每次连接创建新的进程，只是共享一个 workspace 及一套 Agent 配置，也可以使用独占式连接，这应当是可选的。"**

### 推演

1. **CWD 永远是 agent 自身 workspace** → domain context 始终可见，问题彻底消除
2. **每次连接创建新进程** → 不需要 session 多路复用，不需要 Gateway
3. **独占式连接（默认）** → 一个 agent instance 同时只有一个活跃连接
4. **共享 workspace 可选** → 多个连接可各自 spawn 独立进程

### Gateway 价值归零

| Gateway 能力 | 是否还需要 |
|---|---|
| sessionId → Client 路由 | 不需要，1:1 连接无需路由 |
| 多 Client 并发 | 不需要，独占或独立进程 |
| 处理 double-initialize | 不需要，每个进程只 initialize 一次 |
| cwd 重写/映射 | 不需要，永远是 agent workspace |

**决策：废弃 ACP Gateway，采用 Direct Bridge。**

## 3. 引入雇员型 Agent

### 提出

> **"考虑雇员型的 agent，Actant 需要有能力持续调度这种 agent。"**

### 两种 Agent 原型

| | 工具型（Tool） | 雇员型（Employee） |
|---|---|---|
| 驱动者 | 人类（IDE / Chat） | Daemon（调度器） |
| 连接归属 | Proxy / Chat 持有 AcpConnection | **Daemon 持有 AcpConnection** |
| 进程生命周期 | 跟随连接 | **长驻，持续运行** |
| launchMode | interactive / acp-background | **acp-service** |

**确认**：Gateway 在两种模式下都不需要。雇员型 Agent 拆为独立 Issue #37。

### 参考：OpenClaw 架构

- 六种输入：Messages / Heartbeats / Cron Jobs / Hooks / Webhooks / Agent-to-Agent
- Hub-and-Spoke：Gateway 做连接管理，不做推理
- Lane Queue：每个 session 串行执行

## 4. Instance:Process 关系问题

### 提出

> **"如何区分一个 AgentInstance 可以用来创建一个进程还是多个进程？"**

### 讨论

- `AgentInstanceMeta` schema 只有一个 `pid` 字段 → 天然暗示 1:1
- 如果一个 Instance 可以有多个 Process，需要 `processes[]` 数组、文件锁等复杂机制

### 决策：1 Instance : 1 Process（严格）

- 需要并发时创建多个 Instance（从同一 Template instantiate）
- 保持 `.actant.json` 简单
- 避免文件锁、数组 pid 追踪等复杂度

## 5. 冷启动与快速释放问题

### 提出

> **"但是有时候希望多个客户端可以和同一个 AgentInstance 互动，虽然不一定是同时但这意味着所有权必须要能够快速释放。"**

### 分析

Direct Bridge 存在一个问题：
- Client A 断开 → Agent 进程终止（cold）
- Client B 连接 → 需要重新 spawn + initialize（冷启动开销大）

### 提出租约模型

引入 **Daemon Lease**：Daemon 始终持有 Agent 进程和 AcpConnection，客户端"租借"使用权。

```
Daemon 启动 Agent → warm 等待
Client A 获取租约 → Daemon relay 消息 → Client A 完成 → 释放租约
Client B 获取租约 → 即时连接（零冷启动）→ ...
```

## 6. 最终演进：Session 级租约

### 提出

> **"租约形态很好，但是否可以是 session 级别的租赁？"**

### 分析

Agent 级租约仍有局限：
- Client A 占住整个 Agent → Client B 必须等待
- 强制一个时刻只能有一个 Client → 不如 Direct Bridge 直观

Session 级租约更优：
- AcpConnection 原生支持多 Session
- 每个 Client 获取自己的 Session → 独立上下文
- 客户端断开 → session 进入 idle → Agent 进程不受影响
- `sessionUpdate` 通知自带 sessionId → 路由仅需 `Map<sessionId, clientId>`

### 与原 Gateway 的区别

| 维度 | 原 ACP Gateway | Session Lease |
|------|---------------|---------------|
| CWD | IDE cwd vs agent cwd 分裂 | **永远 agent workspace** |
| Initialize | 需处理 double-init | **Daemon 初始化一次** |
| 转发方式 | 透明字节流代理 | **结构化 API 调用** |
| 复杂度 | AgentSide + ClientSide bridge | **sessionId → clientId 映射** |

### 最终决策

三种连接模式共存，两种并发策略互补：

```
模式 A — Direct Bridge + 自动实例化 ⭐ 默认:
  Client spawn + 持有 AcpConnection
  端到端原生 ACP（Proxy 仅做字节流桥接）
  进程随连接走
  并发时自动从 Template 创建 ephemeral Instance → 独立进程 + workspace
  适用：大多数 IDE 连接、一次性使用、隔离需求

模式 B — Session Lease（可选，--lease）:
  Daemon 持有 AcpConnection
  客户端租借 Session（多 Session 共享一个进程）
  IDE 通过 Proxy ACP 适配器接入（Proxy 翻译 ACP ↔ Daemon API）
  CLI/Web UI 直接使用 Daemon 结构化 API
  进程独立于连接
  适用：长期使用、需要 session 恢复、避免冷启动

模式 C — Daemon Managed (#37):
  Daemon 持有 AcpConnection + 主动调度
  适用：雇员型 Agent
```

**两种并发策略**：

| 策略 | 机制 | 隔离级别 | 适用模式 |
|------|------|---------|---------|
| 自动实例化 | 1 Template → N Instances → N Processes | **完全隔离** | Direct Bridge（默认） |
| 多 Session | 1 Process → N Sessions | 同进程共享 | Session Lease |

两种策略都维持 **1 Instance : 1 Process 严格 1:1** 不变量。

### IDE 在 Session Lease 模式下的 ACP 接入

IDE（Cursor / Claude Desktop）只会说 ACP 协议。在 Session Lease 模式下，Proxy 做 ACP 协议适配器：

```
IDE ──ACP/stdio──→ Proxy(适配器) ──Daemon API──→ Daemon ──ACP/stdio──→ Agent
```

- `initialize` → Proxy 返回缓存的 Agent 能力声明
- `session/new` → `session.create`
- `session/prompt` → `session.prompt` → 流式转发为 ACP 通知
- `session/cancel` → `session.cancel`

这比原 Gateway 简单：不需要透明代理，Daemon 不需要实现 ACP Server，翻译逻辑在 Proxy 侧。

## 7. 产出汇总

| 产出 | 说明 |
|------|------|
| Issue #35 更新 | 双模式：Direct Bridge（默认）+ Session Lease（`--lease`） |
| Issue #37 新建 | 雇员型 Agent — 持续调度与主动行为系统 |
| roadmap.md 更新 | Phase 3 新增 #35、#37 |
| agent-launch-scenarios.md 重写 | 完整的连接架构与启动场景文档 |

## 8. 后续待跟进

- [ ] 自动实例化的 Instance 命名策略（`<name>-eph-<uuid>` 或其他）
- [ ] 自动实例化时 workspace 的创建方式（完整物化 vs 符号链接共享只读部分）
- [ ] 无 Template 引用的 Instance 是否支持自动实例化（回退为 AGENT_ALREADY_ATTACHED）
- [ ] Proxy ACP 适配器的具体实现：哪些 ACP 方法需要翻译，哪些可以透传
- [ ] Session Lease 的 streaming relay 协议设计（二进制帧 vs JSON-RPC 扩展）
- [ ] Session idle TTL 的合理默认值和配置方式
- [ ] `agent chat` 是否应该自动 `agent start`（如 agent 未运行）
- [ ] 更新 `agent-lifecycle.md` 中 ACP Proxy 部分反映新连接模型
- [ ] 更新 `api-contracts.md` 中 Proxy 协议描述
- [ ] 雇员型 Agent 的 Webhook HTTP server 是否复用 Daemon 进程
