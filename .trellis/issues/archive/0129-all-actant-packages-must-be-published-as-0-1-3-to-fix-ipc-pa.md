---
id: 129
title: "All @actant/* packages must be published as 0.1.3 to fix IPC path mismatch"
status: closed
closedAs: completed
closedAt: 2026-02-25T23:00:00
labels:
  - bug
  - "priority:P1"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#129"
closedAs: null
createdAt: "2026-02-23T12:56:21Z"
updatedAt: "2026-02-23T12:56:34"
closedAt: null
---

## 现象

全局 `npm install -g @actant/cli` 后，CLI 通过 `getDefaultIpcPath()` 连接 `\\.\pipe\actant`（忽略 ACTANT_HOME），而 Daemon 通过 `getIpcPath()` 监听 `\\.\pipe\actant-{safeName}`。二者不匹配，`actant daemon status` 始终返回 `running: false`。

## 复现步骤

1. `npm install -g @actant/cli`（安装 npm 上的 0.1.2）
2. `set ACTANT_HOME=C:\custom\path`
3. `actant daemon start`
4. `actant daemon status -f json` → `{ "running": false }`

## 期望行为

CLI 和 Daemon 使用同一个 IPC 路径，`daemon status` 正确报告 `running: true`。

## 实际行为

- `@actant/shared@0.1.2` 的 `getDefaultIpcPath()` 未委托给 `getIpcPath()`（Issue #120 修复尚未发布）
- CLI 连接 `\\.\pipe\actant`，Daemon 监听 `\\.\pipe\actant-{safeName}`
- 仅在手动替换全局 `@actant/shared/dist` 为本地构建后才能正常工作

## 根因分析

Issue #120 修复了 `getDefaultIpcPath` → `getIpcPath` 的委托，但该修复仅存在于本地源码中。npm 上的 `@actant/shared@0.1.2` 仍然是旧版本。所有 `@actant/*` 包需同步发布 0.1.3。

## 验收标准

- [ ] `@actant/shared`、`@actant/api`、`@actant/core`、`@actant/acp` 全部发布 0.1.3
- [ ] 全新 `npm install -g @actant/cli` 后，自定义 ACTANT_HOME 场景下 daemon start/status 正常
- [ ] CI 发布工作流中确保所有包版本同步
