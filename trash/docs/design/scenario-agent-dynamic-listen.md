# 场景分析：Employee Agent 动态注册时间片轮询事件

> **Status**: Design Analysis (v2)
> **Date**: 2026-02-25
> **Related**: `event-system-unified-design.md`, #135, #153, #47

---

## 1. 场景描述

一个 **employee archetype** 的 Agent（运行在 Claude Code 后端进程中）在执行任务过程中决定：
"我需要每 5 分钟检查一次是否有新的 PR 需要 review。"

**核心问题**: Agent 动态监听 — 不是通过静态 template 配置，而是 Agent 自身在运行时决定要监听什么事件。

---

## 2. 通信通道选择：ACP / CLI，而非 MCP

### 为什么不是 MCP？

MCP（Model Context Protocol）是 Agent 连接**外部工具服务器**的协议 —— Agent 是 MCP client，外部工具是 MCP server。Actant daemon 不应伪装为 MCP server 来暴露自己的管理能力，这违反了协议的语义：MCP 用于"Agent 使用工具"，不是"Agent 管理自己的运行时"。

### 正确的路径

```
路径 1: ACP 原生扩展（未来）
  Agent process ←ACP protocol→ Daemon (Client)
  ACP 协议本身扩展 custom capabilities / server-side commands
  → 需要 ACP SDK 协议层变更，当前不可用

路径 2: CLI（立即可用，推荐）
  Agent → Bash("actant hook subscribe ...") → CLI → RPC → Daemon
  Agent → Bash("actant hook unsubscribe ...") → CLI → RPC → Daemon
  Agent → Bash("actant hook list ...") → CLI → RPC → Daemon
```

**路径 2 是正确且可行的选择**：

| 维度 | CLI 路径 |
|------|---------|
| 通用性 | 所有 backend (Claude Code, Cursor, Pi) 都有 shell/terminal 能力 |
| 一致性 | 与 `actant agent dispatch` 等现有 CLI 命令同构 |
| 零依赖 | 不需要修改 ACP 协议或注入 MCP server |
| 可测试 | 人类和 agent 用同一套 CLI 操作 |
| 权限控制 | CLI 调用时可通过 agent name 绑定 callerType="agent" |

### Agent 侧用法

Agent 通过 Bash 工具调用 CLI：

```bash
# 注册 heartbeat
actant hook subscribe \
  --agent my-agent \
  --event "heartbeat:tick" \
  --interval 300000 \
  --prompt "Check for new PRs needing review" \
  --description "PR review polling"

# 返回: subscriptionId=abc123

# 取消
actant hook unsubscribe --agent my-agent --id abc123

# 查看当前动态订阅
actant hook list --agent my-agent --dynamic
```

### 未来 ACP 扩展

当 ACP 协议支持 custom server-side capabilities 时，daemon 可将 hook 管理注册为 ACP 能力，Agent 无需 exec shell 即可直接调用。但 CLI 作为基线始终保留。

---

## 3. 核心设计问题：Agent 如何决定自己要不要关心一个事件？

这是事件系统最根本的问题。不是所有事件都以同样的方式到达 Agent。按**谁决定 Agent 关心这个事件**，分三种订阅模型：

### 模型 A: 系统强制推送 (System Mandatory)

**由系统内部代码硬编码的响应**。Agent 无法选择不关心。不走 Workflow 配置，而是系统行为的一部分。

| 事件 | 强制行为 | 谁负责 |
|------|---------|--------|
| `actant:stop` | 通知所有运行中的 agent 准备关闭 | Daemon shutdown handler |
| `process:crash` | 执行重启策略（restart policy） | AgentManager + RestartTracker |
| `process:restart` | 记录重启次数，判断是否超限 | RestartTracker |
| `agent:created` | 初始化 workspace、materialize domain context | AgentManager |
| `agent:destroyed` | 清理 workspace、释放资源 | AgentManager |
| `user:dispatch` | 路由到 agent 的 TaskQueue（employee）或直接执行 | ActionRunner (archetype-aware) |
| `user:run` | 执行 prompt 并返回结果 | AgentManager.runPrompt |
| `user:prompt` | 路由到 ACP session | AcpConnectionManager |

**特征**:
- 在系统代码中硬编码 emit + handle
- 不依赖 HookRegistry / Workflow 配置
- Agent 无法覆盖或取消这些行为
- 本质是**系统自身对事件的内部响应**，而非 hook

### 模型 B: 用户注册 Action (User-Configured)

**人类操作者在部署时通过 Workflow JSON 声明**。Agent 自己不决定。

```json
{
  "name": "code-review-guard",
  "level": "instance",
  "hooks": [
    {
      "on": "prompt:after",
      "description": "Show git diff after every prompt",
      "actions": [{ "type": "shell", "run": "git diff --stat" }]
    },
    {
      "on": "source:updated",
      "description": "Re-analyze code when source changes",
      "actions": [{ "type": "agent", "target": "self", "prompt": "Source updated, re-analyze." }]
    }
  ]
}
```

**特征**:
- 配置时决定，运行时不变
- 存储在 DomainContext（workspace 或 actant-hub）
- Agent start 时由 HookRegistry.registerWorkflow() 加载
- Agent stop 时由 HookRegistry.unregisterAgent() 清理
- 用户可为**任何事件类型**注册 action
- 这是 Workflow 系统的核心用例

### 模型 C: Agent 主动注册 (Agent Self-Subscribed)

**Agent 在运行时自主决定要监听什么事件**。

```bash
# Agent 运行中，决定要定期检查 PR
actant hook subscribe --agent self --event "heartbeat:tick" --interval 300000 --prompt "Check PRs"

# Agent 运行中，决定要在 source 更新时重新分析
actant hook subscribe --agent self --event "source:updated" --prompt "Source changed, re-index."
```

**特征**:
- 运行时动态决定，ephemeral（不持久化）
- Agent stop → 所有动态订阅自动清理
- Agent restart → 需要 agent 自己重新注册（由 agent 的 skill/prompt 驱动）
- 只能为自己注册，不能为其他 agent 注册
- callerType="agent"，受 EmitGuard 和 allowedCallers 约束

---

## 4. 全事件订阅模型矩阵

| 事件 | A: 系统强制 | B: 用户配置 | C: Agent 自注册 | 说明 |
|------|:-:|:-:|:-:|------|
| **System Layer** | | | | |
| `actant:start` | ✅ | ✅ | ✗ | Agent 未启动时无法自注册 |
| `actant:stop` | ✅ | ✅ | ✗ | 关闭中，注册无意义 |
| **Entity Layer** | | | | |
| `agent:created` | ✅ | ✅ | ✗ | 自身正被创建，无法注册 |
| `agent:destroyed` | ✅ | ✅ | ✗ | 自身正被销毁 |
| `agent:modified` | — | ✅ | ✅ | Agent 可关心自己的配置变更 |
| `source:updated` | — | ✅ | ✅ | Agent 可关心代码源变化 |
| **Runtime Layer** | | | | |
| `process:start` | ✅ | ✅ | ✗ | 自身进程在启动中 |
| `process:stop` | ✅ | ✅ | ✗ | 自身进程在停止中 |
| `process:crash` | ✅ | ✅ | ✗ | 自身进程已崩溃，handler 无法执行 |
| `process:restart` | ✅ | ✅ | ✗ | 进程重启中 |
| `session:start` | ✅ | ✅ | ✅ | Agent 可在新 session 创建时做准备 |
| `session:end` | ✅ | ✅ | ✅ | Agent 可在 session 结束时做清理 |
| `prompt:before` | — | ✅ | ✅ | Agent 可拦截自己收到的 prompt |
| `prompt:after` | — | ✅ | ✅ | Agent 可在 prompt 完成后自动执行 |
| `error` | ✅ | ✅ | ✅ | Agent 可注册自己的错误处理 |
| `idle` | — | ✅ | ✅ | Agent 可决定空闲时做什么 |
| **Schedule Layer** | | | | |
| `cron:*` | — | ✅ | ✅ | Agent 可动态创建定时任务 |
| `heartbeat:tick` | — | ✅ | ✅ | Agent 可动态创建轮询 |
| **User Layer** | | | | |
| `user:dispatch` | ✅ | ✅ | ✅ | Agent 可在收到 dispatch 前/后增加行为 |
| `user:run` | ✅ | ✅ | ✅ | 同上 |
| `user:prompt` | ✅ | ✅ | ✅ | 同上 |
| **Extension Layer** | | | | |
| `plugin:*` | — | ✅ | ✅ | 插件定义的事件 |
| `custom:*` | — | ✅ | ✅ | Agent 可自定义事件 |

### 关键规律

1. **系统强制 (A)** 只覆盖**系统必须正确处理的事件** — 进程生命周期、用户指令路由。这些不是 hook，是系统行为。

2. **用户配置 (B)** 覆盖**所有事件** — 这就是 Workflow 系统的存在意义。

3. **Agent 自注册 (C)** 只对 **Agent 运行期间可以触发的事件**有意义 — Agent 不能注册自己的进程启停事件（进程不存在时 handler 无法执行），也不能注册 daemon 级事件（自己还没启动）。

4. **模型 A 和 B/C 的本质区别**: A 是系统内部代码硬编码的 if-then，不经过 HookRegistry；B/C 是通过 EventBus → HookRegistry → ActionRunner 的标准事件链路。

---

## 5. 场景完整调用链路（修正版）

```
Agent (Claude Code, running)
  │
  │  "我要每 5 分钟检查 PR"
  │
  ├─ exec: actant hook subscribe \
  │         --agent my-agent \
  │         --event "heartbeat:tick" \
  │         --interval 300000 \
  │         --prompt "Check for new PRs needing review"
  │
  ▼  (CLI → RPC → Daemon)
  
Daemon: hook.subscribe handler
  │
  ├─ 1. 验证: callerType = "agent", 只能操作自己
  │
  ├─ 2. EventSourceManager.createHeartbeat("my-agent", 300000)
  │      → 创建 timer, 每 tick:
  │        EventBus.emit("heartbeat:tick", { callerType: "system" }, "my-agent")
  │
  ├─ 3. HookRegistry.registerWorkflow({
  │        name: "dynamic-my-agent-<uuid>",
  │        level: "instance",
  │        hooks: [{ on: "heartbeat:tick",
  │                   actions: [{ type: "agent", target: "my-agent", prompt: "Check PRs" }],
  │                   allowedCallers: ["system"] }]  // 只接受系统发出的 tick
  │      }, "my-agent")
  │
  └─ 4. stdout: { subscriptionId: "<uuid>", sourceId: "<sourceId>" }
       → Agent 解析 JSON 输出保存 subscriptionId

─── 每 5 分钟 ───

Timer tick
  → EventBus.emit("heartbeat:tick", { callerType: "system" }, "my-agent")
    → HookRegistry listener (instance match: agentName == "my-agent")
      → ActionRunner.runAgentAction({ target: "my-agent", prompt: "Check PRs" })
        → archetype == "employee" → TaskQueue.enqueue(task)
          → TaskDispatcher → promptAgent → Agent 收到 prompt

─── Agent 决定不再需要 ───

Agent: exec actant hook unsubscribe --agent my-agent --id <uuid>
  → Daemon: HookRegistry.unregisterWorkflow(name, agentName)
  → Daemon: EventSourceManager.destroy(sourceId)
  → timer 停止, hook 移除

─── Agent stop ───

AgentManager.stopAgent("my-agent")
  → HookRegistry.unregisterAgent("my-agent")     // 清理所有 hook
  → EventSourceManager.destroyByAgent("my-agent") // 清理所有动态 timer
```

---

## 6. 需要的最小变更

### Phase 1: RPC + CLI (通道)

```
rpc.types.ts:
  + hook.subscribe   { agent, event, prompt, interval?, cron?, description? }
  + hook.unsubscribe { agent, subscriptionId }
  + hook.list        { agent, dynamic?: boolean }

cli/src/commands/hook/:
  + subscribe.ts
  + unsubscribe.ts
  + list.ts

api/src/handlers/:
  + hook-handlers.ts
```

### Phase 2: EventSourceManager (事件源工厂)

```
core/src/hooks/event-source-manager.ts:
  class EventSourceManager {
    createHeartbeat(agent, intervalMs): string   // → sourceId
    createCron(agent, pattern): string           // → sourceId
    destroy(sourceId): void
    destroyByAgent(agent): void                  // → agent stop 时调用
  }
```

所有事件源 emit 到 EventBus，不再直接 enqueue 到 TaskQueue。

### Phase 3: 生命周期绑定

AgentManager.stopAgent 流程增加:
- `EventSourceManager.destroyByAgent(name)`
- `HookRegistry.unregisterAgent(name)` (已有)

### Phase 4: ActionRunner archetype 感知

```
runAgentAction:
  employee → TaskQueue (serial)
  service  → session pool (concurrent)  
  tool     → direct prompt (sync)
```

---

## 7. 三种订阅模型对 HookEventMeta 的影响

`BUILTIN_EVENT_META` 中每个事件应标注支持的订阅模型：

```typescript
export interface HookEventMeta {
  event: string;
  description: string;
  emitters: string[];
  payloadSchema: HookPayloadFieldSchema[];
  allowedEmitters: HookCallerType[];
  allowedListeners: HookCallerType[];
  
  /** 该事件支持的订阅模型 */
  subscriptionModels: {
    /** 系统是否对此事件有内置强制行为 */
    systemMandatory: boolean;
    /** 用户是否可以通过 Workflow JSON 配置 action */
    userConfigurable: boolean;
    /** Agent 运行时是否可以自注册 action */
    agentSubscribable: boolean;
  };
}
```

这让系统可以在 CLI `actant hook subscribe` 时校验：
如果 `agentSubscribable = false`，拒绝 agent 的自注册请求并给出原因。

---

## 8. 架构启示

1. **Agent 自治能力的边界**：Agent 可以管理自己的事件订阅，但不能逃逸系统强制行为，也不能操作其他 agent。

2. **CLI 是 Agent→Daemon 的通用通道**：在 ACP 原生扩展之前，CLI 是唯一立即可用且跨后端通用的路径。这比 MCP 更正确 —— MCP 是 Agent 使用外部工具，不是 Agent 管理自己。

3. **三种订阅模型不互斥**：同一个事件（如 `user:dispatch`）可以同时有系统强制行为（路由到 queue）、用户配置的 action（发通知）、和 agent 自注册的 action（预处理）。它们按 priority 排序依次执行。
