---
id: 313
title: "chore(trellis): reconcile roadmap and active task states after milestone delivery"
status: open
labels:
  - chore
  - "priority:P2"
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - docs/planning/contextfs-roadmap.md
  - .trellis/tasks/03-19-m0-contextfs-baseline/task.json
  - .trellis/tasks/03-20-m5-control-stream/task.json
  - .trellis/tasks/03-20-m6-facade-unify/task.json
taskRef: null
githubRef: "blackplume233/Actant#313"
closedAs: null
createdAt: "2026-03-21T01:51:47"
updatedAt: "2026-03-21T02:14:16"
closedAt: null
---

**Related Files**: `docs/planning/contextfs-roadmap.md`, `.trellis/tasks/03-19-m0-contextfs-baseline/task.json`, `.trellis/tasks/03-20-m5-control-stream/task.json`, `.trellis/tasks/03-20-m6-facade-unify/task.json`

---

## 审查发现

Roadmap 已明确写成 `M5 completed, M6 in-progress`，但 active task 目录里仍保留了 M0/M1/M2/M3/M5 任务，状态全部还是 `review`，`completedAt` 也为空。M6 四个拆分 task 也仍停留在 `review`。这导致仓库同时存在两套彼此冲突的项目状态：roadmap/commit 历史显示已经交付，而 task 池与 session context 仍把这些工作视为活跃待处理项。

## 证据

- `docs/planning/contextfs-roadmap.md:3` 标记 `M5 completed, M6 in-progress`
- `.trellis/tasks/03-19-m0-contextfs-baseline/task.json:6,13` 仍为 `status: review`, `completedAt: null`
- `.trellis/tasks/03-20-m5-control-stream/task.json:6,13` 仍为 `status: review`, `completedAt: null`
- `.trellis/tasks/03-20-m6-facade-unify/task.json:4` 仍为 `status: review`
- `git log --oneline -8` 已包含 M5/M6 相关 merge/finish 提交

## 风险

- `/trellis:start`、session context、任务筛选会向后续执行者暴露错误的当前状态
- 影响优先级判断，容易让已交付里程碑持续占据活跃任务池
- review/ship 自动化难以判断哪些 task 应继续推进，哪些应归档

## 建议

- 明确一个单一状态真相源：要么 roadmap 驱动 task 状态，要么 task 状态驱动 roadmap
- 已交付 milestone 对应 task 在 merge/ship 完成后自动写入 `completedAt` 并归档
- 给 `get-context` / task 列表增加“已合并但未归档”的告警
