---
id: 50
title: EmployeeScheduler + AgentManager 集成 + CLI 命令
status: closed
labels:
  - feature
  - scheduler
  - cli
  - "priority:P0"
  - phase3c
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 40
  - 48
  - 49
relatedFiles:
  - packages/core/src/scheduler/employee-scheduler.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/cli/src/commands/schedule.ts
taskRef: null
githubRef: null
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0040-daemon-stop-test-failure]], [[0048-task-queue-dispatcher]], [[0049-input-router-sources]]
**Related Files**: `packages/core/src/scheduler/employee-scheduler.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/core/src/template/schema/template-schema.ts`, `packages/cli/src/commands/schedule.ts`

---

## 目标

实现 EmployeeScheduler 编排层，集成到 AgentManager，扩展模板 schema，新增 CLI 命令。

## 依赖

- #48 TaskQueue + Dispatcher
- #49 InputRouter + Sources

## 交付物

### 1. EmployeeScheduler

编排 InputRouter + TaskQueue + TaskDispatcher：
- 从 ScheduleConfig 创建对应 InputSources
- 管理调度生命周期（start/stop/pause/resume）

### 2. 模板 Schema 扩展

```typescript
const ScheduleConfigSchema = z.object({
  heartbeat: z.object({ enabled, intervalMs, prompt, suppressNoAction }).optional(),
  cron: z.array(z.object({ schedule, prompt, label, timezone })).optional(),
  hooks: z.array(z.object({ event, prompt })).optional(),
  webhooks: z.array(z.object({ path, secret, promptTemplate })).optional(),
  n8n: z.object({ enabled, apiUrl, callbackUrl }).optional(),
});
```

AgentTemplate 新增 `schedule` 字段。

### 3. AgentManager 集成

- `startAgent()`: 如果 launchMode=acp-service 且有 schedule → 启动 EmployeeScheduler
- `stopAgent()`: 停止 EmployeeScheduler

### 4. RPC + CLI

RPC: `agent.dispatch` / `agent.tasks` / `agent.logs`
CLI:
- `agent dispatch <name> "prompt"` — 手动派发
- `agent tasks <name>` — 查看队列
- `agent logs <name>` — 查看执行历史
- `schedule list <name>` / `schedule pause` / `schedule resume`

### 5. Webhook + N8N (P2 可选)

- WebhookInput + Hono HTTP handler + HMAC
- N8N Bridge（payload 解析 + callback）

## 验收标准

- [ ] EmployeeScheduler 正确编排
- [ ] 模板 schedule 字段可解析
- [ ] AgentManager 在 acp-service 模式自动启动调度
- [ ] CLI dispatch/tasks/logs 命令可用
- [ ] 集成测试覆盖

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
