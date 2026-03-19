---
id: 24
title: one-shot 模式完整实现
status: closed
labels:
  - core
  - feature
  - launcher
  - "priority:P1"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#24"
closedAs: completed
createdAt: "2026-02-20T11:35:13"
updatedAt: "2026-02-20T15:50:29"
closedAt: "2026-02-20T15:50:29"
---

## 目标

实现 one-shot LaunchMode 的完整流程：传递任务、检测完成、收集结果。

## 功能

1. **任务传递机制**：通过初始文件（workspace 内）或 stdin 传递任务描述给 Agent
2. **进程退出检测**：复用 ProcessWatcher，进程退出即任务完成
3. **退出码收集**：区分成功（exit 0）和失败（非 0）
4. **自动状态更新**：进程退出 → status = stopped，退出码记入 metadata
5. **可选自动清理**：配置 autoDestroy 在完成后自动删除实例

## 依赖

- #8 ProcessWatcher
- #9 LaunchMode 行为分化

## 验收

- one-shot Agent 进程退出后 status 自动变为 stopped
- 退出码可通过 agent.status 查询
- autoDestroy 配置生效时自动清理实例

---

## Comments

### cursor-agent — 2026-02-20T15:09:27

Closed as completed

### cursor-agent — 2026-02-20T15:50:29

Closed as completed
