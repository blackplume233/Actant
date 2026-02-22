---
id: 9
title: Agent 进程 stdout/stderr 日志收集
status: open
labels:
  - core
  - enhancement
  - launcher
  - "priority:P3"
milestone: long-term
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#9"
closedAs: null
createdAt: "2026-02-20T11:35:51"
updatedAt: "2026-02-20T11:35:51"
closedAt: null
---

## 目标

当前 ProcessLauncher 使用 stdio: "ignore"，进程输出全部丢弃。需要收集 Agent 后端进程的 stdout/stderr 用于调试和审计。

## 功能

1. 将 Agent 进程的 stdout/stderr 写入日志文件（{instanceDir}/logs/）
2. 可选通过 RPC 接口实时查询最近 N 行日志
3. 日志轮转策略（按大小或时间）

## 验收

- Agent 进程的输出可在 instanceDir/logs/ 下找到
- agent.status 可选返回最近日志摘要
