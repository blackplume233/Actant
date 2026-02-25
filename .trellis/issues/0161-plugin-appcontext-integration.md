---
id: 161
title: "Plugin AppContext + AgentManager 集成 + CLI 命令"
status: open
labels:
  - api
  - cli
  - core
  - feature
  - "priority:P0"
milestone: phase-4
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 160
relatedFiles:
  - packages/api/src/services/app-context.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/cli/src/commands/plugin-commands.ts
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0014-plugin-heartbeat-scheduler-memory]], [[0160-heartbeat-plugin]]
**Related Files**: `packages/api/src/services/app-context.ts`, `packages/core/src/manager/agent-manager.ts`

---

## 目标

将 PluginHost 集成到 Actant Daemon 运行时，使插件在 Daemon 启动/关停和 Agent 启动/停止时自动管理。

## 任务

### AppContext 集成

- `AppContext` 创建 `HookEventBus` 和 `PluginHost`
- Daemon 启动时 `pluginHost.startActantPlugins()` 加载全局配置的 actant 级插件
- Daemon 关停时 `pluginHost.stopAll()`

### AgentManager 集成

- `startAgent()` 中根据 Template 的 `systemPlugins` 配置启动 instance 级插件
- `stopAgent()` 中先停 instance 级插件再停 agent

### CLI 命令

- `actant plugin list` — 列出所有已注册插件及状态
- `actant plugin status` — 插件健康检查结果

## 验收标准

- [ ] PluginHost 随 Daemon 启动/关停
- [ ] HeartbeatPlugin 随 Agent 实例启动/停止
- [ ] CLI `actant plugin list` 工作正常
- [ ] 端到端测试：启动 agent → heartbeat tick → 停止 agent → plugin 停止

## 依赖

- #14 Plugin 体系 (PluginHost)
- #160 HeartbeatPlugin (端到端验证)

## 被依赖

- #165 MemoryPlugin (需要 PluginHost 已集成)
