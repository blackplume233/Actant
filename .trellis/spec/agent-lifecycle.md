# Agent 生命周期与使用模式

> 本文档定义 Actant 中 Agent 的完整生命周期模型、运行模式和外部接入方式。
> 这是理解"Actant 能做什么、怎么用"的核心文档。
> **若代码行为与本文档不一致，以本文档为准。**

---

## 1. 核心概念：实体关系与生命周期

### 1.1 四层实体模型

Actant 中有四个核心实体，具有严格的层次关系和基数约束：

```
AgentTemplate ──1:N──→ AgentInstance ──1:1──→ Process ──1:N──→ Session
(配置蓝图)            (workspace + 元数据)   (OS 进程)         (ACP 会话)
```

| 实体 | 本质 | 持久性 | 管理者 | 基数 |
|------|------|--------|--------|------|
| **AgentTemplate** | JSON 配置文件，定义 Agent 组成 | 持久（文件系统） | TemplateRegistry | 1 Template : N Instance |
| **AgentInstance** | workspace 目录 + `.actant.json` 元数据 | 持久（create→destroy） | AgentManager.cache, InstanceRegistry | 1 Instance : 1 Process |
| **Agent Process** | OS 进程（PID），运行 Agent 后端 | 临时（start→stop/crash） | AgentManager.processes, ProcessWatcher | 1 Process : 1 AcpConnection |
| **ACP Session** | ACP 协议内的会话 | 临时（newSession→end） | AcpConnection.sessions | 1 Connection : N Session |

> **严格 1:1**：一个 Instance 同一时刻最多有一个 Process。`AgentInstanceMeta.pid` 字段天然暗示此约束。
> **并发通过实例化**：Instance 被占用时，通过自动创建 ephemeral 副本实现并发，而非在一个 Instance 上启多个 Process。

### 1.2 两个独立的生命周期

Instance 和 Process 有**两个解耦的生命周期**：

```
Instance 生命周期（持久化）       Process 生命周期（运行时）
  create ──→ exists              spawn ──→ running
     │                              │
     │  可以多次 spawn/terminate     │  可以多次 prompt
     │                              │
  destroy ──→ gone               exit ──→ stopped / crashed
```

| 维度 | Instance (Workspace) | Process |
|------|-----------|---------|
| 实体 | 目录 + `.actant.json` + 领域上下文文件 | OS 进程 (PID) |
| 创建 | `agent.create` / `agent.resolve` | `agent.start` / 外部 spawn |
| 销毁 | `agent.destroy` / `detach --cleanup` | `agent.stop` / 进程退出 / kill |
| 持久性 | 可持久（persistent）或临时（ephemeral） | 总是临时的 |
| 多次使用 | 一个 workspace 可承载多次 spawn | 一次 spawn 只有一个进程 |

**关键理解**：`agent.create` ≠ 启动进程。创建只是准备 workspace（物化配置文件、规则、MCP 配置等）。启动是另一个独立操作。

### 1.3 统一事件系统（Event-First 架构）

> 完整设计文档：[event-system-unified-design.md](../../docs/design/event-system-unified-design.md)

**核心原则：所有系统行为的副作用都应通过事件表达。**

所有触发源（系统生命周期、定时器、用户命令、Agent 交互、插件）流经单一的 **EventBus**，所有响应（shell 执行、内置动作、Agent prompt）由 **ActionRunner** 按 archetype 分派执行策略。

#### 事件分层（六层分类）

```
┌──────────┬──────────┬──────────────────────────────────────────────┐
│ Layer    │ Scope    │ Events                                       │
├──────────┼──────────┼──────────────────────────────────────────────┤
│ System   │ Global   │ actant:start, actant:stop                    │
│ Entity   │ Global   │ agent:created/destroyed/modified, source:*   │
│ Runtime  │ Instance │ process:start/stop/crash/restart              │
│          │          │ session:start/end, prompt:before/after        │
│          │          │ error, idle                                   │
│ Schedule │ Config.  │ cron:<expr>, heartbeat:tick                   │
│ User     │ Config.  │ user:dispatch, user:run, user:prompt          │
│ Extension│ Any      │ subsystem:activated/deactivated/error          │
│          │          │ plugin:<name>, custom:<name>                  │
└──────────┴──────────┴──────────────────────────────────────────────┘
```

#### Archetype 决定执行策略

Agent 三层分类（repo / service / employee）以管理深度递进排列（#228）。Archetype 是确定执行策略、进程管理、工具暴露的根本依据：

```
repo ──→ service ──→ employee
(仅构建)  (进程管理)  (自治调度)
```

| Archetype | 管理深度 | `agent` 动作执行策略 | 原因 |
|-----------|---------|---------------------|------|
| **repo** | L1 — 持续管理 workspace | **N/A** — 通过 actant 命令 acp direct 连接 | 用户自行 open，或外部通过 actant 命令走 ACP |
| **service** | L2 — 进程管理 | **Caller-controlled** — session 策略由调用者/配置决定 | 面向多客户端，纯被动响应，无调度器 |
| **employee** | L3 — 自治调度 | **Queued** — 进入 TaskQueue，串行派发 | 多事件可能同时到达，需串行排队；具备 heartbeat/cron/hooks |

> **关键约束**：
> - `repo` workspace 由 Actant 持续管理（热重载模板变更、组件同步），外部可通过 `actant` 命令经 ACP 直接连接
> - `service` 无调度器 —— 不允许配置 `schedule`，不初始化 EmployeeScheduler；session 生命周期由调用者控制
> - `employee` 必须有 `schedule` 配置 —— 至少包含 heartbeat，是"有使命感的服务"

#### 三种事件订阅模型

每个事件需回答："谁决定 Agent 要关心这个事件？"

| 模型 | 决定者 | 生命周期 | 机制 |
|------|--------|---------|------|
| **A: 系统强制推送** | 系统代码硬编码 | 永久 | 系统内部 if-then，不走 HookRegistry |
| **B: 用户配置 Action** | 人类操作者 | Agent 实例生命周期 | Workflow JSON → HookRegistry |
| **C: Agent 自注册** | Agent 运行时决定 | Ephemeral（进程存活期间） | `actant internal hook subscribe --token $T` → RPC → HookRegistry |

**通信通道**：Agent 动态订阅（模型 C）与所有其他 Agent 系统能力一样，统一通过 `actant internal <command> --token` CLI 暴露（#228 CLI-first 设计决策），使用 session token 认证。MCP 仅作为可选封装层。

```bash
# Agent 在运行时动态订阅事件
actant internal hook subscribe --token $ACTANT_SESSION_TOKEN --event "source:updated" --prompt "有组件更新，请检查"

# Agent 取消订阅
actant internal hook unsubscribe --token $ACTANT_SESSION_TOKEN --hook-id <id>
```

#### 统一数据流

```
Timer → emit(EventBus) ─┐
System event ────────────┤
User CLI/API ────────────┤→ EventBus → HookRegistry → ActionRunner ─┬→ shell/builtin (immediate)
Plugin ──────────────────┘                                          └→ agent prompt
                                                                       ├ employee → TaskQueue → serial
                                                                       ├ service  → caller-controlled session
                                                                       └ repo     → acp direct (on demand)
```

#### Archetype 决定 Dashboard 可用功能

Archetype 不仅影响事件执行策略，还决定了 Dashboard UI 中哪些功能对该 Agent 可用：

| Dashboard 功能 | repo | service | employee | 实现方式 |
|---------------|------|---------|----------|---------|
| Agent Card / Detail | ✅ | ✅ | ✅ | 无限制 |
| Chat | ✅（按需 acp direct） | ✅ | ✅ | repo 通过 acp direct 按需连接，service/employee 需 `running` 状态 |
| Live Canvas（推送 HTML widget） | ❌ | ❌ | ✅ | 前端：仅渲染 employee slot；后端：`canvas.update` 拒绝 repo 和 service |
| 进程状态/重启 | ❌ | ✅ | ✅ | repo 不主动 spawn |
| 调度器面板 | ❌ | ❌ | ✅ | 仅 employee 有 EmployeeScheduler |

> **Warning**: 后端 `canvas.update` RPC handler 会校验 agent archetype，仅 `employee` 类型可使用 Canvas，`repo` 和 `service` 类型的 canvas 推送请求将返回 `INVALID_PARAMS` 错误。前端 Live Canvas 页面也只渲染 `employee` 类型的 agent canvas 条目。前后端双重校验缺一不可。

#### Event-First 设计规则

1. **Emit before extend** — 操作完成后先 emit 事件，由 listener 决定后续行为
2. **Side-effects via hooks, not inline** — 副作用应作为事件 listener，不硬编码在调用方
3. **Caller identity always** — 每次 emit 必须携带 `HookEmitContext`（callerType + callerId）
4. **Don't break the bus** — listener 异常不阻断主流程，emit 是 fire-and-forget

#### Schedule 作为事件源

Schedule 层组件（HeartbeatInput、CronInput）是**纯事件源**，emit 到 EventBus 后由 HookRegistry → ActionRunner 路由。不再拥有独立的 TaskQueue 路由。

- `HeartbeatInput` → emit `heartbeat:tick`（携带 `intervalMs` + `tickCount`）
- `CronInput` → emit `cron:<pattern>`（携带 `pattern` + `timezone`）
- `TaskDispatcher` → emit `idle`（agent 从有任务变为无任务时触发）

EmployeeScheduler 双路输出：既 emit 到 EventBus（供 Workflow Hook 响应），又通过 TaskQueue 串行派发内置 prompt（向后兼容）。

#### Heartbeat `.heartbeat` 文件约定

Employee Agent 的心跳机制通过 **`.heartbeat` 文件约定**实现自适应：

```
创建时                         每次心跳
seedHeartbeatFile()            HeartbeatInput → DEFAULT_HEARTBEAT_PROMPT
  │                              │
  ▼                              ▼
.heartbeat (种子内容)   →   Agent 读取 .heartbeat → 执行任务 → 写回 .heartbeat
                                                              ↑
                                                     Agent 自主演进关注点
```

**核心设计**：

| 组件 | 职责 |
|------|------|
| `heartbeat-default.md` | 固定系统 prompt 模板，指示 Agent 读取 `.heartbeat` 文件 |
| `HeartbeatInput` | 始终发送 `DEFAULT_HEARTBEAT_PROMPT`（从模板加载），不使用用户配置的 prompt |
| `seedHeartbeatFile()` | Agent 创建时，将 template `schedule.heartbeat.prompt` 写入 `.heartbeat` 作为种子值（`wx` 模式，不覆盖已有文件） |
| Agent（运行时） | 每次心跳读取 `.heartbeat` → 执行检查/推进工作 → 写回最新状态和计划 |

**为什么不在 HeartbeatInput 里拼入 prompt**：将 prompt 内容硬编码到 HeartbeatInput 会导致 Agent 无法自主调整关注点。文件约定让 Agent 成为自己心跳内容的唯一控制者，实现真正的自治。

> **Gotcha**: `.heartbeat` 文件使用 `HEARTBEAT_FILENAME` 常量（`packages/core/src/scheduler/inputs/heartbeat-input.ts`），模板变量 `{{heartbeatFilename}}` 在加载时替换。修改文件名需同步更新常量和模板。
>
> 实现参考：`packages/core/src/prompts/heartbeat-default.md`，`packages/core/src/scheduler/inputs/heartbeat-input.ts`，`packages/api/src/handlers/agent-handlers.ts`（`seedHeartbeatFile`）

#### Subsystem 子系统

> 完整设计文档：[subsystem-design.md](../../docs/design/subsystem-design.md)

Subsystem 是绑定到特定 Outer（宿主）的**可热插拔功能模块**，参考 UE5 Subsystem 模式：

| Scope | Outer 实体 | 生命周期 | 典型用途 |
|-------|-----------|---------|---------|
| `ActantSubsystem` | Daemon | daemon start → stop | 全局监控、调度策略 |
| `InstanceSubsystem` | AgentInstance | create → destroy | 领域组件注入、EmployeeScheduler |
| `ProcessSubsystem` | AgentProcess | start → stop | 健康检查、重启追踪 |
| `SessionSubsystem` | AcpSession | session start → end | 会话记忆、工具沙箱 |

Subsystem 生命周期由宿主管理器直接驱动（保证有序可靠），业务通信自由使用 EventBus。

#### Instance 层的作用域角色

- Instance 的 create/destroy/modify 是**持久化操作**，归 Entity 层（全局事件）
- Instance 层不产生独立事件类型，而是作为**作用域**（binding scope），决定 Runtime 层事件绑定到哪个实例
- Process 和 Session 的事件是**运行时事件**，归 Runtime 层

---

## 2. WorkspacePolicy — Workspace 生命周期策略

| 策略 | 行为 | 适用场景 |
|------|------|---------|
| `"persistent"` | Workspace 在 `destroy` 前一直保留，可多次 spawn 复用 | 长期员工 Agent、开发环境 |
| `"ephemeral"` | 任务完成后可自动清理（通过 `detach --cleanup` 或 one-shot 自动清理） | 一次性任务、批量处理 |

```
persistent:                    ephemeral:

create ──→ workspace           create ──→ workspace
   │                              │
spawn → run → exit                spawn → run → exit
   │                              │
spawn → run → exit             destroy ──→ cleaned up
   │
spawn → run → exit
   │
destroy (手动)
```

---

## 3. LaunchMode — 进程运行模式

LaunchMode 定义 Agent 进程的**启动方式**和**生命周期语义**。

### 3.1 direct — 直接交互模式

```
用户
 │  直接操作
 ▼
Agent 进程 (IDE / TUI)
 │
 ▼
Actant workspace
```

| 属性 | 值 |
|------|-----|
| 生命周期所有者 | **用户** |
| 进程形态 | 有 UI（IDE 窗口 / 终端 TUI） |
| 典型 WorkspacePolicy | persistent |
| Actant 角色 | 准备 workspace + 启动进程，之后用户接管 |

**场景**：
- 开发者打开 Cursor IDE 在 Agent workspace 中工作
- 使用 Claude Code TUI 进行交互式编码

**典型流程**：
```
actant agent create dev-agent -t cursor-dev
actant agent start dev-agent          # 打开 Cursor 窗口
# 用户在 Cursor 中工作...
# 用户关闭 Cursor
actant agent stop dev-agent           # 或自动检测进程退出
```

---

### 3.2 acp-background — 后台受控模式

```
外部客户端 (IDE 插件 / Unreal / 脚本)
 │  ACP 或 Actant API
 ▼
Actant Daemon
 │  ACP / stdio
 ▼
Agent 进程 (headless)
 │
 ▼
Actant workspace
```

| 属性 | 值 |
|------|-----|
| 生命周期所有者 | **调用方**（通过 Actant API 控制） |
| 进程形态 | 无头（headless），通过 ACP 通信 |
| 典型 WorkspacePolicy | persistent 或 ephemeral |
| Actant 角色 | spawn + 持有 ACP 连接 + 转发消息 |

**场景**：
- Unreal 通过 ACP Proxy 使用一个代码审查 Agent
- IDE 插件在后台运行一个重构助手
- Web 应用调用 Agent 完成用户请求

**典型流程**：
```
# 通过 ACP Proxy
actant proxy review-agent              # 外部客户端 spawn 这个

# 或通过 API
actant agent create review-agent -t code-review
actant agent start review-agent
# agent.prompt("review-agent", "审查这段代码...")
actant agent stop review-agent
```

---

### 3.3 acp-service — 持久服务模式

```
Actant Daemon (守护者)
 │  监控 + 心跳 + 崩溃重启
 ▼
Agent 进程 (headless, long-running)
 │
 ▼
Actant workspace (persistent)
```

| 属性 | 值 |
|------|-----|
| 生命周期所有者 | **Actant**（像 systemd 管理服务一样） |
| 进程形态 | 无头，长期运行 |
| 典型 WorkspacePolicy | **persistent**（必须） |
| Actant 角色 | spawn + 心跳监控 + 崩溃自动重启 + 接受外部 prompt |

**场景**：
- 7×24 运行的"员工 Agent"——持续监控代码仓库、自动审查 PR
- 定时执行任务的 Agent（通过 scheduler plugin 触发）
- 多个客户端共享的公共 Agent 服务

**典型流程**：
```
actant agent create pr-reviewer -t pr-review --launch-mode acp-service
actant agent start pr-reviewer
# Agent 持续运行...
# 崩溃？Actant 自动重启（指数退避）
# 多个客户端可以 agent.prompt 向它发任务
```

**与 acp-background 的区别**：

| 维度 | acp-background | acp-service |
|------|---------------|-------------|
| 谁决定何时终止 | 调用方 | Actant（或管理员手动） |
| 崩溃处理 | 标记 error/crashed，不自动重启 | **自动重启**（指数退避） |
| 心跳监控 | ProcessWatcher 基础监控 | ProcessWatcher + **心跳插件** |
| Workspace | 可以是 ephemeral | **必须 persistent** |
| 并发客户端 | 通常单客户端 | 可多客户端 prompt |

---

### 3.4 one-shot — 一次性执行模式

```
调用方
 │  agent.run / agent.start
 ▼
Actant Daemon
 │  spawn + 等待退出
 ▼
Agent 进程 (短期)
 │  执行任务 → 退出
 ▼
结果返回 + workspace 可选清理
```

| 属性 | 值 |
|------|-----|
| 生命周期所有者 | **Actant**（自动管理全流程） |
| 进程形态 | 短期运行，执行完毕自动退出 |
| 典型 WorkspacePolicy | **ephemeral** |
| Actant 角色 | create → spawn → 等待完成 → 收集结果 → 清理 |

**场景**：
- Unreal 实时创建一个 Agent 完成单次代码生成任务
- CI/CD 流水线中调用 Agent 做代码审查
- 批量处理：对 100 个文件各创建一个 one-shot Agent

**典型流程**：
```
# 一站式（agent.run 封装全流程）
result = agent.run({ template: "code-gen", prompt: "生成一个排序算法" })
# workspace 自动清理

# 分步骤
actant agent create task-123 -t code-gen --launch-mode one-shot
actant agent start task-123
# 等待进程退出...
# Actant 自动：status → stopped，可选清理 workspace
```

---

### 3.5 LaunchMode 对比总览

| 维度 | direct | acp-background | acp-service | one-shot |
|------|--------|---------------|-------------|----------|
| 进程形态 | 有 UI | headless | headless | headless |
| 生命周期所有者 | 用户 | 调用方 | Actant | Actant |
| 进程存续 | 用户关闭 | 调用方决定 | 长期运行 | 任务完成退出 |
| 崩溃处理 | 通知 | 通知 | **自动重启** | 标记失败 |
| 典型 workspace | persistent | 均可 | persistent | ephemeral |
| Daemon 持有 ACP | 否 | **是** | **是** | **是** |
| 多客户端 | 否 | 否 | **是** | 否 |

---

## 4. ProcessOwnership — 进程管理方

独立于 LaunchMode，标识**谁实际 spawn 了进程**。

| 值 | 含义 | Daemon 能力 |
|----|------|------------|
| `"managed"` | Daemon spawn 的 | 发 ACP 消息、重启、终止、环境请求处理 |
| `"external"` | 外部客户端 spawn 的（通过 `agent.attach` 注册） | PID 监控、状态追踪；**不能**发 ACP 消息 |
| *(空)* | 进程未运行 | — |

```
ProcessOwnership × LaunchMode 组合：

             managed                      external
           ──────────                   ──────────
direct     Daemon spawn Cursor          外部 IDE 自己打开 workspace
           (少见)                        (常见: 用户直接 cursor .)

acp-bg     Daemon spawn headless        Unreal spawn + attach
           + 持有 ACP                    (Unreal 自管 ACP)

acp-svc    Daemon spawn + 心跳           (不适用: 服务必须由 Daemon 管)
           + 崩溃重启

one-shot   Daemon spawn + 等待退出       (不适用: 一次性任务由 Daemon 管)
```

---

## 5. Backend Mode — 后端交互模式

独立于 LaunchMode 和 ProcessOwnership，每个后端声明自身支持的**交互模式（Backend Mode）**。这决定了调用方"如何启动或连接到"一个 Agent 后端。

### 5.1 三种 Backend Mode

| Mode | 职责 | 对应操作 | 典型用法 |
|------|------|---------|---------|
| **open** | **直接打开**后端的原生 TUI/UI，不经过 ACP 协议 | `agent open` → 启动 detached 进程 | `cursor <dir>` 打开 IDE、`claude` 打开 TUI |
| **resolve** | **输出** ACP 连接所需的 command/args，供外部调用方自行建立 ACP 连接 | `agent resolve` → 调用方 `spawn()` → `agent attach` | IDE 插件、自定义编排器 |
| **acp** | **Actant 托管**控制：由 Daemon 或 CLI 通过 ACP 协议 spawn 并管理 Agent | `agent start` / `agent stop` / `agent run` / `agent prompt` / `agent chat` / `agent proxy` | 所有程序化/headless 交互场景 |

> **核心原则**：除了 `open`（直接打开原生 UI）和 `resolve`（输出连接命令供外部使用）之外，所有与 Agent 的程序化交互都应走 **acp** 模式。
>
> **关系说明**：
> - `open` — 人工交互场景，不涉及 ACP 协议，启动后端原生界面即可。
> - `resolve` — 为外部系统提供"如何建立 ACP 连接"的信息（command/args/workspace），由外部系统自行管理进程和 ACP 通信。
> - `acp` — Actant 自身管理的 ACP 生命周期。所有 CLI 命令（start、run、chat、prompt、proxy）和 Daemon 内部调度都通过此模式。

### 5.2 后端支持矩阵

| 后端 | open | resolve | acp | 备注 |
|------|------|---------|-----|------|
| `cursor` | **YES** | **YES** | — | 只打开 IDE，不支持 ACP 协议 |
| `cursor-agent` | **YES** | **YES** | **YES** | Cursor Agent 模式，支持全部三种 |
| `claude-code` | **YES** | **YES** | **YES** | `open` → `claude` TUI；`resolve`/`acp` → `claude-agent-acp`（ACP bridge） |
| `pi` | — | — | **YES** | ACP-only，进程由 AcpConnectionManager spawn；无原生 TUI，不支持 open |
| `custom` | **YES** | — | — | 用户自定义，仅支持外部 spawn |

> **`open` vs `acp` 的可执行文件可能不同**：以 `claude-code` 为例，`open` 使用 `claude`（原生 TUI），而 `resolve`/`acp` 使用 `claude-agent-acp`（ACP 桥接器）。前者是人看的终端界面，后者是 ACP 协议的 stdio 通道。

> **InteractionMode vs Dashboard 通信**：`interactionModes` 仅在 CLI 层校验（`chat.ts`、`run.ts` 等命令入口处检查）。Dashboard 通过 REST API → RPC → `AgentManager.promptAgent()` → ACP 直接通信，**不经过 interactionModes 校验**。因此即使后端缺少某个 interactionMode，Dashboard 侧的功能可能仍然可用（只要 ACP 连接正常）。但 CLI 和 Dashboard 的行为应保持一致，`defaultInteractionModes` 应准确反映后端的实际能力。

> **ACP-only 后端的进程追踪**：`pi` 等 ACP-only 后端的子进程由 `AcpConnectionManager` spawn，而非 `ProcessLauncher`。`AcpConnection.childPid` 暴露子进程 PID，`connect()` 返回值包含 `pid` 字段，供 `startAgent()` 注册到 `ProcessWatcher`。若 PID 未正确传递，bridge 进程崩溃时 Agent 状态将不会更新（保持 "running" 但 ACP 已断开）。

### 5.3 BackendManager（原 BackendRegistry，已重构）

后端通过 `BackendManager`（继承 `BaseComponentManager<BackendDefinition>`）动态注册和管理。所有后端配置为纯数据的 `BackendDefinition`（`VersionedComponent`），可通过 actant-hub 分发。非序列化的行为扩展（如 `acpResolver` 函数）通过 `BackendManager` 的专用方法单独注册。

> **数据与行为分离**：`BackendDefinition` 是 JSON 可序列化的纯数据对象，不含函数字段。行为性扩展（`acpResolver`）由 `BackendManager` 的 `acpResolvers: Map<string, AcpResolverFn>` 独立管理。旧版 `BackendDescriptor`（含 `acpResolver` 函数字段）保留为兼容层，新代码应直接使用 `BackendDefinition` + `BackendManager`。

**核心 API**（`packages/core/src/domain/backend/backend-manager.ts`）：

| 方法 / 函数 | 用途 |
|------|------|
| `register(definition)` | 注册一个 `BackendDefinition` |
| `get(name)` | 获取已注册的定义 |
| `supportsMode(name, mode)` | 检查后端是否支持指定 mode |
| `requireMode(name, mode)` | 断言后端支持指定 mode（不支持则抛描述性错误） |
| `getPlatformCommand(cmd)` | 根据 `process.platform` 选择 `win32` / `default` 命令 |
| `registerAcpResolver(name, fn)` | 注册自定义 ACP 命令解析函数（行为扩展） |
| `getAcpResolver(name)` | 获取已注册的 ACP 解析函数 |
| `checkAvailability(name)` | 使用 `existenceCheck` 探测后端是否已安装 |
| `getInstallMethods(name)` | 获取当前平台适用的安装方式列表 |

**兼容层**（`packages/core/src/manager/launcher/backend-registry.ts`）：

| 函数 | 用途 |
|------|------|
| `registerBackend(descriptor)` | **已废弃** — 兼容旧版 `BackendDescriptor`，内部转换为 `BackendDefinition` + 单独注册 `acpResolver` |
| `registerBackendDefinition(def)` | 推荐 — 直接注册新版 `BackendDefinition` |
| `getBackendDescriptor(type)` | 获取描述符（兼容旧调用方） |
| `getBackendManager()` | 获取底层 `BackendManager` 单例 |

**BackendDefinition 结构**：见 [config-spec.md §5 BackendDefinition](./config-spec.md#backenddefinition)。

**AcpResolverFn**：

```typescript
type AcpResolverFn = (workspaceDir: string, backendConfig?: Record<string, unknown>) => { command: string; args: string[] };
```

自定义 ACP 命令解析函数。优先级高于 `acpCommand`/`resolveCommand`。用于动态解析的后端（如 Pi 使用 `process.execPath`）。

**注册时机**：

- **内置后端**（cursor / cursor-agent / claude-code / custom）：在 `builtin-backends.ts` 模块加载时通过 `BackendManager.register()` 自动注册。
- **外部后端**（如 Pi）：由其包的初始化代码调用 `BackendManager.register()` + `registerAcpResolver()`（见 `app-context.ts`）。
- **Hub 后端**：通过 `SourceManager.injectComponents()` 从 actant-hub 加载 `BackendDefinition` JSON 文件并注册。Hub 定义可被本地代码中的 `register()` 覆盖（如 Pi 在 `app-context.ts` 中添加 `acpOwnsProcess` 和 `origin`）。

> 实现参考：`packages/core/src/domain/backend/backend-manager.ts`、`packages/core/src/manager/launcher/backend-registry.ts`、`packages/core/src/manager/launcher/builtin-backends.ts`

### 5.4 后端依赖解析：resolvePackage 与 binary-resolver

后端通过 `resolvePackage` 字段自声明"我需要哪个 npm 包提供可执行文件"。`binary-resolver`（位于 `@actant/acp`）是通用解析器，接受 `resolvePackage` 作为参数，不持有任何后端特定知识。

**解析链路**：

```
BackendDescriptor.resolvePackage          （后端声明意图）
  → ResolvedBackend.resolvePackage        （backend-resolver 传透）
    → ResolveResult.resolvePackage        （RPC 序列化传递给 CLI）
      → AcpConnection.spawn(resolvePackage)（传给 binary-resolver）
        → resolveAcpBinary(command, resolvePackage)  （泛型解析）
```

**解析优先级**：

1. 检查 PATH — 已全局安装则直接使用
2. `resolvePackage` 有值 → `createRequire(import.meta.url)` 从 `node_modules` 解析 bin 脚本，以 `node <script>` 方式执行
3. 原样返回 command — 由调用方得到 spawn 错误并展示安装提示

> **Warning**: pnpm strict mode 下的依赖定位约束。
>
> `createRequire(import.meta.url)` 只能解析**当前包的直接依赖**。`binary-resolver.ts` 位于 `@actant/acp`，因此即使后端在 `@actant/core/builtin-backends.ts` 中通过 `resolvePackage` 声明了包名，实际的 npm dependency 仍必须出现在 `@actant/acp/package.json` 中。
>
> 这是 pnpm 严格模式的运行时约束，不是架构泄漏。`resolvePackage` 字段声明"需要什么"（意图由后端管理），`@actant/acp` 的 dep 提供"在哪能找到"（运行时宿主）。未来当后端独立为子包（如 `@actant/backend-claude-code`）时，dep 自然跟随后端包迁移，`@actant/acp` 回归纯通用层。

---

## 6. 四种外部接入模式

外部系统与 Actant 交互的四种方式，按**Actant 控制程度**从高到低排列。

### 6.1 agent.run — 全托管

```
调用方 ──→ Actant API ──→ Agent
调用方 ←── 结果             ←── Agent
```

| 属性 | 值 |
|------|-----|
| 协议 | JSON-RPC（CLI / API） |
| 谁 spawn | Daemon |
| 谁拥有 ACP | Daemon |
| Actant 感知 | **完全** |
| 环境能力 | Actant workspace |
| 适合 | 纯任务委托、不关心 Agent 细节 |

**调用方只需一行**：
```
result = agent.run({ template: "reviewer", prompt: "审查这个 PR" })
```

---

### 6.2 ACP Proxy — 标准协议接入

```
调用方 ──ACP/stdio──→ actant proxy ──RPC──→ Daemon ──ACP──→ Agent
```

| 属性 | 值 |
|------|-----|
| 协议 | **标准 ACP / stdio** |
| 谁 spawn Agent | Daemon |
| 谁拥有 Agent ACP | Daemon（Proxy 转发） |
| Actant 感知 | **完全** |
| 环境能力 | workspace 隔离 或 环境穿透 |
| 适合 | IDE 集成、需要标准协议互操作 |

**调用方配置**（与任何 ACP Agent 完全相同）：
```json
{
  "agent": {
    "command": "actant",
    "args": ["proxy", "--agent", "my-agent"],
    "protocol": "acp/stdio"
  }
}
```

**核心价值**：调用方无需了解 Actant，以标准 ACP 即可使用。和接入 Claude Code / Cursor Agent 的代码路径完全一致，**零供应商锁定**。

**两种子模式**：

| 模式 | 标志 | Agent 的 fs/read 去哪 | 场景 |
|------|------|---------------------|------|
| Workspace 隔离 | *(默认)* | Actant workspace | 任务委托 |
| 环境穿透 | `--env-passthrough` | 穿透回调用方 | Agent 操作调用方的文件 |

---

### 6.3 Self-spawn + Attach — 自主管理

```
调用方 ──resolve──→ Actant ──→ workspace 信息
调用方 ──spawn────→ Agent 进程
调用方 ──attach───→ Actant (注册 PID)
调用方 ←──ACP────→ Agent 进程 (直接通信)
```

| 属性 | 值 |
|------|-----|
| 协议 | JSON-RPC（resolve/attach/detach）+ 调用方自选 ACP |
| 谁 spawn Agent | **调用方** |
| 谁拥有 ACP | **调用方** |
| Actant 感知 | 通过 attach 注册（PID 监控 + 状态追踪） |
| 环境能力 | 调用方自己提供 |
| 适合 | 需要完全控制进程和 ACP 的场景 |

**典型流程**：
```
1. info = agent.resolve("my-agent", { template: "..." })
2. process = spawn(info.command, info.args)          // 调用方自己 spawn
3. agent.attach("my-agent", { pid: process.pid })    // 注册到 Actant
4. // 调用方直接和 Agent ACP 通信
5. process.terminate()
6. agent.detach("my-agent", { cleanup: true })       // 通知 Actant
```

**只需两行额外代码**（attach + detach），调用方就从"完全独立"变成了"可观测 + 可协调"。

**Actant 对 attached 进程的能力**：

| 能力 | managed | external (attached) |
|------|---------|-------------------|
| 状态追踪 | ✅ | ✅ |
| PID 监控 | ✅ | ✅ |
| 防重复 spawn | ✅ | ✅ |
| 发 ACP 消息 | ✅ | ❌（调用方拥有 stdio） |
| 崩溃重启 | ✅ | ❌（只通知调用方） |
| 环境请求处理 | ✅ | ❌（调用方自己处理） |

---

### 6.4 MCP Server — Agent 间通信

```
Agent A ──MCP tool call──→ Actant MCP Server ──RPC──→ Daemon ──ACP──→ Agent B
```

| 属性 | 值 |
|------|-----|
| 协议 | **标准 MCP / stdio** |
| 谁 spawn Agent B | Daemon |
| 谁拥有 Agent B ACP | Daemon |
| Actant 感知 | **完全** |
| 环境能力 | Actant workspace |
| 适合 | Agent 委托子任务给另一个 Agent |

**为什么不用 ACP**：Agent A 自身就是被管理的 Agent，它没有能力扮演 ACP Client（无法提供文件系统、终端、权限）。MCP 是 Agent 的原生工具调用协议。

**MCP Tools**（基础版，#16）：
```
actant_run_agent      — 创建 ephemeral Agent 执行任务
actant_prompt_agent   — 向持久 Agent 发送消息
actant_agent_status   — 查询 Agent 状态
actant_create_agent   — 创建实例
actant_list_agents    — 列出所有 Agent
```

> **架构决策：CLI-first 工具暴露（#228）**
>
> 所有对 Agent 暴露的系统能力**统一通过 `actant internal <command> --token` CLI 暴露**，MCP 仅作为可选封装层：
> - Agent 间通信：`actant internal email send --token $T --to <agent>`（CLI）→ `email.send` RPC
> - 调度工具：`actant internal schedule wait --token $T --delay 30000`（CLI）→ Daemon RPC
> - 状态查询：`actant internal status self --token $T`（CLI）→ Daemon RPC
> - MCP Server (#16) 降为 P4 可选扩展，内部仍调 Daemon RPC（同路径）
>
> **理由**：CLI 适用于所有 backend（Cursor / Claude Code / Pi / Custom），零额外依赖，人/Agent/脚本均可测试。MCP 仅适用于支持 MCP 协议的 IDE Agent。
>
> 按 archetype 分层暴露：
> - `repo`：无工具（不持有进程）
> - `service`：canvas、status、agent 间通信
> - `employee`：service 全部 + schedule、email、self-status

---

### 6.5 四种模式对比

| 维度 | agent.run | ACP Proxy | Self-spawn+Attach | MCP Server |
|------|-----------|-----------|-------------------|------------|
| 调用方 | 脚本 / CLI | IDE / 应用 | 应用（Unreal 等） | 其他 Agent |
| 外部协议 | JSON-RPC | **ACP** | JSON-RPC | **MCP** |
| 谁 spawn | Daemon | Daemon | **调用方** | Daemon |
| 谁拥有 ACP | Daemon | Daemon(转发) | **调用方** | Daemon |
| 调用方灵活度 | 低 | 中 | **高** | 中 |
| 实现复杂度 | 最低 | 中 | 低（调用方侧） | 中 |
| 环境穿透 | ❌ | ✅(可选) | ✅(调用方自有) | ❌ |
| 标准协议互操作 | ❌ | ✅(**ACP**) | ❌ | ✅(**MCP**) |

```
Actant 控制程度
高 ◄───────────────────────────────────────────────► 低

 agent.run      ACP Proxy      MCP Server     Self-spawn+Attach
 Daemon 管一切   Daemon 管,      Daemon 管,      调用方管进程,
                Proxy 转 ACP    Agent A 调       attach 注册状态
```

---

## 7. 场景矩阵

### 7.1 游戏引擎集成（Unreal / Unity）

#### 场景 A：一次性代码生成

> Unreal 需要实时生成一段蓝图逻辑代码，用后丢弃。

| 选择 | 推荐 |
|------|------|
| LaunchMode | `one-shot` |
| WorkspacePolicy | `ephemeral` |
| 接入模式 | **agent.run**（最简单）或 **Self-spawn+Attach**（需要控制） |

```
// agent.run 方式（最简）
result = actant.run({ template: "ue-codegen", prompt: "生成排序蓝图" })
use(result.response)

// Self-spawn 方式（需要控制 ACP）
info = actant.resolve("task-123", { template: "ue-codegen" })
proc = spawn(info.command, info.args)
actant.attach("task-123", { pid: proc.pid })
response = acp_prompt(proc, "生成排序蓝图")  // 直接 ACP
proc.terminate()
actant.detach("task-123", { cleanup: true })
```

#### 场景 B：持久化代码审查 Agent

> Unreal 团队有一个长期运行的代码审查 Agent，多人可以随时向它提交审查请求。

| 选择 | 推荐 |
|------|------|
| LaunchMode | `acp-service` |
| WorkspacePolicy | `persistent` |
| 接入模式 | **ACP Proxy**（标准协议）或 **agent.prompt**（API 调用） |

```
// 一次性设置
actant agent create team-reviewer -t code-review --launch-mode acp-service
actant agent start team-reviewer
// Agent 持续运行，崩溃自动重启

// 团队成员使用（通过 ACP Proxy）
// 在各自 IDE 中配置：actant proxy team-reviewer

// 或通过 API
actant.prompt("team-reviewer", "审查 PR #42")
```

#### 场景 C：Unreal 自主管理 Agent 进程

> Unreal 需要完全控制 Agent 进程（自定义 spawn 参数、资源限制、进程组管理），但希望 Actant 追踪状态。

| 选择 | 推荐 |
|------|------|
| LaunchMode | `acp-background` |
| WorkspacePolicy | `persistent`（多次复用）或 `ephemeral` |
| 接入模式 | **Self-spawn + Attach** |

```cpp
// Unreal C++
auto Info = Actant->Resolve("ue-helper", "ue-template");
auto Proc = FPlatformProcess::CreateProc(Info.Command, Info.Args, ...);
Actant->Attach("ue-helper", Proc.GetProcessId());
// Unreal 直接 ACP 通信...
Proc.Terminate();
Actant->Detach("ue-helper");
```

---

### 7.2 IDE 插件集成

#### 场景 D：VSCode 插件接入专业 Agent

> VSCode 插件想使用一个 Actant 管理的安全审计 Agent。

| 选择 | 推荐 |
|------|------|
| 接入模式 | **ACP Proxy**（VSCode 已支持 ACP） |

```json
// VSCode settings.json
{
  "actant.agents": {
    "security-auditor": {
      "command": "actant",
      "args": ["proxy", "--agent", "security-auditor", "--env-passthrough"],
      "protocol": "acp/stdio"
    }
  }
}
```

使用 `--env-passthrough` 让 Agent 能读取 VSCode 当前打开的项目文件。

---

### 7.3 Agent-to-Agent 协作

#### 场景 E：架构师 Agent 委派任务给编码 Agent（同步 MCP）

> Agent A（架构师）需要把实现任务委派给 Agent B（编码专家），等待结果后继续。

| 选择 | 推荐 |
|------|------|
| 接入模式 | **MCP Server**（同步，#16） |
| Agent B LaunchMode | `one-shot`（单次任务）或 `acp-service`（持久可复用） |

```
// Agent A 的 MCP 配置中包含 Actant MCP Server
// Agent A 在执行过程中：

result = mcp.call("actant_run_agent", {
  template: "coding-expert",
  prompt: "实现以下接口：..."
})
// Agent B 被创建、执行、返回结果、清理

// 或者复用持久 Agent：
result = mcp.call("actant_prompt_agent", {
  name: "team-coder",
  message: "实现以下接口：..."
})
```

#### 场景 E2：Agent 间异步 Email 协作（#136）

> Agent A（架构师）发送 Email 给 Agent B（编码专家）和 Agent C（测试专家），无需等待，继续其他工作。

| 选择 | 推荐 |
|------|------|
| 接入模式 | **Email via CLI/API**（异步，#136） |
| Agent B/C LaunchMode | `acp-service`（雇员 Agent，主 Session 处理 Email） |

```bash
# 通过 CLI 发送 Email（人或 Agent 均可调用）
actant email send --to team-coder --cc qa-bot \
  --subject "实现排序模块" \
  --body "请实现以下接口：..."

# 或通过 RPC（Agent 进程内部调用）
rpc.call("email.send", {
  to: ["team-coder"],
  cc: ["qa-bot"],
  subject: "实现排序模块",
  body: "请实现以下接口：...",
})
// Agent A 继续其他工作

// 雇员 Agent B 在主 Session 中收到 Email 并处理
// Agent C (cc) 也收到 Email 备忘
// 完成后 Agent B 的回复 Email 自动投递回 Agent A
```

---

### 7.4 CI/CD 集成

#### 场景 F：流水线中批量代码审查

> CI 流水线在 PR 合并前自动调用 Agent 审查每个变更文件。

| 选择 | 推荐 |
|------|------|
| LaunchMode | `one-shot` |
| WorkspacePolicy | `ephemeral` |
| 接入模式 | **agent.run**（通过 CLI 或 API） |

```bash
#!/bin/bash
for file in $(git diff --name-only HEAD~1); do
  result=$(actant agent run -t code-review -p "审查文件: $file")
  echo "$result" >> review-report.md
done
```

---

### 7.5 Web 应用集成

#### 场景 G：SaaS 平台后端调用 Agent

> Web 应用后端收到用户请求，调用 Agent 生成回复。

| 选择 | 推荐 |
|------|------|
| 接入模式 | **agent.run**（一次性）或 **agent.prompt**（复用持久 Agent） |

```typescript
// Express route handler
app.post("/api/generate", async (req, res) => {
  const result = await actant.run({
    template: "content-writer",
    prompt: req.body.prompt,
  });
  res.json({ content: result.response });
});
```

---

## 8. 决策流程图

选择接入模式的决策树：

```
你是谁？
  │
  ├─ Agent（AI） ──→ MCP Server
  │
  └─ 人/应用
       │
       ├─ 需要标准 ACP 互操作？
       │    ├─ 是 ──→ ACP Proxy
       │    └─ 否 ──→ 继续
       │
       ├─ 需要自己管理 Agent 进程？
       │    ├─ 是 ──→ Self-spawn + Attach
       │    └─ 否 ──→ 继续
       │
       └─ 纯任务委托 ──→ agent.run / agent.prompt
```

选择 LaunchMode 的决策树：

```
Agent 需要多久？
  │
  ├─ 执行一次就结束 ──→ one-shot
  │
  └─ 需要持续运行
       │
       ├─ 需要 7×24 + 崩溃自动重启？
       │    └─ 是 ──→ acp-service
       │
       ├─ 需要用户直接交互（有 UI）？
       │    └─ 是 ──→ direct
       │
       └─ 后台运行，由调用方控制生命周期
            └─ ──→ acp-background
```

---

## 9. 状态转换全图

```
                          ┌──────────────────────────────────────────┐
                          │                                          │
                     create                                          │
                       │                                             │
                       ▼                                             │
                   ┌────────┐    agent.start     ┌──────────┐       │
                   │created │───────────────────→│ starting │       │
                   └────────┘    (或 attach)      └────┬─────┘       │
                       ▲                               │             │
                       │                          成功  │  失败       │
                       │                               │             │
                       │              ┌────────────────┼─────┐       │
                       │              ▼                      ▼       │
  detach(cleanup) ┌─────────┐    ┌─────────┐         ┌───────┐     │
  ───────────────→│destroyed│    │ running │         │ error │     │
  (ephemeral)     └─────────┘    └────┬────┘         └───┬───┘     │
                       ▲              │                   │         │
                       │         ┌────┴────┐              │         │
                  destroy        │         │              │         │
                       │    agent.stop  PID died          │         │
                       │         │     (watcher)     restart        │
                       │         ▼         ▼              │         │
                       │    ┌────────┐ ┌────────┐         │         │
                       │    │stopping│ │crashed │─────────┘         │
                       │    └───┬────┘ └────┬───┘                   │
                       │        │           │                       │
                       │        ▼           │ (acp-service          │
                       │    ┌────────┐      │  auto-restart)        │
                       └────│stopped │      └───────────────────────┘
                            └────────┘
```

---

## 10. 平台级默认 Agent 体系

> 详细设计见 [Hub Agent Kernel (#204)](https://github.com/blackplume233/Actant/issues/204)

Actant 系统自带一套三层平台级 Agent，它们是 actant-hub 的初始内容，不是用户创建的应用级 Agent，而是构成平台"自治操作系统内核"的组成部分。

### 10.1 三层架构

```
┌─ Spark Layer ──────────────────────────────────┐
│  actant-spark  (自主进化引擎，默认不启用)         │
├─ Auxiliary Layer ──────────────────────────────┤
│  updater · scavenger · researcher · onboarder  │
├─ Kernel Layer ─────────────────────────────────┤
│  actant-steward · actant-maintainer · actant-curator │
└────────────────────────────────────────────────┘
```

| 层级 | Archetype | LaunchMode | WorkspacePolicy | 特征 |
|------|-----------|------------|-----------------|------|
| Kernel | `employee` | `acp-service` | `persistent` | 随 daemon 启动，7×24 运行 |
| Auxiliary | `employee` | `acp-service` | `persistent` | 按需激活或由 Kernel 委派 |
| Spark | `employee` | `acp-service` | `persistent` | 贡献者专用，自主 fork/PR |

### 10.2 Kernel Agent 职责

| Agent | 核心职责 | 关键交互 |
|-------|---------|---------|
| **Steward（总管）** | 人类交互的统一入口，取代 CLI；路由、编排、会话管理 | Email in → 理解意图 → 委派给其他 Agent |
| **Maintainer（维护员）** | 自我诊断、自动修复、工程进化、依赖更新 | 监听 error/crash 事件 → 自我修复流程 |
| **Curator（资产管理员）** | 管理本地运行时资产（记忆、人类委托的 Docker/目录/进程等） | `ac://` URI 统一寻址，"一切即文件" |

### 10.3 资产系统概念（Curator 核心）

Curator 遵循 **"一切即文件"** 哲学，将所有受管实体统一为 `ManagedAsset`，通过 `ac://` URI 寻址：

```
ac://memory/{instance}/{layer}/{id}    — 记忆记录
ac://assets/workspace/{name}           — 工作目录
ac://assets/docker/{name}              — Docker 容器
ac://assets/process/{pid}              — 托管进程
ac://records/{instance}/{type}         — 执行记录
ac://artifacts/{instance}/{name}       — Agent 产物
```

**设计原则**：
- Curator 不管理 actant-hub（那是 Updater/Maintainer 的职责）
- Curator 管理的是 **本地运行时产出** 和 **人类委托的外部资产**
- 记忆部分与 Memory 系统分层概念（L0/L1/L2、Instance/Template/Actant 层）深度集成
- 每个资产有 `retentionPolicy`、`healthStatus`、`owner` 属性，支持生命周期自治

> **Gotcha**: 资产系统是 Memory 系统的超集。Memory 专注于记忆记录（L0/L1/L2），Asset System 额外涵盖人类委托的进程、容器、目录等非记忆性资源。两者通过 `ac://` URI 统一。

---

## 变更约定

> 对本文档所定义的任何生命周期状态、LaunchMode 语义、接入模式或场景进行增删改时，**必须先更新本文档，再修改代码**，并在同一次提交中完成。
