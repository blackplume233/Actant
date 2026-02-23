---
id: 128
title: "agent start: spawn EINVAL error message should indicate missing backend CLI"
status: open
labels:
  - enhancement
  - cli
  - "priority:P2"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#128"
closedAs: null
createdAt: "2026-02-23T12:56:12Z"
updatedAt: "2026-02-23T12:56:44"
closedAt: null
---

## 现象

`actant agent start` 在 backend CLI 不可用时报 `[RPC -32603] spawn EINVAL`，错误信息不够友好，用户无法理解原因。

## 复现步骤

1. 创建 agent（使用 `claude-code` backend 模板）
2. 未安装 Claude Code CLI
3. `actant agent start qa-test-agent`
4. 输出：`[RPC -32603] spawn EINVAL`

## 期望行为

错误信息应明确提示：

```
Error: Backend "claude-code" CLI not found.
  Please install Claude Code CLI first: npm install -g @anthropic-ai/claude-code
  Or use a different backend in your template.
```

## 实际行为

`spawn EINVAL` 是 Node.js 底层错误，对终端用户毫无帮助。

## 方案建议

在 `process-launcher.ts` 或 `backend-resolver.ts` 中捕获 spawn 错误，检查 `error.code === 'EINVAL'` 或 `'ENOENT'`，映射为用户友好的 `BackendNotFoundError` 并附带安装指引。

## 相关文件

- `packages/core/src/manager/launcher/process-launcher.ts`
- `packages/core/src/manager/launcher/backend-resolver.ts`
