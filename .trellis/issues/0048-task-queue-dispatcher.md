---
id: 48
title: TaskQueue + TaskDispatcher + ExecutionLog 基础实现
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
  - 40
  - 37
relatedFiles:
  - packages/core/src/scheduler/task-queue.ts
  - packages/core/src/scheduler/task-dispatcher.ts
  - packages/core/src/scheduler/execution-log.ts
taskRef: null
githubRef: "blackplume233/Actant#101"
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0040-daemon-stop-test-failure]], [[0037-employee-agent-scheduling]]
**Related Files**: `packages/core/src/scheduler/task-queue.ts`, `packages/core/src/scheduler/task-dispatcher.ts`, `packages/core/src/scheduler/execution-log.ts`

---

## 目标

实现调度器核心：任务队列、任务派发、执行日志。

## 交付物

### 1. 类型定义

```typescript
interface AgentTask {
  id: string;
  agentName: string;
  source: InputSourceType;
  sourceId: string;
  prompt: string;
  priority: number;  // 0 = 最高
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface ExecutionRecord {
  taskId: string;
  agentName: string;
  source: string;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  responseText?: string;
  durationMs?: number;
  error?: string;
}
```

### 2. TaskQueue

- per-agent 串行队列
- priority-sorted（低数值高优先级）
- enqueue / dequeue / peek / size
- 串行保证：同一 agent 同时只执行一个任务

### 3. TaskDispatcher

- dequeue → AgentManager.promptAgent() → record
- 自动循环处理队列
- 错误处理 + 重试策略

### 4. ExecutionLog

- 内存存储 + 可选文件持久化
- getByAgent / getRecent / getByTask 查询

## 文件路径

```
packages/core/src/scheduler/
  ├── types.ts
  ├── task-queue.ts
  ├── task-dispatcher.ts
  ├── execution-log.ts
  └── index.ts
```

## 验收标准

- [ ] TaskQueue 串行 + 优先级排序
- [ ] TaskDispatcher 自动处理队列
- [ ] ExecutionLog 记录 + 查询
- [ ] 单元测试覆盖

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
