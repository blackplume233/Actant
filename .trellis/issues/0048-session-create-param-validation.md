---
id: 48
title: "session.create 缺少参数验证，空参数暴露 'undefined' 内部细节"
status: closed
labels:
  - enhancement
  - qa
  - api
  - "priority:P2"
milestone: null
author: qa-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/api/src/handlers/session-handlers.ts
taskRef: null
githubRef: "blackplume233/Actant#48"
closedAs: completed
createdAt: "2026-02-21T10:20:00.000Z"
updatedAt: "2026-02-21T10:20:00.000Z"
closedAt: "2026-02-22T21:23:00Z"
---

**Related Files**: `packages/api/src/handlers/session-handlers.ts`

---

## 测试发现

**场景**: Issue #35 随机漫步测试 — 边界条件
**步骤**: 5.9 - session.create 空参数

## 复现方式

```bash
# RPC 调用 session.create 传入空对象
{"jsonrpc":"2.0","id":1,"method":"session.create","params":{}}
```

## 期望行为

返回参数验证错误，如 `Required field 'agentName' is missing`。

## 实际行为

返回 `Agent "undefined" not found`，暴露了 JavaScript 内部实现细节。

## 分析

`handleSessionCreate` 中使用 `params as unknown as SessionCreateParams` 进行类型断言，没有运行时参数验证。当 `agentName` 未提供时，解构为 `undefined`，传入 `getAgent(undefined)` 返回 null，最终错误消息包含字面量 `undefined`。

## 建议修复

在 `handleSessionCreate` 开头添加参数验证：
```typescript
if (!agentName || typeof agentName !== 'string') {
  throw new Error('Required parameter "agentName" is missing or invalid');
}
if (!clientId || typeof clientId !== 'string') {
  throw new Error('Required parameter "clientId" is missing or invalid');
}
```

同样的问题可能存在于 session.prompt、session.cancel、session.close 等处理器中。
