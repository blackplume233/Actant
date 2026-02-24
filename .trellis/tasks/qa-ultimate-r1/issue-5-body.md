## 问题描述

`agent start` 启动带有 `schedule` 配置的 Agent 时，不会创建 `EmployeeScheduler` 实例并注册到 `ctx.schedulers` Map 中，导致 `agent dispatch` 始终返回 `{ queued: false }`。

## 复现步骤

```bash
# 1. 加载含 schedule 配置的模板
actant template load qa-sched-tpl.json
# 模板内容: { ..., schedule: { heartbeat: { intervalMs: 30000, prompt: "Health check" } } }

# 2. 创建并启动 agent
actant agent create sched-agent -t qa-sched-tpl
actant agent start sched-agent

# 3. 验证 agent 在运行
actant agent status sched-agent
# => status: "running" ✓

# 4. 尝试 dispatch
actant agent dispatch sched-agent -m "Hello"
# => "No scheduler for agent "sched-agent". Task not queued."
```

## 期望行为

`agent start` 检测到模板有 `schedule` 配置时，应自动创建 `EmployeeScheduler`，调用 `configure()` 和 `start()`，并注册到 `ctx.schedulers`。之后 `agent dispatch` 应返回 `{ queued: true }`。

## 实际行为

`ctx.schedulers` 始终为空 Map。整个代码库中没有任何地方调用 `schedulers.set()`。

## 根因分析

`packages/api/src/services/app-context.ts` 第 152 行：

```typescript
this.schedulers = new Map();
```

初始化后再无写入。`handleAgentStart`（`agent-handlers.ts:64`）只调用 `agentManager.startAgent(name)`，未检查模板的 `schedule` 字段，也未创建 `EmployeeScheduler`。

## 修复建议

在 `handleAgentStart` 中，agent 启动成功后：

1. 从 `templateRegistry` 获取模板的 `schedule` 配置
2. 如果存在，创建 `EmployeeScheduler(name, promptFn)`
3. 调用 `scheduler.configure(scheduleConfig)` 和 `scheduler.start()`
4. `ctx.schedulers.set(name, scheduler)`

对应地，`handleAgentStop` 和 `handleAgentDestroy` 中需要 `scheduler.stop()` 并从 Map 中移除。

## 影响范围

- `agent dispatch` 对所有 agent 均不可用
- `schedule list` 返回空（虽然模板配了 heartbeat）
- `agent tasks` / `agent logs` 返回空
