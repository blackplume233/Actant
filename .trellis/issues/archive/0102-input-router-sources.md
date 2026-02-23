---
id: 102
title: InputRouter + InputSources (Heartbeat / Cron / Hook)
status: closed
labels:
  - feature
  - scheduler
  - "priority:P0"
  - phase3c
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 46
  - 101
relatedFiles:
  - packages/core/src/scheduler/inputs/input-source.ts
  - packages/core/src/scheduler/inputs/input-router.ts
  - packages/core/src/scheduler/inputs/heartbeat-input.ts
  - packages/core/src/scheduler/inputs/cron-input.ts
  - packages/core/src/scheduler/inputs/hook-input.ts
taskRef: null
githubRef: "blackplume233/Actant#102"
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0046-daemon-stop-test-failure]], [[0101-task-queue-dispatcher]]
**Related Files**: `packages/core/src/scheduler/inputs/input-source.ts`, `packages/core/src/scheduler/inputs/input-router.ts`, `packages/core/src/scheduler/inputs/heartbeat-input.ts`, `packages/core/src/scheduler/inputs/cron-input.ts`, `packages/core/src/scheduler/inputs/hook-input.ts`

---

## 目标

实现输入路由器和三种内置输入源，将外部事件转化为 AgentTask 入队。

## 依赖

- #48 TaskQueue

## 交付物

### 1. InputSource 接口

```typescript
interface InputSource {
  readonly id: string;
  readonly type: 'heartbeat' | 'cron' | 'hook' | 'webhook' | 'n8n';
  start(): void;
  stop(): void;
  onTask: (task: AgentTask) => void;
}
```

### 2. InputRouter

- register/unregister InputSource
- 统一分发到 TaskQueue
- 启动/停止所有 sources

### 3. HeartbeatInput

- setInterval 定时触发
- 可配置间隔 (intervalMs)
- suppressNoAction 选项

### 4. CronInput

- croner 库解析 cron 表达式
- 时区支持
- 支持多个 cron job

### 5. HookInput

- EventEmitter 模式
- 事件: agent:started, agent:recovered, task:completed, task:failed, agent:idle
- AgentManager 在关键生命周期点 emit

## 新依赖

- `croner` — 零依赖 Cron 库，ESM + 时区原生支持

## 文件路径

```
packages/core/src/scheduler/inputs/
  ├── input-source.ts
  ├── input-router.ts
  ├── heartbeat-input.ts
  ├── cron-input.ts
  ├── hook-input.ts
  └── index.ts
```

## 验收标准

- [ ] InputRouter 正确注册/分发
- [ ] HeartbeatInput 按间隔触发
- [ ] CronInput 按表达式触发
- [ ] HookInput 响应内部事件
- [ ] 单元测试覆盖

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
