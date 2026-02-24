---
id: 14
title: Plugin 体系设计（heartbeat/scheduler/memory 可插拔）
status: open
labels:
  - architecture
  - core
  - feature
  - "priority:P2"
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#14"
closedAs: null
createdAt: "2026-02-20T11:35:43"
updatedAt: "2026-02-20T11:35:43"
closedAt: null
---

## 目标

设计可插拔的 Plugin 体系，使 Agent Instance 可按需附加增强能力（心跳、调度、记忆等），而非将 Employee 作为独立概念。

## 核心理念

Employee 不是独立类型，而是「acp-service + plugins」的组合：
- direct + 无插件 = 传统 Agent
- acp-service + heartbeat + scheduler = Employee
- acp-background + heartbeat = 受监控的临时 Agent

## 功能

1. **PluginRegistry**：Agent Instance 级别的插件注册表
2. **Plugin 接口**：onStart / onStop / onCrash / onTick 等生命周期钩子
3. **内置插件**：
   - HeartbeatMonitor（定时检活 + 崩溃回调）
   - Scheduler（cron/定时触发任务）
   - MetricsCollector（运行时统计）
4. **模板配置**：在 AgentTemplate 中声明 plugins 字段

## 依赖

- #8 ProcessWatcher（HeartbeatMonitor 的基础）

## 验收

- Plugin 接口定义清晰
- 至少 HeartbeatMonitor 作为首个插件实现
- 模板中可配置 plugins
