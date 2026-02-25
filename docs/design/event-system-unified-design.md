# Unified Event System Design

> **Status**: Draft → Review
> **Author**: cursor-agent
> **Date**: 2026-02-25
> **Related**: #135, #159, #153, #14, #47, `docs/human/hook机制.md`

---

## 0. 设计原则：事件优先 (Event-First)

> **所有系统行为的副作用都应通过事件表达。**

后续所有功能设计和实现必须遵守：

1. **Emit before extend** — 当一个操作（create / start / stop / prompt / dispatch）完成后，
   先 emit 事件到 EventBus，再由感兴趣的 listener 决定后续行为。
   不要在调用方直接硬编码"下一步做什么"。

2. **Side-effects via hooks, not inline** — 如果 `startAgent()` 完成后需要初始化 Scheduler、
   注册 Workflow、发通知等，这些都应作为 `process:start` 事件的 listener，
   而不是写在 `startAgent()` 函数体内或 handler 中。

3. **Caller identity always** — 每次 emit 必须携带 `HookEmitContext`
   （callerType + callerId），让 listener 能做权限判断。

4. **Don't break the bus** — EventBus listener 的异常不能阻断主流程。
   emit 是 fire-and-forget（listener error 被 catch + log）。

违反此原则的典型反模式：

```
// ❌ 反模式: 直接调用
async handleAgentStart(name, ctx) {
  await ctx.agentManager.startAgent(name);
  initSchedulerIfNeeded(name, ctx);   // 硬编码副作用
  sendNotification(name);              // 又一个硬编码副作用
}

// ✅ 正确: 通过事件
async handleAgentStart(name, ctx) {
  await ctx.agentManager.startAgent(name);
  // startAgent 内部已 emit("process:start")
  // Scheduler 初始化由 process:start listener 完成
  // 通知由另一个 listener 完成
}
```

---

## 1. 问题陈述

当前系统存在**两套平行的事件/调度机制**，职责重叠，数据流割裂：

```
                 路径 A: Hook 系统
事件 ──→ HookEventBus ──→ HookRegistry ──→ ActionRunner ──→ shell / builtin / agent

                 路径 B: Scheduler 系统
Timer ──→ InputSource(Cron/Heartbeat/Hook) ──→ TaskQueue ──→ TaskDispatcher ──→ promptAgent
CLI   ──→ EmployeeScheduler.dispatch()     ──→ TaskQueue ──→ TaskDispatcher ──→ promptAgent
API   ──→ agent.dispatch handler           ──→ TaskQueue ──→ TaskDispatcher ──→ promptAgent
```

**根本问题**: 这两条路径在做同一件事 —— "某个事件发生时，执行某个动作（通常是 prompt agent）"。但它们：

- 使用不同的事件总线（HookEventBus vs plain EventEmitter）
- 使用不同的调度模型（immediate vs queue-based）
- 使用不同的执行器（ActionRunner vs TaskDispatcher）
- 用户操作（run / dispatch / prompt）完全绕过了 Hook 系统

---

## 2. 核心洞察

> **Everything is an Event. Every action is a reaction.**

所有触发源 —— 系统生命周期、定时器、用户命令、Agent 交互 —— 本质上都是**事件**。所有响应 —— 执行 shell、调用内置动作、prompt agent —— 本质上都是**动作**。

```
事件源           →   事件名                →   动作
─────────────────────────────────────────────────────
CronInput        →   cron:<expr>           →   agent action (prompt)
HeartbeatInput   →   heartbeat:tick        →   agent action (prompt)
HookInput        →   <event>               →   agent action (prompt)
Manual dispatch  →   user:dispatch         →   agent action (prompt)
CLI run          →   user:run              →   agent action (prompt)
CLI prompt       →   user:prompt           →   agent action (prompt)
ProcessWatcher   →   process:crash         →   builtin (restart/notify)
Agent 完成任务    →   prompt:after          →   shell (git diff)
```

**统一模型**: 一个 EventBus + 一个 ActionRunner + Archetype 感知的执行策略。

---

## 3. 设计目标

| 目标 | 说明 |
|------|------|
| **统一性** | 所有触发源和所有动作类型走同一条 EventBus |
| **可观测性** | 每个事件的完整生命周期（emit → match → execute → result）可追踪 |
| **用户可编程** | 用户通过 Workflow (JSON) 将任意事件映射到任意动作 |
| **权限安全** | 事件发射和监听有 caller-type 级别的访问控制 |
| **Archetype 感知** | 队列调度仅限 employee 型 Agent，其余类型按自身语义执行 |

---

## 4. 统一事件系统架构

### 4.1 概念模型

```
┌───────────────────────────────────────────────────────────────────┐
│                        Event Sources                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ System   │ │ Timer    │ │ User     │ │ Agent    │ │ Plugin │ │
│  │ Lifecycle│ │ Cron/HB  │ │ CLI/API  │ │ ACP      │ │ Custom │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       └─────────────┴────────────┴─────────────┴───────────┘      │
│                              │                                    │
│                    ┌─────────▼──────────┐                         │
│                    │     EventBus       │  单一统一事件总线        │
│                    │  emit(event, ctx)  │  EmitGuard 权限拦截     │
│                    └─────────┬──────────┘                         │
│                              │                                    │
│                    ┌─────────▼──────────┐                         │
│                    │   ActionRunner     │  按动作类型分派          │
│                    └─────────┬──────────┘                         │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐               │
│         ▼                    ▼                    ▼               │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │ Immediate   │    │  Queued      │    │  Concurrent  │         │
│  │ shell,      │    │  TaskQueue   │    │  Multi-Sess  │         │
│  │ builtin     │    │ ↓            │    │  (service)   │         │
│  └─────────────┘    │ Dispatcher   │    └──────────────┘         │
│                     │ (employee    │                              │
│                     │  only)       │                              │
│                     └──────────────┘                              │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Archetype 决定执行策略

**核心变更**: 队列串行化**仅限 employee archetype**。这是明确 Instance Archetype 的根本原因。

| Archetype | `agent` 动作执行策略 | 原因 |
|-----------|-------------------|------|
| **tool** | **Immediate** — 直接 prompt，调用方同步等待 | Tool 是按需调用，用户主动触发，无并发问题 |
| **employee** | **Queued** — 进入 TaskQueue，串行派发 | Employee 持续运行，多事件可能同时到达，需串行排队 |
| **service** | **Concurrent** — 多 session 并发处理 | Service 面向多客户端，每个请求独立 session |

```
ActionRunner 决策流:

action.type == "agent"?
  ├─ target archetype == "employee"  → TaskQueue → serial dispatch
  ├─ target archetype == "service"   → new session / pool session → concurrent
  └─ target archetype == "tool"      → direct prompt → return result
```

> **Service 多 session 问题**: Service Instance 接收指令时是否默认创建新 session？
> 这涉及 session 池化、并发限制、资源管理等设计。已创建 Issue 单独讨论。
> 参见 → Issue: "Service Instance 多 session 与并发模型"

### 4.3 事件分类（完整版）

| Layer | Category | Scope | 事件名 | 触发源 |
|-------|----------|-------|--------|--------|
| **System** | actant | Global | `actant:start`, `actant:stop` | Daemon main |
| **Entity** | agent | Global | `agent:created`, `agent:destroyed`, `agent:modified` | AgentManager |
| **Entity** | source | Global | `source:updated` | SourceManager |
| **Runtime** | process | Instance | `process:start`, `process:stop`, `process:crash`, `process:restart` | AgentManager / ProcessWatcher |
| **Runtime** | session | Instance | `session:start`, `session:end` | AcpConnectionManager |
| **Runtime** | prompt | Instance | `prompt:before`, `prompt:after` | AgentManager.runPrompt |
| **Runtime** | (standalone) | Instance | `error`, `idle` | Various |
| **Schedule** | cron | Configurable | `cron:<expr>` | CronScheduler (emit to EventBus) |
| **Schedule** | heartbeat | Instance | `heartbeat:tick` | HeartbeatScheduler (emit to EventBus) |
| **User** | user | Configurable | `user:dispatch`, `user:run`, `user:prompt` | CLI / API handler |
| **Extension** | plugin | Any | `plugin:<name>` | Plugin code |
| **Extension** | custom | Any | `custom:<name>` | User workflow |

### 4.4 事件生命周期

```
           ┌─────┐
           │ NEW │  事件源产生事件
           └──┬──┘
              │
    ┌─────────▼──────────┐
    │   EMIT GUARD       │  callerType 权限检查
    └─────────┬──────────┘
              │ pass
    ┌─────────▼──────────┐
    │   MATCH            │  EventBus → listeners
    └─────────┬──────────┘
              │ matched
    ┌─────────▼──────────┐
    │   FILTER           │  allowedCallers + condition
    └─────────┬──────────┘
              │ pass
    ┌─────────▼──────────┐
    │   EXECUTE          │  ActionRunner → 按 archetype 分策略
    │   immediate / queue│
    │   / concurrent     │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │   RESULT           │  ExecutionLog 记录
    └─────────────────────┘
```

---

## 5. Schedule 语义重定义

### 5.1 Schedule = EventBus 的事件源，不是独立调度器

当前 `EmployeeScheduler` 内含 `InputRouter` + `TaskQueue` + `TaskDispatcher` + 独立 `EventEmitter`。统一后：

- **定时器（Cron / Heartbeat）**: 纯事件源，emit 到 EventBus，**不自带 TaskQueue**
- **事件接收与调度**: 由 EventBus + HookRegistry + ActionRunner 统一处理
- **任务排队**: 仅当动作目标是 employee archetype 的 Agent 时，ActionRunner 内部走 TaskQueue

### 5.2 Schedule 与 EventBus 重叠部分的处理

| 现有组件 | 与 EventBus 的关系 | 处置 |
|---------|-------------------|------|
| `HookInput` | 完全重叠 — 就是监听 EventEmitter 事件 | **移除**: EventBus 直接覆盖 |
| `InputRouter` | 完全重叠 — 就是事件路由 | **移除**: HookRegistry 覆盖 |
| `CronInput` | 事件源角色不重叠，但内部走独立 TaskQueue | **保留定时逻辑，改为 emit 到 EventBus** |
| `HeartbeatInput` | 同上 | **同上** |
| `TaskQueue` | 不重叠 — EventBus 无排队能力 | **保留，降级为 ActionRunner 的内部子策略，仅限 employee** |
| `TaskDispatcher` | 不重叠 — EventBus 无串行执行能力 | **同上** |
| `EmployeeScheduler` | 大部分重叠 | **Phase C 移除外壳**，核心能力拆散到 EventBus + ActionRunner |

### 5.3 统一后的数据流

```
Before (两条路径):
  Timer → InputSource → TaskQueue → Dispatcher → promptAgent     (路径 B)
  Event → EventBus → HookRegistry → ActionRunner → shell/agent   (路径 A)

After (一条路径):
  Timer → emit(EventBus) ─┐
  System event ────────────┤
  User CLI/API ────────────┤→ EventBus → HookRegistry → ActionRunner ─┬→ shell/builtin (immediate)
  Plugin ──────────────────┘                                          └→ agent prompt
                                                                         ├ employee → TaskQueue → serial
                                                                         ├ service  → session pool → concurrent
                                                                         └ tool     → direct → sync
```

---

## 6. 配置方式

### 6.1 Workflow 声明（JSON 格式）

所有 hook/event 配置统一使用 JSON。

```json
{
  "name": "ops-automation",
  "level": "actant",
  "hooks": [
    {
      "on": "agent:created",
      "description": "Log new agent creation and run smoke test",
      "priority": 10,
      "actions": [
        { "type": "shell", "run": "echo 'New agent: ${agent.name}' >> /var/log/actant.log" },
        { "type": "agent", "target": "qa-bot", "prompt": "Run smoke test for ${agent.name}" }
      ],
      "allowedCallers": ["system", "user"]
    },
    {
      "on": "cron:0 9 * * *",
      "description": "Daily health check",
      "actions": [
        { "type": "builtin", "action": "actant.healthcheck" }
      ],
      "retry": { "maxRetries": 2, "backoffMs": 5000 },
      "timeoutMs": 30000
    }
  ]
}
```

Instance-level workflow（绑定到特定 agent）：

```json
{
  "name": "dev-guard",
  "level": "instance",
  "hooks": [
    {
      "on": "user:run",
      "description": "Auto-stash before running agent",
      "actions": [
        { "type": "shell", "run": "git stash push -m 'auto-stash before agent run'" }
      ],
      "allowedCallers": ["user"]
    },
    {
      "on": "prompt:after",
      "description": "Show git diff after prompt completes",
      "actions": [
        { "type": "shell", "run": "git diff --stat" }
      ]
    }
  ]
}
```

### 6.2 AgentTemplate.schedule → Workflow 适配

旧 `schedule` 字段由适配器自动转换为等价 Workflow：

```
AgentTemplate.schedule.heartbeat
  → WorkflowDefinition {
      name: "<template>-heartbeat",
      level: "instance",
      hooks: [{ on: "heartbeat:tick", actions: [{ type: "agent", target: self, prompt }] }]
    }

AgentTemplate.schedule.cron[i]
  → WorkflowDefinition {
      name: "<template>-cron-<i>",
      level: "instance",
      hooks: [{ on: "cron:<pattern>", actions: [{ type: "agent", target: self, prompt }] }]
    }

AgentTemplate.schedule.hooks[i]
  → WorkflowDefinition {
      name: "<template>-hook-<i>",
      level: "instance",
      hooks: [{ on: "<eventName>", actions: [{ type: "agent", target: self, prompt }] }]
    }
```

### 6.3 注册方式

| 注册方式 | 使用者 | 入口 |
|---------|--------|------|
| Workflow JSON | 用户 | DomainContext / actant-hub |
| `HookRegistry.registerWorkflow()` | 系统代码 | AgentManager 初始化时 |
| `HookCategoryRegistry.register()` | 插件 | Plugin.init() |
| `eventBus.emit()` | 任何代码 | 需通过 EmitGuard 校验 |
| `actant hook subscribe` CLI | Agent (运行时) | Bash 工具 → RPC → Daemon |

---

## 7. 事件订阅模型

### 7.1 三种订阅模型

每个事件都需要回答：**谁决定 Agent 要关心这个事件？**

| 模型 | 决定者 | 生命周期 | 机制 |
|------|--------|---------|------|
| **A: 系统强制推送** | 系统代码硬编码 | 永久 | 不走 HookRegistry，是系统内部 if-then |
| **B: 用户配置 Action** | 人类操作者 | Agent 实例生命周期 | Workflow JSON → HookRegistry |
| **C: Agent 自注册** | Agent 运行时决定 | Ephemeral（进程存活期间） | CLI `actant hook subscribe` → RPC → HookRegistry |

### 7.2 通信通道：ACP/CLI，而非 MCP

Agent 动态订阅（模型 C）的通信通道选择：

- **MCP**: ✗ 错误选择。MCP 是 Agent 连接外部工具的协议，不是管理自身运行时。
- **ACP 原生扩展**: ○ 未来方向。等 ACP 协议支持 custom server-side capabilities。
- **CLI**: ✅ 推荐。所有 backend (Claude Code, Cursor, Pi) 都有 shell 能力。
  Agent 通过 `Bash("actant hook subscribe ...")` 调用。

```bash
# Agent 注册定期轮询
actant hook subscribe --agent self --event heartbeat:tick \
  --interval 300000 --prompt "Check for new PRs"

# Agent 取消订阅
actant hook unsubscribe --agent self --id <subscriptionId>

# Agent 查看自己的动态订阅
actant hook list --agent self --dynamic
```

### 7.3 完整事件订阅矩阵

`HookEventMeta.subscriptionModels` 为每个内置事件标注了支持的订阅模型。

| 事件 | A: 系统强制 | B: 用户配置 | C: Agent 自注册 | 原因 |
|------|:-:|:-:|:-:|------|
| `actant:start/stop` | ✅ | ✅ | ✗ | Agent 未运行或正在关闭 |
| `agent:created/destroyed` | ✅ | ✅ | ✗ | 自身正被创建/销毁 |
| `agent:modified` | — | ✅ | ✅ | Agent 可关心自己的配置变更 |
| `source:updated` | — | ✅ | ✅ | Agent 可关心代码源变化 |
| `process:start/stop/crash/restart` | ✅ | ✅ | ✗ | 进程不存在时 handler 无法执行 |
| `session:start/end` | ✅ | ✅ | ✅ | Agent 可追踪 session 状态 |
| `prompt:before/after` | — | ✅ | ✅ | Agent 可拦截/后处理 prompt |
| `error` | ✅ | ✅ | ✅ | Agent 可注册自定义错误处理 |
| `idle` | — | ✅ | ✅ | Agent 可决定空闲时做什么 |
| `heartbeat:tick` | — | ✅ | ✅ | Agent 可动态创建轮询 |
| `cron:*` | — | ✅ | ✅ | Agent 可动态创建定时任务 |
| `user:dispatch/run/prompt` | ✅ | ✅ | ✅ | 系统路由 + 用户/agent 可拦截 |
| `plugin:*/custom:*` | — | ✅ | ✅ | 扩展事件，完全开放 |

**关键规律**:
- 模型 A 不走 HookRegistry — 是系统行为代码的一部分
- 模型 B 覆盖所有事件 — Workflow 系统的核心用例
- 模型 C 排除 Agent 进程不存在时触发的事件 — 逻辑上无法自注册

`HookCategoryRegistry.isAgentSubscribable()` 方法在运行时校验模型 C 的合法性。

---

## 8. 程序设计模式

| 模式 | 组件 | 职责 |
|------|------|------|
| **Observer** | EventBus (HookEventBus) | 发布-订阅事件分发 |
| **Registry** | HookRegistry | Workflow ↔ 事件绑定的生命周期管理 |
| **Registry** | HookCategoryRegistry | 事件类型分类 + 权限 + subscriptionModels |
| **Strategy** | ActionRunner | 按 action type × target archetype 分派执行策略 |
| **Queue** | TaskQueue | employee archetype 专用串行排队 |
| **Guard** | EmitGuard + allowedCallers + isAgentSubscribable | 三层权限拦截 |

---

## 9. 与现有系统的关系

| 现有概念 | 统一后 | 变化 |
|---------|--------|------|
| `HookEventBus` | **保留 → 升级为统一 EventBus** | +EmitContext, +EmitGuard |
| `HookRegistry` | **保留** | +allowedCallers 过滤 |
| `HookCategoryRegistry` | **保留** | +EventMeta, +canEmit/canListen |
| `ActionRunner` | **保留 → 增加 archetype 感知** | employee→queue, service→concurrent, tool→direct |
| `TaskQueue` | **保留 → 降级为 ActionRunner 内部子策略** | 仅 employee 使用 |
| `TaskDispatcher` | **保留 → 同上** | |
| `ExecutionLog` | **保留** | |
| `CronInput` | **改造**: 保留定时，emit 到 EventBus | 不再直接 enqueue |
| `HeartbeatInput` | **改造**: 同上 | |
| `HookInput` | **移除**: EventBus 全覆盖 | |
| `InputRouter` | **移除**: HookRegistry 全覆盖 | |
| `EmployeeScheduler` | **移除外壳**: 核心能力拆入 EventBus + ActionRunner | |
| `WorkflowDefinition` | **保留, 已升级** | JSON Hook Package |

---

## 10. 不做什么

- **不做 Event Sourcing**: 事件用于触发动作，不用于状态重建
- **不做分布式事件**: 事件总线是进程内的，不跨进程
- **不做事件持久化**: 执行日志持久化，但事件本身不持久化

---

## 11. 设计决策记录

### D1: 事件链深度限制

**决策**: 设置 `MAX_EMIT_DEPTH = 8`。

ActionRunner 的 `emit` 动作类型在执行时递增 depth 计数器（放在 HookEmitContext 中）。EventBus 检查 depth 超限时拒绝 emit 并记录 warning。

8 层足以覆盖合理的事件编排场景（如 A→B→C），同时阻止意外递归。

### D2: Agent 动作超时

**决策**: 分 archetype 设定默认超时。

| Archetype | 默认 timeoutMs | 原因 |
|-----------|---------------|------|
| tool | 300_000 (5min) | 单次任务，用户等待 |
| employee | 600_000 (10min) | 后台任务，可容忍更长 |
| service | 不设默认超时 | 长连接服务，由 session 管理 |

用户可在 HookDeclaration.timeoutMs 中覆盖。Shell 动作保持 30s 不变。

### D3: 事件回放

**决策**: 不支持。

事件用于实时触发动作，不用于审计重建。ExecutionLog 已记录动作的输入输出和结果，足以满足调试需求。如果未来需要，可以在 EventBus 上加一个可选的 EventLogger 插件，但不纳入核心设计。

### D4: 条件表达式语法

**决策**: 使用模板字符串 + 简单比较，不引入表达式引擎。

`condition` 字段支持 `${data.xxx}` 占位符解析后进行 truthy 判断。如需更复杂逻辑，用户应拆分为多个 hook 或使用 `shell` 动作中的 if/then。

理由：保持 JSON 可序列化；避免引入 eval 或 DSL 解析器带来的安全和复杂度开销。

### D5: Workflow 优先级冲突

**决策**: priority 数值全局排序，相同 priority 按注册顺序执行。

- priority 值越小越先执行（类似 Linux nice）
- 默认 priority = 100
- 系统内部 hook 使用 priority < 50 以确保在用户 hook 前执行
- 同 priority 的 hook 按 HookRegistry 注册顺序（FIFO）执行
- 不存在"冲突" — 所有匹配的 hook 都会执行，priority 仅控制顺序

### D6: 配置格式

**决策**: 使用 JSON。

Workflow 声明与 Actant 的所有其他配置（template、manifest、backend）保持格式一致。JSON 支持 schema validation (Zod)、编辑器补全、程序化读写。

### D7: 队列仅限 Employee

**决策**: TaskQueue 串行排队仅对 archetype = "employee" 的 Agent 生效。

- **tool**: 调用方主动触发，直接执行并返回结果（同步语义）
- **employee**: 多事件源可能同时到达（cron + hook + dispatch），必须串行排队防止 prompt 冲突
- **service**: 面向多客户端，每个请求应在独立 session 中并发处理

这也是明确 `AgentArchetype` 的根本原因 — archetype 不仅决定 UI 行为，更决定运行时的调度模型。

---

## 12. 关联 Issues

| Issue | 说明 |
|-------|------|
| #135 | Workflow 重定义为 Hook Package（本设计的直接来源） |
| #159 | Hook 类型定义补全（已完成） |
| #153 | Instance Interaction Archetype（archetype 字段已实现，本设计依赖它） |
| #14 | Plugin 系统（Plugin 通过 HookCategoryRegistry 扩展事件） |
| #47 | EmployeeScheduler（本设计将其重构为 EventBus 消费者） |
| #171 | Service Instance 多 session 与 Instance 并发模型 |
| — | 场景分析: Agent 动态监听 (`scenario-agent-dynamic-listen.md`) |
