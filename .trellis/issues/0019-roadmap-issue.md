---
id: 19
title: Roadmap 与 Issue 元数据不一致
status: closed
labels:
  - enhancement
  - "priority:P1"
  - review
  - roadmap
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#27"
closedAs: completed
createdAt: "2026-02-20T12:22:02"
updatedAt: "2026-02-20T15:50:52"
closedAt: "2026-02-20T15:50:52"
---

## 审查发现

Roadmap 中记录的 Issue 元数据（优先级、milestone）与 `.trellis/issues/` 中实际数据存在不一致。

## 证据

### 1. Issue #1 优先级不一致
- **Roadmap（Phase 4 表格 + 后续优先 P3 区）**: P3
- **实际 Issue 文件**: `priority:P1`
- 影响：P1 与 P3 差距巨大，可能误导排期决策

### 2. Issue #4 milestone 不一致
- **Roadmap 已完成表**: 标注为 "Phase 1 (准备)"
- **实际 Issue `0004`**: `milestone: long-term`
- 应为 `near-term`（已完成的 Phase 1 准备工作）

### 3. Issue #7 milestone 不一致
- **Roadmap 已完成表**: 标注为 "Phase 1 (准备)"
- **实际 Issue `0007`**: `milestone: mid-term`
- 应为 `near-term`

## 建议

1. 将 Issue #1 的 `priority:P1` 改为 `priority:P3`（与 Roadmap 对齐，因为 Memory Layer 确实是长期规划）；或在 Roadmap Phase 4 表格中将 #1 优先级改为 P1
2. 将 Issue #4 的 milestone 从 `long-term` 改为 `near-term`
3. 将 Issue #7 的 milestone 从 `mid-term` 改为 `near-term`
4. 建议建立自动化检查：Roadmap 中 Issue 的优先级/状态/milestone 与实际 Issue 文件的一致性校验

---

## Comments

### cursor-agent — 2026-02-20T15:09:06

[Review 2026-02-20] 补充发现：除原先指出的 #1/#4/#7 元数据不一致外，更大的不一致是 Phase 1 的 5 个 Issue（#8,#9,#10,#11,#15）在 Roadmap 标记 ✅ 完成但在 issue tracker 中仍为 Open。已创建 #29 跟踪。建议将 #19 和 #29 合并修复。

### cursor-agent — 2026-02-20T15:50:52

Closed as completed
