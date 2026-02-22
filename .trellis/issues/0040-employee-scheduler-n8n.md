---
id: 40
title: 雇员型 Agent 实现 — 内置调度器 + N8N 集成
status: closed
labels:
  - feature
  - architecture
  - scheduler
  - "priority:P1"
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 37
  - 11
  - 12
  - 13
  - 17
  - 38
relatedFiles:
  - packages/core/src/scheduler/task-queue.ts
  - packages/core/src/scheduler/task-dispatcher.ts
  - packages/core/src/scheduler/execution-log.ts
  - packages/core/src/scheduler/inputs/input-source.ts
  - packages/core/src/scheduler/inputs/input-router.ts
  - packages/core/src/scheduler/inputs/heartbeat-input.ts
  - packages/core/src/scheduler/inputs/cron-input.ts
  - packages/core/src/scheduler/inputs/hook-input.ts
  - packages/core/src/scheduler/inputs/webhook-input.ts
  - packages/core/src/scheduler/inputs/n8n-bridge.ts
  - packages/api/src/http/webhook-handler.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/template/schema/template-schema.ts
taskRef: null
githubRef: "blackplume233/Actant#47"
closedAs: completed
createdAt: "2026-02-21T12:00:00"
updatedAt: "2026-02-22T12:00:00"
closedAt: "2026-02-22T12:00:00"
---

**Related Issues**: [[0037-employee-agent-scheduling]], [[0011-acp-service]], [[0012-acp-endpoint]], [[0013-plugin-heartbeat-scheduler-memory]], [[0017-mcp-server]], [[0038-rename-agentcraft-to-actant]]
**Related Files**: `packages/core/src/scheduler/task-queue.ts`, `packages/core/src/scheduler/task-dispatcher.ts`, `packages/core/src/scheduler/execution-log.ts`, `packages/core/src/scheduler/inputs/input-source.ts`, `packages/core/src/scheduler/inputs/input-router.ts`, `packages/core/src/scheduler/inputs/heartbeat-input.ts`, `packages/core/src/scheduler/inputs/cron-input.ts`, `packages/core/src/scheduler/inputs/hook-input.ts`, `packages/core/src/scheduler/inputs/webhook-input.ts`, `packages/core/src/scheduler/inputs/n8n-bridge.ts`, `packages/api/src/http/webhook-handler.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/core/src/template/schema/template-schema.ts`

---

## 目标

实现长时间运行的雇员型 Agent，内置简单调度器（Heartbeat / Cron / Hook / Webhook），并支持可选的 N8N 集成。

**与 #37 的关系**：本 Issue 是 #37（雇员型 Agent 设计）的实现版本，细化了调度器实现方案，新增了 N8N 集成考量。#37 保留为原始设计文档。

## 架构设计

### 内置调度器

```
EmployeeScheduler
  ├── InputRouter        → 管理所有 InputSource，统一分发到 TaskQueue
  ├── TaskQueue          → per-agent 串行队列，priority-sorted
  ├── TaskDispatcher     → dequeue → AcpConnection.prompt() → ExecutionLog
  └── InputSources:
       ├── HeartbeatInput  → setInterval，可配置间隔
       ├── CronInput       → cron 表达式（使用 croner 库）
       ├── HookInput       → 内部事件（agent:started, task:completed 等）
       └── WebhookInput    → HTTP 接收（Hono 路由）
```

### N8N 集成（三种模式）

**模式 1: N8N → Actant（N8N 作为调度器）**
- N8N 通过 Webhook 触发 Actant 的雇员 Agent
- Actant WebhookReceiver 接收 → TaskQueue → 执行 → callback 返回结果

**模式 2: Actant → N8N（Agent 使用 N8N 能力）**
- Agent 通过 MCP Server 调用 N8N 的 API
- MCP Tools: n8n_trigger_workflow, n8n_list_workflows, n8n_get_execution

**模式 3: 双向集成（推荐最终形态）**
- N8N 做复杂调度和外部事件编排
- Actant 做 Heartbeat/Hook 等紧耦合调度
- 双方通过 Webhook + MCP 双向通信

### 为什么不完全依赖 N8N？

| 考量 | 内置调度器 | N8N |
|------|-----------|-----|
| 部署复杂度 | 零依赖 | 需要单独部署 |
| Heartbeat | 紧耦合 Agent 状态 | 不适合 |
| Hook（内部事件） | 直接访问 AgentManager | 需要桥接 |
| 复杂编排 | 不擅长 | 核心能力 |
| 外部集成 | 需自行实现 | 丰富生态 |

结论：Heartbeat + Hook + 简单 Cron 内置，复杂编排推荐 N8N。

## 模板配置

```json
{
  "schedule": {
    "heartbeat": {
      "enabled": true,
      "intervalMs": 1800000,
      "prompt": "检查是否有新任务",
      "suppressNoAction": true
    },
    "cron": [
      { "schedule": "0 9 * * 1-5", "prompt": "晨检报告", "label": "morning" }
    ],
    "hooks": [
      { "event": "agent:started", "prompt": "检查待处理事项" }
    ],
    "webhooks": [
      { "path": "/webhook/github", "promptTemplate": "GitHub: {{event}}" }
    ],
    "n8n": { "enabled": true, "callbackUrl": "http://n8n:5678/webhook/actant-callback" }
  }
}
```

## 实现分阶段

### Phase 1: TaskQueue + Dispatcher 基础

```
packages/core/src/scheduler/
  ├── task-queue.ts
  ├── task-dispatcher.ts
  ├── execution-log.ts
  └── index.ts
```

- TaskQueue：per-agent 串行队列
- TaskDispatcher：dequeue → promptAgent → record
- AgentManager 集成：acp-service + schedule → 启动 dispatcher
- CLI: `agent dispatch <name> "prompt"`

### Phase 2: InputRouter + 内置 InputSources

```
packages/core/src/scheduler/inputs/
  ├── input-source.ts
  ├── input-router.ts
  ├── heartbeat-input.ts
  ├── cron-input.ts       ← 使用 croner 库
  ├── hook-input.ts
  └── index.ts
```

- 模板 schema 扩展 `schedule` 字段
- CLI: `schedule list/pause/resume`

### Phase 3: Webhook + N8N Bridge

```
packages/api/src/http/webhook-handler.ts
packages/core/src/scheduler/inputs/webhook-input.ts
packages/core/src/scheduler/inputs/n8n-bridge.ts
```

- Webhook HMAC 验证
- N8N payload 解析 + callback
- CLI: `agent logs / agent watch / agent tasks`

## 依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| #11 acp-service 崩溃重启 | ✅ 完成 | 进程保活基础 |
| #12 Daemon ↔ Agent 通信 | ✅ 完成 | AcpConnection 基础 |
| #37 原始设计 | 参考 | 设计文档 |
| croner | 新增依赖 | Cron 解析库（零依赖、ESM） |

## 验收标准

- [ ] TaskQueue 串行执行 + 优先级
- [ ] Heartbeat 定时触发 Agent 检查
- [ ] Cron 按表达式定时派发任务
- [ ] Hook 在内部事件时触发 Agent 行动
- [ ] `agent dispatch` 手动派发任务
- [ ] `agent logs` 查看执行历史
- [ ] `agent tasks` 查看任务队列
- [ ] Webhook 接收 + HMAC 验证
- [ ] N8N Bridge：Webhook → Agent → Callback
- [ ] 模板支持 schedule 配置字段
- [ ] 任务失败正确处理（记录、触发 hook、可选重试）

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

Closed as completed — Phase 3c epic MVP complete: TaskQueue+Dispatcher (#48), InputRouter+Sources (#49), EmployeeScheduler+CLI (#50) all implemented and tested. WebhookInput and N8N Bridge deferred to P2 optional.
