# Plugin 体系预定设计

> **⚠️ 预定设计 (Preliminary Design)**：本文档记录 Phase 4 Plugin / Hook / Scheduler / Memory 的设计草案。
> 所有内容均为**预定方案**，实际开发时须重新审查，确认后方可作为正式规范。
> 与已验证的 guideline（如 `quality-guidelines.md`）不同，本文档的内容可能在实施阶段发生重大调整。

---

## 核心原则（预定）

1. **三插口统一**: 一个 Plugin 可同时具备 domainContext / runtime / hooks 三种能力，按需声明
2. **双层作用域**: actant (全局单例) + instance (per-agent)，生命周期与 Daemon / Agent 对齐
3. **故障隔离**: 单个 Plugin 的异常不得影响其他 Plugin 或 Host 运行
4. **向后兼容**: 旧 `PluginDefinition` (Phase 3, Agent-side) 自动适配为纯 domainContext 插件
5. **零硬编码**: Plugin 不直接访问其他 Plugin 的内部状态，通过 PluginContext 提供的 API 交互

---

## Plugin 接口规范（预定）

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

## 三插口设计（预定）

### domainContext 插口

物化到 Agent workspace 的静态资源（Claude Code plugins、MCP servers、rules 文件等）。

| 属性 | 类型 | 说明 |
|------|------|------|
| `files` | `Record<string, string>` | 目标路径 → 内容 |
| `mcpServers` | `McpServerRef[]` | 额外 MCP Server 配置 |
| `rules` | `string[]` | 注入到 AGENTS.md 的规则 |

旧 `PluginDefinition` (Phase 3) 自动适配为纯 domainContext 插件:

```typescript
function adaptLegacyPlugin(def: PluginDefinition): ActantPlugin {
  return {
    name: def.name,
    version: def.version,
    scope: 'instance',
    domainContext: {
      files: buildFilesFromDef(def),
      mcpServers: def.mcpServers ?? [],
    },
  };
}
```

### runtime 插口

Daemon 运行时的有状态逻辑，遵循五阶段生命周期。

### hooks 插口

事件消费/生产。Plugin 可声明 `hooks: HookDeclaration[]`，PluginHost 自动注册到 HookEventBus。

---

## 禁止模式（预定）

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

## 调度器扩展规范 (InputSource)（预定）

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

## Hook 事件规范（预定）

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

## Memory 组件规范（预定）

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

## 代码审查参考清单（预定，待实施时确认）

以下为预定审查项，实际开发时按确认后的设计调整：

- [ ] Plugin 是否实现了完整的五阶段生命周期？
- [ ] tick() 是否有 try/catch 隔离和 running guard？
- [ ] 是否通过 PluginContext 获取配置，而非硬编码或直接读文件？
- [ ] 事件命名是否遵循 `<scope>:<noun>:<verb>` 规范？
- [ ] 新增 InputSource 是否实现了 start/stop/active 完整接口？
- [ ] Memory 操作是否使用参数化查询（防 URI 注入）？
- [ ] 是否存在 Plugin 间的直接调用（应通过 PluginContext）？
- [ ] 新增 RPC 方法是否已更新 `api-contracts.md`？
- [ ] 新增配置 schema 是否已更新 `config-spec.md`？
- [ ] 是否添加了对应的单元测试？
- [ ] 是否考虑了向后兼容性（无 Plugin / 无 Memory 时行为不变）？
