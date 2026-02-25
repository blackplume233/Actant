# 场景分析：Employee Agent 动态注册时间片轮询事件

> **Status**: Design Analysis
> **Date**: 2026-02-25
> **Related**: `event-system-unified-design.md`, #135, #153, #47

---

## 1. 场景描述

一个 **employee archetype** 的 Agent（运行在 Claude Code 后端进程中）在执行任务过程中决定：
"我需要每 5 分钟检查一次是否有新的 PR 需要 review。"

Agent 需要在运行时**动态地**：
1. 创建一个 heartbeat 定时器
2. 注册一个 hook 监听该定时器事件
3. 当定时器触发时，自己收到 prompt 执行特定任务
4. 在不需要时可以取消

**核心问题**: Agent 动态监听 — 不是通过静态 template 配置，而是 Agent 自身在运行时决定要监听什么。

---

## 2. 理想调用链路

```
Agent (Claude Code 进程)
  │
  │  "我要每 5 分钟检查 PR"
  │
  ├─ 调用 MCP Tool: actant_hook_subscribe
  │    { event: "heartbeat:tick",
  │      intervalMs: 300000,
  │      prompt: "Check for new PRs needing review",
  │      description: "PR review polling" }
  │
  ▼
Daemon (Actant 进程)
  │
  ├─ 1. 验证权限: EmitGuard 检查 callerType="agent" 是否可操作 hook
  │
  ├─ 2. 创建事件源: 为该 agent 启动 HeartbeatTimer(300000ms)
  │     timer 每 tick → EventBus.emit("heartbeat:tick", { callerType: "system" }, agentName)
  │
  ├─ 3. 注册 hook: HookRegistry.registerWorkflow({
  │       name: "dynamic-<agent>-<uuid>",
  │       level: "instance",
  │       hooks: [{
  │         on: "heartbeat:tick",
  │         actions: [{ type: "agent", target: "<self>", prompt: "Check for new PRs..." }]
  │       }]
  │     }, agentName)
  │
  └─ 4. 返回 subscriptionId 给 Agent
  
─── 5 分钟后 ───

HeartbeatTimer fires
  │
  ├─ EventBus.emit("heartbeat:tick", { callerType: "system" }, agentName, { intervalMs, tickCount })
  │
  ├─ HookRegistry listener matches (instance-level, agentName 匹配)
  │
  ├─ ActionRunner.runAgentAction({ target: self, prompt: "Check for new PRs..." })
  │
  ├─ target archetype == "employee" → TaskQueue.enqueue(task)
  │
  └─ TaskDispatcher → promptAgent(agentName, prompt) → Agent 收到 prompt 执行
```

---

## 3. 当前架构 Gap 分析

逐层追踪，标注每一步的现状：

| # | 步骤 | 需要 | 现有 | Gap |
|---|------|------|------|-----|
| 1 | Agent 向 daemon 发命令 | MCP Tool 或 RPC 接口 | 无 `hook.*` RPC 方法 | **Gap A**: 缺少 Agent→Daemon 的 hook 操作 API |
| 2 | Daemon 验证 Agent 权限 | EmitGuard / callerType 检查 | HookCategoryRegistry.canEmit() 已实现 | ✅ 可用 |
| 3 | 动态创建 HeartbeatTimer | 运行时创建 timer + emit 到 EventBus | HeartbeatInput 只能在 EmployeeScheduler.configure() 时静态创建，且 emit 到 TaskQueue 而非 EventBus | **Gap B**: 无法动态创建事件源 |
| 4 | 注册 hook 到 EventBus | HookRegistry.registerWorkflow() | ✅ 已实现，支持动态调用 | ✅ 可用 |
| 5 | 取消注册 | HookRegistry.unregisterWorkflow() | ✅ 已实现 | ✅ 可用 |
| 6 | 定时器 tick → EventBus | HeartbeatTimer emit 到 EventBus | HeartbeatInput emit 到 TaskQueue（通过 onTask callback） | **Gap C**: 事件源未接入 EventBus |
| 7 | ActionRunner 执行 agent 动作 | promptAgent function | ✅ ActionRunner.runAgentAction 已实现 | ✅ 可用 |
| 8 | Employee 串行排队 | TaskQueue integration | ActionRunner 直接调用 ctx.promptAgent，不走 TaskQueue | **Gap D**: ActionRunner 未做 archetype 感知 |
| 9 | 生命周期管理 | agent stop 时清理动态 hook + timer | HookRegistry.unregisterAgent() 可清理 hook，但无机制清理动态创建的 timer | **Gap E**: 动态事件源的生命周期管理 |

---

## 4. 三个必须填补的 Gap

### Gap A: Agent→Daemon Hook 操作 API

Agent 运行在独立进程中，通过 ACP（或 MCP tool）与 daemon 通信。需要一组 RPC 方法让 agent 管理自己的 hook：

```
hook.subscribe   — 注册 hook 监听 + 可选的事件源创建
hook.unsubscribe — 取消 hook 监听 + 关联事件源清理
hook.list        — 列出自己的动态 hook
```

这些 RPC 方法暴露给 agent 的方式有两条路径：

```
路径 1: MCP Tool（推荐）
  Agent → MCP Tool "actant_hook_subscribe" → MCP Server → RPC → Daemon

路径 2: Agent 通过 shell 调用 CLI
  Agent → exec("actant hook subscribe ...") → CLI → RPC → Daemon
```

路径 1 更优：类型安全、无需 spawn 子进程、响应快。Pi（后端构建器）在 materialize 时向 agent workspace 注入 actant MCP server 配置即可。

### Gap B: 动态事件源工厂

当前 HeartbeatInput / CronInput 只在 EmployeeScheduler.configure() 时从静态配置创建。需要一个**事件源工厂**支持运行时创建/销毁：

```typescript
interface EventSourceFactory {
  createHeartbeat(agentName: string, intervalMs: number): string;  // → sourceId
  createCron(agentName: string, pattern: string): string;          // → sourceId
  destroy(sourceId: string): void;
  destroyByAgent(agentName: string): void;
}
```

所有事件源统一 emit 到 EventBus，不再直接 enqueue 到 TaskQueue。

### Gap C → 与 Gap B 合并

HeartbeatInput 改为 emit 到 EventBus（设计文档 Phase A）。Gap B 的实现自然解决 Gap C。

### Gap D: ActionRunner Archetype 感知

当前 `runAgentAction` 直接调用 `ctx.promptAgent()`。需要根据 target agent 的 archetype 选择执行策略：

```typescript
async function runAgentAction(action, payload, ctx): Promise<ActionResult> {
  const archetype = ctx.getArchetype(action.target);  // 新增
  
  switch (archetype) {
    case "employee":
      return ctx.enqueueTask(action.target, prompt);   // → TaskQueue → serial
    case "service":
      return ctx.promptSession(action.target, prompt);  // → new/pooled session
    case "tool":
    default:
      return ctx.promptAgent(action.target, prompt);    // → direct
  }
}
```

### Gap E: 动态事件源生命周期

动态创建的事件源（timer）必须与创建者的生命周期绑定：

- Agent stop → 清理该 agent 的所有动态 timer + hook
- Agent restart → 不自动恢复（动态注册是 ephemeral 的）
- Daemon restart → 所有动态事件源丢失（可接受，因为 agent 也会重启）

`EventSourceFactory.destroyByAgent(agentName)` + 在 `AgentManager.stopAgent` 流程中调用。

---

## 5. 最小实现方案

按依赖顺序，实现这个场景需要的**最小变更集**：

```
Phase 1: 事件源接入 EventBus（Gap B+C）
  ├─ 新建 EventSourceManager（管理动态事件源，emit 到 EventBus）
  ├─ HeartbeatEmitter（简化版 HeartbeatInput，只做 emit）
  └─ 与 agent 生命周期绑定（stop 时清理）

Phase 2: Hook 操作 RPC（Gap A）
  ├─ rpc.types.ts 增加 hook.subscribe / hook.unsubscribe / hook.list
  ├─ hook-handlers.ts 实现 handler
  └─ handler 内部: EventSourceManager.createHeartbeat() + HookRegistry.registerWorkflow()

Phase 3: Agent 侧 MCP Tool（Gap A 的前端）
  ├─ Pi materializer 注入 actant MCP server 配置
  └─ MCP server 实现 actant_hook_subscribe tool → 转发到 daemon RPC

Phase 4: ActionRunner Archetype 感知（Gap D）
  ├─ ActionContext 增加 getArchetype + enqueueTask
  └─ runAgentAction 按 archetype 分策略
```

Phase 1+2 是核心，Phase 3 是 agent 侧集成，Phase 4 是执行策略优化。

---

## 6. Phase 1+2 的数据流

实现 Phase 1+2 后，完整数据流如下：

```
Agent (Claude Code)
  │  actant_hook_subscribe({
  │    event: "heartbeat:tick",
  │    intervalMs: 300000,
  │    prompt: "Check PRs"
  │  })
  │
  ▼  (MCP Tool → RPC)
Daemon: hook.subscribe handler
  │
  ├─ EventSourceManager.createHeartbeat("my-agent", 300000)
  │   → 创建 timer, 每 300s:
  │     EventBus.emit("heartbeat:tick", { callerType: "system" }, "my-agent", { intervalMs, tickCount })
  │
  ├─ HookRegistry.registerWorkflow({
  │     name: "dynamic-my-agent-<uuid>",
  │     level: "instance",
  │     hooks: [{ on: "heartbeat:tick", actions: [{ type: "agent", target: "my-agent", prompt: "Check PRs" }] }]
  │   }, "my-agent")
  │
  └─ return { subscriptionId: "<uuid>" }

─── 每 5 分钟 ───

Timer tick
  → EventBus.emit("heartbeat:tick")
    → HookRegistry listener (instance match: agentName == "my-agent")
      → ActionRunner.runAgentAction({ target: "my-agent", prompt: "Check PRs" })
        → ctx.promptAgent("my-agent", "Check PRs")  // Phase 4 前直接调用
          → Agent 收到 prompt, 执行 PR review

─── Agent 取消 ───

Agent: actant_hook_unsubscribe({ subscriptionId })
  → handler: HookRegistry.unregisterWorkflow(name, agentName)
  → handler: EventSourceManager.destroy(sourceId)
  → timer 停止, hook 移除
```

---

## 7. 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 动态 hook 持久化？ | **不持久化** | Agent 重启后由 agent 自己重新注册。降低复杂度 |
| 一个 subscribe 同时创建事件源 + hook？ | **是** | 原子操作，避免"有 timer 无 hook"的悬挂状态 |
| 每个 agent 独立 heartbeat？ | **是** | 不同 agent 可能要不同间隔，且生命周期独立 |
| Agent 能为其他 agent 注册 hook？ | **不能** | callerType="agent" 只能操作自己。跨 agent 操作需要 callerType="system" |

---

## 8. 架构启示

这个最简单的场景暴露了一个根本问题：

> **当前架构是"配置驱动"的，不是"运行时驱动"的。**

所有 hook/schedule 都在 init 时从 template 静态加载。agent 运行时无法改变自己的事件监听。
统一事件系统要支持"Agent 自治"，就必须提供**运行时 hook 管理 API**。

这也意味着事件系统的设计不仅面向"系统管理员配置自动化"，更面向"Agent 自主编排自己的行为" — 这是 employee/service archetype 区别于 tool 的核心能力。
