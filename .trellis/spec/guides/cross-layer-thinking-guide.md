# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across Actant's layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

In Actant, there are more boundaries than a typical web app:

```
User ↔ CLI ↔ Core ↔ Agent Process ↔ Model Provider
                ↕           ↕
              API         ACP/MCP
                ↕           ↕
           Web UI    External Clients
                    (Unreal/Unity/IM)
```

Every arrow is a potential source of bugs.

---

## Actant Layer Map

| Layer | Responsibility | Communication |
|-------|---------------|---------------|
| **CLI** | User interaction, command parsing, output formatting | Calls Core directly (in-process) |
| **API** | HTTP interface for external access | Calls Core directly (in-process) |
| **Core** | Business logic, template resolution, lifecycle management | Manages Agent Processes |
| **ACP Server** | Protocol bridge for external Agent Clients | Translates ACP ↔ Core operations |
| **MCP Server** | Protocol bridge for agent-to-platform access | Translates MCP ↔ Core operations |
| **Agent Process** | Running agent instance | Communicates via ACP/MCP/stdin/stdout |
| **Config Files** | Persistent configuration source of truth | Read by Core at resolution time |
| **State Store** | Runtime state persistence | Read/written by Core Manager |

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves through Actant's specific layers:

```
Example: "User creates an agent from template"

User Input (CLI)
  → Command Parser (CLI)
    → CreateAgentCommand (Core)
      → Template Resolution (Core: resolve skill/mcp/workflow references)
        → Config File Read (Config Files)
      → Workspace Setup (Core: Initializer)
        → File System Write
      → Process Launch (Core: Manager)
        → Agent Process spawned
      → State Persist (State Store)
    → Output Formatter (CLI)
  → User sees result
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who validates the data?

### Step 2: Identify Actant-Specific Boundaries

| Boundary | Common Issues |
|----------|---------------|
| CLI ↔ Core | Argument types mismatch, missing validation |
| API ↔ Core | HTTP serialization, enum string values vs typed enums |
| Core ↔ Config Files | File not found, schema version mismatch, parse errors |
| Core ↔ State Store | Stale state, concurrent access, migration needed |
| Core ↔ Agent Process | Process crash, stdout parsing, signal handling |
| ACP Server ↔ Core | Protocol version mismatch, message format differences |
| MCP Server ↔ Core | Tool schema mismatch, permission errors |
| Agent Process ↔ Provider | Network timeout, rate limiting, model errors |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?
- Who is responsible for format conversion?

---

## Common Cross-Layer Mistakes in Actant

### Mistake 1: Config Reference Resolution Timing

**Bad**: Resolving skill references at template load time (stale references)

**Good**: Resolve references at agent creation time (fresh resolution)

**Why**: Skills and other Domain Context components may be updated after the template was loaded. Always resolve at the latest possible moment.

### Mistake 2: Agent Process State Assumptions

**Bad**: Assuming agent process is running because state store says "Running"

**Good**: Verify process is alive (PID check) before operations

**Why**: Agent processes can crash without notifying the manager. State store may be stale.

### Mistake 3: CLI ↔ API Output Mismatch

**Bad**: CLI command returns different data structure than equivalent API endpoint

**Good**: Both CLI and API call the same Core function and format the same result

**Why**: Scripts and CI tools may switch between CLI and API. Inconsistent output breaks automation.

### Mistake 4: ACP/MCP Schema Drift

**Bad**: Core changes data format without updating ACP/MCP protocol handlers

**Good**: Protocol handlers use shared type definitions from `packages/shared/types/`

**Why**: External clients depend on stable protocol schemas. Breaking changes cause silent failures.

### Mistake 5: Leaky Abstraction Across Modules

**Bad**: CLI command directly reads config files, bypassing Core

**Good**: CLI → Core (Template Module) → Config Files

**Why**: Core owns the business rules for config resolution (defaults, overrides, validation). Bypassing it creates inconsistencies.

---

## Actant Cross-Layer Checklist

### Before Implementation

- [ ] Mapped the complete data flow through all involved layers
- [ ] Identified all layer boundaries the feature crosses
- [ ] Defined data format at each boundary
- [ ] Decided where validation happens (validate once at entry point)
- [ ] Shared types defined in `packages/shared/types/`

### During Implementation

- [ ] CLI and API commands call the same Core function
- [ ] Config references resolved at the right time (creation, not load)
- [ ] Agent process state verified before operations
- [ ] Error handling at each boundary (see [Error Handling](../backend/error-handling.md))

### After Implementation

- [ ] Tested with edge cases (null, empty, invalid, not found)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip (CLI create → API read → CLI modify)
- [ ] ACP/MCP protocol schemas updated if data format changed

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Data format is complex (nested Domain Context)
- Feature involves agent-to-agent communication
- Feature has caused bugs before
- External protocol (ACP/MCP) is involved

Store flow docs in the relevant task directory:
```
.trellis/tasks/{task-name}/flow.md
```

---

## Layer Dependency Rules

```
CLI ──→ Core ←── API
           ↕
    ┌──────┼──────┐
    ↓      ↓      ↓
   ACP    MCP   State Store
   Server Server
    ↓      ↓
  External Agents/Clients
```

**Rules**:
1. CLI and API never depend on each other
2. ACP and MCP servers never depend on each other
3. All external-facing layers go through Core
4. Shared types live in `packages/shared/`
5. Config files are only read by Core (never by CLI, API, ACP, or MCP directly)

---

## Phase 4 跨层流程: Plugin / Hook / Memory

### 新增层: PluginHost 与 HookEventBus

Phase 4 引入了两个新的跨层组件:

```
CLI ──→ Core ←── API ←── Dashboard (HTTP + SSE)
           ↕
    ┌──────┼──────┐──────────┐
    ↓      ↓      ↓          ↓
   ACP    MCP   PluginHost  HookEventBus
   Server Server    ↕          ↕
    ↓      ↓    Plugin[n]  Workflow[n]
  External      ↕    ↕        ↕
  Clients   Memory Scheduler ActionRunner
```

### 关键跨层数据流

#### 流程 1: Plugin 初始化

```
Daemon 启动 / Agent 创建
  → Core 读取配置 (config-spec)
    → PluginHost 初始化 (actant scope)
      → 遍历 actant-level plugins
        → 各 Plugin.init(ctx) — ctx 含 logger/eventBus/dataDir/config
          → 失败: 标记 error + 跳过，不影响其他 Plugin
        → 各 Plugin.start(ctx)
      → PluginHost 进入 tick 循环
    → Agent 创建时: PluginHost 创建 instance scope
      → 遍历 instance-level plugins
        → 初始化流程同上，ctx.scope = 'instance'
```

**边界注意**:
- actant scope Plugin 的 init 在 Daemon 启动时，instance scope 在 Agent 创建时
- Plugin 获得的 PluginContext 是隔离的副本，不共享可变状态
- Plugin 的 dataDir 在 `ACTANT_HOME/plugins/<name>/` (actant) 或 `workspace/.actant/plugins/<name>/` (instance)

#### 流程 2: Hook 事件传播

```
事件源 (Agent 启动 / Cron / Plugin)
  → HookEventBus.emit(eventName, payload)
    → HookRegistry 匹配已注册 Workflow 的 hooks
      → 过滤: level 匹配 (actant vs instance)
      → 过滤: eventName 匹配 (支持 wildcard)
    → ActionRunner 执行匹配到的 actions
      → shell: 在 cwd 执行命令，注入 vars
      → builtin: 调用内置操作 (healthcheck, log, notify)
      → agent: 向目标 Agent dispatch prompt
```

**边界注意**:
- 事件名必须是 `HookEventName` 类型，编译期校验
- ActionRunner 的 shell action 在隔离的子进程中执行，不阻塞事件循环
- agent action 通过 RPC 分发，目标 Agent 可能不在运行中（需要容错）

#### 流程 3: Memory 与 Materialize 集成

```
Agent 启动 → Initializer
  → materialize domainContext (已有流程)
  → [Phase 5] materialize memory
    → MemoryPlugin.onMaterialize(ctx)
      → Instance Memory Store: recall('', { limit: 50 })
        → 可能触及外部存储后端（具体实现待定）
      → 格式化为 "Instance Insights" Markdown
      → 注入到 AGENTS.md
    → 超时 / 失败: 跳过 memory 注入，记录 warn，Agent 正常启动
```

**边界注意**:
- 存储后端（具体选型待定）可能涉及 native 模块的跨平台兼容性问题
- materialize 有 5s 超时，降级为无 memory 启动
- `AGENTS.md` 的 memory section 使用标记注释 (`<!-- MEMORY:START -->`)，幂等更新

#### 流程 4: EmailHub 跨 Agent 通信

```
Agent A (MCP Tool: email.send)
  → MCP Server → RPC → Core → EmailHub
    → 路由: 查找目标 Agent B 的 EmailInput
    → 持久化: 写入发件箱 + 收件箱
    → 通知: EmailInput.onMessage(email)
      → Scheduler.InputRouter 将消息转为 Task
        → TaskDispatcher 分发到 Agent B
```

**边界注意**:
- Email 持久化在 `ACTANT_HOME/email/` 目录，JSON 格式
- Agent 离线时消息入队列，上线后 Scheduler 自动投递
- EmailHub 不关心消息内容，仅负责路由和持久化

#### 流程 5: Dashboard SSE 数据流

```
浏览器 → HTTP GET /api/events → SSE 连接建立
  ← RPC Bridge 每 N 秒轮询:
    ← daemon.ping → 在线状态
    ← agent.list → Agent 列表
    ← agent.status → 各 Agent 详情
    ← schedule.list → 调度状态
    ← events.recent → 最近事件 [新 RPC]
    ← email.stats → 邮件统计 [新 RPC]
  ← SSE push: { type: "state-update", data: { ... } }
```

**边界注意**:
- Dashboard 是只读的，不通过 RPC 修改状态
- RPC Bridge 连接 Daemon 的 IPC Socket，SSE 推送到浏览器
- 断线重连: 浏览器 EventSource 自动重连，服务端保持无状态

### Phase 4 跨层检查清单

- [ ] 新增的跨层数据是否有明确的类型定义（在 `@actant/shared`）？
- [ ] Plugin ↔ Host 边界: Plugin 是否只通过 PluginContext API 交互？
- [ ] Event 边界: 事件 payload 是否可序列化（JSON-safe）？
- [ ] Memory 边界: recall/navigate/browse 结果是否有容量限制？
- [ ] Email 边界: 离线投递是否有重试和去重机制？
- [ ] Dashboard 边界: SSE 数据是否脱敏（不包含 API Key / prompt 内容）？
- [ ] 所有新增 RPC 方法是否已更新 `api-contracts.md`？
- [ ] 失败路径: 每个跨层调用是否有超时和降级策略？
