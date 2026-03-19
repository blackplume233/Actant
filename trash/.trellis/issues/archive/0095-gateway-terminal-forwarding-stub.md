---
id: 95
title: "ACP Gateway: Terminal 回调 IDE 转发未实现（4 个方法为 stub）"
status: closed
closedAs: completed
closedAt: 2026-02-25T23:00:00
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
  - 116
  - 117
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

**核心问题：SDK API 不对称。**

`@agentclientprotocol/sdk` v0.14.1 的 `AgentSideConnection` 对 fs 和 terminal 的 API 设计不对称：
- fs 操作暴露扁平方法（`readTextFile`/`writeTextFile`）→ Gateway 可一行代码无状态转发
- terminal 操作封装在 `TerminalHandle` 对象中 → 后续 4 个方法没有扁平接口

**架构上的正确模型**：Gateway 伪装 Server，IDE (Client) 自管 terminal 状态（terminalId → 进程映射）。Gateway 应该是无状态转发层，但 SDK 不暴露扁平 terminal 方法，迫使 Gateway 维护 handle map。

## 临时方案（已实现）

采用 `Map<string, TerminalHandle>` 适配：
- `createTerminal` 时保存 handle 到 map
- 后续 4 个方法通过 handle 委托（`handle.currentOutput()` 等）
- IDE 断连时释放所有 handles

代码注释明确标注为 SDK 限制导致的权宜之计。

## 长期方案

跟踪 #116 — 等待 SDK 在 `AgentSideConnection` 上暴露扁平 terminal 方法后移除 handle map。

## 相关阻塞

此修复仅解决 Gateway 层的转发能力。Session Lease Gateway 模式整体可用还依赖 #117（`gateway.lease` RPC handler 缺失）。

## 影响范围

- Session Lease 模式下，IDE 的 terminal 面板无法展示 Agent 创建的终端 → **临时修复后理论可用**（仍依赖 #117）
- Direct Bridge 模式不受影响（Agent 直连 IDE，terminal 回调直达 IDE）
- Self-managed 模式不受影响（无 IDE 参与）
