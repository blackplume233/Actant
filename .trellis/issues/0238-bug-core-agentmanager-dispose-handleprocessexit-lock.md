---
id: 238
title: "bug(core): AgentManager.dispose() 绔炴€佺獥鍙?鈥?寤惰繜 handleProcessExit lock 涓嶈绛夊緟"
status: open
labels:
  - bug
  - core
  - review
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#238"
closedAs: null
createdAt: "2026-02-27T04:03:11Z"
updatedAt: "2026-02-27T12:35:50"
closedAt: null
---

## 现象

`AgentManager.dispose()` 在 `await Promise.all(agentLocks.values())` 时只等待当时已有的 lock。如果 `ProcessWatcher` 的轮询回调在 `watcher.dispose()` 返回后但在 `Promise.all` 快照之前触发了 `handleProcessExit`，新创建的 lock 不会被等待。

这意味着 `dispose()` 可能在 crash-restart 操作进行中就开始终止进程。

## 影响

- 竞态窗口极小（`watcher.dispose()` 已停止定时器），但在高并发 + 大量 agent 场景下理论可触发
- 最坏情况：一个 agent 正在重启时被 dispose 杀掉，可能留下不一致的 meta 状态

## 建议方案

1. 在 `dispose()` 中设置一个 `disposing` 标志位
2. `handleProcessExit` 在 restart 前检查该标志，若为 true 则跳过 restart
3. 或者循环等待 `agentLocks` 直到 Map 为空

## 相关文件

- `packages/core/src/manager/agent-manager.ts` — `dispose()` 和 `handleProcessExit`
