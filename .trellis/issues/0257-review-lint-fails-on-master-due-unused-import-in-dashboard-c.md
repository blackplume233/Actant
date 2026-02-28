---
id: 257
title: "Review: lint fails on master due unused import in dashboard chat page"
status: open
labels:
  - bug
  - "priority:P1"
  - review
  - quality
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#258"
closedAs: null
createdAt: "2026-02-28T04:50:22"
updatedAt: "2026-02-28T04:58:34"
closedAt: null
---

## 审查发现

`pnpm lint` 在当前 `master` 分支失败，阻断基础质量门禁。

## 证据

- 命令: `pnpm lint`
- 错误: `packages/dashboard/client/src/pages/agent-chat.tsx:11:3  error  'RotateCcw' is defined but never used  @typescript-eslint/no-unused-vars`
- 相关文件: `packages/dashboard/client/src/pages/agent-chat.tsx`

## 影响

- CI/本地 lint 无法通过，影响后续提交与发布节奏。
- 说明主干当前存在可避免的静态检查回归。

## 建议

- 移除未使用的 `RotateCcw` 导入，重新执行 `pnpm lint` 确认通过。
- 在提交前门禁中强制 `pnpm lint` 通过后再允许 ship。
