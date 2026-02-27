# Plugin 体系规范

> **✅ 已验证 (Step 4 — #14)**：`ActantPlugin` 六插口接口 + `PluginHost` 生命周期管理器已实现并通过 27 个单元测试。
> 以下内容为已验证规范，可作为 Plugin 编写和 Code Review 的依据。
> Memory / InputSource / 调度器扩展部分仍为预定设计，标注 ⚠️。

---

## 核心原则

1. **六插口统一**: 一个 Plugin 可同时具备 domainContext / runtime / hooks / contextProviders / subsystems / sources 六种能力，按需声明
2. **双层作用域**: actant (全局单例) + instance (per-agent)，生命周期与 Daemon / Agent 对齐
3. **故障隔离**: 单个 Plugin 的 init/start/hooks 抛异常时标记为 `error` 状态，不影响其他 Plugin
4. **向后兼容**: 旧 `PluginDefinition` (Phase 3, Agent-side) 通过 `adaptLegacyPlugin()` 自动适配为纯 domainContext 插件
5. **收集模式**: 插口 4/5/6（contextProviders / subsystems / sources）在 start() 时收集，由 AppContext 在 Step 5 统一接线
6. **零依赖原则**: PluginHost 对 SessionContextInjector / SourceManager / SubsystemRegistry 零依赖，通过暴露 getter 解耦

---

## Plugin 接口规范

### ActantPlugin 生命周期

```
init → start → tick (循环) → stop → dispose
```

| 阶段 | 时机 | 职责 | 错误处理 |
|------|------|------|---------|
| `init` | PluginHost 启动时 | 读取配置、校验参数、分配资源 | 失败则标记 `error`，不加载 |
| `start` | init 成功后 | 启动内部逻辑（定时器、连接等） | 失败则 stop + dispose |
| `tick` | 定时周期调用 | 执行周期性工作 | try/catch 隔离，连续失败触发 unhealthy |
| `stop` | Agent 停止或 Daemon 关闭 | 停止内部逻辑、释放连接 | 必须幂等，多次调用无副作用 |
| `dispose` | stop 之后 | 释放所有资源、清理文件 | 最后防线，必须成功 |

### 必须遵守的模式

#### tick() 防重入 + 错误隔离

```typescript
// 必须: 每个 Plugin 的 tick 独立 try/catch + running guard
private ticking = false;
async tick(ctx: PluginContext): Promise<void> {
  if (this.ticking) return;
  this.ticking = true;
  try {
    // 业务逻辑
  } catch (error) {
    ctx.logger.error(`Plugin ${this.name} tick failed`, { error });
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= MAX_FAILURES) {
      ctx.eventBus.emit(`plugin:${this.name}:unhealthy`, { failures: this.consecutiveFailures });
    }
  } finally {
    this.ticking = false;
  }
}
```

#### 配置通过 PluginContext 注入

```typescript
// 正确: 通过 ctx.config 获取配置
async init(ctx: PluginContext): Promise<void> {
  const interval = ctx.config.intervalMs ?? 30000;
  this.dataDir = ctx.dataDir;
}

// 禁止: 直接读取文件系统或全局变量
async init(): Promise<void> {
  const config = JSON.parse(fs.readFileSync('/etc/actant/plugin.json'));
}
```

#### 事件命名规范

Plugin 发射的事件必须使用 `plugin:<name>:<event>` 命名空间:

```typescript
ctx.eventBus.emit('plugin:heartbeat:healthy', { pid, latency });
ctx.eventBus.emit('plugin:heartbeat:unhealthy', { pid, reason });
ctx.eventBus.emit('plugin:memory:extracted', { count, sessionId });
```

---

## 六插口设计

`ActantPlugin` 接口定义在 `packages/core/src/plugin/types.ts`，基础类型在 `packages/shared/src/types/plugin.types.ts`。

```typescript
// packages/core/src/plugin/types.ts
interface ActantPlugin {
  readonly name: string;
  readonly scope: PluginScope;            // "actant" | "instance"
  readonly dependencies?: readonly string[];

  // 插口 1: domainContext — 向 Agent workspace 注入 DomainContextConfig
  domainContext?: (ctx: PluginContext) => DomainContextConfig | undefined;

  // 插口 2: runtime — 五阶段生命周期
  runtime?: PluginRuntimeHooks;

  // 插口 3: hooks — 注册 HookEventBus 监听器（start() 时立即生效）
  hooks?: (bus: HookEventBus, ctx: PluginContext) => void;

  // 插口 4: contextProviders — 注入 SessionContextInjector（start() 时收集，Step 5 接线）
  contextProviders?: (ctx: PluginContext) => ContextProvider[];

  // 插口 5: subsystems — 注册 SubsystemDefinition（start() 时收集，Step 5 接线）
  subsystems?: (ctx: PluginContext) => SubsystemDefinition[];

  // 插口 6: sources — 注册 SourceConfig（start() 时收集，Step 5 接线）
  sources?: (ctx: PluginContext) => SourceConfig[];
}
```

### 插口 1: domainContext

返回 `DomainContextConfig` 片段，由 BackendBuilder 在 Agent workspace 物化时合并使用。
返回 `undefined` 表示不注入任何内容。

旧 `PluginDefinition` (Phase 3) 通过 `adaptLegacyPlugin()` 自动适配：

```typescript
// packages/core/src/plugin/legacy-adapter.ts
function adaptLegacyPlugin(def: PluginDefinition): ActantPlugin {
  return {
    name: def.name,
    scope: 'actant',
    domainContext(ctx) {
      if (def.enabled === false) return undefined;
      return { plugins: [def.name] };
    },
  };
}
```

### 插口 2: runtime

Daemon 运行时的有状态逻辑，遵循五阶段生命周期（见上方「生命周期」表）。

### 插口 3: hooks

注册 HookEventBus 事件监听器。回调在 `PluginHost.start()` 期间（init 成功后）立即调用，
确保监听器在任何事件发射之前就已注册。

```typescript
hooks(bus, ctx) {
  bus.on('process:crash', (payload) => {
    // 处理 Agent 进程崩溃事件
  });
}
```

hooks 异常与 init/start 一样会导致该 plugin 进入 `error` 状态。

### 插口 4/5/6: 收集模式

`contextProviders` / `subsystems` / `sources` 在 `start()` 时调用并收集结果，
通过 `PluginHost.getContextProviders()` / `getSubsystems()` / `getSources()` 暴露。
AppContext 在 Step 5 取出并分别注册到对应的系统（SessionContextInjector / SubsystemRegistry / SourceManager）。
PluginHost 对这三个系统零依赖。

---

## 禁止模式

### 禁止: Plugin 间直接调用

```typescript
// 禁止
const memory = otherPlugin.getMemoryStore();

// 正确: 通过 PluginContext.getPlugin() 获取公共接口
const memory = ctx.getPlugin<MemoryPlugin>('memory');
const records = await memory?.recall(query);
```

### 禁止: Plugin 修改其他 Plugin 的 dataDir

```typescript
// 禁止: 访问其他 Plugin 的数据目录
fs.writeFileSync(path.join(otherPluginDataDir, 'state.json'), data);

// 正确: 只操作自己的 ctx.dataDir
fs.writeFileSync(path.join(ctx.dataDir, 'state.json'), data);
```

### 禁止: 阻塞式 tick

```typescript
// 禁止: tick 中执行长时间同步操作
tick() {
  const data = execSync('heavy-computation');
}

// 正确: 异步执行，设置超时
async tick(ctx: PluginContext) {
  const result = await Promise.race([
    this.heavyWork(),
    timeout(ctx.config.tickTimeoutMs ?? 10000),
  ]);
}
```

### 禁止: Plugin 直接操作 AgentManager

```typescript
// 禁止: Plugin 直接启停 Agent
agentManager.stopAgent('my-agent');

// 正确: 通过事件通知，由 Host 协调
ctx.eventBus.emit('plugin:scheduler:agent-restart-requested', { name: 'my-agent' });
```

---

## 调度器扩展规范 (InputSource)（⚠️ 预定）

### InputSource 注册

Plugin 通过 `registerInputSources` 钩子注册自定义调度源:

```typescript
registerInputSources(registry: InputSourceRegistry): void {
  registry.register('webhook:github', (config) => new GitHubWebhookInput(config));
}
```

### InputSource 生命周期

| 方法 | 职责 |
|------|------|
| `start(agentName, onTask)` | 启动监听，产生任务时调用 onTask |
| `stop()` | 停止监听，释放资源 |
| `active` (getter) | 返回当前是否活跃 |

### DelayInput 作为最小原语

`DelayInput` 是一次性定时器，作为所有时间相关调度的基础:

- MCP Tool `actant_schedule_wait` 内部创建 DelayInput
- 执行完毕后自动从 InputRouter 注销
- 不可复用，每次创建新实例

---

## Hook 事件规范（⚠️ 预定）

### 三层事件架构

| Layer | 作用域 | 事件示例 |
|-------|--------|---------|
| Layer 1: Actant 系统 | 全局 | `actant:start`, `agent:created`, `source:updated`, `cron:*` |
| Layer 2: Instance | 绑定到特定 Agent | 作为 scope 过滤器，不产生独立事件 |
| Layer 3: 运行时 | 进程/Session | `process:start`, `session:end`, `prompt:after` |

### 事件命名规范

```
<scope>:<noun>             # 状态事件: actant:start, process:stop
<scope>:<noun>:<verb>      # 动作事件: agent:created, source:updated
plugin:<name>:<event>      # 插件事件: plugin:heartbeat:unhealthy
cron:<expression>          # 定时事件: cron:0 9 * * *
```

### Workflow 配置格式

```json
{
  "name": "ops-automation",
  "level": "actant",
  "enabled": true,
  "hooks": [
    {
      "on": "agent:created",
      "actions": [
        { "type": "shell", "run": "echo 'New agent: ${agent.name}'" },
        { "type": "agent", "target": "qa-bot", "prompt": "Run smoke test for ${agent.name}" }
      ]
    },
    {
      "on": "cron:0 9 * * *",
      "actions": [
        { "type": "builtin", "action": "actant.healthcheck" }
      ]
    }
  ]
}
```

---

## Memory 组件规范（⚠️ 预定）

> **⚠️ 存储后端待讨论**：当前设计假设使用 LanceDB 作为向量存储后端，但该选型尚未最终确认。
> 实际开发前需评估：(1) LanceDB native 模块的跨平台兼容成本 (2) 是否有更轻量的替代方案
> (3) 是否先用 InMemoryStore 验证上层逻辑，再决定持久化方案。

### 包隔离原则

```
@agent-memory/core            → 零外部依赖，纯类型 + 接口 + InMemoryStore
@agent-memory/embedding       → 依赖: OpenAI SDK (optional), ONNX (optional peer)
@agent-memory/store-<backend> → 具体存储实现（LanceDB 或其他，待定）
@actant/memory                → 依赖: 上述包 + @actant/core (PluginHost)
```

### MemoryStore 接口三模式

| 方法 | 用途 | 返回 |
|------|------|------|
| `recall(query, options)` | 语义检索 | `RecallResult[]` (含 score) |
| `navigate(uri)` | URI 精确定位 | `MemoryRecord \| null` |
| `browse(prefix, options)` | 树状浏览 | `BrowseResult` |

### URI 安全规范

所有 `ac://` URI 必须经过校验:
- 只允许 `ac://` scheme
- 拒绝 `..`、`~`、绝对路径组件
- 查询使用参数化绑定，不拼接 URI

### materialize 降级

```
尝试注入记忆 (5s 超时)
  ├── 成功 → AGENTS.md 包含 "Instance Insights" section
  └── 超时/失败 → 跳过记忆注入，Agent 正常启动，记录 warn 日志
```

---

## 代码审查参考清单

### Plugin 实现审查

- [ ] `name` 是否全局唯一且稳定（不随重启改变）？
- [ ] `scope` 设置是否正确（actant vs instance）？
- [ ] runtime 插口：五阶段生命周期是否完整？
- [ ] tick() 是否有 try/catch 隔离和 running guard（PluginHost 已内置，自行实现时须遵守）？
- [ ] 是否通过 `ctx.config` 获取配置，而非硬编码或直接读文件？
- [ ] hooks 插口：事件命名是否遵循 `plugin:<name>:<event>` 命名空间？
- [ ] 是否存在 Plugin 间的直接调用（禁止）？
- [ ] domainContext 插口：是否考虑 `enabled === false` 的情况？
- [ ] 旧 PluginDefinition 是否通过 `adaptLegacyPlugin()` 适配，而非重复实现？

### 集成审查（Step 5 接线时）

- [ ] PluginHost 是否在 AppContext.init() 中创建并启动？
- [ ] `getContextProviders()` 是否注册到 SessionContextInjector？
- [ ] `getSubsystems()` 是否注册到 SubsystemRegistry？
- [ ] `getSources()` 是否通过 SourceManager.addSource() 注册？
- [ ] 新增 RPC 方法是否已更新 `api-contracts.md`？
- [ ] 是否添加了对应的单元测试（覆盖所有使用的插口）？
- [ ] 是否考虑了向后兼容性（无 Plugin 时行为不变）？
