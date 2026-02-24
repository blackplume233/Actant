---
id: 120
title: "Windows: Daemon and CLI IPC socket path mismatch - getDefaultIpcPath vs getIpcPath"
status: closed
closedAt: "2026-02-23"
labels:
  - bug
  - cli
  - "priority:P2"
  - qa
  - "platform:windows"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#120"
closedAs: null
createdAt: "2026-02-23T02:52:02Z"
updatedAt: "2026-02-23T02:52:16"
closedAt: null
---

**Related Files**: `packages/shared/src/platform/platform.ts`, `packages/cli/src/program.ts`, `packages/api/src/services/app-context.ts`

---

## 现象

当使用自定义 `ACTANT_HOME` 时，CLI 客户端和 Daemon 连接不同的 named pipe，导致 `daemon status` 报告 `running: false` 即使 Daemon 进程正在运行。

在默认 `ACTANT_HOME` 场景下，Windows 上同样存在路径不一致：
- CLI: `\\.\pipe\actant`（固定值）
- Daemon: `\\.\pipe\actant-C__Users_xxx_.actant`（从 homeDir 计算）

## 复现步骤

```powershell
$env:ACTANT_HOME = "C:\temp\actant-test"
# 不设 ACTANT_SOCKET

# 启动 daemon（foreground 验证）
node packages/cli/dist/bin/actant.js daemon start --foreground
# Daemon 监听: \\.\pipe\actant-C__temp_actant-test

# 另一终端查状态
node packages/cli/dist/bin/actant.js daemon status -f json
# { "running": false }
# CLI 连接: \\.\pipe\actant（固定值，与 Daemon 不匹配）
```

## 根因分析

`packages/shared/src/platform/platform.ts` 中有两个 IPC 路径函数：

**getDefaultIpcPath**（CLI 使用）：Windows 上返回固定值 `\\.\pipe\actant`，忽略 homeDir 参数。

**getIpcPath**（Daemon 使用）：Windows 上从 homeDir 动态计算 `\\.\pipe\actant-{safeName}`。

**路径决策链**：
- CLI: `defaultSocketPath()` -> `process.env.ACTANT_SOCKET ?? getDefaultIpcPath()` -> `\\.\pipe\actant`
- Daemon: `AppContext.socketPath` -> `getIpcPath(homeDir)` -> `\\.\pipe\actant-{safeName}`

两者在 Windows 上永远不匹配（除非显式设置 `ACTANT_SOCKET`）。

Unix 上不受影响：两个函数都使用 `join(homeDir, "actant.sock")`，路径一致。

## 期望行为

CLI 和 Daemon 在任何配置下都应使用相同的 IPC 路径，无需手动设置 `ACTANT_SOCKET`。

## 建议修复方向

**方案 A**（推荐）：统一使用 `getIpcPath(homeDir)`
- `defaultSocketPath()` 改为 `process.env.ACTANT_SOCKET ?? getIpcPath(resolvedHomeDir)`
- 需要在 CLI 层也解析 `ACTANT_HOME`

**方案 B**：Daemon 也读取 `ACTANT_SOCKET` 环境变量
- `AppContext.socketPath = process.env.ACTANT_SOCKET ?? getIpcPath(homeDir)`
- 简单但不解决根本的函数不一致问题

**方案 C**：`getDefaultIpcPath` 在 Windows 上也使用 homeDir
- 修改 `getDefaultIpcPath` 使其 Windows 分支也基于 homeDir 计算
- 最小改动但可能影响其他调用方

## 影响范围

- 仅影响 Windows 平台
- Unix 平台不受影响（路径计算一致）
- 所有依赖 `defaultSocketPath()` 的 CLI 命令均受影响（daemon status/stop/start、agent 操作、proxy 等）

## 发现于

QA 验证 #57 修复时发现。详见 `.trellis/tasks/02-23-fix-95-57/qa-report-round1.md`
