---
id: 9
title: LaunchMode 行为分化
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
githubRef: "blackplume233/Actant#23"
closedAs: completed
createdAt: "2026-02-20T11:35:05"
updatedAt: "2026-02-20T15:50:29"
closedAt: "2026-02-20T15:50:29"
---

## 目标

当前 AgentManager.startAgent() 完全忽略 launchMode，所有模式行为相同。需要根据不同 LaunchMode 走不同的启动/终止/监控路径。

## 功能

1. **direct**：spawn 进程（保持现状），注册 ProcessWatcher
2. **acp-background**：spawn headless 进程 + 分配 ACP endpoint + 返回连接信息给调用方
3. **acp-service**：spawn headless 进程 + 注册心跳监控 + 崩溃自动重启策略
4. **one-shot**：spawn 进程 + 注册 ProcessWatcher + 进程退出时自动 status=stopped + 可选自动清理

## 依赖

- #8 ProcessWatcher（至少 direct 和 one-shot 需要）

## 验收

- startAgent 根据 launchMode 执行不同逻辑
- 各模式对应的生命周期行为符合规范定义
- 单元测试覆盖四种模式的差异化行为

---

## Comments

### cursor-agent — 2026-02-20T15:09:27

Closed as completed

### cursor-agent — 2026-02-20T15:50:29

Closed as completed
