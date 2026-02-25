# Unified Event System Design

> **Status**: Draft
> **Author**: cursor-agent
> **Date**: 2026-02-25
> **Related**: #135, #159, #14, #47, `docs/human/hook机制.md`

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

当前的 CronInput、HeartbeatInput、HookInput、manual dispatch 都可以表达为：

```
事件源           →   事件名                →   动作
─────────────────────────────────────────────────────
CronInput        →   schedule:cron          →   agent action (prompt)
HeartbeatInput   →   schedule:heartbeat     →   agent action (prompt)
HookInput        →   hook:xxx               →   agent action (prompt)
Manual dispatch  →   user:dispatch          →   agent action (prompt)
CLI run          →   user:run               →   agent action (prompt)
CLI prompt       →   user:prompt            →   agent action (prompt)
ProcessWatcher   →   process:crash          →   builtin (restart/notify)
Agent 完成任务    →   prompt:after           →   shell (git diff)
```

**统一模型**: 一个事件总线 + 一个动作执行器 + 可选的任务队列（对于需要串行化的动作）。

---

## 3. 设计目标

| 目标 | 说明 |
|------|------|
| **统一性** | 所有触发源和所有动作类型走同一条数据通路 |
| **可观测性** | 每个事件的完整生命周期（emit → match → execute → result）可追踪 |
| **用户可编程** | 用户可以通过 Workflow (YAML) 将任意事件映射到任意动作 |
| **权限安全** | 事件发射和监听有 caller-type 级别的访问控制 |
| **渐进迁移** | 不一次性重写，而是逐步将 Scheduler 路径接入事件系统 |

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
│       │             │            │             │           │      │
│       └─────────────┴────────────┴─────────────┴───────────┘      │
│                              │                                    │
│                    ┌─────────▼──────────┐                         │
│                    │    EventBus        │ ← emit(event, context)  │
│                    │  (single unified)  │                         │
│                    └─────────┬──────────┘                         │
│                              │                                    │
│               ┌──────────────┼──────────────┐                     │
│               ▼              ▼              ▼                     │
│        ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│        │ Immediate  │ │  Queued    │ │  Passive   │              │
│        │ Executor   │ │  Executor  │ │  Observer  │              │
│        │ (shell,    │ │  (agent    │ │  (log,     │              │
│        │  builtin)  │ │   prompt)  │ │   metrics) │              │
│        └────────────┘ └────────────┘ └────────────┘              │
│                              │                                    │
│                    ┌─────────▼──────────┐                         │
│                    │    TaskQueue       │ ← 仅 agent 类动作需要    │
│                    │  (priority-based)  │    串行排队             │
│                    └─────────┬──────────┘                         │
│                              │                                    │
│                    ┌─────────▼──────────┐                         │
│                    │  TaskDispatcher    │ ← 按 agent 串行执行      │
│                    │  (serial per agent)│                         │
│                    └────────────────────┘                         │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 事件分类（完整版）

在 Step 1 已建立的五层分类基础上，补充**用户层**和**调度层**：

| Layer | Category | Scope | 事件名 | 触发源 |
|-------|----------|-------|--------|--------|
| **System** | actant | Global | `actant:start`, `actant:stop` | Daemon main |
| **Entity** | agent | Global | `agent:created`, `agent:destroyed`, `agent:modified` | AgentManager |
| **Entity** | source | Global | `source:updated` | SourceManager |
| **Runtime** | process | Instance | `process:start`, `process:stop`, `process:crash`, `process:restart` | AgentManager / ProcessWatcher |
| **Runtime** | session | Instance | `session:start`, `session:end` | AcpConnectionManager |
| **Runtime** | prompt | Instance | `prompt:before`, `prompt:after` | AgentManager.runPrompt |
| **Runtime** | (standalone) | Instance | `error`, `idle` | Various |
| **Schedule** | cron | Configurable | `cron:<expr>` | CronScheduler |
| **Schedule** | heartbeat | Instance | `heartbeat:tick` | HeartbeatScheduler |
| **User** | user | Configurable | `user:dispatch`, `user:run`, `user:prompt` | CLI / API handler |
| **Extension** | plugin | Any | `plugin:<name>` | Plugin code |
| **Extension** | custom | Any | `custom:<name>` | User workflow |

**新增的 User 层**：将用户发起的操作也视为事件。这意味着：
- `actant agent run my-agent "review code"` 会先 emit `user:run`
- Workflow 可以拦截 `user:run`，在 agent prompt 前后插入自定义动作
- 给了用户"在任何操作前后插入行为"的能力

**新增的 heartbeat category**：将 HeartbeatInput 纳入标准事件分类。

### 4.3 动作执行策略

不同动作类型有不同的执行语义：

| 动作类型 | 执行策略 | 是否排队 | 说明 |
|---------|---------|---------|------|
| `shell` | Immediate | 否 | 直接 exec, 有 timeout |
| `builtin` | Immediate | 否 | 同步调用内置函数 |
| `agent` | Queued | **是** | 进入 TaskQueue, 按 agent 串行派发 |
| `webhook` (future) | Immediate | 否 | HTTP POST 到外部 URL |
| `emit` (future) | Immediate | 否 | 发射另一个事件（事件链） |

关键设计决策：**`agent` 类动作必须走队列**。因为一个 Agent 在同一时刻只能处理一个 prompt（ACP 串行模型），所以 agent 动作不能立即执行，必须排入 TaskQueue 由 TaskDispatcher 按优先级串行派发。

这正是当前 Scheduler 系统存在的原因 —— 它不是多余的，而是 agent 动作的必要调度层。统一后的架构保留了 TaskQueue + TaskDispatcher，但将其作为 ActionRunner 的子策略而非独立系统。

### 4.4 事件生命周期

```
               ┌─────┐
               │ NEW │ 事件源产生事件
               └──┬──┘
                  │
        ┌─────────▼──────────┐
        │   EMIT GUARD       │ 检查 callerType 权限
        │   (canEmit?)       │
        └─────────┬──────────┘
                  │ pass
        ┌─────────▼──────────┐
        │   MATCH            │ EventBus 匹配 listeners
        │   (event → hooks)  │
        └─────────┬──────────┘
                  │ matched
        ┌─────────▼──────────┐
        │   FILTER           │ 检查 allowedCallers, condition
        │   (per hook)       │
        └─────────┬──────────┘
                  │ pass
        ┌─────────▼──────────┐
        │   EXECUTE          │ ActionRunner 执行动作
        │   immediate / queue│
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │   RESULT           │ 记录执行结果
        │   success / fail   │
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │   POST-EXEC        │ 可选: 发射后续事件
        │   (event chaining) │ (e.g. action:completed)
        └─────────────────────┘
```

---

## 5. 用户操作映射为事件

### 5.1 当前用户操作与事件的对应关系

| CLI 命令 | 当前实现 | 统一后事件 | 拦截点 |
|---------|---------|-----------|--------|
| `agent create <name>` | AgentManager.createAgent | emit `agent:created` | after |
| `agent start <name>` | AgentManager.startAgent | emit `process:start` | after |
| `agent stop <name>` | AgentManager.stopAgent | emit `process:stop` | after |
| `agent destroy <name>` | AgentManager.destroyAgent | emit `agent:destroyed` | after |
| `agent run <name> "prompt"` | AgentManager.runPrompt | emit `user:run` → `prompt:before` → exec → `prompt:after` | before & after |
| `agent prompt <name> "msg"` | AgentManager.promptAgent | emit `user:prompt` → `prompt:before` → exec → `prompt:after` | before & after |
| `agent dispatch <name> "task"` | EmployeeScheduler.dispatch | emit `user:dispatch` → enqueue → exec → `prompt:after` | before & after |

### 5.2 用户可编程示例

用户通过 Workflow YAML 即可在任何操作前后插入自定义逻辑：

```yaml
name: code-review-guard
level: instance
hooks:
  # 每次 run 之前自动保存 git stash
  - on: "user:run"
    description: "Auto-stash before running agent"
    actions:
      - type: shell
        run: "git stash push -m 'auto-stash before agent run'"
    allowedCallers: ["user"]

  # 每次 prompt 完成后自动 diff
  - on: "prompt:after"
    description: "Show git diff after prompt completes"
    actions:
      - type: shell
        run: "git diff --stat"

  # Agent crash 时通知 + 自动重启
  - on: "process:crash"
    description: "Notify and request diagnostic"
    actions:
      - type: builtin
        action: actant.notify
        params:
          channel: slack
          message: "Agent ${agent.name} crashed"
      - type: agent
        target: diagnostics-agent
        prompt: "Analyze crash logs for ${agent.name}"
```

---

## 6. Scheduler → Event System 统一路径

### 6.1 映射关系

| Scheduler 组件 | 统一后归属 | 说明 |
|---------------|-----------|------|
| `HeartbeatInput` | 事件源: emit `heartbeat:tick` | 定时器变为事件发射器 |
| `CronInput` | 事件源: emit `cron:<pattern>` | 定时器变为事件发射器 |
| `HookInput` | **废弃**: 直接由 HookEventBus 覆盖 | 不再需要桥接层 |
| `InputRouter` | **废弃**: 事件总线本身就是路由器 | 注册逻辑移入 HookRegistry |
| `TaskQueue` | **保留**: 作为 agent 类动作的排队层 | ActionRunner 内部使用 |
| `TaskDispatcher` | **保留**: 作为 agent 类动作的串行执行器 | ActionRunner 内部使用 |
| `EmployeeScheduler` | **重构**: 变为事件系统的配置入口 | 配置 workflow → register hooks |
| `ExecutionLog` | **保留**: 记录所有动作的执行历史 | ActionRunner 输出 |

### 6.2 渐进迁移策略

**Phase A — 桥接（当前可做）**:
- 让 HookEventBus 成为单一事件中心
- EmployeeScheduler 内部的 timer 改为 emit 到 HookEventBus
- Agent handler (run/prompt/dispatch) 增加 emit 调用
- 不改变外部 API，内部数据流统一

**Phase B — 队列整合**:
- ActionRunner 的 `agent` 动作类型内部走 TaskQueue
- 废弃 HookInput（事件直接走 HookEventBus）
- 废弃 InputRouter（HookRegistry 全覆盖）

**Phase C — 完全统一**:
- EmployeeScheduler 重构为 `EventScheduler`
- Schedule 配置格式统一为 Workflow 声明
- 旧 schedule config 提供兼容适配器

---

## 7. 程序设计模式

| 模式 | 组件 | 职责 |
|------|------|------|
| **Observer** | HookEventBus | 发布-订阅事件分发 |
| **Registry** | HookRegistry | Workflow ↔ 事件绑定的生命周期管理 |
| **Registry** | HookCategoryRegistry | 事件类型的分类元数据管理 |
| **Strategy** | ActionRunner | 按动作类型分派到不同执行策略 |
| **Queue + Serial Executor** | TaskQueue + TaskDispatcher | agent 动作的串行排队派发 |
| **Guard / Interceptor** | EmitGuard + allowedCallers | 双层权限拦截 |
| **Chain of Responsibility** | 事件生命周期 | emit → guard → match → filter → execute → post-exec |

---

## 8. 配置方式

### 8.1 Workflow 声明（用户配置）

```yaml
name: ops-automation
level: actant
hooks:
  - on: "agent:created"
    description: "Log new agent creation and run smoke test"
    priority: 10
    actions:
      - type: shell
        run: "echo 'New agent: ${agent.name}' >> /var/log/actant.log"
      - type: agent
        target: qa-bot
        prompt: "Run smoke test for ${agent.name}"
    allowedCallers: ["system", "user"]

  - on: "cron:0 9 * * *"
    description: "Daily health check"
    actions:
      - type: builtin
        action: actant.healthcheck
    retry:
      maxRetries: 2
      backoffMs: 5000
    timeoutMs: 30000
```

### 8.2 AgentTemplate.schedule（兼容旧配置）

```yaml
schedule:
  heartbeat:
    intervalMs: 60000
    prompt: "Check for pending tasks"
  cron:
    - pattern: "0 9 * * *"
      prompt: "Daily review"
  hooks:
    - eventName: "source:updated"
      prompt: "Source updated, re-analyze"
```

这些旧格式会被**适配器**自动转换为 Workflow 声明：

```
schedule.heartbeat → Workflow{ hooks: [{ on: "heartbeat:tick", actions: [{ type: "agent", ... }] }] }
schedule.cron[i]   → Workflow{ hooks: [{ on: "cron:<pattern>", actions: [{ type: "agent", ... }] }] }
schedule.hooks[i]  → Workflow{ hooks: [{ on: "<eventName>", actions: [{ type: "agent", ... }] }] }
```

### 8.3 注册方式

| 注册方式 | 使用者 | 入口 |
|---------|--------|------|
| Workflow YAML/JSON | 用户 | DomainContext / actant-hub |
| `HookRegistry.registerWorkflow()` | 系统代码 | AgentManager 初始化时 |
| `HookCategoryRegistry.register()` | 插件 | Plugin.init() |
| `eventBus.emit()` | 任何代码 | 需通过 EmitGuard 校验 |

---

## 9. 新增事件类型定义

### 9.1 User Layer 事件

| 事件 | 触发时机 | Payload |
|------|---------|---------|
| `user:dispatch` | 用户通过 CLI/API dispatch 任务 | `{ prompt, priority, source: "cli"/"api" }` |
| `user:run` | 用户通过 CLI/API run prompt | `{ prompt, source: "cli"/"api" }` |
| `user:prompt` | 用户通过 CLI/API prompt agent (ACP) | `{ prompt, sessionId, source: "cli"/"api" }` |

### 9.2 Schedule Layer 事件（扩充）

| 事件 | 触发时机 | Payload |
|------|---------|---------|
| `cron:<expr>` | Cron 表达式匹配 | `{ pattern, timezone? }` |
| `heartbeat:tick` | 心跳间隔到达 | `{ intervalMs, tickCount }` |

### 9.3 未来扩展事件

| 事件 | 层 | 说明 |
|------|---|------|
| `action:completed` | Runtime | 动作执行完成（用于事件链） |
| `action:failed` | Runtime | 动作执行失败 |
| `webhook:received` | Extension | 收到外部 webhook |
| `file:changed` | Extension | 文件系统变化 |

---

## 10. 与现有系统的关系

| 现有概念 | 统一后定位 | 变化 |
|---------|-----------|------|
| `HookEventBus` | **保留, 升级为统一事件总线** | 增加 EmitContext, EmitGuard |
| `HookRegistry` | **保留, 职责不变** | 增加 allowedCallers 过滤 |
| `ActionRunner` | **保留, 增加队列策略** | agent 动作走 TaskQueue |
| `EmployeeScheduler` | **Phase C 重构** | 变为 Workflow 配置的适配器 |
| `InputRouter` | **Phase B 废弃** | HookRegistry 全覆盖 |
| `HookInput` | **Phase B 废弃** | 直接用 HookEventBus |
| `CronInput` | **Phase A 改造** | 保留定时逻辑, 改为 emit 到 EventBus |
| `HeartbeatInput` | **Phase A 改造** | 同上 |
| `TaskQueue` | **保留** | 作为 agent 动作的内部排队 |
| `TaskDispatcher` | **保留** | 作为 agent 动作的串行执行器 |
| `WorkflowDefinition` | **保留, 已升级** | 从 markdown 容器升级为 Hook Package |

---

## 11. 不做什么

- **不做 Event Sourcing**: 事件用于触发动作，不用于状态重建
- **不做分布式事件**: 事件总线是进程内的，不跨进程
- **不做事件持久化**: 执行日志持久化，但事件本身不持久化
- **不一次性重写**: 通过三阶段渐进迁移，保持系统稳定

---

## 12. 开放问题

1. **事件链的深度限制**: `emit` 动作类型可能产生无限递归，需要 max-depth 保护
2. **agent 动作的超时**: 当前 shell 有 30s timeout, agent prompt 可能需要分钟级 timeout
3. **事件回放**: 是否需要支持重放历史事件用于调试？
4. **条件表达式语法**: `condition` 字段目前是模板字符串，是否需要更强的表达式引擎？
5. **Workflow 优先级冲突**: 多个 Workflow 监听同一事件时，priority 冲突的解决策略
