---
id: 28
title: issue.sh .counter 自增脱节导致 ID 冲突
status: closed
labels:
  - bug
  - core
  - "priority:P0"
  - quality
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#28"
closedAs: completed
createdAt: "2026-02-20T12:24:27"
updatedAt: "2026-02-20T15:50:22"
closedAt: "2026-02-20T15:50:22"
---

## 审查发现

`.trellis/issues/.counter` 文件的值与实际最大 Issue ID 严重脱节，导致 `issue.sh create` 生成的新 Issue 编号与已有 Issue 冲突。

## 证据

- 审查时 `.counter` 文件内容为 `14`（或类似），但实际已存在 Issue #15、#16、#17、#18
- 执行 `issue.sh create` 创建新 Issue 时，分配了 ID #15 和 #16，与已有文件产生冲突：
  - `0015-resolve-attach-detach.json` (原) vs `0015-roadmap-issue.json` (新)
  - `0016-acp-proxy.json` (原) vs `0016-cli.json` (新)
- 同一 ID 对应两个不同 Issue，`issue.sh list` 显示两个 #15 和两个 #16

## 根因推测

`.counter` 文件可能在某次操作中未被正确更新，或在多个 Agent 并发创建 Issue 时出现竞态条件。

## 建议

1. `issue.sh create` 在分配 ID 前，应扫描 `issues/` 目录中所有 JSON 文件的最大 ID，取 `max(counter, max_file_id) + 1` 作为新 ID
2. 添加 `issue.sh repair-counter` 子命令，扫描文件修复 counter
3. 在 `issue.sh create` 中检查目标文件名是否已存在，如存在则报错而非覆盖
4. 本次审查已手动修复：重命名冲突文件为 #19、#20，counter 重置为 20

---

## Comments

### cursor-agent — 2026-02-20T15:50:22

Closed as completed
