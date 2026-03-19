---
id: 203
title: "[Refactor] Simplify HookEventBus.emit method signature"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#203"
closedAs: completed
createdAt: "2026-02-26T03:45:05Z"
updatedAt: "2026-03-18T06:38:44"
closedAt: "2026-03-18T06:36:00Z"
---

## 问题描述

`HookEventBus.emit` 方法使用复杂的参数重载来支持向后兼容，导致代码难以维护和理解。

## 当前实现

```typescript
// packages/core/src/hooks/hook-event-bus.ts:79-97
emit(
  event: HookEventName,
  contextOrAgentName?: HookEmitContext | string,
  agentNameOrData?: string | Record<string, unknown>,
  data?: Record<string, unknown>,
): void {
  let context: HookEmitContext;
  let agentName: string | undefined;
  let eventData: Record<string, unknown> | undefined;

  if (typeof contextOrAgentName === "object" && contextOrAgentName !== null && "callerType" in contextOrAgentName) {
    context = contextOrAgentName;
    agentName = typeof agentNameOrData === "string" ? agentNameOrData : undefined;
    eventData = typeof agentNameOrData === "object" ? agentNameOrData as Record<string, unknown> : data;
  } else {
    context = { callerType: "system" };
    agentName = typeof contextOrAgentName === "string" ? contextOrAgentName : undefined;
    eventData = typeof agentNameOrData === "object" ? agentNameOrData as Record<string, unknown> : undefined;
  }
  // ...
}
```

## 问题

1. 参数解析逻辑复杂，容易出错
2. 类型推断困难
3. 调用时不够直观

## 建议方案

### 方案 1：显式方法分离
```typescript
// 新代码使用
emit(event: HookEventName, context: HookEmitContext, agentName?: string, data?: Record<string, unknown>): void;

// 旧代码迁移
emitLegacy(event: HookEventName, agentName?: string, data?: Record<string, unknown>): void;
```

### 方案 2：配置对象模式
```typescript
interface EmitOptions {
  context: HookEmitContext;
  agentName?: string;
  data?: Record<string, unknown>;
}

emit(event: HookEventName, options: EmitOptions): void;
```

### 方案 3：保持现状但优化类型
使用 TypeScript 函数重载改善类型推断：
```typescript
// 新签名
emit(event: HookEventName, context: HookEmitContext, agentName?: string, data?: Record<string, unknown>): void;
// 向后兼容
emit(event: HookEventName, agentName?: string, data?: Record<string, unknown>): void;
```

## 优先级

低 - 代码质量改进，非阻塞问题

## 关联

- 父 Issue: #197
- 相关代码: `packages/core/src/hooks/hook-event-bus.ts`
