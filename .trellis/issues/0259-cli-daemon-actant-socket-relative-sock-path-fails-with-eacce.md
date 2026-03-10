---
id: 259
title: "cli/daemon: ACTANT_SOCKET relative .sock path fails with EACCES on Windows"
status: closed
labels:
  - bug
  - "priority:P1"
  - qa
  - cli
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 258
relatedFiles:
  - packages/cli/src/program.ts
  - packages/cli/src/commands/daemon/start.ts
taskRef: null
githubRef: "blackplume233/Actant#264"
closedAs: completed
createdAt: "2026-02-28T16:56:06"
updatedAt: "2026-03-05T16:03:33Z"
closedAt: "2026-03-05T16:03:33Z"
---

**Related Issues**: [[0258-cli-agent-start-launch-error-context-collapses-to-object-obj]]
**Related Files**: `packages/cli/src/program.ts`, `packages/cli/src/commands/daemon/start.ts`

---

## 测试发现

**场景**: qa-dashboard-deep-20260301-003731
**步骤**: Step 3 - 启动 Daemon（使用 ACTANT_SOCKET 相对路径）

## 复现方式

```bash
ACTANT_HOME=".trellis/tmp/ac-qa-dashboard-deep-20260301-003731" \
ACTANT_SOCKET=".trellis/tmp/ac-qa-dashboard-deep-20260301-003731/actant.sock" \
node packages/cli/dist/bin/actant.js daemon start
```

## 期望行为

在 Windows 环境下，若 `ACTANT_SOCKET` 指向可写路径，Daemon 应成功启动，或至少给出明确的跨平台路径格式提示（例如命名管道格式）。

## 实际行为

Daemon 启动失败：

```text
Daemon process exited unexpectedly.
Daemon failed to start: Error: listen EACCES: permission denied .trellis/tmp/ac-qa-dashboard-deep-20260301-003731/actant.sock
```

同一测试中，去掉 `ACTANT_SOCKET`、仅保留绝对 `ACTANT_HOME` 时可成功启动。

## 分析

当前行为对 Windows 下 `ACTANT_SOCKET`（Unix 风格 `.sock` 路径）兼容性不足，且错误信息未提示正确格式（如 `\\.\pipe\...`），导致用户难以自行修正。建议：

1. 在 Windows 检测到不兼容的 `ACTANT_SOCKET` 时给出可操作提示。
2. 文档明确 `ACTANT_SOCKET` 的 Windows 合法格式。
3. 可考虑自动规范化或 fallback 到 `ACTANT_HOME` 推导的默认 IPC 路径。
