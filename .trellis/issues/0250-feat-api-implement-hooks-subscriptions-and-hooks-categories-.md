---
id: 250
title: "feat(api): implement hooks.subscriptions and hooks.categories RPC methods"
status: open
labels:
  - enhancement
  - "priority:P3"
  - api
  - qa
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#250"
closedAs: null
createdAt: "2026-02-27T12:08:13Z"
updatedAt: "2026-02-27T12:08:30"
closedAt: null
---

## 目标

实现 `hooks.subscriptions` 和 `hooks.categories` 两个 RPC 方法，使 Dashboard 和外部客户端能够查询当前 Hook 订阅状态和可用事件类别。

## 背景

QA 全覆盖测试中发现这两个 RPC 方法尚未注册到 HandlerRegistry：

```
rpc-hooks-subs | WARN | Method not found: hooks.subscriptions
rpc-hooks-cats | WARN | Method not found: hooks.categories
```

HookCategoryRegistry 和 HookEventBus 已经实现了相应的内部逻辑，只需要在 registerEventHandlers 中注册对应的 RPC handler。

## 方案

1. 在 `packages/api/src/handlers/event-handlers.ts` 的 registerEventHandlers 中新增两个 handler
2. `hooks.subscriptions` → 返回当前所有事件订阅列表
3. `hooks.categories` → 返回 HookCategoryRegistry 的完整分层事件分类
4. 可选：增加 `hooks.subscribe` / `hooks.unsubscribe` 用于动态订阅管理

## 验收标准

- hooks.subscriptions 返回结构化订阅列表
- hooks.categories 返回分层事件类别（含 entity/process/session/system 层）
- Dashboard Events 页面可使用这些接口展示完整的 Hook 信息

## 发现来源

QA 全覆盖测试 Round 1 — RPC 直连测试
