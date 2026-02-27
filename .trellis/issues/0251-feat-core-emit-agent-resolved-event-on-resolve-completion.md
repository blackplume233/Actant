---
id: 251
title: "feat(core): emit agent:resolved event on resolve completion"
status: open
labels:
  - enhancement
  - core
  - "priority:P2"
  - qa
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#251"
closedAs: null
createdAt: "2026-02-27T12:08:15Z"
updatedAt: "2026-02-27T12:08:32"
closedAt: null
---

## 目标

在 agent resolve 操作完成时 emit `agent:resolved` 事件，补全 Agent 生命周期事件链。

## 背景

QA 全覆盖测试发现，agent create 会 emit `agent:created` 事件，但 agent resolve 操作完成后没有对应的 `agent:resolved` 事件记录。

```
evt-agent-created  | PASS | found 1 event for evt-test, created=true
evt-agent-resolved | WARN | resolved=false
```

Agent 生命周期中 resolve 是一个重要状态变更（workspace 初始化、Domain Context 物化），应该被事件系统记录以供审计。

## 方案

在 `packages/api/src/handlers/agent-handlers.ts` 的 handleAgentResolve 成功后，添加：

```typescript
ctx.eventBus?.emit("agent:resolved", { callerType: "system", callerId: "AgentManager" }, name, {
  workspaceDir: result.workspaceDir,
});
```

需要先在 `packages/shared/src/types/hook.types.ts` 的 HOOK_CATEGORIES 中注册 `agent:resolved` 事件。

## 验收标准

- agent resolve 后 events.recent 中出现 agent:resolved 事件
- 事件 payload 包含 workspaceDir
- 不影响现有 agent:created / agent:destroyed 事件

## 发现来源

QA 全覆盖测试 Round 1 — Agent 事件验证
