# Agent 连接架构与启动场景

> 定义 AgentCraft 中 Agent 的连接模式、启动场景和数据流。
> **本文档是 [Agent 生命周期](../../.trellis/spec/agent-lifecycle.md) 和 [接口契约](../../.trellis/spec/api-contracts.md) 的补充设计文档。**
>
> 设计演进记录见 [ACP 架构讨论](./acp-gateway-deprecation-discussion.md)

---

## 基本概念

### 实体关系

```
AgentTemplate ──1:N──→ AgentInstance ──1:1──→ Process ──1:N──→ Session
(配置蓝图)            (workspace + 元数据)   (OS 进程)         (ACP 会话)
                      ↑
                      │ 自动实例化
                      │ (按需从 Template 创建)
```

- **AgentTemplate**：可复用的配置蓝图（skills、prompts、MCP servers、backend 等）
- **AgentInstance**：一个具体的工作空间目录 + `.agentcraft.json` 元数据
- **Process**：一个 OS 进程（pid），与 Instance **严格 1:1**
- **Session**：ACP 协议级的会话，一个 Process 可以承载多个 Session

### 不变量

1. **CWD 永远是 agent workspace** — 所有 session 共享同一个 cwd，domain context 始终可见
2. **一个 Instance 最多一个 Process** — 严格 1:1，永远不会出现一个 Instance 对应多个 Process
3. **Daemon 或 Client 拥有 AcpConnection，不会同时拥有**

### 两种并发策略

Instance:Process 严格 1:1 不变，但系统提供两种方式处理多客户端并发：

| 策略 | 机制 | 并发粒度 | 上下文隔离 | 适用场景 |
|------|------|---------|-----------|---------|
| **多 Session** | 1 Process → N Sessions | Session | 同进程，共享内存 | Session Lease 模式 |
| **自动实例化** | 1 Template → N Instances → N Processes | Instance | **完全隔离**（独立进程 + workspace） | Direct Bridge 模式 |

**自动实例化**：当客户端请求连接一个已被占用的 Agent（或配置要求进程隔离）时，Daemon 自动从同一 Template 创建临时 Instance（ephemeral），分配独立 workspace，spawn 独立进程。客户端断开后临时 Instance 可自动清理。

```
手动创建:
  agentcraft agent create my-agent -t code-review    →  持久 Instance

自动实例化:
  agentcraft proxy my-agent --direct                 →  Daemon 检测到 my-agent 已占用
                                                     →  自动创建 my-agent-ephemeral-<id>
                                                     →  spawn 独立进程，客户端断开后销毁
```

---

## 三种连接模式

AgentCraft 支持三种连接模式，适用于不同场景。

### 模式 A：Direct Bridge（直连桥接）⭐ 默认

**Client 自己 spawn Agent 进程 + 持有 AcpConnection。进程随连接走。这是最常用的模式。**

```
┌──────────────────┐
│  外部 ACP Client │  IDE / Claude Desktop / 脚本
│  (Cursor 等)     │
└───────┬──────────┘
        │ ACP / stdio
┌───────▼──────────┐
│  Proxy (Bridge)  │  stdin ↔ Agent stdin
│                  │  stdout ↔ Agent stdout
│  spawn + 持有:   │
│  - ChildProcess  │  cwd = agent workspace
│  - AcpConnection │  Daemon.resolve → attach → detach
└───────┬──────────┘
        │ ACP / stdio
┌───────▼──────────┐
│  Agent 子进程     │  进程随 Proxy 退出而终止
└──────────────────┘
```

| 属性 | 值 |
|------|---|
| AcpConnection 归属 | **Client**（Proxy 进程） |
| 进程归属 | Client spawn，processOwnership = `external` |
| 进程生命周期 | 跟随连接：Client 断开 → 进程终止 |
| Daemon 角色 | resolve / attach / detach（不参与 ACP 通信） |
| 冷启动 | **每次连接都有**（spawn + initialize + newSession） |
| 并发策略 | **自动实例化**：Instance 已占用时从 Template 创建临时 Instance |
| ACP 协议 | **端到端原生 ACP** — Proxy 仅做字节流桥接，不解析内容 |
| 适用场景 | IDE 连接（最常见）、隔离需求、需要完全独立上下文 |

**CLI 命令**：

```bash
agentcraft proxy my-agent              # 默认即 Direct Bridge
agentcraft proxy my-agent --direct     # 显式指定（等同上面）
```

**并发行为**：

```
Client A 连接 my-agent
  → resolve(my-agent) → workspace + command
  → attach(my-agent, pidA) → 成功

Client B 连接 my-agent
  → resolve(my-agent) → 发现已占用
  → 自动从 my-agent 的 Template 创建 my-agent-eph-<uuid>
  → resolve(my-agent-eph-<uuid>) → 独立 workspace + command
  → attach(my-agent-eph-<uuid>, pidB) → 成功

Client B 断开
  → detach + terminate → 临时 Instance 自动销毁（ephemeral）
```

**优势**：最简单，端到端 ACP，完全进程隔离，无共享状态，无需 Daemon 管理 ACP 连接。
**劣势**：每次冷启动，客户端之间无法共享 Agent 上下文。

---

### 模式 B：Session Lease（会话租约）

**Daemon 持有 Agent 进程和 AcpConnection。客户端向 Daemon 租借 Session 与 Agent 交互。进程独立于客户端连接存活。**

前提：Agent 需先通过 `agent start` 启动（Daemon 管理进程）。

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  IDE (Proxy)  │  │  Chat CLI     │  │  Web UI       │
│  ACP 协议     │  │  结构化 API   │  │  WebSocket    │
└──────┬────────┘  └──────┬────────┘  └──────┬────────┘
       │                  │                  │
┌──────▼──────────────────▼──────────────────▼──────────┐
│  Daemon                                                │
│                                                        │
│  ┌── Session Registry ──────────────────────────────┐ │
│  │  session-A → Client A (active, IDE)              │ │
│  │  session-B → Client B (active, chat)             │ │
│  │  session-D → (idle, 上次 Chat 的会话，可恢复)     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌── AcpConnection (Daemon 始终持有) ───────────────┐ │
│  │  prompt(sessionId, text)    → 转发到 Agent        │ │
│  │  onSessionUpdate(notif)     → 按 sessionId 路由   │ │
│  └──────────────────────┬────────────────────────────┘ │
└─────────────────────────┼──────────────────────────────┘
                          │ ACP / stdio
                          ▼
                   Agent 子进程（warm，长驻）
```

| 属性 | 值 |
|------|---|
| AcpConnection 归属 | **Daemon** |
| 进程归属 | Daemon spawn，processOwnership = `managed` |
| 进程生命周期 | **独立于客户端**：客户端断开 → 进程保持运行 |
| Daemon 角色 | 持有 AcpConnection + Session 管理 + 通知路由 |
| 冷启动 | **仅首次**（后续客户端即时连接） |
| 多 Client | **支持**（每个客户端独立 Session，可同时活跃） |
| Session 恢复 | 客户端断开后 session 进入 idle，重连可恢复 |
| 适用场景 | 长期使用的 Agent、需要 session 恢复、多客户端并发 |

**CLI 命令**：

```bash
agentcraft agent start my-agent       # 先启动 Agent（Daemon 管理）
agentcraft proxy my-agent --lease     # IDE 通过 Session Lease 接入
agentcraft agent chat my-agent        # Chat 自动走 Session Lease（agent 已运行时）
```

**IDE 通过 ACP 协议接入（Proxy ACP 适配器）**：

IDE 只会说 ACP，因此 Proxy 在 Session Lease 模式下做 **ACP 协议适配**：

```
IDE ──ACP/stdio──→ Proxy ──Daemon API──→ Daemon ──ACP/stdio──→ Agent
                   (ACP 适配器)

Proxy 的翻译逻辑：
  IDE 发 initialize       → Proxy 返回 Daemon 缓存的 Agent 能力声明（不转发）
  IDE 发 session/new      → Proxy 调用 Daemon session.create → 返回 sessionId
  IDE 发 session/prompt   → Proxy 调用 Daemon session.prompt → 流式转发 ACP 通知
  IDE 发 session/cancel   → Proxy 调用 Daemon session.cancel
```

非 ACP 客户端（CLI chat、Web UI、IM）直接使用 Daemon 的结构化 API，无需适配层。

**Session 生命周期**：

```
创建: 客户端连接 → Daemon 调用 newSession(agentWorkspace) → 分配 sessionId
活跃: 客户端发 prompt → Daemon 转发 → Agent 回复 → Daemon 路由回客户端
空闲: 客户端断开 → session 保留（idle），Agent 进程不受影响
恢复: 客户端重连 + 提供 sessionId → 恢复映射，继续对话
过期: idle 超过 TTL → session 关闭清理
```

**与原 Gateway 的区别**：

| 维度 | 原 ACP Gateway（已废弃） | Session Lease |
|------|------------------------|---------------|
| CWD | IDE cwd vs agent cwd 分裂 | **永远 agent workspace** |
| Initialize | 需处理 double-init | **Proxy 拦截，返回缓存** |
| 转发方式 | 透明字节流代理 | **Proxy 做 ACP 翻译，Daemon 用结构化 API** |
| 复杂度 | AgentSide + ClientSide bridge | **sessionId → clientId 映射** |

**优势**：零冷启动（warm process），多客户端并发，session 可恢复。
**劣势**：Proxy 需理解 ACP 协议做翻译，进程不跟随客户端清理（需 TTL 管理）。

---

### 模式 C：Daemon Managed（守护进程托管）

**Daemon 持有 Agent 进程并主动调度任务。用于雇员型 Agent。**

```
┌─────────────────────────────────────────────────────┐
│  Daemon                                              │
│                                                      │
│  ┌── Input Router ────────────────────────────────┐ │
│  │  Heartbeat │ Cron │ Webhook │ Hook │ Prompt    │ │
│  │            ↓      ↓         ↓      ↓          │ │
│  │  ┌─── Task Queue (串行) ──────────────────┐   │ │
│  │  │  [heartbeat] [cron:email] [webhook:pr]  │   │ │
│  │  └────────────────┬────────────────────────┘   │ │
│  └───────────────────┼────────────────────────────┘ │
│                      ▼                               │
│  ┌── AcpConnection ──────────────────────────────┐  │
│  │  prompt(sessionId, task.prompt)                │  │
│  │  ← sessionUpdate → execution log              │  │
│  └──────────────────┬────────────────────────────┘  │
└─────────────────────┼───────────────────────────────┘
                      │ ACP / stdio
                      ▼
               Agent 子进程（长驻，Daemon 调度）
```

| 属性 | 值 |
|------|---|
| AcpConnection 归属 | **Daemon** |
| 驱动方 | **Daemon**（非人类） |
| 输入来源 | Heartbeat / Cron / Webhook / Hook / Agent-to-Agent |
| 进程生命周期 | 长驻，崩溃自动重启 |
| launchMode | `acp-service` |
| 适用场景 | 7×24 运行的自主 Agent（PR 审查、监控、客服） |

> 详见 [Issue #37](../../.trellis/issues/0037-employee-agent-scheduling.json)

---

### 三种模式对比

| 维度 | A: Direct Bridge | B: Session Lease | C: Daemon Managed |
|------|-----------------|-----------------|-------------------|
| AcpConnection | Client 持有 | **Daemon** 持有 | **Daemon** 持有 |
| 驱动方 | 人类 | 人类 | Daemon 调度器 |
| 进程生命周期 | 随连接走 | **独立于连接** | **长驻** |
| 冷启动 | 每次 | **仅首次** | **仅首次** |
| 并发策略 | **自动实例化**（N Instances） | **多 Session**（1 Instance） | ✗（调度器独占） |
| 上下文隔离 | **完全隔离**（独立进程+workspace） | 同进程共享 | N/A |
| Session 恢复 | ✗ | **✓** | N/A |
| 观察能力 | ✗ | ✓ | **✓（execution log）** |
| 实现复杂度 | 最低 | 中 | 高 |
| CWD | agent workspace | agent workspace | agent workspace |

**选择指南**：

```
大多数情况（IDE 接入、一般使用）：
  └─ 模式 A (Direct Bridge) — 默认，最简单

需要长期运行 + 自动调度？
  └─ 模式 C (Daemon Managed / #37)

Agent 已通过 agent start 运行，需要 session 恢复或避免冷启动？
  └─ 模式 B (Session Lease)  — 通过 --lease 选项启用
```

> **注意**：模式 A 和 B 可以共存于同一个 Agent 下。
> `agent start my-agent` 启动后，`proxy my-agent --lease` 走 Session Lease，
> 同时 `proxy my-agent`（默认）仍然走 Direct Bridge（自动实例化一个临时 Instance）。
> 两种模式各自独立，互不影响。

---

## 启动场景

### 场景 1: One-shot 任务

```bash
agentcraft agent run my-agent --prompt "review this PR"
```

Daemon spawn → prompt → 收集结果 → 终止进程。内部使用模式 C 的简化版。

| 属性 | 值 |
|------|---|
| 连接模式 | Daemon Managed（临时） |
| launchMode | `one-shot` |
| workspacePolicy | `ephemeral`（用完清理） |

---

### 场景 2: IDE / CLI 直连（默认）

```bash
agentcraft proxy my-agent              # IDE 通过 Direct Bridge 连接（默认）
agentcraft agent chat my-agent         # Agent 未运行时也走 Direct Bridge
```

Proxy 自己 spawn Agent 进程，端到端 ACP。IDE 断开时进程终止。

| 属性 | 值 |
|------|---|
| 连接模式 | **Direct Bridge（默认）** |
| launchMode | 由 Proxy 控制 |
| processOwnership | `external` |

---

### 场景 3: 长驻服务 + Session Lease

```bash
agentcraft agent start my-agent           # Daemon 启动，进程 warm
agentcraft agent chat my-agent            # Agent 已运行 → 自动走 Session Lease
agentcraft proxy my-agent --lease         # IDE 显式走 Session Lease
agentcraft agent prompt my-agent "hello"  # 单次 prompt（使用 primary session）
```

Agent 进程由 Daemon 管理，多个客户端通过 Session Lease 交互。IDE 通过 Proxy ACP 适配器接入。

| 属性 | 值 |
|------|---|
| 连接模式 | Session Lease |
| launchMode | `acp-service` 或 `acp-background` |
| 多 Client | 每个 Client 独立 Session |

---

### 场景 4: IDE 直连 + Direct Bridge（显式）

```bash
agentcraft proxy my-agent --direct     # 即使 agent 已通过 start 运行，仍走 Direct Bridge
```

显式使用 Direct Bridge，即使 Agent 已通过 `agent start` 运行。会自动实例化一个临时 Instance。

| 属性 | 值 |
|------|---|
| 连接模式 | Direct Bridge（显式） |
| 行为 | 忽略已运行的 Daemon-managed 进程，自己 spawn 新进程 |

---

### 场景 5: 雇员型 Agent

```bash
agentcraft agent create pr-reviewer -t pr-review --launch-mode acp-service
agentcraft agent start pr-reviewer
# Agent 持续运行，Daemon 按 Heartbeat/Cron/Webhook 调度任务
```

| 属性 | 值 |
|------|---|
| 连接模式 | Daemon Managed |
| launchMode | `acp-service` |
| 输入来源 | Heartbeat / Cron / Webhook / Hook |

---

### 场景 6: Direct 模式（打开 IDE，无 ACP）

```bash
agentcraft agent start my-agent   # template backendType: "cursor"
```

Daemon 打开 Cursor IDE 窗口，仅做进程监控。无 ACP 连接。

| 属性 | 值 |
|------|---|
| 连接模式 | 无（仅进程监控） |
| launchMode | `direct` |

---

### 场景 7: 外部自管理（resolve + attach）

```
调用方 → resolve(name) → 获取 {command, args, cwd}
调用方 → spawn Agent 进程
调用方 → attach(name, pid)
调用方 → 自己持有 ACP 连接，直接通信
调用方 → 完成后 detach(name)
```

| 属性 | 值 |
|------|---|
| 连接模式 | 外部全权（等同 Direct Bridge，但由外部调用方控制） |
| AcpConnection 归属 | 外部调用方 |
| Daemon 角色 | 仅 pid 监控（resolve / attach / detach） |

---

### 场景 8: Web UI（未来）

Web 浏览器通过 HTTP REST + WebSocket 接入 Daemon。交互部分走 Session Lease 模式。

---

### 场景 9: Docker + IM（未来）

Docker 容器中运行 Daemon + Agent，外部 IM 通过 HTTP Webhook 接入。每个 IM 用户映射一个 Session（Session Lease 模式）。

---

## 场景总览

### 属性对比

| 场景 | 连接模式 | ACP 归属 | 流式 | 多 Client | launchMode |
|------|---------|---------|:---:|:---:|------------|
| 1. one-shot run | Daemon Managed | Daemon | ✗ | N/A | one-shot |
| 2. proxy / chat（默认） | **Direct Bridge** | **Client** | **✓** | 自动实例化 | 由 Proxy 控制 |
| 3. start + --lease | Session Lease | Daemon | ✓ | ✓ (多 Session) | acp-service/background |
| 4. proxy --direct（显式） | Direct Bridge | Client | ✓ | 自动实例化 | 由 Proxy 控制 |
| 5. 雇员型 | Daemon Managed | Daemon | — | — | acp-service |
| 6. direct IDE | 无 | 无 | N/A | N/A | direct |
| 7. external | 外部全权 | 外部 | 外部 | 外部 | 由外部决定 |
| 8. Web UI | Session Lease | Daemon | ✓ | ✓ | — |
| 9. Docker+IM | Session Lease | Daemon | 取决 IM | ✓ | — |

### 控制权谱系

```
AgentCraft 全权 ◄─────────────────────────────────────────► 调用方全权

  agent.run       Session Lease     Direct Bridge    Self-spawn+Attach
  Daemon Managed  (Daemon管进程,     (Client管进程,    (调用方管全部,
  (Daemon全管)     Client租session)   attach注册)       resolve获取信息)
```

---

## 协议分层

```
┌─────────────────────────────────────────────────────────────┐
│                     Client 层                                │
│  agentcraft CLI / IDE Proxy / Web UI / IM Adapter           │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
         管理操作(RPC)            实时交互(Streaming)
                │                      │
┌───────────────▼──────────────────────▼──────────────────────┐
│                     Daemon 层                                │
│                                                              │
│  ┌─────────────┐  ┌───────────────────┐  ┌───────────────┐ │
│  │ RPC Server  │  │ Session Registry  │  │ Input Router  │ │
│  │ (管理操作)   │  │ (session→client)  │  │ (调度输入)    │ │
│  └──────┬──────┘  └────────┬──────────┘  └───────┬───────┘ │
│         │                  │                      │          │
│         └──────────┬───────┴──────────────────────┘          │
│                    ▼                                         │
│  ┌─────────────────────────────────────────────────┐        │
│  │ AcpConnection (per agent)                       │        │
│  │  initialize / newSession / prompt / cancel      │        │
│  │  sessionUpdate → 按 sessionId 路由              │        │
│  └──────────────────────┬──────────────────────────┘        │
└─────────────────────────┼────────────────────────────────────┘
                          │ ACP / stdio
                          ▼
                   Agent 子进程
```

| 协议层 | 传输 | 用途 |
|--------|------|------|
| **JSON-RPC** | Unix socket | 管理操作：create / start / stop / list / resolve / attach / detach |
| **ACP Session Relay** | Unix socket (streaming) | 实时交互：prompt / stream / cancel / notifications |
| **ACP Direct** | stdio (Proxy ↔ Agent) | Direct Bridge 模式：Proxy 直连 Agent |
| **HTTP** | TCP (未来) | Web UI / Webhook / IM 接入 |

---

## 相关文档

| 文档 | 关系 |
|------|------|
| [Agent 生命周期](../../.trellis/spec/agent-lifecycle.md) | 状态转换、LaunchMode 行为、WorkspacePolicy |
| [接口契约](../../.trellis/spec/api-contracts.md) | RPC 方法、CLI 命令定义 |
| [ACP 架构讨论](./acp-gateway-deprecation-discussion.md) | 设计演进记录（Gateway → Direct Bridge → Session Lease） |
| [Issue #35](../../.trellis/issues/0035-acp-proxy-full-protocol.json) | Proxy + Chat 实现计划 |
| [Issue #37](../../.trellis/issues/0037-employee-agent-scheduling.json) | 雇员型 Agent 调度系统 |
