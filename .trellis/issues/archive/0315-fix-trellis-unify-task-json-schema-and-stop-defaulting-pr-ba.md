---
id: 315
title: "fix(trellis): unify task.json schema and stop defaulting PR base to main"
status: closed
labels:
  - bug
  - "priority:P1"
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - .trellis/scripts/multi-agent/create-pr.sh
  - .trellis/tasks/03-20-m6-converge-acp/task.json
  - .trellis/tasks/03-20-m6-converge-handlers/task.json
  - .trellis/tasks/03-20-m6-hub-paths/task.json
taskRef: null
githubRef: "blackplume233/Actant#315"
closedAs: completed
createdAt: "2026-03-21T01:51:47"
updatedAt: "2026-03-22T02:27:33"
closedAt: "2026-03-22T02:27:33"
---

**Related Files**: `.trellis/scripts/multi-agent/create-pr.sh`, `.trellis/tasks/03-20-m6-converge-acp/task.json`, `.trellis/tasks/03-20-m6-converge-handlers/task.json`, `.trellis/tasks/03-20-m6-hub-paths/task.json`

---

## 审查发现

当前部分 M6 task.json 使用了缩水 schema，只保留 `name/type/status/requirement/...`，缺少 `base_branch`、`id`、`title`、`completedAt` 等标准字段。与此同时，`create-pr.sh` 在 `base_branch` 缺失时会直接回落到 `main`。本仓库当前默认主分支是 `master`，因此后续如果对这些 task 再执行 create-pr / ship，PR 目标分支会被错误指向 `main`。

## 证据

- `.trellis/scripts/multi-agent/create-pr.sh:101` 使用 `jq -r '.base_branch // "main"'`\n- `.trellis/tasks/03-20-m6-converge-acp/task.json:1-10`、`.trellis/tasks/03-20-m6-converge-handlers/task.json:1-10`、`.trellis/tasks/03-20-m6-hub-paths/task.json:1-10` 均无 `base_branch`\n- `git symbolic-ref refs/remotes/origin/HEAD` 当前返回 `master`\n\n## 风险\n\n- 自动化 PR/ship 目标分支错误\n- task 消费脚本对字段存在性做隐式假设，后续再出现 schema 漂移时更难排查\n\n## 建议\n\n- 固定 task.json schema，至少统一 `id/name/title/status/base_branch/current_phase`\n- `create-pr.sh` 在缺少 `base_branch` 时优先读取 `origin/HEAD`，不要硬编码 `main`\n- 为 task schema 增加校验脚本或测试，避免后续再次漂移

---

## Comments

### ### cursor-agent — 2026-03-22T01:49:28

[Review 2026-03-22]

本地证据表明该问题已经修复，可进入关闭验证。

证据：
- `.trellis/scripts/common/task-utils.sh:178-215` 新增 `resolve_repo_default_branch()` / `resolve_task_base_branch()`，会优先读 `origin/HEAD`，而不是回退硬编码 `main`。
- `.trellis/scripts/multi-agent/create-pr.sh:101-110` 已改为调用 `resolve_task_base_branch "$TASK_JSON" "$REPO_ROOT"`。
- `.trellis/tasks/archive/2026-03/03-20-m6-converge-acp/task.json:2-17`、`.trellis/tasks/archive/2026-03/03-20-m6-converge-handlers/task.json:2-17`、`.trellis/tasks/archive/2026-03/03-20-m6-hub-paths/task.json:2-17` 现在都含有标准字段，并显式记录 `base_branch: "master"`。
- 全仓测试里 `packages/shared/src/__tests__/trellis-governance.test.ts` 也包含 `resolves missing base_branch to the repository default branch` 用例，说明这条回退路径已纳入回归面。

建议直接按 fixed 关闭；若要进一步强化，可把 task schema 校验挂进更显式的 CI / ship 门。

### cursor-agent — 2026-03-22T02:27:33

Closed as completed
