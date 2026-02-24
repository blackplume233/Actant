# MVP Next — 组件管理 · 构造器 · 雇员调度 设计方案

> **状态**：设计稿 — 待评审
> **日期**：2026-02-21
> **范围**：Phase 3 后半段 + Phase 4 部分能力前置

---

## 一、动机

Phase 1–2 MVP 和 Phase 3 前半段（ACP Proxy）已完成。当前系统能力：
- 模板加载 → 实例创建 → workspace 物化 → 进程启动 → prompt 交互
- 领域组件（Skill / Prompt / MCP / Workflow）具备只读加载 + CLI list/show
- ACP Proxy 基础版完成

**缺失的关键能力：**

1. **组件管理不完整**：只有 list/show，缺乏 add/remove/update/import/export + Plugin（Cloud Code 插件）管理
2. **构造器缺失**：`ContextMaterializer` 只做简单文件写入，缺乏面向不同 Agent 后端的差异化构造（Cursor vs Claude Code vs 自定义后端的 workspace 结构不同）
3. **雇员型 Agent 未实现**：#37 描述了设计但未落地，需要 TaskQueue + InputRouter + Scheduler，且用户希望考虑 N8N 集成

---

## 二、设计概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Actant Daemon                          │
│                                                                 │
│  ┌─── Component Registry ──────────────────────────────────────┐│
│  │  SkillManager · PromptManager · PluginManager               ││
│  │  McpConfigManager · WorkflowManager                         ││
│  │  ← 统一 CRUD + import/export + 依赖检查                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                    │
│                            ▼                                    │
│  ┌─── Workspace Builder ───────────────────────────────────────┐│
│  │  BackendBuilder (Strategy Pattern)                          ││
│  │  ├── CursorBuilder    (.cursor/rules, .cursor/mcp.json)     ││
│  │  ├── ClaudeCodeBuilder(.claude/*, CLAUDE.md, settings)      ││
│  │  └── CustomBuilder    (plugin-defined)                      ││
│  │                                                              ││
│  │  Pipeline: resolve → validate → scaffold → materialize      ││
│  │           → inject-permissions → verify                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                    │
│                            ▼                                    │
│  ┌─── Employee Scheduler ──────────────────────────────────────┐│
│  │  InputRouter → TaskQueue → Dispatcher                       ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       ││
│  │  │Heartbeat │ │ Cron     │ │ Hook     │ │ Webhook  │       ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       ││
│  │                                                              ││
│  │  ┌── N8N Bridge (可选) ──────────────────────────────────┐  ││
│  │  │  N8N Webhook → InputRouter                            │  ││
│  │  │  Actant MCP → N8N (N8N 作为 MCP client 调用)      │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、模块 A — 统一组件管理体系

### A.1 目标

将 Skill、Prompt、Plugin（Cloud Code Plugin）纳入统一的组件管理框架，支持完整 CRUD + import/export。

### A.2 Plugin 概念定义

**Plugin** 在此上下文中指 **Cloud Code Plugin**——即安装到 Agent workspace 中用于扩展 Agent 能力的插件包。不同于 Actant 自身的可插拔扩展（Phase 4 #13），这里的 Plugin 是 **Agent 侧的能力扩展**。

```
Plugin 类型对照：

Agent-side Plugin (本 Issue):
  - Cloud Code plugin（如 memory plugin、web-search plugin）
  - Cursor Extension（如 GitHub Copilot、ESLint）
  - Custom tool packages

Actant-side Plugin (#13 Phase 4):
  - HeartbeatMonitor、CronScheduler、MemoryLayer
  - 系统级可插拔扩展
```

### A.3 PluginDefinition Schema

```typescript
const PluginDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["claude-code", "cursor", "universal"]),
  
  // 安装方式
  install: z.discriminatedUnion("method", [
    z.object({
      method: z.literal("npm"),
      package: z.string(),
      version: z.string().optional(),
    }),
    z.object({
      method: z.literal("file"),
      path: z.string(),
    }),
    z.object({
      method: z.literal("config"),
      target: z.string(),     // 目标配置文件路径，如 ".claude/plugins.json"
      content: z.record(z.string(), z.unknown()),
    }),
  ]),

  // 此插件需要的权限（Claude Code tools 权限）
  permissions: z.array(z.string()).optional(),
  
  // 插件自身需要的环境变量
  env: z.record(z.string(), z.string()).optional(),
  
  // 兼容的后端类型
  compatibleBackends: z.array(z.enum(["claude-code", "cursor", "custom"])).optional(),
  
  tags: z.array(z.string()).optional(),
});
```

### A.4 增强 BaseComponentManager

```typescript
abstract class BaseComponentManager<T extends NamedComponent> {
  // 现有能力（保持）
  register(component: T): void;
  unregister(name: string): boolean;
  get(name: string): T | undefined;
  resolve(names: string[]): T[];
  list(): T[];
  loadFromDirectory(dirPath: string): Promise<number>;

  // 新增：CRUD
  async add(component: T, persist?: boolean): Promise<void>;     // register + 可选写磁盘
  async update(name: string, patch: Partial<T>): Promise<T>;     // 部分更新
  async remove(name: string, persist?: boolean): Promise<boolean>; // unregister + 可选删文件

  // 新增：Import / Export
  async importFromFile(filePath: string): Promise<T>;
  async importFromUrl(url: string): Promise<T>;                  // 从远程 URL 导入
  async exportToFile(name: string, filePath: string): Promise<void>;

  // 新增：搜索与过滤
  search(query: string): T[];                                    // 模糊搜索
  filter(predicate: (c: T) => boolean): T[];                    // 条件过滤

  // 新增：持久化目录
  protected persistDir?: string;                                  // 持久化目录
  async setPersistDir(dir: string): Promise<void>;
}
```

### A.5 CLI 命令扩展

```
# Skill 管理
actant skill list                    # 现有
actant skill show <name>             # 现有
actant skill add <file|url>          # 新增：导入 skill
actant skill create                  # 新增：交互式创建
actant skill remove <name>           # 新增：删除
actant skill export <name> [--out]   # 新增：导出

# Prompt 管理
actant prompt list                   # 现有
actant prompt show <name>            # 现有
actant prompt add <file|url>         # 新增
actant prompt create                 # 新增
actant prompt remove <name>          # 新增
actant prompt export <name> [--out]  # 新增

# Plugin 管理（新增）
actant plugin list                   # 列出所有已注册插件
actant plugin show <name>            # 查看插件详情
actant plugin add <file|url>         # 导入插件定义
actant plugin create                 # 交互式创建
actant plugin remove <name>          # 删除
actant plugin install <name> <agent> # 安装到指定 agent workspace
```

### A.6 RPC 方法扩展

```
# 通用模式: domain.<type>.<action>
domain.skill.add     { definition: SkillDefinition }        → { ok: true }
domain.skill.update  { name: string, patch: Partial }       → { component: SkillDefinition }
domain.skill.remove  { name: string }                       → { ok: true }
domain.skill.import  { source: string }                     → { component: SkillDefinition }

domain.prompt.add    { definition: PromptDefinition }       → { ok: true }
domain.prompt.update { name: string, patch: Partial }       → { component: PromptDefinition }
domain.prompt.remove { name: string }                       → { ok: true }

domain.plugin.list   {}                                     → { plugins: PluginDefinition[] }
domain.plugin.show   { name: string }                       → { plugin: PluginDefinition }
domain.plugin.add    { definition: PluginDefinition }       → { ok: true }
domain.plugin.remove { name: string }                       → { ok: true }
domain.plugin.install { pluginName: string, agentName: string } → { ok: true }
```

### A.7 实现计划

| 步骤 | 内容 | 预计复杂度 |
|------|------|-----------|
| 1 | 增强 `BaseComponentManager`：add/update/remove/import/export/search | 中 |
| 2 | 创建 `PluginManager` + `PluginDefinition` schema | 中 |
| 3 | 扩展 CLI 命令：skill/prompt CRUD + plugin 全套 | 中 |
| 4 | 扩展 RPC handlers | 低 |
| 5 | configs/plugins/ 目录 + 示例插件定义 | 低 |
| 6 | 集成测试 | 低 |

---

## 四、模块 B — Workspace 构造器 (Builder)

### B.1 问题分析

当前 `ContextMaterializer` 的限制：
1. **路径硬编码**：`AGENTS.md`、`prompts/system.md` 等路径是写死的，但不同后端有不同惯例
2. **无验证**：写完文件不验证结构完整性
3. **无 scaffold**：不创建项目骨架（如 `.gitignore`、`package.json` 等），只写 domain context 文件
4. **单一模式**：不区分首次创建 vs 增量更新

### B.2 设计方案：Strategy-based WorkspaceBuilder

```typescript
/**
 * WorkspaceBuilder orchestrates the full workspace construction pipeline.
 * BackendBuilder implements backend-specific file layout.
 */
interface BackendBuilder {
  readonly backendType: AgentBackendType;

  /** 创建初始目录结构（骨架） */
  scaffold(workspaceDir: string, meta: AgentInstanceMeta): Promise<void>;

  /** 物化 skills → 后端特定路径 */
  materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void>;

  /** 物化 prompts → 后端特定路径 */
  materializePrompts(workspaceDir: string, prompts: PromptDefinition[]): Promise<void>;

  /** 物化 MCP 配置 → 后端特定路径 */
  materializeMcpConfig(workspaceDir: string, servers: McpServerRef[]): Promise<void>;

  /** 物化 plugins → 后端特定路径 */
  materializePlugins(workspaceDir: string, plugins: PluginDefinition[]): Promise<void>;

  /** 注入权限配置 */
  injectPermissions(workspaceDir: string, permissions: PermissionSet): Promise<void>;

  /** 物化 workflow → 后端特定路径 */
  materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void>;

  /** 验证 workspace 完整性 */
  verify(workspaceDir: string): Promise<VerifyResult>;
}
```

### B.3 各后端 Builder 差异

```
CursorBuilder:
  scaffold:
    .cursor/rules/           → skill files (each skill = one .mdc file)
    .cursor/mcp.json         → MCP 配置
    .cursor/extensions.json  → 推荐扩展（plugins）
    AGENTS.md                → 聚合 skill 概述
    prompts/system.md        → system prompt
    .gitignore
    .actant.json         → 实例元数据

ClaudeCodeBuilder:
  scaffold:
    .claude/                 → Claude Code 配置目录
    .claude/mcp.json         → MCP 配置
    .claude/settings.local.json → 权限设置
    .claude/plugins.json     → Cloud Code plugins
    CLAUDE.md                → Claude Code 主指令文件（= skills + prompts 聚合）
    AGENTS.md                → Agent Skills 声明
    prompts/system.md        → system prompt
    .gitignore
    .actant.json

CustomBuilder:
  通过 template.backend.config.builderConfig 自定义：
    {
      "skillsPath": "docs/skills/",
      "promptsPath": "config/prompts/",
      "mcpPath": ".config/mcp.json",
      "scaffoldFiles": { ".editorconfig": "...", "README.md": "..." }
    }
```

### B.4 构建 Pipeline

```
WorkspaceBuilder.build(template, overrides):
  1. resolve    → 解析 template 引用的所有组件
  2. validate   → 检查组件兼容性（如 cursor plugin 不能用于 claude-code 后端）
  3. scaffold   → 创建目录结构 + 骨架文件
  4. materialize → 逐项物化 domain context
  5. inject     → 注入权限、环境变量、后端特定配置
  6. verify     → 检查文件完整性
  
  返回 BuildResult { workspaceDir, filesCreated, warnings }
```

### B.5 WorkspaceBuilder 类设计

```typescript
class WorkspaceBuilder {
  private builders = new Map<AgentBackendType, BackendBuilder>();

  constructor(
    private readonly managers: DomainManagers,
    private readonly baseDir: string,
  ) {
    this.builders.set("cursor", new CursorBuilder());
    this.builders.set("claude-code", new ClaudeCodeBuilder());
    this.builders.set("custom", new CustomBuilder());
  }

  registerBuilder(type: AgentBackendType, builder: BackendBuilder): void {
    this.builders.set(type, builder);
  }

  async build(
    instanceName: string,
    template: AgentTemplateOutput,
    overrides?: BuildOverrides,
  ): Promise<BuildResult> {
    const builder = this.builders.get(template.backend.type);
    if (!builder) throw new Error(`No builder for backend: ${template.backend.type}`);

    const workspaceDir = join(this.baseDir, instanceName);

    // 1. Resolve all components
    const resolved = await this.resolveComponents(template.domainContext);

    // 2. Validate compatibility
    const warnings = this.validateCompatibility(resolved, template.backend.type);

    // 3. Scaffold
    await builder.scaffold(workspaceDir, { name: instanceName, ...template });

    // 4. Materialize
    await builder.materializeSkills(workspaceDir, resolved.skills);
    await builder.materializePrompts(workspaceDir, resolved.prompts);
    await builder.materializeMcpConfig(workspaceDir, resolved.mcpServers);
    await builder.materializePlugins(workspaceDir, resolved.plugins ?? []);
    if (resolved.workflow) {
      await builder.materializeWorkflow(workspaceDir, resolved.workflow);
    }

    // 5. Inject permissions
    await builder.injectPermissions(workspaceDir, this.computePermissions(resolved));

    // 6. Verify
    const verifyResult = await builder.verify(workspaceDir);

    return { workspaceDir, verifyResult, warnings };
  }
}
```

### B.6 与现有 ContextMaterializer 的关系

`ContextMaterializer` 将被 `WorkspaceBuilder` + `BackendBuilder` 取代：

```
Phase 1:
  - 新建 WorkspaceBuilder + CursorBuilder + ClaudeCodeBuilder
  - AgentInitializer 中增加 WorkspaceBuilder 注入
  - ContextMaterializer 标记 @deprecated

Phase 2:
  - 迁移所有调用方到 WorkspaceBuilder
  - 删除 ContextMaterializer
```

### B.7 实现计划

| 步骤 | 内容 | 预计复杂度 |
|------|------|-----------|
| 1 | 定义 `BackendBuilder` 接口 + `BuildResult` 类型 | 低 |
| 2 | 实现 `CursorBuilder` | 中 |
| 3 | 实现 `ClaudeCodeBuilder` | 中 |
| 4 | 实现 `WorkspaceBuilder` 编排层 | 中 |
| 5 | 迁移 `AgentInitializer` 使用新 Builder | 中 |
| 6 | `CustomBuilder` + 可配置路径 | 低 |
| 7 | 集成测试 + E2E 测试更新 | 中 |

---

## 五、模块 C — 雇员型 Agent + 调度器 + N8N 集成

### C.1 设计原则

- **内置简单调度器**：Heartbeat + Cron + Hook 由 Actant 内置，零依赖
- **N8N 作为可选增强**：复杂调度 / 外部事件编排交给 N8N，通过 Webhook + MCP 双向集成
- **渐进式**：先实现内置调度器，再接入 N8N

### C.2 内置调度器架构

```
┌──────────────────────────────────────────────────────────────┐
│ EmployeeScheduler                                            │
│                                                              │
│  ┌── InputRouter ─────────────────────────────────────────┐  │
│  │  register(source: InputSource): void                    │  │
│  │  unregister(sourceId: string): void                    │  │
│  │  onTask → enqueue to TaskQueue                         │  │
│  └──────────────┬────────────────────────────────────────┘  │
│                 │                                            │
│    ┌────────────┼──────────────┬──────────────┐             │
│    ▼            ▼              ▼              ▼             │
│  ┌─────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐        │
│  │Heart│  │  Cron   │  │  Hook   │  │  Webhook │        │
│  │beat │  │Scheduler│  │ Emitter │  │ Receiver │        │
│  └─────┘  └─────────┘  └──────────┘  └───────────┘        │
│                 │                                            │
│                 ▼                                            │
│  ┌── TaskQueue ─────────────────────────────────────────┐  │
│  │  enqueue(task: AgentTask): void                       │  │
│  │  serial per agent, priority-sorted                    │  │
│  └──────────────┬────────────────────────────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌── TaskDispatcher ────────────────────────────────────┐  │
│  │  dispatch(agentName, task) → AcpConnection.prompt()   │  │
│  │  collect response → ExecutionLog                      │  │
│  │  emit Hook("task:completed" | "task:failed")          │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### C.3 核心接口

```typescript
/** 输入源抽象 */
interface InputSource {
  readonly id: string;
  readonly type: "heartbeat" | "cron" | "hook" | "webhook" | "n8n";
  start(): void;
  stop(): void;
  onTask: (task: AgentTask) => void;  // callback
}

/** 任务 */
interface AgentTask {
  id: string;
  agentName: string;
  source: InputSource["type"];
  sourceId: string;
  prompt: string;
  priority: number;           // 0 = 最高
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/** 执行记录 */
interface ExecutionRecord {
  taskId: string;
  agentName: string;
  source: string;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  responseText?: string;
  durationMs?: number;
  error?: string;
}

/** 调度器配置（模板中 schedule 字段） */
interface ScheduleConfig {
  heartbeat?: {
    enabled: boolean;
    intervalMs: number;
    prompt: string;
    suppressNoAction?: boolean;
  };
  cron?: Array<{
    schedule: string;         // cron expression
    prompt: string;
    label?: string;
    timezone?: string;
  }>;
  hooks?: Array<{
    event: string;
    prompt: string;
  }>;
  webhooks?: Array<{
    path: string;
    secret?: string;
    promptTemplate: string;
  }>;
}
```

### C.4 N8N 集成方案

N8N 是一个流行的工作流自动化工具，有强大的调度和事件编排能力。与 Actant 有两种集成模式：

#### 模式 1：N8N → Actant (N8N 作为调度器)

N8N workflow 通过 Webhook 触发 Actant 的雇员 Agent：

```
N8N Workflow:
  Trigger (Cron/Webhook/Event)
    → HTTP Request Node
    → POST http://localhost:PORT/agents/{name}/webhook/n8n
    → body: { "prompt": "...", "metadata": {...} }
```

Actant 侧：
- `WebhookReceiver` 接收 N8N 的 HTTP 请求
- 路由到对应 Agent 的 TaskQueue
- Agent 执行 → 结果通过 callback URL 返回 N8N

```typescript
interface N8nWebhookPayload {
  prompt: string;
  callbackUrl?: string;       // N8N 的 webhook response URL
  executionId?: string;        // N8N execution ID for tracing
  metadata?: Record<string, unknown>;
}
```

#### 模式 2：Actant → N8N (Agent 使用 N8N 能力)

Agent 通过 MCP Server 调用 N8N 的 API：

```json
// configs/mcp/n8n.json
{
  "name": "n8n",
  "description": "N8N workflow automation integration",
  "command": "npx",
  "args": ["-y", "@actant/mcp-n8n"],
  "env": {
    "N8N_API_URL": "http://localhost:5678",
    "N8N_API_KEY": "${N8N_API_KEY}"
  }
}
```

MCP Tools exposed:
- `n8n_trigger_workflow` — 触发 N8N workflow
- `n8n_list_workflows` — 列出可用 workflow
- `n8n_get_execution` — 查看执行结果

#### 模式 3：双向集成（推荐的最终形态）

```
                  ┌─────────────────────┐
                  │        N8N          │
                  │  (调度 + 编排中心)    │
                  └──────┬──────────────┘
                         │
          ┌──────────────┼──────────────┐
          │ Webhook       │ MCP Client   │
          ▼              ▼              │
  ┌───────────────────────────────┐     │
  │     Actant Daemon         │     │
  │  WebhookReceiver ←─── N8N    │     │
  │  MCP Server     ───→ N8N     │◄────┘
  │                               │
  │  Employee Agent A ←→ N8N     │
  │  Employee Agent B ←→ N8N     │
  └───────────────────────────────┘

N8N 侧：
  - Cron Trigger → webhook Actant → Agent 执行任务
  - GitHub Trigger → webhook Actant → Agent code review
  - Agent 完成 → callback → N8N 继续后续流程（通知 Slack 等）

Actant 侧：
  - 简单的 Heartbeat/Hook 内置处理
  - 复杂调度委托 N8N（通过 MCP 或 Webhook）
```

### C.5 为什么不完全依赖 N8N？

| 考量 | 内置调度器 | N8N |
|------|-----------|-----|
| 部署复杂度 | 零依赖，开箱即用 | 需要单独部署 N8N |
| Heartbeat | 需要与 Agent 紧耦合 | 不适合高频心跳 |
| Hook（内部事件） | 直接访问 AgentManager 状态 | 需要额外的事件桥接 |
| 复杂编排 | 不擅长 | 核心能力 |
| 外部系统集成 | 需要自己写 | 丰富的 Node 生态 |
| 可视化编排 | 无 | 完整 UI |

**结论**：Heartbeat + Hook + 简单 Cron 内置，复杂 Cron + 外部事件 + 工作流编排推荐 N8N。

### C.6 模板配置扩展

```typescript
// template-schema.ts 扩展
const ScheduleConfigSchema = z.object({
  heartbeat: z.object({
    enabled: z.boolean().default(false),
    intervalMs: z.number().min(10000).default(1800000),
    prompt: z.string(),
    suppressNoAction: z.boolean().default(true),
  }).optional(),

  cron: z.array(z.object({
    schedule: z.string(),
    prompt: z.string(),
    label: z.string().optional(),
    timezone: z.string().optional(),
  })).optional(),

  hooks: z.array(z.object({
    event: z.enum([
      "agent:started", "agent:recovered",
      "task:completed", "task:failed",
      "agent:idle",
    ]),
    prompt: z.string(),
  })).optional(),

  webhooks: z.array(z.object({
    path: z.string(),
    secret: z.string().optional(),
    promptTemplate: z.string(),
  })).optional(),

  // N8N 集成配置
  n8n: z.object({
    enabled: z.boolean().default(false),
    apiUrl: z.string().optional(),
    callbackUrl: z.string().optional(),
  }).optional(),
}).optional();

// 加入 AgentTemplateSchema
const AgentTemplateSchema = z.object({
  // ... 现有字段
  schedule: ScheduleConfigSchema,
  // domainContext 扩展 plugins
  domainContext: DomainContextSchema.extend({
    plugins: z.array(z.string()).optional().default([]),
  }),
});
```

### C.7 CLI 命令

```bash
# 雇员管理
actant agent dispatch <name> "<prompt>"   # 手动派发任务
actant agent tasks <name>                 # 查看任务队列
actant agent logs <name>                  # 查看执行日志
actant agent watch <name>                 # 实时观察输出

# 调度管理
actant schedule list <name>               # 查看 agent 的调度配置
actant schedule pause <name>              # 暂停调度
actant schedule resume <name>             # 恢复调度
```

### C.8 实现分阶段

#### 阶段 1：TaskQueue + Dispatcher 基础（#37 Phase 1）

```
packages/core/src/scheduler/
  ├── task-queue.ts           # 串行优先级队列
  ├── task-dispatcher.ts      # 任务派发（调用 AcpConnection）
  ├── execution-log.ts        # 执行记录（内存 + 文件持久化）
  └── index.ts
```

- TaskQueue：per-agent 串行队列，priority-sorted
- TaskDispatcher：dequeue → promptAgent → record
- AgentManager 集成：`startAgent` 时如果 launchMode=acp-service 且有 schedule，启动 dispatcher
- CLI：`agent dispatch` 手动派发

#### 阶段 2：InputRouter + 内置 Input Sources（#37 Phase 2）

```
packages/core/src/scheduler/inputs/
  ├── input-source.ts         # InputSource 接口
  ├── input-router.ts         # 路由器
  ├── heartbeat-input.ts      # 定时心跳
  ├── cron-input.ts           # Cron 调度（使用 node-cron 或 croner）
  ├── hook-input.ts           # 内部事件 hook
  └── index.ts
```

- InputRouter：管理所有 InputSource，统一分发到 TaskQueue
- HeartbeatInput：setInterval，可配置间隔
- CronInput：cron 表达式解析，使用 `croner` 库（零依赖、ESM、时区支持）
- HookInput：EventEmitter 模式，AgentManager 在关键生命周期点 emit

#### 阶段 3：Webhook + N8N Bridge（#37 Phase 3）

```
packages/api/src/http/
  └── webhook-handler.ts      # HTTP webhook 接收

packages/core/src/scheduler/inputs/
  ├── webhook-input.ts        # Webhook → TaskQueue
  └── n8n-bridge.ts           # N8N 专用适配（解析 N8N payload + callback）
```

- WebhookReceiver：Hono HTTP 路由，HMAC 验证
- N8N Bridge：解析 N8N 特定 payload，执行完成后 callback
- `agent watch` / `agent logs` CLI

---

## 六、依赖关系与优先级

```
#38 组件管理增强
 │  (PluginManager, CRUD, import/export)
 │
 ├──→ #39 Workspace Builder
 │     (BackendBuilder strategy, scaffold + materialize pipeline)
 │     依赖 #38 提供 PluginManager 用于 plugin 物化
 │
 └──→ #40 雇员型 Agent + 调度器
       (TaskQueue, InputRouter, Dispatcher)
       依赖 #37 的设计，但独立于 #38/#39
       N8N 集成为可选增强
```

**推荐实现顺序：**

1. **#38 组件管理增强** — 基础能力，其他模块依赖
2. **#39 Workspace Builder** — 重构构造流程，依赖 #38 的 PluginManager
3. **#40 雇员型 Agent** — 可与 #39 并行开发（调度器不依赖 Builder）

---

## 七、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| N8N 集成增加部署复杂度 | 用户门槛提高 | N8N 为可选，内置调度器满足基本需求 |
| Cron 库选型 | 时区/DST 处理 | 使用 `croner`（零依赖、ESM、时区原生支持） |
| Builder 重构影响现有测试 | 回归风险 | 增量迁移，ContextMaterializer 先 deprecate 再删除 |
| Plugin 生态初期内容少 | 用户感知价值低 | 内置 3-5 个常用插件定义（memory、web-search、github 等） |
| Webhook 安全性 | 未授权访问 | HMAC 签名验证 + 可选 API Key |

---

## 八、验收标准

### #38 组件管理增强
- [ ] Skill/Prompt 支持 add/update/remove + 持久化
- [ ] PluginManager 完整实现，支持 CRUD
- [ ] CLI 新增 skill/prompt/plugin 管理命令
- [ ] configs/plugins/ 至少 3 个示例插件定义
- [ ] 导入/导出功能可用

### #39 Workspace Builder
- [ ] CursorBuilder 正确生成 Cursor 项目结构
- [ ] ClaudeCodeBuilder 正确生成 Claude Code 项目结构（含 CLAUDE.md、plugins）
- [ ] CustomBuilder 支持配置化路径
- [ ] Pipeline 六步骤全部实现（resolve → validate → scaffold → materialize → inject → verify）
- [ ] 现有测试全部通过（兼容性）

### #40 雇员型 Agent + 调度器
- [ ] TaskQueue 串行执行 + 优先级
- [ ] Heartbeat 定时触发
- [ ] Cron 按表达式触发
- [ ] Hook 在内部事件时触发
- [ ] agent dispatch / agent logs / agent tasks CLI 命令
- [ ] Webhook 接收 + HMAC 验证
- [ ] N8N Bridge 可选集成（Webhook → Agent → Callback）
- [ ] 模板支持 schedule 配置字段
