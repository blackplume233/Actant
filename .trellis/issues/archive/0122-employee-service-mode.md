---
id: 122
title: "Feature: Employee/Service Mode - continuous execution, scheduler types, inter-agent dispatch"
status: closed
closedAs: absorbed-by-228
labels:
  - core
  - feature
  - architecture
  - "priority:P1"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 47
  - 135
relatedFiles:
  - packages/core/src/scheduler/employee-scheduler.ts
  - packages/core/src/scheduler/inputs/input-source.ts
  - packages/core/src/scheduler/schedule-config.ts
  - packages/core/src/scheduler/types.ts
taskRef: null
githubRef: "blackplume233/Actant#122"
closedAs: null
createdAt: "2026-02-23T12:18:22Z"
updatedAt: "2026-02-25T00:00:00Z"
closedAt: null
---

**Related Issues**: [[0014-plugin-heartbeat-scheduler-memory]], [[0135-workflow-as-hook-package]], #47 (Phase 3c 已交付)
**Related Files**: `packages/core/src/scheduler/`

---

## 动机

当前 EmployeeScheduler（#47 Phase 3c 已交付）实现了基础的 InputSource → TaskQueue → TaskDispatcher 管道。但调度器的使用方式仅限于「系统通过模板配置自动驱动」这一种模式。

实际场景中，Agent 调度器需要支持更多使用模式：
- Agent 自身需要「等待一段时间后继续」的能力（如轮询、延迟重试）
- 用户/系统需要通过插件体系动态扩展调度能力
- 不同场景下调度器的来源和生命周期各不相同

## 核心设计：调度器的四种使用模式

### 模式 1: 配置驱动 — 系统自动调用

> **现状**：已在 Phase 3c (#47) 中实现。

通过模板的 `schedule` 字段声明调度配置，Daemon 在启动 Employee Agent 时自动读取配置、初始化 EmployeeScheduler 并启动对应的 InputSource。

```yaml
# template.json → schedule 字段
schedule:
  heartbeat:
    intervalMs: 60000
    prompt: "检查是否有新任务"
  cron:
    - pattern: "0 9 * * *"
      prompt: "执行每日代码审查"
      timezone: "Asia/Shanghai"
  hooks:
    - eventName: "source:updated"
      prompt: "有组件更新，请检查兼容性"
```

**特征**：
- 生命周期跟随 Agent Instance（start/stop 同步）
- 配置是静态的（来自模板 JSON/YAML）
- 由 Actant Daemon 调用 `EmployeeScheduler.configure()` + `start()`

### 模式 2: 工具驱动 — Agent 自己调用并等待

> **新增能力**：调度器作为 MCP Tool 暴露给 Agent，Agent 可以主动调用来「等待」然后继续工作。

这是最关键的新能力。Agent 在执行任务过程中，可能需要：
- 等待一段时间后重新检查（轮询外部资源）
- 延迟执行下一步（rate limiting / backoff）
- 定时自唤醒继续未完成的工作

#### 设计：`actant_schedule_wait` MCP Tool

```typescript
// 通过 MCP Server 暴露给 Agent 的工具
interface ScheduleWaitTool {
  name: "actant_schedule_wait";
  description: "等待指定时间后，向自己发送一条 prompt 以继续工作";
  inputSchema: {
    delayMs: number;       // 等待毫秒数
    prompt: string;        // 到期后发给自己的 prompt
    reason?: string;       // 等待原因（用于日志/审计）
  };
  // 返回值：调度 task ID（可用于取消）
  outputSchema: {
    taskId: string;
    scheduledAt: string;   // ISO timestamp — 预计触发时间
  };
}

// 同类：actant_schedule_cron — 注册一个临时 cron 调度
interface ScheduleCronTool {
  name: "actant_schedule_cron";
  inputSchema: {
    pattern: string;       // cron 表达式
    prompt: string;
    maxTriggers?: number;  // 最大触发次数（默认 1）
  };
}

// 同类：actant_schedule_cancel — 取消一个待执行的调度
interface ScheduleCancelTool {
  name: "actant_schedule_cancel";
  inputSchema: {
    taskId: string;
  };
}
```

**执行流程**：
```
Agent 调用 actant_schedule_wait(delayMs=30000, prompt="重新检查 PR 状态")
  → Actant MCP Server 收到请求
  → 创建 DelayedTask，注册到 EmployeeScheduler 的 TaskQueue
  → 立即返回 { taskId, scheduledAt }
  → Agent 当前 session 结束（或继续其他工作）
  → 30s 后 TaskDispatcher 将 prompt 送入 Agent 的下一个 prompt
  → Agent 被唤醒，继续处理
```

**关键决策**：
- Agent 调用 `schedule_wait` 后**不阻塞** — 它只是注册了一个延迟任务，当前 prompt 正常完成
- 延迟任务触发时，通过 TaskDispatcher → promptAgent 机制投递给 Agent 的下一轮对话
- 这与 Heartbeat/Cron 走同一条管道，只是触发源不同（Agent 自己 vs 系统配置）

### 模式 3: 插件驱动 — 通过 Plugin 体系动态加入

> **与 #14 Plugin 体系协同**：调度器本身应当可以作为 Plugin 注册到系统中。

Phase 4 (#14) 将引入 Actant 系统级 Plugin 体系。调度器应当是 Plugin 接口的一等公民：

```typescript
// Plugin 接口中的调度器扩展点
interface ActantPlugin {
  name: string;
  version: string;

  onStart?(ctx: PluginContext): void | Promise<void>;
  onStop?(ctx: PluginContext): void | Promise<void>;

  // 插件可以注册自定义 InputSource
  registerInputSources?(registry: InputSourceRegistry): void;

  // 插件可以注册自定义 MCP Tools（包括调度相关工具）
  registerTools?(registry: ToolRegistry): void;
}

// 示例：一个 GitHub Webhook 调度器插件
const githubWebhookPlugin: ActantPlugin = {
  name: "github-webhook-scheduler",
  version: "1.0.0",

  registerInputSources(registry) {
    registry.register("webhook:github", (config) => {
      return new GitHubWebhookInput(config);  // 实现 InputSource 接口
    });
  },

  registerTools(registry) {
    registry.register({
      name: "actant_watch_github_pr",
      handler: async (params) => {
        // 注册一个 PR 状态轮询调度
      }
    });
  }
};
```

**插件可以扩展的调度能力**：
- 自定义 InputSource（如 WebhookInput、FileWatcherInput、MQInput）
- 自定义调度相关的 MCP Tool（如 `watch_github_pr`、`poll_api_endpoint`）
- 自定义 TaskDispatcher 策略（如并行执行、条件分发）

### 模式 4: 内置基础调度器 — 等待一段时间

> **最小可用的调度器**：一个简单的 delay/sleep 调度，作为所有调度场景的基石。

这是调度器体系中最基本的单元 — `DelayInput`，一个只触发一次的定时器：

```typescript
// packages/core/src/scheduler/inputs/delay-input.ts
export class DelayInput implements InputSource {
  readonly type = "delay";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _active = false;

  constructor(
    private readonly config: {
      delayMs: number;
      prompt: string;
      priority?: TaskPriority;
    },
    readonly id: string = `delay-${randomUUID()}`,
  ) {}

  start(agentName: string, onTask: TaskCallback): void {
    this._active = true;
    this.timer = setTimeout(() => {
      onTask({
        id: randomUUID(),
        agentName,
        prompt: this.config.prompt,
        priority: this.config.priority ?? "normal",
        source: `delay:${this.config.delayMs}ms`,
        createdAt: new Date().toISOString(),
      });
      this._active = false;
    }, this.config.delayMs);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this._active = false;
  }

  get active(): boolean { return this._active; }
}
```

**它的使用场景**：
- **模式 2 的底层实现**：`actant_schedule_wait` MCP Tool 内部创建一个 DelayInput 并注册到 InputRouter
- **模式 1 的补充**：模板配置中可以声明 `delay` 类型的一次性调度（如 Agent 启动后延迟 5s 执行初始化任务）
- **模式 3 的测试基石**：Plugin 开发者可以组合 DelayInput 实现更复杂的调度策略

## 调度器统一架构

```
┌─────────────────────────────────────────────────────────────┐
│                    调度器使用模式                              │
├─────────────┬─────────────┬──────────────┬─────────────────┤
│ 模式 1       │ 模式 2       │ 模式 3        │ 模式 4           │
│ 配置驱动     │ 工具驱动     │ 插件驱动      │ 内置基础         │
│ (template)  │ (MCP Tool)  │ (Plugin)     │ (DelayInput)    │
├─────────────┴─────────────┴──────────────┴─────────────────┤
│                    InputSource 接口                          │
│   HeartbeatInput │ CronInput │ HookInput │ DelayInput │ ... │
├─────────────────────────────────────────────────────────────┤
│                    InputRouter                               │
│         register / unregister / startAll / stopAll           │
├─────────────────────────────────────────────────────────────┤
│                    TaskQueue                                  │
│              per-agent 串行 + 优先级排序                       │
├─────────────────────────────────────────────────────────────┤
│                    TaskDispatcher                             │
│           dequeue → promptAgent → ExecutionLog               │
└─────────────────────────────────────────────────────────────┘
```

四种模式**共享同一条管道**（InputSource → InputRouter → TaskQueue → TaskDispatcher），区别仅在于：

| 模式 | InputSource 来源 | 注册时机 | 生命周期 |
|------|-----------------|---------|---------|
| 配置驱动 | 模板 `schedule` 字段 | Agent start 时 | 跟随 Agent Instance |
| 工具驱动 | Agent 调用 MCP Tool | 运行时动态注册 | 单次触发后自动注销（或按 maxTriggers） |
| 插件驱动 | Plugin `registerInputSources` | Plugin onStart 时 | 跟随 Plugin 生命周期 |
| 内置基础 | 代码直接创建 | 任意时刻 | 单次触发后自动注销 |

## 与现有系统的整合

| 现有组件 | 变更 |
|---------|------|
| `EmployeeScheduler` | 新增 `registerDelayedTask(delayMs, prompt)` 方法，内部创建 DelayInput |
| `InputRouter` | 支持动态 register/unregister（已实现），新增 `registerOnce()` 语义糖 |
| `InputSource` 接口 | **不变** — DelayInput 实现同一接口 |
| `ScheduleConfigSchema` | 新增可选 `delay` 字段（初始任务延迟） |
| `@actant/mcp-server` | 新增 `actant_schedule_wait` / `actant_schedule_cron` / `actant_schedule_cancel` tools |
| Plugin 体系 (#14) | Plugin 接口需包含 `registerInputSources` 扩展点 |

## 实现路径

### Step 1: DelayInput 基础实现
- 新增 `packages/core/src/scheduler/inputs/delay-input.ts`
- 实现 InputSource 接口，单次触发 + 自动清理
- 单元测试

### Step 2: EmployeeScheduler 增强
- `registerDelayedTask(delayMs, prompt, priority?)` 方法
- `registerOnce(source: InputSource)` — 触发后自动 unregister
- 模板 `schedule.initialDelay` 配置支持

### Step 3: MCP Tool 暴露
- 在 `@actant/mcp-server` 注册 `actant_schedule_wait` tool
- 在 `@actant/mcp-server` 注册 `actant_schedule_cron` tool（带 maxTriggers）
- 在 `@actant/mcp-server` 注册 `actant_schedule_cancel` tool
- Tool handler 调用 Daemon RPC → EmployeeScheduler

### Step 4: Plugin 扩展点
- 在 #14 Plugin 接口设计中预留 `registerInputSources` 钩子
- 示例：将 WebhookInput (Phase 3c P2 可选项) 改为独立 Plugin

## 验收标准

- [ ] DelayInput 实现并通过单元测试
- [ ] EmployeeScheduler 支持动态注册一次性调度
- [ ] `actant_schedule_wait` MCP Tool 可被 Agent 调用
- [ ] Agent 可通过 Tool 实现「等 30s 后继续」的工作流
- [ ] Plugin 接口预留调度器扩展点
- [ ] 模板配置支持 `schedule.initialDelay`
- [ ] lint + typecheck 通过

---

## Comments
