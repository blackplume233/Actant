---
id: 11
title: acp-service 崩溃重启策略
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
githubRef: "blackplume233/Actant#25"
closedAs: completed
createdAt: "2026-02-20T11:35:25"
updatedAt: "2026-02-20T15:50:29"
closedAt: "2026-02-20T15:50:29"
---

## 目标

acp-service 模式的 Agent 应在崩溃后自动重启，保证持久化员工的高可用。

## 功能

1. **RestartPolicy**：可配置重启策略
   - maxRestarts: 最大重启次数（默认 5）
   - backoffMs: 退避间隔（默认 1000ms，指数退避）
   - resetAfterMs: 稳定运行多久后重置计数器（默认 300000ms = 5min）
2. **崩溃检测**：复用 ProcessWatcher 的进程退出事件
3. **自动重启**：满足策略时自动调用 launcher.launch()
4. **超出限制**：达到 maxRestarts 后 status = error，记录日志，不再重启
5. **守护进程重启恢复**：daemon 重启时，acp-service 模式的 Agent 应自动恢复到 running

## 依赖

- #8 ProcessWatcher

## 验收

- acp-service Agent 被 kill 后自动重启
- 指数退避策略生效
- 超出重启限制后停止重启
- daemon 重启后 acp-service Agent 自动恢复

---

## Comments

### cursor-agent — 2026-02-20T15:09:27

Closed as completed

### cursor-agent — 2026-02-20T15:50:29

Closed as completed
