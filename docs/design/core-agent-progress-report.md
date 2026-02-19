# AgentCraft Core Agent 配置系统 — 完成度报告

> 截至 2026-02-19，Phase 0-7 全部完成，M1-M4 四个里程碑已达成。

---

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        @agentcraft/core                         │
│                                                                 │
│  ┌──────────┐  ┌───────────┐  ┌─────────┐  ┌────────────────┐  │
│  │ template/ │→│initializer/│→│ manager/ │  │    domain/     │  │
│  │          │  │           │  │         │  │                │  │
│  │ schema   │  │ context-  │  │ agent-  │  │ skill-manager  │  │
│  │ loader   │  │ material- │  │ manager │  │ prompt-manager │  │
│  │ registry │  │ izer      │  │ launcher│  │ mcp-manager    │  │
│  └──────────┘  └───────────┘  └─────────┘  │ workflow-mgr   │  │
│        ↑              ↑                     └───────┬────────┘  │
│        │              └─────────────────────────────┘           │
│  ┌─────────┐                                                    │
│  │ state/  │  instance-meta-io (读写 .agentcraft.json)          │
│  └─────────┘                                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│                       @agentcraft/shared                        │
│                                                                 │
│  types/          errors/              logger/                   │
│  ├ agent.types   ├ base-error         └ pino logger factory     │
│  ├ template.types├ config-errors                                │
│  ├ domain-context├ lifecycle-errors                              │
│  └ domain-component                                             │
└─────────────────────────────────────────────────────────────────┘
```

**核心理念**：Agent Instance = 一个工作目录。模板定义 Agent 的 DNA，Initializer 将 DNA 物化为文件系统上的工作目录，Manager 管理这些工作目录的生命周期。

---

## 二、数据流全链路

```
                    用户定义
                       │
         ┌─────────────▼─────────────┐
         │   Agent Template (JSON)    │  名称引用：skills, prompts, workflow
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │    TemplateLoader          │  从文件/字符串/目录加载
         │    + Zod Schema 验证       │  验证结构 + 类型安全
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   TemplateRegistry         │  注册、查询、CRUD
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   AgentInitializer         │
         │     │                      │
         │     ├→ ContextMaterializer │  ← DomainManagers (可选)
         │     │    │                 │
         │     │    ├→ SkillManager.resolve()  → AGENTS.md
         │     │    ├→ PromptManager.resolve() → prompts/system.md
         │     │    ├→ WorkflowManager.resolve()→ .trellis/workflow.md
         │     │    └→ MCP configs (inline)    → .cursor/mcp.json
         │     │                      │
         │     └→ writeInstanceMeta() │  → .agentcraft.json
         └─────────────┬─────────────┘
                       │
              Instance 工作目录:
              my-agent/
              ├── .agentcraft.json     ← 元数据
              ├── AGENTS.md            ← 物化的 Skills
              ├── .cursor/mcp.json     ← 物化的 MCP 配置
              ├── .trellis/workflow.md  ← 物化的 Workflow
              └── prompts/system.md    ← 物化的 Prompts
                       │
         ┌─────────────▼─────────────┐
         │   AgentManager             │
         │     ├→ createAgent()       │  委托 Initializer
         │     ├→ startAgent()        │  委托 Launcher → status: running
         │     ├→ stopAgent()         │  终止进程 → status: stopped
         │     ├→ destroyAgent()      │  删除工作目录
         │     ├→ initialize()        │  重启恢复：扫描目录 + 修正遗留状态
         │     └→ listAgents()        │  内存缓存查询
         └────────────────────────────┘
```

---

## 三、各模块详细说明

### 3.1 `@agentcraft/shared` — 共享基础设施

#### 类型体系

| 类型 | 文件 | 说明 |
|------|------|------|
| `AgentInstanceMeta` | `agent.types.ts` | Instance 元数据：id, name, status, launchMode, pid 等 |
| `AgentStatus` | `agent.types.ts` | 6 种状态: created/starting/running/stopping/stopped/error |
| `LaunchMode` | `agent.types.ts` | 4 种模式: direct/acp-background/acp-service/one-shot |
| `AgentTemplate` | `template.types.ts` | 模板定义：backend, provider, domainContext, initializer |
| `DomainContextConfig` | `domain-context.types.ts` | 引用配置：skills[], prompts[], mcpServers[], workflow, subAgents[] |
| `McpServerRef` | `domain-context.types.ts` | MCP Server 内联配置：name, command, args, env |
| `SkillDefinition` | `domain-component.types.ts` | 技能定义：name, content, tags |
| `PromptDefinition` | `domain-component.types.ts` | 提示词定义：name, content, variables |
| `WorkflowDefinition` | `domain-component.types.ts` | 工作流定义：name, content |
| `McpServerDefinition` | `domain-component.types.ts` | MCP 服务器定义（注册表形式） |

#### 错误层级

```
AgentCraftError (abstract base)
├── configuration 类
│   ├── ConfigNotFoundError       — 配置文件不存在
│   ├── ConfigValidationError     — Schema 验证失败 (带 validationErrors[])
│   ├── TemplateNotFoundError     — 模板名未在 Registry 中找到
│   ├── SkillReferenceError       — Skill 引用解析失败
│   ├── ComponentReferenceError   — 通用组件引用解析失败 (带 componentType)
│   └── CircularReferenceError    — 循环引用检测 (预留)
└── lifecycle 类
    ├── AgentLaunchError          — 启动失败
    ├── AgentNotFoundError        — 实例不存在
    ├── AgentAlreadyRunningError  — 重复启动
    ├── InstanceCorruptedError    — .agentcraft.json 损坏
    └── WorkspaceInitError        — 工作目录初始化失败
```

#### Logger

`createLogger(module)` — 基于 pino 的结构化日志工厂，JSON 格式输出，支持 `LOG_LEVEL` 环境变量。

---

### 3.2 `@agentcraft/core` — 核心业务逻辑

#### 3.2.1 template/schema — Zod Schema 验证

```
AgentTemplateSchema
├── name: string (1-100 字符)
├── version: string (semver 格式)
├── description?: string
├── backend: { type: "cursor"|"claude-code"|"custom", config? }
├── provider: { type: "anthropic"|"openai"|"custom", config? }
├── domainContext: DomainContextSchema
│   ├── skills?: string[] (默认 [])
│   ├── prompts?: string[] (默认 [])
│   ├── mcpServers?: McpServerRefSchema[] (默认 [])
│   ├── workflow?: string
│   └── subAgents?: string[] (默认 [])
├── initializer?: { steps: [{ type, config? }] }
└── metadata?: Record<string, string>
```

**关键设计**：`z.infer<typeof AgentTemplateSchema>` 与 `shared/AgentTemplate` 接口严格对齐，通过 type-alignment 测试保证。

#### 3.2.2 template/loader — 模板加载器

`TemplateLoader` 三个入口：

| 方法 | 输入 | 输出 | 错误 |
|------|------|------|------|
| `loadFromFile(path)` | 文件路径 | `AgentTemplate` | ConfigNotFoundError / ConfigValidationError |
| `loadFromString(json)` | JSON 字符串 | `AgentTemplate` | ConfigValidationError |
| `loadFromDirectory(dir)` | 目录路径 | `AgentTemplate[]` | ConfigNotFoundError (无效文件被静默跳过) |

内部流程：`readFile → JSON.parse → AgentTemplateSchema.safeParse → toAgentTemplate()`

#### 3.2.3 template/registry — 模板注册表

`TemplateRegistry` 接口：

| 方法 | 说明 |
|------|------|
| `register(template)` | 注册（默认拒绝重复，可配 allowOverwrite） |
| `unregister(name)` | 注销 |
| `get(name)` / `getOrThrow(name)` | 查询（后者抛 TemplateNotFoundError） |
| `has(name)` / `list()` / `size` | 检查/列表/计数 |
| `loadBuiltins(configDir)` | 从目录批量加载内置模板 |
| `clear()` | 清空 |

#### 3.2.4 state/ — Instance 元数据 I/O

| 函数 | 说明 |
|------|------|
| `readInstanceMeta(dir)` | 读取 `.agentcraft.json`，Zod 验证 |
| `writeInstanceMeta(dir, meta)` | 原子写入（write-tmp + rename） |
| `updateInstanceMeta(dir, patch)` | 部分更新（read → merge → write） |
| `scanInstances(baseDir)` | 扫描所有子目录，返回 `{ valid, corrupted }` |

`AgentInstanceMetaSchema` — 独立的 Zod schema，用于运行时验证 `.agentcraft.json` 内容。

#### 3.2.5 initializer/ — Instance 创建

**`AgentInitializer`**：

| 方法 | 行为 |
|------|------|
| `createInstance(name, tplName, overrides?)` | 创建新目录 + 物化 + 写元数据 |
| `findOrCreateInstance(name, tplName, overrides?)` | 幂等操作：存在则返回，不存在则创建 |
| `destroyInstance(name)` | 删除整个工作目录 |

**`ContextMaterializer`**（双模式设计）：

- **无 DomainManagers**：写入占位内容（名称列表）— 适用于快速原型 / 测试
- **有 DomainManagers**：通过 Manager 解析名称 → 渲染真实内容 — 生产模式

物化规则：

| Domain 组件 | 目标文件 | 解析方式 |
|------------|---------|---------|
| skills[] | `AGENTS.md` | SkillManager.resolve() → renderSkills() |
| prompts[] | `prompts/system.md` | PromptManager.resolve() → renderPrompts() |
| workflow | `.trellis/workflow.md` | WorkflowManager.resolve() → renderWorkflow() |
| mcpServers[] | `.cursor/mcp.json` | 直接从 Template 内联配置物化（不经 Manager） |
| subAgents[] | 不物化 | 记录在 `.agentcraft.json` 中，运行时解析 |

#### 3.2.6 manager/ — 生命周期管理

**`AgentManager`** 状态机：

```
createAgent()        → status: created
                            │
startAgent()         → status: starting → [Launcher.launch()] → status: running
                                                                      │
stopAgent()          → status: stopping → [Launcher.terminate()] → status: stopped
                                                                      │
destroyAgent()       → 删除工作目录 + 从缓存移除                        │
                                                                      │
initialize()（重启恢复）:  running/starting/stopping → 强制修正为 stopped
                          corrupted directories → 移至 .corrupted/
```

**`AgentLauncher`** 接口（策略模式）：

```typescript
interface AgentLauncher {
  launch(workspaceDir, meta): Promise<AgentProcess>
  terminate(process): Promise<void>
}
```

当前实现：`MockLauncher`（返回假 PID，用于测试）。真实 Launcher（Cursor/Claude Code 进程管理）留待后续迭代。

**核心设计决策**：
- 不维护独立数据库 — 扫描目录即可恢复所有状态
- 内存缓存 `Map<name, meta>` 作为单一查询点
- 原子写入 `.agentcraft.json` 防止状态数据竞争

#### 3.2.7 domain/ — Domain Context 组件管理器

**`BaseComponentManager<T>`** 泛型基类：

```typescript
abstract class BaseComponentManager<T extends { name: string }> {
  register(component: T): void
  unregister(name: string): boolean
  get(name: string): T | undefined
  has(name: string): boolean
  resolve(names: string[]): T[]              // 批量解析，任一缺失则抛错
  list(): T[]
  loadFromDirectory(dirPath: string): Promise<number>  // 从 JSON 文件批量加载
  protected abstract validate(data, source): T         // 子类实现 Zod 验证
}
```

4 个具体 Manager：

| Manager | 额外能力 | Zod Schema |
|---------|---------|------------|
| `SkillManager` | `renderSkills()` → AGENTS.md 格式 | name, content, description?, tags? |
| `PromptManager` | `renderPrompt()` 变量插值 `{{var}}`，`renderPrompts()` 合并 | name, content, description?, variables? |
| `McpConfigManager` | `renderMcpConfig()` → `.cursor/mcp.json` 格式 | name, command, args?, env?, description? |
| `WorkflowManager` | `renderWorkflow()` → 工作流内容 | name, content, description? |

---

## 四、测试用例清单

**共 15 个测试文件，161 个测试用例，全部通过。**

### `@agentcraft/shared` (13 tests)

| 文件 | 数量 | 覆盖点 |
|------|------|--------|
| `errors.test.ts` | 11 | 各错误类实例化、code/category 正确、继承链、context 传递 |
| `logger.test.ts` | 2 | Logger 创建、模块名设置 |

### `@agentcraft/core` — template (58 tests)

| 文件 | 数量 | 覆盖点 |
|------|------|--------|
| `template-schema.test.ts` | 21 | 有效模板验证、必填字段缺失、类型错误、边界值(空字符串/超长名称)、semver 格式、嵌套 schema 验证、默认值应用 |
| `type-alignment.test.ts` | 6 | `z.infer` 输出类型与 shared 接口的结构对齐验证 |
| `template-loader.test.ts` | 13 | loadFromFile(有效/最小/复杂模板)、不存在文件、非JSON、缺失字段、无效版本、loadFromString(正常/无效JSON/无效模板)、loadFromDirectory(批量加载/跳过无效/不存在目录) |
| `template-registry.test.ts` | 18 | register(正常/重复拒绝/allowOverwrite/多模板)、unregister、get/getOrThrow、has、list、clear、loadBuiltins(正常/跳过重复)、register+unregister+re-register 组合 |

### `@agentcraft/core` — state (11 tests)

| 文件 | 数量 | 覆盖点 |
|------|------|--------|
| `instance-meta-io.test.ts` | 11 | write+read 往返、JSON 内容验证、可选字段、缺失文件→错误、无效JSON→错误、无效Schema→错误、部分更新、scan(有效+损坏/不存在/跳过dot/多实例) |

### `@agentcraft/core` — initializer (21 tests)

| 文件 | 数量 | 覆盖点 |
|------|------|--------|
| `context-materializer.test.ts` | 8 | 空context、skills→AGENTS.md、mcpServers→mcp.json(含env/不含env)、workflow、prompts、全组件同时、subAgents不物化 |
| `agent-initializer.test.ts` | 13 | createInstance(正常/物化验证/模板不存在/名称冲突/覆盖项)、findOrCreate(新建/已存在/损坏)、destroy(正常/不存在) |

### `@agentcraft/core` — manager (19 tests)

| 文件 | 数量 | 覆盖点 |
|------|------|--------|
| `agent-manager.test.ts` | 19 | create+query、list、lifecycle(start/stop/双重start/restart)、错误处理(未知agent)、getOrCreate(新/缓存)、destroy(正常/运行中)、重启恢复(stale running/starting/corrupted)、E2E全链路 |

### `@agentcraft/core` — domain (39 tests)

| 文件 | 数量 | 覆盖点 |
|------|------|--------|
| `skill-manager.test.ts` | 9 | CRUD、resolve失败、loadFromDirectory(正常/跳过无效/不存在)、renderSkills |
| `prompt-manager.test.ts` | 8 | CRUD、resolve失败、loadFromDirectory、变量插值、renderPrompts |
| `mcp-config-manager.test.ts` | 6 | CRUD、resolve失败、loadFromDirectory、renderMcpConfig |
| `workflow-manager.test.ts` | 7 | CRUD、resolve失败、loadFromDirectory、render、clear |
| `domain-context-resolver.test.ts` | 9 | 集成：有Manager真实解析、引用缺失→错误、无Manager降级、部分Manager混合模式 |

---

## 五、Roadmap 里程碑完成状态

| 里程碑 | 阶段 | 可验证能力 | 状态 |
|--------|------|-----------|------|
| **M1** | Phase 0-2 | Zod schema 验证 JSON 模板，40 个测试通过 | 已完成 |
| **M2** | Phase 3-4 | 从文件加载模板 → 注册到 Registry，CRUD 测试通过 | 已完成 |
| **M3** | Phase 5-6 | 从 Template 创建 Instance → 启动/停止/重启恢复 | 已完成 |
| **M4** | Phase 7 | Skill/Prompt/MCP/Workflow 引用解析 + 集成测试通过 | 已完成 |

**Phase 8 (CLI 集成)** 为独立 Roadmap，尚未开始。

---

## 六、源码文件清单

### 生产代码 (30 文件)

```
@agentcraft/shared (8 文件)
├── types/agent.types.ts              AgentInstanceMeta, AgentStatus, LaunchMode
├── types/template.types.ts           AgentTemplate, AgentBackendConfig, ModelProviderConfig
├── types/domain-context.types.ts     DomainContextConfig, McpServerRef
├── types/domain-component.types.ts   SkillDefinition, PromptDefinition, WorkflowDefinition, McpServerDefinition
├── errors/base-error.ts              AgentCraftError 抽象基类
├── errors/config-errors.ts           5 个配置类错误
├── errors/lifecycle-errors.ts        5 个生命周期类错误
└── logger/logger.ts                  pino Logger 工厂

@agentcraft/core (22 文件)
├── template/schema/template-schema.ts   Zod schema 定义
├── template/loader/template-loader.ts   JSON 加载 + 验证
├── template/registry/template-registry.ts  注册表 CRUD
├── state/instance-meta-schema.ts        AgentInstanceMeta Zod schema
├── state/instance-meta-io.ts            原子读写 + 扫描
├── initializer/agent-initializer.ts     Instance 创建/查找/销毁
├── initializer/context/context-materializer.ts  Domain Context 物化
├── manager/agent-manager.ts             生命周期管理
├── manager/launcher/agent-launcher.ts   Launcher 接口定义
├── manager/launcher/mock-launcher.ts    测试用 Mock
├── domain/base-component-manager.ts     泛型基类
├── domain/skill/skill-manager.ts        Skill 管理器
├── domain/prompt/prompt-manager.ts      Prompt 管理器
├── domain/mcp/mcp-config-manager.ts     MCP 配置管理器
├── domain/workflow/workflow-manager.ts   Workflow 管理器
└── (7 个 index.ts barrel exports)
```

### 测试代码 (15 文件, 161 tests)

### Fixture 文件 (15 个 JSON/txt)

```
template/loader/__fixtures__/   valid-template.json, minimal-template.json, complex-template.json,
                                invalid-missing-name.json, invalid-bad-version.json, not-json.txt
domain/skill/__fixtures__/      code-review.json, typescript-expert.json, invalid-skill.json
domain/prompt/__fixtures__/     system-reviewer.json, style-guide.json
domain/mcp/__fixtures__/        filesystem.json, database.json
domain/workflow/__fixtures__/   trellis-standard.json, minimal-workflow.json
```

---

## 七、关键设计决策

| # | 决策 | 理由 |
|---|------|------|
| 1 | **Instance = 工作目录** | Agent Backend (Cursor/Claude Code) 直接指向目录即可工作，无需额外配置 |
| 2 | **无独立数据库** | `.agentcraft.json` 作为唯一状态源，扫描目录即可恢复——简单且可靠 |
| 3 | **原子写入** (write-tmp + rename) | 防止进程崩溃导致 `.agentcraft.json` 部分写入 |
| 4 | **引用式组合** | Template 中 skills/prompts/workflow 按名称引用，不嵌入完整内容——支持复用和独立管理 |
| 5 | **ContextMaterializer 双模式** | 无 Manager 时降级为占位内容，有 Manager 时全量解析——渐进式集成 |
| 6 | **Launcher 策略接口** | 启动进程的逻辑与 Manager 解耦，当前用 Mock，未来可插入 Cursor/Claude Code 真实启动器 |
| 7 | **损坏目录自动隔离** | `.agentcraft.json` 损坏时移至 `.corrupted/` 而非删除——可恢复，不阻塞其他 Instance |
| 8 | **BaseComponentManager 泛型** | 4 个 Domain Manager 共享注册/解析/加载逻辑，避免重复代码，子类只需实现 `validate()` |

---

## 八、尚未实现 / 下一步

| 项 | 说明 |
|---|------|
| Phase 8: CLI 集成 | 将 core 能力暴露为 `agentcraft template list`、`agentcraft agent create` 等命令 |
| 真实 AgentLauncher | 实际启动 Cursor / Claude Code 进程的 Launcher 实现 |
| Employee 持久化 Agent | 心跳、崩溃重启、定时任务、IM 接入（作为 Manager 高级模式） |
| 变量插值集成 | Prompt 的 `{{variable}}` 在物化时按实例参数替换 |
| reinitialize 操作 | Template 更新后，重新物化已有 Instance 的 Domain Context 文件 |
| 循环引用检测 | SubAgent 引用链的环检测（CircularReferenceError 已预留） |
