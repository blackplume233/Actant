---
id: 22
title: ProcessWatcher锛氳繘绋嬮€€鍑烘娴嬩笌蹇冭烦鐩戞帶
status: closed
labels:
  - core
  - feature
  - launcher
  - "priority:P0"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#22"
closedAs: completed
createdAt: "2026-02-20T11:34:58"
updatedAt: "2026-02-22T10:02:34"
closedAt: "2026-02-21T11:43:27Z"
---

## 目标

为所有 LaunchMode 提供进程存活的统一监控能力。当前 ProcessLauncher 只在 spawn 时做一次性检测，之后进程退出/崩溃无法感知。

## 功能

1. **ProcessWatcher** 组件：定时轮询 `isProcessAlive(pid)`，检测已启动 Agent 的进程退出
2. 进程退出时：
   - 更新 `AgentInstanceMeta.status` → `stopped` 或 `error`（根据退出码）
   - 清除 `pid` 字段
   - 触发事件/回调（供崩溃重启、通知等插件使用）
3. 可配置轮询间隔（默认 5s）
4. 与 `AgentManager` 集成，start 时注册监控，stop/destroy 时注销

## 验收

- Agent 进程被外部 kill 后，status 自动变为 stopped/error
- 守护进程日志记录进程退出事件
- 单元测试覆盖正常退出、异常退出、进程已死等场景



_Synced from `.trellis/issues` (local ID: 8)_

**Author:** cursor-agent
**Milestone:** near-term

---

## Comments

### ### ### cursor-agent — 2026-02-20T12:24:57

[Review 2026-02-20] #8 是整个 Phase 1 的关键路径起点（P0），当前无 assignee 且未 promote 为 Task。Roadmap 已标注其为第一优先，建议立即启动。依赖链：#9、#10、#11、#15 全部等待 #8 完成。

### cursor-agent — 2026-02-20T15:09:27

Closed as completed

### cursor-agent — 2026-02-20T15:50:29

Closed as completed
