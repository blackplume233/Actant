---
id: 14
title: Plugin 体系设计（heartbeat/scheduler/memory 可插拔）
status: open
labels:
  - architecture
  - core
  - feature
  - "priority:P1"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues:
  - 22
  - 47
  - 122
  - 135
relatedFiles:
  - packages/core/src/scheduler/employee-scheduler.ts
  - packages/core/src/scheduler/inputs/input-source.ts
taskRef: null
githubRef: "blackplume233/Actant#14"
closedAs: null
createdAt: "2026-02-20T11:35:43"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0122-employee-service-mode]], [[0135-workflow-as-hook-package]], #47 (Phase 3c 已交付), #22 (ProcessWatcher)
**Related Files**: `packages/core/src/scheduler/`, `packages/core/src/agent/`

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

## 调度器作为 Plugin 的设计要点

> 详细调度器设计见 #122。此处聚焦 Plugin 接口对调度器的支持。

Plugin 接口需为调度器提供以下扩展点：

### `registerInputSources` — 注册自定义调度源

插件可通过此钩子向 EmployeeScheduler 的 InputRouter 注入自定义 InputSource：

```typescript
interface ActantPlugin {
  name: string;
  version: string;

  onStart?(ctx: PluginContext): void | Promise<void>;
  onStop?(ctx: PluginContext): void | Promise<void>;

  // 调度器扩展点：注册自定义 InputSource
  registerInputSources?(registry: InputSourceRegistry): void;

  // 工具扩展点：注册自定义 MCP Tool（含调度工具）
  registerTools?(registry: ToolRegistry): void;
}

interface InputSourceRegistry {
  // 注册一个 InputSource 工厂，按类型名索引
  register(type: string, factory: (config: unknown) => InputSource): void;
}
```

### 调度器 Plugin 化的三步走

1. **Phase 1（当前 #122）**：在现有 EmployeeScheduler 上新增 DelayInput + MCP Tool 暴露，不改变架构
2. **Phase 2（本 issue）**：将 HeartbeatInput、CronInput、HookInput 重构为内置 Plugin 注册的 InputSource
3. **Phase 3**：InputSourceRegistry 开放给第三方 Plugin，支持 WebhookInput、FileWatcherInput 等社区扩展

### 内置调度器 Plugin 清单

| Plugin 名 | 包含的 InputSource | 注册的 MCP Tool |
|-----------|-------------------|----------------|
| `builtin:heartbeat` | HeartbeatInput | — |
| `builtin:cron` | CronInput | — |
| `builtin:hook` | HookInput | — |
| `builtin:scheduler-tools` | DelayInput (动态) | `actant_schedule_wait`, `actant_schedule_cron`, `actant_schedule_cancel` |

## 依赖

- #22 ProcessWatcher（HeartbeatMonitor 的基础）
- #47 EmployeeScheduler（已完成，提供调度管道）
- #122 调度器四种使用模式设计（配置/工具/插件/内置基础）

## 验收

- [ ] Plugin 接口定义清晰，包含 `registerInputSources` 和 `registerTools` 扩展点
- [ ] 至少 HeartbeatMonitor 作为首个插件实现
- [ ] 现有 HeartbeatInput / CronInput / HookInput 可通过 Plugin 注册（向后兼容）
- [ ] 模板中可配置 plugins
- [ ] 第三方 Plugin 可注册自定义 InputSource
