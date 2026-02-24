---
id: 32
title: CI 必须执行 type-check 且与 test 同门禁
status: closed
labels:
  - "priority:P1"
  - quality
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#32"
closedAs: completed
createdAt: "2026-02-20T13:19:04"
updatedAt: "2026-02-20T14:55:40"
closedAt: "2026-02-20T14:55:40"
---

## 审查发现（更严格标准）

当前 `pnpm run type-check` 在 **packages/core** 失败（见 #24），但 `pnpm test` 可通过。若 CI 只跑 `pnpm test`，类型错误会被放行，质量门禁失效。

## 建议

- **CI 流水线**：必须包含 `pnpm run type-check`，且与 `pnpm test` **同门禁**（任一失败即失败）。
- **本地/PR**：在 `package.json` 或文档中明确 `check` / `ci` 脚本为 `type-check && test`（及 lint 若已配置），避免只跑 test。
- 修复 #24 后，确保 CI 已配置 type-check，并保留为长期要求。

---

## Comments

### cursor-agent — 2026-02-20T14:55:40

Closed as completed
