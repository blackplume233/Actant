---
id: 95
title: "ACP Gateway: Terminal 回调 IDE 转发未实现（4 个方法为 stub）"
status: open
labels:
  - bug
  - acp
  - qa
  - "priority:P2"
milestone: mid-term
author: qa-agent
assignees: []
relatedIssues:
  - 18
relatedFiles:
  - packages/acp/src/gateway.ts
  - packages/acp/src/callback-router.ts
  - docs/design/acp-complete-server-architecture.md
taskRef: null
githubRef: "blackplume233/Actant#95"
closedAs: null
createdAt: "2026-02-21T20:05:00"
updatedAt: "2026-02-21T20:05:00"
closedAt: null
---

**Related Issues**: [[0018-acp-proxy-full-protocol]]
**Related Files**: `packages/acp/src/gateway.ts`, `packages/acp/src/callback-router.ts`, `docs/design/acp-complete-server-architecture.md`

---

## 测试发现

**场景**: /qa-loop 文档一致性验证 — `docs/design/acp-complete-server-architecture.md`
**步骤**: Phase 1 网关检查 — AcpGateway UpstreamHandler 路由表完整性

## 问题描述

`packages/acp/src/gateway.ts` 中 UpstreamHandler 的 4 个 terminal 回调方法实现为 stub，抛出 "not yet supported" 错误：

- `terminalOutput` (L106-135)
- `waitForTerminalExit` (L137-138)
- `killTerminal` (L140-141)
- `releaseTerminal` (L143-144)

设计文档 §3.4 + §2.2 的路由表明确要求：当 IDE 声明 `terminal: true` 时，这 4 个回调应**转发到 IDE**。但实际代码中这些方法直接 throw Error。

## 实际行为

由于 `ClientCallbackRouter`（callback-router.ts）中有 try-catch fallback：
1. Router 尝试调用 `upstream.terminalOutput()` → 抛出 Error
2. Router catch 后 warn 日志 → fallback 到 `this.local.terminalOutput()` (LocalTerminalManager)
3. 功能通过本地进程实现，**不会崩溃**

但 IDE 的 terminal 面板集成无法使用 — Agent 发起的终端操作始终在 Daemon 本地执行，IDE 看不到。

## 期望行为

当 IDE 声明 `terminal: true` 时：
- `terminalOutput` → 通过 ACP Gateway 转发到 IDE，IDE 返回其终端输出
- `waitForTerminalExit` → 转发到 IDE，等待 IDE 终端退出
- `killTerminal` → 转发到 IDE，由 IDE 终止终端
- `releaseTerminal` → 转发到 IDE，由 IDE 释放终端资源

## 根因分析

gateway.ts 注释说明了原因：`AgentSideConnection` 不直接暴露 `terminalOutput`、`waitForTerminalExit`、`killTerminal`、`releaseTerminal` 方法。SDK 的设计是通过 `createTerminal` 返回 `TerminalHandle`，后续操作走 TerminalHandle 内部的 JSON-RPC。

要实现转发，需要：
1. 扩展 SDK 的底层 JSON-RPC 接口，或
2. 使用 `extMethod` 机制，或
3. 在 Gateway 层维护 terminalId 映射，将 downstream 的 terminal 回调重映射到 upstream

## 文档一致性问题

设计文档 §6 Phase 2 标记为 `-- DONE`，但 4 个 terminal 方法仍为 stub。建议在文档中注明此限制。

## 影响范围

- Session Lease 模式下，IDE 的 terminal 面板无法展示 Agent 创建的终端
- Direct Bridge 模式不受影响（Agent 直连 IDE，terminal 回调直达 IDE）
- Self-managed 模式不受影响（无 IDE 参与）
