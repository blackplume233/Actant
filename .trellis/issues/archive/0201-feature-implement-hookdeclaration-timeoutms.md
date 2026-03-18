---
id: 201
title: "[Feature] Implement HookDeclaration timeoutMs"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#201"
closedAs: completed
createdAt: "2026-02-26T03:44:59Z"
updatedAt: "2026-03-18T06:38:42"
closedAt: "2026-03-18T06:35:52Z"
---

## 问题描述

`HookDeclaration` 类型定义中包含 `timeoutMs` 字段，但 `ActionRunner` 并未实现该功能。

## 类型定义

```typescript
// packages/shared/src/types/hook.types.ts:365-395
export interface HookDeclaration {
  // ...
  /** Max wall-clock time for the entire hook execution in ms. */
  timeoutMs?: number;
  // ...
}
```

## 当前实现

```typescript
// packages/core/src/hooks/action-runner.ts:27-41
export async function runActions(
  actions: HookAction[],
  payload: HookEventPayload,
  ctx: ActionContext,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of actions) {
    const result = await runSingleAction(action, payload, ctx);
    results.push(result);
    // 无超时控制！
  }
  return results;
}
```

## 期望行为

1. 如果 hook 执行超过 `timeoutMs`，应该中断执行
2. 已执行的 actions 结果应返回
3. 超时的 action 标记为失败
4. 后续 actions 不再执行（或根据策略决定）

## 实现建议

使用 `AbortController` 或 `Promise.race` 实现超时：

```typescript
async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}
```

## 关联

- 父 Issue: #197
- 相关代码: 
  - `packages/core/src/hooks/action-runner.ts`
  - `packages/shared/src/types/hook.types.ts`
