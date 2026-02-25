---
id: 159
title: "补全 Hook 类型定义 — HookEventName / HookDeclaration / HookAction"
status: open
labels:
  - core
  - shared
  - "priority:P0"
milestone: phase-4
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 135
relatedFiles:
  - packages/shared/src/types/hook.types.ts
  - packages/shared/src/types/index.ts
  - packages/core/src/hooks/hook-event-bus.ts
  - packages/core/src/hooks/hook-registry.ts
  - packages/core/src/hooks/action-runner.ts
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0014-plugin-heartbeat-scheduler-memory]], [[0135-workflow-as-hook-package]]
**Related Files**: `packages/shared/src/types/hook.types.ts`, `packages/core/src/hooks/`

---

## 问题

`HookEventName`、`HookDeclaration`、`HookAction` 在 `@actant/shared` 被 core 包引用 (`hook-event-bus.ts`, `hook-registry.ts`, `action-runner.ts`) 但**从未定义**。Plugin 体系 (#14) 需要使用这些类型。

## 任务

新增 `packages/shared/src/types/hook.types.ts`：

```typescript
type HookEventName =
  | "actant:start" | "actant:stop"
  | "agent:created" | "agent:destroyed" | "agent:modified"
  | "source:updated"
  | `cron:${string}`
  | "process:start" | "process:stop" | "process:crash" | "process:restart"
  | "session:start" | "session:end"
  | "prompt:before" | "prompt:after"
  | "error" | "idle"
  | `plugin:${string}`;

interface HookDeclaration {
  on: HookEventName;
  actions: HookAction[];
}

type HookAction =
  | { type: "shell"; run: string }
  | { type: "builtin"; action: string; params?: Record<string, unknown> }
  | { type: "agent"; target: string; prompt: string };
```

## 验收标准

- [ ] `packages/shared/src/types/hook.types.ts` 新增并导出
- [ ] `hook-event-bus.ts`、`hook-registry.ts`、`action-runner.ts` 正确引用新类型
- [ ] TypeScript 编译无类型错误
- [ ] `plugin:${string}` 模板字面量类型为 Plugin 扩展事件预留空间

## 依赖

- 无

## 被依赖

- #14 Plugin 体系
