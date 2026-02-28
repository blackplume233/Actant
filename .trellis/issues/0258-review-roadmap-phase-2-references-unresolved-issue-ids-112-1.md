---
id: 258
title: "Review: roadmap phase-2 references unresolved issue IDs (#112-#115)"
status: open
labels:
  - enhancement
  - "priority:P2"
  - review
  - roadmap
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#259"
closedAs: null
createdAt: "2026-02-28T04:50:33"
updatedAt: "2026-02-28T04:58:44"
closedAt: null
---

## 审查发现

`docs/planning/roadmap.md` 在 Phase 2 区块引用了 `#112/#113/#114/#115`，并标记为已完成，但本地 issue 缓存无法查询到这些编号。

## 证据

- Roadmap 引用位置：
  - `docs/planning/roadmap.md:79` (`#112`)
  - `docs/planning/roadmap.md:80` (`#113`)
  - `docs/planning/roadmap.md:82` (`#114`)
  - `docs/planning/roadmap.md:83` (`#115`)
- 查询结果：
  - `issue.sh show 112` → not found
  - `issue.sh show 113` → not found
  - `issue.sh show 114` → not found
  - `issue.sh show 115` → not found

## 影响

- Roadmap 与 issue 系统无法一一追溯，降低审查、排期和复盘的可靠性。
- 新成员很难验证“已完成”状态是否对应可追踪的历史记录。

## 建议

- 统一编号来源：确认这 4 个项的真实 issue ID（或 GitHub issue number），并回填到 roadmap。
- 若这些项已被合并到其他 issue，建议在 roadmap 中改为可追溯引用（例如 `#13/#43/...`），并注明映射关系。
