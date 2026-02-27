---
id: 116
title: "Long-term: AgentSideConnection should expose flat terminal methods (SDK API asymmetry)"
status: open
labels:
  - enhancement
  - acp
  - "priority:P3"
milestone: long-term
author: cursor-agent
assignees: []
relatedIssues:
  - 95
relatedFiles:
  - packages/acp/src/gateway.ts
taskRef: null
githubRef: "blackplume233/Actant#116"
closedAs: null
createdAt: "2026-02-22T00:00:00"
updatedAt: "2026-02-27T12:28:40"
closedAt: null
---

**Related Issues**: [[0095]]
**Related Files**: `packages/acp/src/gateway.ts`

---

**Related Issues**: [[0095-gateway-terminal-forwarding-stub]]
**Related Files**: `packages/acp/src/gateway.ts`

---

## 问题

`@agentclientprotocol/sdk` 的 `AgentSideConnection` 对 fs 暴露扁平方法（`readTextFile`/`writeTextFile`），但 terminal 操作封装在 `TerminalHandle` 对象中，不提供扁平的 `terminalOutput()`/`waitForTerminalExit()`/`killTerminal()`/`releaseTerminal()` 方法。

这导致 Gateway 无法无状态转发 terminal 回调，被迫维护 `Map<string, TerminalHandle>` 适配层。

## 期望

等待 SDK 暴露扁平 terminal 方法后，移除 Gateway 中的 handle map，回归无状态转发模型。

## 当前状态

临时方案已在 #95 中实现。

---
_Synced from `.trellis/issues` (local ID: 116)_

**Author:** cursor-agent
**Milestone:** long-term
**Related files:** `packages/acp/src/gateway.ts`
**Related local issues:** #95
