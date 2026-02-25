---
id: 160
title: "HeartbeatPlugin — 首个内置插件，验证 Plugin 架构"
status: open
labels:
  - core
  - feature
  - "priority:P0"
milestone: phase-4
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 161
relatedFiles:
  - packages/core/src/plugins/builtin/heartbeat-plugin.ts
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0014-plugin-heartbeat-scheduler-memory]]
**Related Files**: `packages/core/src/plugins/builtin/heartbeat-plugin.ts`

---

## 目标

实现最简单的 Instance 级 **纯 runtime 插件** HeartbeatPlugin，验证统一 Plugin 架构的 runtime 插口 + hooks 插口。

## 设计 (统一三插口)

```typescript
descriptor: {
  name: "heartbeat",
  scope: "instance",
  // 无 domainContext 插口 — 不物化任何东西到 workspace
  runtime: { tickInterval: 30_000, configSchema: ... },
  hooks: [{ on: "prompt:after", actions: [...] }],
}
```

## 功能

- scope: `"instance"` (每个 Agent Instance 一份)
- **纯 runtime 插件**: 无 domainContext，只有 runtime + hooks 两个插口
- 通过 hooks 插口声明 `prompt:after` 事件消费
- tick 中检查超时，超时时 emit `plugin:heartbeat:timeout` 事件
- 可配置 `timeoutMs`

## 验收标准

- [ ] HeartbeatPlugin descriptor 使用统一三插口格式 (domainContext=无, runtime=有, hooks=有)
- [ ] PluginHost 正确识别为 "纯 runtime" 插件并管理生命周期
- [ ] init/start/tick/stop 全链路正常工作
- [ ] hooks 插口声明的事件自动注册到 EventBus
- [ ] 超时检测触发 `plugin:heartbeat:timeout` 事件
- [ ] 配置通过 Zod schema 校验
- [ ] 单元测试覆盖

## 依赖

- #14 Plugin 体系 (PluginHost + ActantPlugin 接口)

## 被依赖

- #161 AppContext 集成 (用 HeartbeatPlugin 做端到端验证)
