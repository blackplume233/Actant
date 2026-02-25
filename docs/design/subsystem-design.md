# Subsystem 子系统设计规范

> 参考 Unreal Engine 的 Subsystem 模式，为 Actant 提供可热插拔、生命周期感知的辅助系统框架。

---

## 0. 设计动机

Actant 当前的系统功能（调度、监控、权限审计、记忆管理等）是以硬编码方式嵌入核心模块中的。这带来几个问题：

1. **耦合性高** — 增加新功能需修改 AgentManager、AppContext 等核心类
2. **不可选择** — 用户无法按需启用/禁用特定功能
3. **生命周期不清晰** — 功能组件的创建/销毁时机与宿主不一致
4. **插件能力有限** — 缺乏让插件注入深层系统行为的标准途径

Subsystem 模式通过**声明式注册 + 自动生命周期管理**，让功能模块以松耦合方式寄生于宿主实体，跟随宿主的生命周期自动初始化和清理。

---

## 1. 核心概念

### 1.1 Subsystem 定义

**Subsystem** 是一个绑定到特定 **Outer（宿主）** 的功能模块，满足以下特征：

- **声明式注册** — 通过插件、配置文件或代码注册，不修改宿主代码
- **自动实例化** — 宿主创建时自动实例化匹配的 Subsystem
- **生命周期绑定** — 跟随宿主的 init / start / stop / dispose 自动调用对应方法
- **可选启用** — 通过配置或条件表达式决定是否激活
- **上下文感知** — 可访问宿主上下文及 EventBus

### 1.2 四种 Outer 作用域

与 Actant 的四层实体模型（Template → Instance → Process → Session）对齐：

```
┌───────────────────────────────────────────────────────────────────┐
│  Outer Scope          │ Lifecycle                │ 生命周期长度   │
├───────────────────────┼──────────────────────────┼───────────────┤
│  ActantSubsystem      │ daemon start → stop      │ 最长          │
│  InstanceSubsystem    │ agent create → destroy   │ 持久          │
│  ProcessSubsystem     │ process start → stop     │ 运行时        │
│  SessionSubsystem     │ session start → end      │ 最短          │
└───────────────────────────────────────────────────────────────────┘
```

| Scope | 数量 | Outer 实体 | 典型用途 |
|-------|------|-----------|---------|
| **ActantSubsystem** | 单例 | Daemon (AppContext) | 全局监控、全局调度策略、系统级审计 |
| **InstanceSubsystem** | 每个 AgentInstance 一份 | AgentInstance | Agent 专属配置加载器、工作空间扩展、领域组件注入 |
| **ProcessSubsystem** | 每个 Process 一份 | AgentProcess | 进程级健康检查、资源限额、通信通道管理 |
| **SessionSubsystem** | 每个 Session 一份 | AcpSession | 会话级上下文维护、对话记忆、工具权限沙箱 |

### 1.3 与 UE Subsystem 的映射

| UE5 | Actant | 说明 |
|-----|--------|------|
| `UEngineSubsystem` | `ActantSubsystem` | 引擎/守护进程级别 |
| `UGameInstanceSubsystem` | `InstanceSubsystem` | 游戏实例/Agent 实例 |
| `UWorldSubsystem` | `ProcessSubsystem` | World/进程生命周期 |
| `ULocalPlayerSubsystem` | `SessionSubsystem` | 玩家/会话级别 |

---

## 2. 接口设计

### 2.1 基础接口

```typescript
/**
 * 所有 Subsystem 的基础接口。
 * 具体 Subsystem 通过实现此接口并注册到 SubsystemRegistry 来声明自身。
 */
interface SubsystemDefinition<TContext = unknown> {
  /** 全局唯一标识符 */
  readonly id: string;

  /** 人类可读名称 */
  readonly name: string;

  /** 绑定的 Outer 作用域 */
  readonly scope: SubsystemScope;

  /** 该 Subsystem 的来源 */
  readonly origin: SubsystemOrigin;

  /**
   * 是否启用。可以是：
   * - boolean: 静态启用/禁用
   * - string: 条件表达式，在 Outer 创建时求值
   *   支持 ${agent.archetype}, ${agent.template}, ${config.xxx} 等占位符
   */
  enabled?: boolean | string;

  /** 依赖的其他 Subsystem ID 列表，确保初始化顺序 */
  dependencies?: string[];

  /** 优先级（同 scope 内初始化顺序，数值越小越先） */
  priority?: number;

  /**
   * 生命周期钩子 — Outer 创建时调用。
   * 接收 Outer 的上下文，用于获取 EventBus、配置等。
   */
  initialize(context: TContext): void | Promise<void>;

  /**
   * 生命周期钩子 — Outer 开始活跃时调用。
   * ActantSubsystem: daemon 已就绪
   * ProcessSubsystem: 进程已 spawn
   * SessionSubsystem: ACP 会话已建立
   */
  start?(context: TContext): void | Promise<void>;

  /**
   * 生命周期钩子 — Outer 即将停止时调用。
   * 与 start() 对称，用于清理运行时状态。
   */
  stop?(context: TContext): void | Promise<void>;

  /**
   * 生命周期钩子 — Outer 销毁时调用。
   * 释放所有资源，与 initialize() 对称。
   */
  dispose?(): void | Promise<void>;
}

type SubsystemScope = "actant" | "instance" | "process" | "session";

type SubsystemOrigin =
  | "builtin"      // Actant 内置
  | "plugin"       // 插件注入
  | "user-config"  // 用户配置文件声明
  | "agent-self";  // Agent 运行时自注册（仅限 process/session scope）
```

### 2.2 各 Scope 的具体上下文

```typescript
/** Daemon 级上下文 */
interface ActantSubsystemContext {
  readonly eventBus: HookEventBus;
  readonly hookCategoryRegistry: HookCategoryRegistry;
  readonly config: ActantConfig;
  readonly homeDir: string;
}

/** Agent 实例级上下文 */
interface InstanceSubsystemContext extends ActantSubsystemContext {
  readonly agentName: string;
  readonly archetype: AgentArchetype;
  readonly templateName: string;
  readonly instanceDir: string;
  readonly instanceMeta: AgentInstanceMeta;
}

/** Agent 进程级上下文 */
interface ProcessSubsystemContext extends InstanceSubsystemContext {
  readonly pid: number;
  readonly launchMode: LaunchMode;
  readonly acpConnection?: AcpConnection;
}

/** ACP 会话级上下文 */
interface SessionSubsystemContext extends ProcessSubsystemContext {
  readonly sessionId: string;
}
```

### 2.3 SubsystemCollection — 运行时容器

每个 Outer 实体持有一个 `SubsystemCollection`，负责 Subsystem 实例的创建和生命周期管理：

```typescript
class SubsystemCollection<TScope extends SubsystemScope> {
  constructor(
    scope: TScope,
    registry: SubsystemRegistry,
    context: SubsystemContextMap[TScope],
  );

  /** 初始化所有匹配当前 scope 且 enabled 的 Subsystem，按依赖排序 */
  initializeAll(): Promise<void>;

  /** 调用所有已初始化 Subsystem 的 start() */
  startAll(): Promise<void>;

  /** 调用所有已初始化 Subsystem 的 stop() */
  stopAll(): Promise<void>;

  /** 销毁所有 Subsystem，按初始化的逆序 */
  disposeAll(): Promise<void>;

  /** 按 ID 获取特定 Subsystem 实例 */
  get<T extends SubsystemDefinition>(id: string): T | undefined;

  /** 列出当前所有活跃 Subsystem */
  list(): SubsystemInfo[];

  /** 运行时热插拔：激活一个之前未启用的 Subsystem */
  activate(id: string): Promise<void>;

  /** 运行时热插拔：停用一个正在运行的 Subsystem */
  deactivate(id: string): Promise<void>;
}
```

---

## 3. 注册机制

### 3.1 SubsystemRegistry — 全局注册表

```typescript
class SubsystemRegistry {
  /** 注册一个 Subsystem 定义 */
  register(definition: SubsystemDefinition): void;

  /** 注销一个 Subsystem */
  unregister(id: string): boolean;

  /** 查询某个 scope 下所有已注册的 Subsystem */
  listByScope(scope: SubsystemScope): SubsystemDefinition[];

  /** 检查是否已注册 */
  has(id: string): boolean;

  /** 获取定义 */
  get(id: string): SubsystemDefinition | undefined;

  /** 按来源分类列出 */
  listByOrigin(origin: SubsystemOrigin): SubsystemDefinition[];
}
```

### 3.2 注册途径

#### 途径 A：内置注册（builtin）

Actant 启动时自动注册的核心 Subsystem：

```typescript
// packages/core/src/subsystems/builtin/index.ts
subsystemRegistry.register(new ProcessWatcherSubsystem());
subsystemRegistry.register(new RestartTrackerSubsystem());
subsystemRegistry.register(new ScheduleSubsystem());
subsystemRegistry.register(new PermissionAuditSubsystem());
```

#### 途径 B：插件注册（plugin）

插件通过 PluginManager 的 hook 注册 Subsystem：

```typescript
// 插件 package 入口
export function activate(ctx: PluginContext): void {
  ctx.subsystemRegistry.register({
    id: "my-plugin.memory-manager",
    name: "Memory Manager",
    scope: "session",
    origin: "plugin",
    dependencies: [],
    initialize(sessionCtx) {
      // 在每个 ACP session 建立时初始化记忆管理
    },
    dispose() {
      // session 结束时清理
    },
  });
}
```

#### 途径 C：用户配置注册（user-config）

用户在 `~/.actant/configs/subsystems/` 或 Agent Template 中声明：

```json
{
  "name": "custom-health-check",
  "version": "1.0.0",
  "subsystems": [
    {
      "id": "custom.health-check",
      "scope": "process",
      "enabled": "${agent.archetype} === 'service'",
      "config": {
        "checkIntervalMs": 30000,
        "unhealthyThreshold": 3
      }
    }
  ]
}
```

#### 途径 D：Agent 自注册（agent-self）

运行中的 Agent 通过 CLI 或 ACP 动态注册 Subsystem（仅限 process/session scope）：

```bash
actant subsystem activate --agent my-agent --id plugin.memory-manager
actant subsystem deactivate --agent my-agent --id plugin.memory-manager
```

---

## 4. 生命周期集成

### 4.1 与 EventBus 的关系

Subsystem 的生命周期钩子由**宿主实体管理器**直接调用，不经过 EventBus。但 Subsystem 自身可以：

1. **监听事件** — 在 `initialize()` 中订阅 EventBus 事件
2. **发射事件** — 在业务逻辑中 emit 自定义事件
3. **注册新事件类型** — 通过 HookCategoryRegistry 扩展事件分类

```
Outer lifecycle                 Subsystem lifecycle
───────────────                 ───────────────────
daemon.start()
  │
  ├─ subsystems.initializeAll()  →  [A].initialize(), [B].initialize(), ...
  ├─ subsystems.startAll()       →  [A].start(), [B].start(), ...
  │
  │  ... daemon running ...         ... Subsystems active, listening events ...
  │
  ├─ subsystems.stopAll()        →  [B].stop(), [A].stop(), ...     (reverse)
  └─ subsystems.disposeAll()     →  [B].dispose(), [A].dispose()    (reverse)
daemon.stop()
```

### 4.2 各 Outer 的集成点

| Outer | 管理者 | initializeAll 时机 | disposeAll 时机 |
|-------|--------|-------------------|-----------------|
| Daemon | `AppContext` | `init()` 完成后 | `stop()` 开始前 |
| Instance | `AgentManager` | `createAgent()` 完成后 | `destroyAgent()` 开始前 |
| Process | `AgentManager` | `startAgent()` 进程 spawn 后 | `stopAgent()` / `handleProcessExit()` 前 |
| Session | `AcpConnectionManager` | ACP session 建立后 | ACP session 关闭前 |

### 4.3 嵌套生命周期

Subsystem 遵循从外到内的嵌套关系。外层 Subsystem 先于内层初始化，后于内层销毁：

```
ActantSubsystem.init()
  │
  ├─ InstanceSubsystem.init()        (per agent create)
  │    │
  │    ├─ ProcessSubsystem.init()    (per agent start)
  │    │    │
  │    │    ├─ SessionSubsystem.init()  (per session)
  │    │    ├─ SessionSubsystem.dispose()
  │    │    │
  │    │    ├─ SessionSubsystem.init()  (another session)
  │    │    └─ SessionSubsystem.dispose()
  │    │
  │    └─ ProcessSubsystem.dispose()
  │
  └─ InstanceSubsystem.dispose()
```

### 4.4 热插拔

通过 `SubsystemCollection.activate()` / `deactivate()`，Subsystem 可以在宿主存活期间动态启用/禁用：

- **activate** — 立即调用 `initialize()` + `start()`（如果宿主已 start）
- **deactivate** — 立即调用 `stop()` + `dispose()`

约束：
- 被其他 Subsystem 依赖的不允许 deactivate
- origin 为 `builtin` 的不允许 deactivate（除非显式 force）

---

## 5. 内置 Subsystem 示例

### 5.1 ActantSubsystem 层

| ID | 功能 | 当前实现位置 |
|----|------|-------------|
| `actant.event-system` | EventBus + HookRegistry + HookCategoryRegistry 管理 | `AppContext` inline |
| `actant.source-manager` | 组件源同步和注入 | `SourceManager` |
| `actant.template-watcher` | 模板文件热更新 | `TemplateFileWatcher` |

### 5.2 InstanceSubsystem 层

| ID | 功能 | 当前实现位置 |
|----|------|-------------|
| `instance.domain-context` | 合并 skills/prompts/mcp/workflows 配置 | `AgentInitializer` inline |
| `instance.schedule` | EmployeeScheduler 管理 | `agent-handlers.ts` inline |
| `instance.permission-audit` | 权限变更审计日志 | `PermissionAuditLogger` |

### 5.3 ProcessSubsystem 层

| ID | 功能 | 当前实现位置 |
|----|------|-------------|
| `process.watcher` | PID 存活轮询 + 异常退出检测 | `ProcessWatcher` |
| `process.restart-tracker` | 崩溃重启决策（指数退避） | `RestartTracker` |
| `process.health-check` | 心跳健康检查（service archetype） | 尚未实现 |

### 5.4 SessionSubsystem 层

| ID | 功能 | 当前实现位置 |
|----|------|-------------|
| `session.context-broker` | 会话级上下文组装 | 尚未实现（Phase 5 Memory） |
| `session.tool-sandbox` | MCP 工具权限沙箱 | 尚未实现 |
| `session.conversation-log` | 对话日志持久化 | 尚未实现 |

---

## 6. 配置 Schema

### 6.1 Subsystem 声明（in Template / Workflow JSON）

```json
{
  "subsystems": {
    "process.health-check": {
      "enabled": true,
      "config": {
        "checkIntervalMs": 30000,
        "unhealthyThreshold": 3
      }
    },
    "session.context-broker": {
      "enabled": "${agent.archetype} !== 'tool'",
      "config": {
        "maxContextTokens": 8000,
        "memoryStrategy": "sliding-window"
      }
    }
  }
}
```

### 6.2 全局 Subsystem 配置（~/.actant/configs/subsystems/）

```json
{
  "name": "global-audit",
  "version": "1.0.0",
  "subsystem": {
    "id": "actant.global-audit",
    "scope": "actant",
    "origin": "user-config",
    "enabled": true
  },
  "config": {
    "auditLogDir": "~/.actant/audit-logs",
    "retentionDays": 30
  }
}
```

---

## 7. 与现有系统的关系

### 7.1 与 EventBus 的协作

```
EventBus                           Subsystem
───────                            ─────────
emit("process:start")  ───────→   ProcessSubsystem.start() [由管理器调]
                                     │
                                     ├─ eventBus.on("heartbeat:tick", ...)
                                     ├─ eventBus.on("prompt:after", ...)
                                     │
                                     │  ... 业务逻辑 ...
                                     │
                                     └─ eventBus.emit("custom:health-report", ...)
```

Subsystem 的生命周期由宿主管理器驱动（不通过 EventBus），但 Subsystem 内部自由使用 EventBus 进行业务通信。

### 7.2 与 Plugin 的关系

Plugin 是 Subsystem 的**注册者**，不是替代品：

```
Plugin                        Subsystem
──────                        ─────────
定义"要注册什么"               定义"做什么 + 绑定到哪个生命周期"
activate() 时注册              被 SubsystemCollection 自动实例化
无固定生命周期                  严格绑定 Outer 生命周期
```

当前 PluginManager 加载的插件可以在 `activate()` 中注册 Subsystem，也可以注册 EventBus listener、CLI command 等。Subsystem 是 Plugin 提供**深层系统集成**的标准途径。

### 7.3 与 EmployeeScheduler 的重构路径

当前 EmployeeScheduler 是硬编码在 `agent-handlers.ts` 中的。重构路径：

```
当前：agent-handlers.ts → new EmployeeScheduler() → start/stop

目标：InstanceSubsystem (id: "instance.schedule")
      initialize() → 读取 template.schedule 配置
      start()      → 创建 EmployeeScheduler → configure → start
      stop()       → scheduler.stop()
      dispose()    → 清理
```

---

## 8. 设计决策

### D1: 为什么不用 EventBus 驱动 Subsystem 生命周期？

EventBus 的 listener 是松散的——无法保证执行顺序，无法声明依赖，异常不阻断主流程。Subsystem 生命周期需要**有序、同步、可靠**的调用链，因此由宿主管理器直接驱动。

### D2: 为什么区分四层而不是三层（去掉 Process）？

Process 和 Instance 是两个独立的生命周期维度。一个 Instance 可以多次 spawn/terminate Process。Process 级 Subsystem（如健康检查、资源监控）不应在 Process 停止后继续存在，也不应在 Instance 创建时就初始化。

### D3: 条件启用表达式的复杂度

`enabled` 字段支持 `${variable}` 模板表达式，与 HookDeclaration.condition 共用同一套求值器。只支持简单的相等/不等比较和布尔运算，不支持函数调用——保持声明式纯度。

### D4: Agent 自注册 Subsystem 的安全边界

Agent 只能激活/停用已在全局 SubsystemRegistry 中注册的 Subsystem 定义，不能注册全新的 Subsystem 代码。这避免了 Agent 注入任意代码到 Daemon 进程的风险。

### D5: 热插拔的粒度

热插拔以单个 Subsystem 实例为粒度，不支持"替换同 ID 的不同版本"。版本升级需要先 deactivate 再 register 新版本再 activate。

---

## 9. API 契约扩展

### 9.1 RPC 方法

| 方法 | 参数 | 说明 |
|------|------|------|
| `subsystem.list` | `{ scope?, agentName? }` | 列出匹配条件的活跃 Subsystem |
| `subsystem.activate` | `{ id, agentName? }` | 激活指定 Subsystem |
| `subsystem.deactivate` | `{ id, agentName? }` | 停用指定 Subsystem |
| `subsystem.status` | `{ id, agentName? }` | 查询 Subsystem 状态和配置 |

### 9.2 CLI 命令

```bash
actant subsystem list [--scope actant|instance|process|session] [--agent <name>]
actant subsystem activate <id> [--agent <name>]
actant subsystem deactivate <id> [--agent <name>]
actant subsystem status <id> [--agent <name>]
```

### 9.3 事件

| 事件 | 时机 | 数据 |
|------|------|------|
| `subsystem:activated` | Subsystem 被激活后 | `{ subsystem.id, scope, agentName? }` |
| `subsystem:deactivated` | Subsystem 被停用后 | `{ subsystem.id, scope, agentName? }` |
| `subsystem:error` | Subsystem 生命周期钩子抛出异常 | `{ subsystem.id, phase, error }` |

---

## 10. 实现路径

### Phase 1: 基础框架

1. 定义 `SubsystemDefinition` 接口和 `SubsystemScope` 类型（`@actant/shared`）
2. 实现 `SubsystemRegistry`（全局注册表）（`@actant/core`）
3. 实现 `SubsystemCollection`（运行时容器）（`@actant/core`）
4. 在 AppContext 中集成 ActantSubsystem scope

### Phase 2: Instance + Process 集成

5. 在 AgentManager 中集成 InstanceSubsystem 和 ProcessSubsystem
6. 将 EmployeeScheduler 迁移为 `instance.schedule` Subsystem
7. 将 ProcessWatcher / RestartTracker 迁移为 `process.watcher` / `process.restart-tracker`

### Phase 3: Session + Plugin

8. 在 AcpConnectionManager 中集成 SessionSubsystem
9. 扩展 PluginManager 支持 Subsystem 注册
10. 实现 CLI / RPC 管理命令

### Phase 4: 热插拔 + Agent 自注册

11. 实现 `activate()` / `deactivate()` 热插拔
12. 通过 CLI channel 暴露给 Agent 自注册能力
13. 安全审计和权限校验

---

## 关联 Issues

- `#135` — Workflow as Hook Package（Subsystem 的事件集成基础）
- `#171` — Service Instance Session Concurrency（SessionSubsystem 的并发模型）
- `#014` — Plugin/Heartbeat/Scheduler/Memory（Subsystem 框架的目标消费者）
- 新建 Issue: Subsystem 基础框架实现
