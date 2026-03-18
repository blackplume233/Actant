---
id: 202
title: "[Feature] Validate cron expression in CronInput constructor"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#202"
closedAs: completed
createdAt: "2026-02-26T03:45:02Z"
updatedAt: "2026-03-18T06:38:43"
closedAt: "2026-03-18T06:35:57Z"
---

## 问题描述

`CronInput` 在构造函数中不验证 cron 表达式的有效性，无效表达式会在运行时静默失败。

## 问题代码

```typescript
// packages/core/src/scheduler/inputs/cron-input.ts:28-36
constructor(private readonly config: CronConfig, options?: CronInputOptions | string) {
  if (typeof options === "string") {
    this.id = options;
  } else {
    this.id = options?.id ?? `cron-${randomUUID().slice(0, 8)}`;
    this.eventBus = options?.eventBus;
  }
  // 没有验证 config.pattern！
}

// packages/core/src/scheduler/inputs/cron-input.ts:41-47
this.job = new Cron(
  this.config.pattern,  // 无效表达式会静默失败
  { timezone: this.config.timezone },
  () => { /* ... */ }
);
```

## 期望行为

在构造函数中验证 cron 表达式，如果无效立即抛出错误，使用户能够早期发现问题。

## 实现建议

使用 `croner` 库的验证功能：

```typescript
import { Cron } from "croner";

constructor(private readonly config: CronConfig, options?: CronInputOptions | string) {
  // 验证 cron 表达式
  try {
    Cron(config.pattern); // 尝试解析
  } catch (err) {
    throw new Error(`Invalid cron expression: ${config.pattern}`);
  }
  // ... 其余初始化
}
```

## 测试建议

添加测试用例：
- 有效表达式不抛出
- 无效表达式抛出特定错误
- 复杂表达式验证（带时区）

## 关联

- 父 Issue: #197
- 相关代码: `packages/core/src/scheduler/inputs/cron-input.ts`
