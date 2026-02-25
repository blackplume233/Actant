---
name: "Phase 3c: #40 雇员型 Agent + 调度器"
overview: "内置调度器 (TaskQueue + InputRouter + Sources) + AgentManager 集成 + 可选 N8N"
todos:
  - id: c1-task-queue
    content: "P0: TaskQueue + TaskDispatcher + ExecutionLog 基础实现"
    status: pending
  - id: c2-input-sources
    content: "P0: InputRouter + HeartbeatInput + CronInput + HookInput"
    status: pending
  - id: c3-integration
    content: "P0: EmployeeScheduler + AgentManager 集成 + 模板 schedule schema"
    status: pending
  - id: c4-cli-webhook
    content: "P1: CLI 命令 (dispatch/tasks/logs/schedule) + Webhook/N8N (可选)"
    status: pending
isProject: false
---

# Phase 3c: #40 雇员型 Agent + 调度器

## 前置条件

- Phase 1/2 已完成（AgentManager + AcpConnection 可用）
- 可与 Phase 3a/3b 并行推进

## 目标

实现长时间运行的雇员型 Agent，内置简单调度器，支持可选 N8N 集成。

## Todo 1: TaskQueue + Dispatcher

**新文件**: `packages/core/src/scheduler/`

- `task-queue.ts` — per-agent 串行优先级队列
- `task-dispatcher.ts` — dequeue → promptAgent → record
- `execution-log.ts` — 执行记录（内存 + 文件持久化）
- 类型定义：AgentTask、ExecutionRecord

## Todo 2: InputRouter + Sources

**新文件**: `packages/core/src/scheduler/inputs/`

- `input-source.ts` — InputSource 接口
- `input-router.ts` — 管理所有 InputSource，分发到 TaskQueue
- `heartbeat-input.ts` — 定时心跳（setInterval）
- `cron-input.ts` — Cron 调度（croner 库）
- `hook-input.ts` — 内部事件 hook（EventEmitter）

**新依赖**: `croner`（零依赖、ESM、时区支持）

## Todo 3: 集成

- `employee-scheduler.ts` — 编排 InputRouter + TaskQueue + Dispatcher
- `template-schema.ts` — 新增 ScheduleConfigSchema
- `agent-manager.ts` — normal 模式 + schedule 配置 → 启动 scheduler
- RPC handlers: agent.dispatch / agent.tasks / agent.logs

## Todo 4: CLI + Webhook/N8N

- CLI: `agent dispatch <name> "prompt"` / `agent tasks` / `agent logs`
- CLI: `schedule list/pause/resume`
- WebhookInput + HTTP handler（Hono 路由 + HMAC）— P2
- N8N Bridge（payload + callback）— P2

## 验收标准

- [ ] TaskQueue 串行执行 + 优先级
- [ ] Heartbeat / Cron / Hook 各 InputSource 正常触发
- [ ] EmployeeScheduler 与 AgentManager 集成
- [ ] 模板支持 schedule 配置字段
- [ ] agent dispatch / tasks / logs CLI 命令
- [ ] lint + typecheck 通过
- [ ] Webhook + N8N（可选增强）
