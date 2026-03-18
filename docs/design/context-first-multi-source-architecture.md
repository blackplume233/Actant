# Context-First Multi-Source Architecture

状态：Draft
范围：ContextManager 架构草案——以上下文组装为核心的平台架构
前置：[project-context-vfs-manager-design.md](./project-context-vfs-manager-design.md)
最后更新：2026-03-18
编码：UTF-8

## 摘要

本草案是 `project-context-vfs-manager-design.md` 的演进版本。

前一份草案建议从 `@actant/agent-runtime` 中抽出一个 bootstrap-first 的项目上下文管理器。本草案在此基础上做出一个更根本的变化：**将上下文管理从子功能提升为平台的核心抽象**，并将 Agent 服务降级为上下文的一种消费者和提供者。

核心变化可以用一句话概括：

> 当前 Actant = Agent 平台，上下文是为 Agent 准备的。
> 反转后 Actant = 上下文平台，Agent 是消费上下文的一种方式。

这个反转基于一个事实：LLM 的行为 100% 由 context window 决定。管理上下文就是管理 Agent 的一切。

Actant 的两层角色因此清晰分开：

1. **对外**：作为上下文仓库，通过 MCP/VFS 向 External Agent（Cursor、Claude Code 等）暴露可浏览的上下文资源和可调用的工具。**不替外部 Agent 做组装决定**——外部 Agent 自行决定读取哪些资源、调用哪些工具。
2. **对内**：创建 Internal Agent 时只固化最基本的规则（identity + rules + dispatcher），Agent 运行时和 External Agent 一样通过 VFS 动态获取其他上下文。Internal Agent 对外暴露为 **tool**。

## 与前一份草案的关系

前一份草案的以下部分被本草案**继承**：

- "输出可确定"设计原则
- "VFS 可检索"原则
- "Runtime 是消费者"原则
- 对 `@actant/agent-runtime` 职责范围过大的诊断
- 不一次性重写整个 Actant 的非目标

前一份草案的以下部分被本草案**替代**：

| 前一份草案 | 本草案 |
|-----------|-------|
| "Bootstrap-first" 作为架构名称 | "Context-First"——bootstrap 能力是 ContextManager 的属性，不是名字 |
| 单一 `ProjectContextSnapshot` 作为 source of truth | 多个 `ContextSource` 各自投影为 VFS 挂载 |
| `/project/...` 固定 VFS 路径作为首选消费契约 | VFS 投影是 ContextSource 的统一输出，Agent 统一通过 VFS 浏览 |
| 一个包 `@actant/project-context` | 核心抽象在 `@actant/context`，各 Source 可分布在不同包中 |
| catalogs 只是名字列表 | VFS 目录结构天然提供层级浏览（list = 概览，read = 详细） |
| `@actant/core` 是系统中心 | `@actant/context`（ContextManager）是平台核心，原 `@actant/core` 重命名为 `@actant/agent-runtime`（Agent 执行工具库） |

## 为什么要进一步反转

前一份草案已经正确地识别了问题（`@actant/agent-runtime` 太重、项目上下文应先于 runtime 被装配）。但它仍然把上下文视为一个静态快照——一次性加载，全量输出。

对于大型游戏项目（UE/Unity 项目通常有 10 万+ 文件），这种模型有三个具体限制：

1. **无预算竞争**。所有 catalogs 享有同等优先级，无法在 token 预算紧张时自动取舍。
2. **无意图感知**。"修改蓝图"和"检查配置"需要完全不同的上下文组合，但快照不知道消费者的意图。
3. **新增上下文类型需改 Snapshot 接口**。每增加一种上下文（如 git 变更、项目结构、运行时状态），都要修改 `ProjectContextSnapshot` 的类型定义。

多 Source 模型通过将上下文拆分为独立的、可组合的源来解决这三个问题。

## 设计原则

### 1. Context-first

上下文管理是平台的核心能力，不是 Agent 的子功能。ContextManager 定义了平台"是什么"。

### 2. Bootstrap-capable

ContextManager 在没有长驻 daemon 的情况下可独立工作。这是 ContextManager 的属性，不是架构的名字。

### 3. 输出可确定

在相同输入 + 相同 budget 下，Assembler 产出相同结果。

### 4. 预算驱动

所有输出必须在给定 token 预算内生成。Source 根据预算自行决定输出的详细程度（L0/L1/L2）。

### 5. Source 独立

每个 ContextSource 是自包含的，不依赖其他 Source 的输出。Source 之间通过 Assembler 间接组合，不直接引用。

### 6. 意图感知

Assembler 可接受可选的 intent 参数，Source 可据此调整输出优先级。

### 7. 不过度组装

对外暴露上下文时，ContextManager 是一个**资源仓库**，不是 prompt 构建器。External Agent 通过 MCP/VFS 按需浏览和读取上下文资源，Actant 不替它决定"你应该知道什么"。组装流程只用于创建 Internal Agent。

### 8. 组装即构建

对于 Internal Agent，上下文在创建时组装一次，固化后长期持有。组装是 build-time 操作，不是每次交互的 runtime 操作。

## 双角色 Agent 模型

本架构中存在两种截然不同的 Agent 角色。关键区分：**对外不组装，对内才组装；Internal Agent 组装完成后就是 tool。**

### External Agent（外部 Agent，自主浏览上下文）

外部 Agent 是 Actant 平台之外的 Agent（如 Cursor IDE、Claude Code、或任何通过 MCP 连接的客户端）。Actant **不替它们组装上下文，也不管理它们的生命周期**。

Actant 对 External Agent 的角色是**上下文仓库 + 工具注册中心**：

```
External Agent（Cursor、Claude Code 等）
    │
    │  通过 MCP 连接 Actant
    ↓
Actant MCP Server 暴露的能力：
    │
    ├── 上下文资源（MCP Resources / VFS）
    │   ├── /skills/ue5-blueprint        → 可浏览、可读取
    │   ├── /skills/cpp-expert           → 可浏览、可读取
    │   ├── /project/overview            → 可浏览、可读取
    │   ├── /project/modules/Characters  → 可浏览、可读取
    │   └── ...
    │
    └── 工具（MCP Tools）
        ├── vfs_read, vfs_list, vfs_grep → 浏览上下文资源
        ├── actant_code_review           → Internal Agent 暴露的 tool
        ├── actant_asset_query           → Internal Agent 暴露的 tool
        └── ...
```

特点：

- **不过度组装**：Actant 暴露资源和工具，External Agent 自行决定读什么、调什么。上下文的选择权在 External Agent，不在 Actant。
- **无状态**：Actant 不管理 External Agent 的对话历史或 session。
- **MCP 是主要接口**：通过 MCP Resources 暴露可浏览的上下文，通过 MCP Tools 暴露可调用的能力（包括 Internal Agent）。
- **External Agent 是智能的**：它有自己的 LLM，能自行判断需要哪些上下文。Actant 只需要把资源组织好、把 tool 注册好。

### Internal Agent（内部 Agent，固化规则 + 动态获取上下文）

Internal Agent 是 Actant 平台内部创建和管理的 Agent。它们通过 AgentProfile 定义，**只固化最基本的规则**，运行时动态连回 ContextManager 获取其他上下文。

```
AgentProfile 定义
    │
    │  组装流程（只固化 identity + rules + dispatcher）
    ↓
AgentServer.createAgent(profile)
    │
    ├── 1. 固化：identity（名字、archetype、描述）
    ├── 2. 固化：rules（行为规则、约束）
    ├── 3. 固化：dispatcher / scheduler 配置
    └── 4. 注入：ContextManager 作为 MCP Server 连接
            │
            ↓
AgentService 实例
    │
    ├── 持有固化的 identity + rules + dispatcher
    ├── 运行时通过 ContextManager 动态获取 skills、project、tools 等
    ├── 注册为 MCP Tool（External Agent 可调用）
    └── 长期运行，直到 stop
```

特点：

- **组装只固化最基本的规则**：上下文的选择和组装是**用户管理的**（用户决定 Agent 的 rules），不需要系统做预算分配或自动判断。
- **运行时动态获取上下文**：和 External Agent 一样，Internal Agent 通过 ContextManager 的 VFS/MCP 接口动态获取 skills、project info、工具列表等。区别仅在于 Internal Agent 有固定的 identity 和 rules。
- **本身就是 tool**：创建后，AgentService 向 ContextManager 注册自己为一个 tool。
- **生命周期受管**：由 AgentServer 管理启动、停止、健康检查。
- **archetype 分级**：repo（轻量）、service（持续服务）、employee（定时任务）。

### 两种角色的交互

```
┌─────────────────────────────────────────────────────────┐
│  External Agent（Cursor IDE）                            │
│                                                         │
│  用户输入："帮我review一下角色蓝图的移动逻辑"               │
│                                                         │
│  External Agent 自主决策：                                │
│  1. 先看看有什么上下文 → vfs_list /skills/               │
│  2. 读取相关 skill    → vfs_read /skills/ue5-blueprint  │
│  3. 看看项目结构      → vfs_read /project/overview      │
│  4. 发现有 code-review tool → 决定调用它                  │
└────────────────────────┬────────────────────────────────┘
                         │  MCP tool call: actant_code_review
                         │  { code: "...", filePath: "Characters/..." }
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Internal Agent: code-reviewer（service archetype）       │
│                                                         │
│  FrozenContext（组装时固化）：                              │
│  ├── code-review skill（L2 完整内容）                     │
│  ├── ue5-conventions skill（L2 完整内容）                  │
│  └── 项目结构理解（L1 模块概览）                           │
│                                                         │
│  handle(input)                                          │
│  → 使用 FrozenContext + input → LLM 处理 → 返回 review   │
└─────────────────────────────────────────────────────────┘
```

关键区分：

| | External Agent | Internal Agent |
|--|----------------|----------------|
| 上下文来源 | 自主通过 MCP 浏览、按需读取 | 组装时由 Assembler 在预算内固化 |
| 谁做选择 | External Agent 自己（有 LLM） | AgentProfile + Assembler |
| 生命周期 | Actant 不管 | Actant 全权管理 |
| 对外身份 | Actant 的用户 | Actant 暴露的 tool |
| 组装 | **不组装** | **完整组装** |

### Internal Agent 注册为 MCP Tool

Internal Agent 创建后，自动注册为 MCP Tool。这是 Internal Agent 对外暴露的唯一方式——External Agent 看到的是 tool，不是 agent：

```ts
// AgentService 创建完成后，注册为 MCP Tool
mcpServer.registerTool({
  name: `actant_${agent.name}`,
  description: agent.description,
  inputSchema: agent.profile.toolSchema.inputSchema,
  handler: async (params) => {
    const result = await agent.handle({
      message: params.message ?? JSON.stringify(params),
      context: params,
    });
    return result;
  },
});
```

同时，ContextManager 将所有运行中的 Internal Agent 暴露为 VFS 资源，供 External Agent 发现：

```
/agents/
├── _catalog.json              → 所有 Internal Agent 的列表
├── code-reviewer/
│   ├── status.json            → 运行状态
│   └── tool-schema.json       → tool 的输入输出 schema
└── asset-query/
    ├── status.json
    └── tool-schema.json
```

## 核心抽象

### ContextSource

上下文从哪里来。每个 Source 代表一类可独立产出上下文的数据源。

ContextSource 的唯一输出是 **VFS 挂载**——将自身内容投影为可浏览的文件系统结构。所有消费者（External Agent 和 Internal Agent）统一通过 VFS 浏览和获取上下文。

```ts
export interface ContextSource {
  /** 唯一标识，如 "domain"、"agent"、"unreal-project" */
  readonly name: string;

  /** 类别标签 */
  readonly type: ContextSourceType;

  /**
   * 将此 Source 的内容投影为 VFS 挂载。
   * 所有 Agent（External 和 Internal）通过 vfs_read/vfs_list 浏览。
   */
  toVfsMounts(mountPrefix: string): VfsSourceRegistration[];

  /**
   * 自上次投影以来是否有变更。
   * 用于增量刷新 VFS 挂载，非必须实现。
   */
  hasChanged?(since: Date): Promise<boolean>;
}

export type ContextSourceType =
  | "domain"       // Skills, Prompts, MCP, Workflows, Templates
  | "agent"        // Internal Agent 能力描述
  | "project"      // 项目结构、代码、资产
  | "runtime"      // 进程状态、会话状态
  | "memory"       // 对话历史、已学偏好
  | "environment"; // Git 状态、CI 状态、平台信息
```

注意：没有 `render()`、没有 `estimate()`、没有 `TokenBudget`。上下文的选择权在消费者（Agent），不在 Source 或平台。

### 移除的抽象

以下类型被**移除**：

- ~~`ContextEstimate`~~、~~`ContextFragment`~~、~~`TokenBudget`~~、~~`ContextAssembler`~~、~~`AssemblyRequest`~~、~~`AssembledContext`~~

原因：**"组装"就是现有的 AgentTemplate → WorkspaceBuilder 流程**。用户通过 Template 声明 Agent 该有什么，WorkspaceBuilder 物化它——这个流程已经存在且工作良好。之前设计的 Assembler（智能预算分配）是对这个事实的过度抽象。

### AgentProfile = AgentTemplate 的演进

AgentProfile 不是一个全新的概念——它**就是 AgentTemplate**，只是做了两个改变：

1. **新增 ContextManager MCP 注入**：Template 的 `domainContext.mcp` 中加入 ContextManager 作为 MCP Server，使 Agent 运行时可动态浏览 VFS。
2. **rules 显式化**：将 system prompt 中的行为规则从模板渲染提升为 Profile 的一等字段。

所以 AgentProfile 完全可以继续使用现有的 AgentTemplate 结构——不需要新类型。"组装"就是 `WorkspaceBuilder.build()`。

对比现有 AgentTemplate 和演进后的变化：

```ts
// 现有 AgentTemplate（domainContext 声明 skills/prompts 等）
{
  name: "code-reviewer",
  archetype: "service",
  backend: { type: "claude-code" },
  domainContext: {
    skills: ["code-review", "ue5-conventions"],
    prompts: ["review-prompt"],
    mcp: ["project-tools"],
  },
}

// 演进后的 AgentTemplate（新增 rules + ContextManager MCP 注入）
{
  name: "code-reviewer",
  archetype: "service",
  description: "Reviews code quality and UE5 conventions",
  backend: { type: "claude-code" },
  domainContext: {
    skills: ["code-review", "ue5-conventions"],
    prompts: ["review-prompt"],
    mcp: [
      "project-tools",
      "actant-context-manager",  // ← 新增：ContextManager 作为 MCP Server
    ],
  },
  // ← 新增：显式的行为规则
  rules: [
    "Follow UE5 coding standards",
    "Focus on performance and memory safety",
    "Report issues in structured format",
  ],
  // ← 新增：作为 tool 暴露给 External Agent
  toolSchema: {
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        filePath: { type: "string" },
      },
      required: ["code"],
    },
  },
}
```

变化极小：
- `domainContext.mcp` 中多了 `actant-context-manager`（Agent 运行时可浏览 VFS）
- 新增 `rules` 字段（行为规则显式化）
- 新增 `toolSchema` 字段（作为 tool 暴露给 External Agent）
- 其余（`name`、`archetype`、`backend`、`domainContext`、`initializer` 等）**完全不变**

### "FrozenContext" = 现有的 build 产物

不需要新的 FrozenContext 类型。现有流程中 `WorkspaceBuilder.build()` 产出的 workspace + `SessionContextInjector.prepare()` 产出的 `SessionContext`，就是 Agent 的"固化上下文"。

唯一的变化是 `SessionContext.mcpServers` 中多了 ContextManager：

```ts
// 现有 SessionContext（由 SessionContextInjector.prepare() 产出）
{
  mcpServers: [
    { name: "project-tools", command: "...", args: [...] },
  ],
  systemContextAdditions: ["You are code-reviewer..."],
  tools: [...],
  token: "session-token-xxx",
}

// 演进后：多了 ContextManager MCP Server
{
  mcpServers: [
    { name: "project-tools", command: "...", args: [...] },
    { name: "actant-context-manager", command: "...", args: [...] },  // ← 新增
  ],
  systemContextAdditions: [
    "You are code-reviewer...",
    "## Rules\n- Follow UE5 coding standards\n- ...",  // ← rules 注入到 system prompt
  ],
  tools: [...],
  token: "session-token-xxx",
}
```

### AgentService

Internal Agent 的运行时实例。

```ts
export interface AgentService {
  readonly name: string;
  readonly archetype: "repo" | "service" | "employee";
  readonly description: string;

  /** 创建时固化的最小上下文 */
  readonly context: FrozenContext;

  /**
   * 处理请求。
   * - External Agent 通过 tool call 触发
   * - Scheduler 对 employee 类型的 Agent 触发
   * Agent 在处理过程中可自主通过 ContextManager 获取所需上下文。
   */
  handle(input: AgentInput): Promise<AgentOutput>;

  /** 生命周期 */
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export interface AgentInput {
  message: string;
  context?: Record<string, unknown>;
}

export interface AgentOutput {
  result: string;
  metadata?: Record<string, unknown>;
}
```

### ContextManager

ContextManager 是**上下文平台**——管理上下文资源、提供 VFS 投影、注册工具。

ContextManager 知道的：Sources、VFS、Tools。
ContextManager 不知道的：Agent 是什么、进程怎么启动、通道怎么建立、上下文该如何组装。

```ts
export interface ContextManager {
  /** ContextSource 注册与管理 */
  registerSource(source: ContextSource): void;
  unregisterSource(name: string): void;
  listSources(): ContextSource[];
  getSource(name: string): ContextSource | undefined;

  /**
   * 将所有注册的 Source 投影为 VFS 挂载。
   * 每个 Source 的 toVfsMounts() 被调用，结果挂载到 VFS Registry。
   * 所有 Agent（External 和 Internal）通过 vfs_read/vfs_list 浏览。
   */
  mountSources(registry: VfsRegistry): void;

  /**
   * Tool 注册中心。
   * 任何模块都可以注册 tool（AgentServer 注册 Agent-as-tool，也可以是其他模块）。
   * 注册的 tool 通过 MCP Server 暴露给 External Agent 和 Internal Agent。
   */
  registerTool(tool: ToolRegistration): void;
  unregisterTool(name: string): void;
  listTools(): ToolRegistration[];
}

export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}
```

注意：ContextManager **没有** `assemble()` 方法。上下文组装是用户管理的（通过 AgentProfile 的 rules），Agent 运行时自主通过 VFS/MCP 获取所需上下文。ContextManager 只需要把资源组织好、工具注册好，不做组装决定。

## Source 实现规划

### Phase 1: DomainContextSource

**位置**：`packages/context/src/sources/domain-context-source.ts`

**包装对象**：现有的 `SkillManager`、`PromptManager`、`McpConfigManager`、`WorkflowManager`、`TemplateRegistry`

**VFS 投影策略**：

```
/skills/
├── ue5-blueprint          → 完整 SKILL.md 内容
├── cpp-expert             → 完整 SKILL.md 内容
└── _index.json            → 所有 skill 的 name + description + tags

/prompts/
├── review-prompt          → 完整 prompt 内容
└── _index.json            → 所有 prompt 的 name + description

/mcp/
├── unreal-hub             → 完整 MCP 配置 + tool schemas
└── _index.json            → 所有 MCP server 的 name + tools 列表

/workflows/
├── code-review-flow       → 完整 workflow 内容
└── _index.json            → 所有 workflow 的 name + description

/templates/
├── code-reviewer          → 完整 template JSON
└── _index.json            → 所有 template 的 name + archetype
```

每个目录下的 `_index.json` 提供列表概览，Agent 按需读取具体资源文件获取完整内容。

**验收标准**：

1. `vfs_list /skills/` → 返回所有 skill 名称。
2. `vfs_read /skills/ue5-blueprint` → 返回完整 SKILL.md 内容。
3. `vfs_read /skills/_index.json` → 返回所有 skill 的结构化摘要。
4. 无组件时 → 目录为空或 `_index.json` 返回空数组。

### Phase 2: InternalAgentSource

**InternalAgentSource**（向所有 Agent 暴露可用的 Internal Agent 作为工具）：

```
/agents/
├── code-reviewer/
│   ├── status.json        → { running: true, uptime: "2h" }
│   └── tool-schema.json   → { inputSchema: ..., description: ... }
├── asset-query/
│   ├── status.json
│   └── tool-schema.json
└── _index.json            → 所有 agent 的 name + description + running status
```

Internal Agent 不再需要单独的"身份上下文 Source"——身份和规则固化在 FrozenContext 的 systemPrompt 中，不通过 ContextSource 投影。

### Phase 3: UnrealProjectSource

**位置**：`packages/context/src/sources/project-source.ts`（通用基类）+ `packages/context/src/sources/unreal-project-source.ts`

**VFS 投影策略**：

```
/project/
├── overview.json          → 项目名、引擎版本、模块列表、插件列表、平台
├── modules/
│   ├── Characters/
│   │   ├── _summary.json  → 类数量、关键头文件列表、公开 API
│   │   └── classes.json   → 类继承关系
│   └── Gameplay/
│       └── ...
├── config/
│   ├── DefaultEngine.ini  → 结构化解析后的配置
│   └── DefaultGame.ini
└── changes.json           → git diff 摘要、变更文件列表
```

**Unreal 特化**：

- 忽略规则：`Intermediate/`, `Saved/`, `Binaries/`, `DerivedDataCache/`, `.vs/`
- 模块发现：扫描 `*.Build.cs` 文件
- 插件发现：扫描 `*.uplugin` 文件
- 蓝图索引：`Content/` 下的 `.uasset` 文件（仅路径，不读二进制）
- 配置读取：`Config/*.ini` 的结构化解析

## 完整工作流

### External Agent 工作流（浏览 + 调用）

External Agent 自主决定读什么、用什么。Actant 不做组装决策。

```
1. External Agent（Cursor）通过 MCP 连接 Actant

2. 用户输入："帮我看看角色蓝图的移动逻辑"

3. Cursor Agent（有自己的 LLM）自主决定：
   a. 先发现可用资源
      → vfs_list /                       → 看到 /skills, /project, /agents, ...
      → vfs_list /skills/                → 看到 ue5-blueprint, cpp-expert, ...
      → vfs_list /agents/                → 看到 code-reviewer (running), ...

   b. 按需读取相关上下文
      → vfs_read /skills/ue5-blueprint   → 获取 UE5 蓝图规范
      → vfs_read /project/overview       → 获取项目结构
      → vfs_read /project/modules/Characters → 获取角色模块详情

   c. 发现并调用 Internal Agent
      → vfs_read /agents/code-reviewer/tool-schema.json → 了解 tool 参数
      → actant_code_review({ code: "...", filePath: "Characters/..." })
      → 获取 review 结果

4. Cursor Agent 综合上下文和 tool 结果，回复用户
```

关键点：**步骤 3 的所有决策都是 External Agent 自己做的**。Actant 只负责把资源组织好（VFS 结构清晰、tool schema 准确）。

### Internal Agent 工作流（固化规则 + 动态获取上下文 + 服务）

Internal Agent 只固化最基本的规则，运行时连回 ContextManager 动态获取其他上下文。

**关键设计决定：组装 = 现有的 AgentTemplate → WorkspaceBuilder 流程**。不需要新的 Assembler。AgentServer 只做两个增量：ContextManager MCP 注入 + Tool 回注。

```
AgentTemplate（演进版）
  │
  │  与现有流程完全一致 ↓
  │
  ├── WorkspaceBuilder.build()     ← 现有 @actant/agent-runtime
  ├── InitializationPipeline.run() ← 现有 @actant/agent-runtime
  ├── ProcessLauncher.launch()     ← 现有 @actant/agent-runtime
  ├── ChannelManager.connect()     ← 现有 @actant/agent-runtime
  │     └── mcpServers 中包含 ContextManager   ← 增量 1
  │
  └── contextManager.registerTool()             ← 增量 2
```

具体流程：

```
1. 加载 AgentTemplate（从 configs/templates/ 或 actant.project.json）
   和现有 Template 完全一样，只是多了几个字段：
   template = {
     name: "code-reviewer",
     archetype: "service",
     description: "Reviews code quality and UE5 conventions",
     backend: { type: "claude-code" },
     domainContext: {
       skills: ["code-review", "ue5-conventions"],
       prompts: ["review-prompt"],
       mcp: ["project-tools", "actant-context-manager"],  // ← ContextManager MCP
     },
     rules: [                                              // ← 新增字段
       "Follow UE5 coding standards",
       "Focus on performance and memory safety",
     ],
     toolSchema: { ... },                                  // ← 新增字段
   }

2. AgentServer.createAgent(template)
   // 完全复用现有流程
   → WorkspaceBuilder.build(workspaceDir, template.domainContext, backendType, permissions)
   → InitializationPipeline.run(template.initializer.steps, stepContext)
   → ProcessLauncher.launch(workspaceDir, meta)
   → SessionContextInjector.prepare(name, meta)
       // rules 通过 ContextProvider 注入 systemContext
       // ContextManager MCP 在 template.domainContext.mcp 中已声明
   → ChannelManager.connect(name, sessionContext)

   // 增量：回注为 MCP Tool
   → contextManager.registerTool({ name: "actant_code_review", handler: ... })

3. Agent 实例运行
   - systemPrompt（identity + rules）固定不变
   - Agent 在处理请求时自主通过 ContextManager 获取上下文：
     → vfs_read /skills/ue5-conventions      → 获取相关 skill
     → vfs_read /project/modules/Characters   → 获取项目结构
   - 这和 External Agent 浏览 VFS 的方式完全一致

4. 被 External Agent 调用时：
   actant_code_review({ code: "void ACharacter::Move()...", filePath: "Characters/..." })
   → AgentService.handle(input)
   → Agent 自主获取需要的上下文 + 处理 → 返回结果
```

### 启动时序

```
Actant 启动
  │
  ├── 1. 初始化 ContextManager
  │
  ├── 2. 注册 ContextSources 到 ContextManager
  │      ├── DomainContextSource（从 configs/ 加载）
  │      ├── ProjectContextSource（从项目根目录扫描）
  │      └── EnvironmentSource（git 状态等）
  │
  ├── 3. ContextManager 投影 Sources 为 VFS 挂载
  │      ├── /skills/...     ← DomainContextSource
  │      ├── /prompts/...    ← DomainContextSource
  │      ├── /project/...    ← ProjectContextSource
  │      └── /env/...        ← EnvironmentSource
  │
  ├── 4. 初始化 AgentServer（传入 ContextManager + @actant/agent-runtime 的 AgentManager）
  │
  ├── 5. AgentServer 创建 Internal Agents（从 AgentProfile 配置）
  │      ├── code-reviewer：
  │      │     固化 rules → 注入 ContextManager MCP → 委托 @actant/agent-runtime build+launch
  │      │     → 回注为 MCP Tool: actant_code_review
  │      └── asset-query：
  │            固化 rules → 注入 ContextManager MCP → 委托 @actant/agent-runtime build+launch
  │            → 回注为 MCP Tool: actant_asset_query
  │
  ├── 6. AgentServer 回注 Agent 信息到 ContextManager 的 VFS
  │      └── /agents/...
  │
  └── 7. MCP Server 就绪
         所有 Agent（External 和 Internal）都可以：
         ├── 浏览 VFS（vfs_read, vfs_list, vfs_grep）
         └── 调用 Tools（actant_code_review, actant_asset_query, ...）
```

## 顶层模块拆分

整个 Actant 拆分为两个核心模块：

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│  ContextManager（上下文平台）            AgentServer（Agent 运行层） │
│  ────────────────────────              ─────────────────────────  │
│  信息的管理 + VFS 暴露                  固化规则 + 启动 + 运行       │
│                                                                   │
│  ┌────────────────────────┐   依赖    ┌────────────────────────┐  │
│  │                        │ ◄──────── │                        │  │
│  │  ContextSource 注册     │  注入MCP  │  AgentProfile 管理      │  │
│  │  VFS 挂载投影           │ ◄──────── │  固化 rules → 转译      │  │
│  │  MCP Resource 暴露     │           │                        │  │
│  │  Tool 注册中心          │  回注     │  委托 @actant/agent-runtime      │  │
│  │                        │ ◄──────── │  (build/launch/channel) │  │
│  │                        │  tool+VFS │  Agent 生命周期          │  │
│  │                        │           │  (start/stop)           │  │
│  └────────────────────────┘           └────────────────────────┘  │
│          ↑                                   │                    │
│          │ 浏览 VFS / 调用 tool               │ 委托               │
│          │                                   ▼                    │
│  ┌───────┴────────────────────┐  ┌─────────────────────────────┐ │
│  │  所有 Agent                │  │  @actant/agent-runtime               │ │
│  │  (External: Cursor 等      │  │  (WorkspaceBuilder,         │ │
│  │   Internal: code-reviewer) │  │   Launcher, ChannelManager, │ │
│  │  统一通过 VFS 获取上下文    │  │   Communicator)             │ │
│  └────────────────────────────┘  └─────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### ContextManager 的职责

ContextManager 是**上下文平台**，负责信息的管理和暴露：

1. **管理 ContextSource**：注册、注销、列举上下文源。
2. **VFS 投影**：将每个 Source 的内容投影为可浏览的 VFS 目录。
3. **MCP 暴露**：通过 MCP Resources 和 MCP Tools 向外部暴露资源和工具。
4. **Tool 注册中心**：接受外部注册的 tool，统一通过 MCP 暴露。

ContextManager **不知道、不做**：
- 不知道 AgentProfile、FrozenContext、archetype 这些 Agent 概念
- 不管理任何进程或生命周期
- **不做上下文组装**——上下文的选择和组装是消费者（Agent）自己的事
- 不做预算分配、不做优先级排序

### AgentServer 的职责

AgentServer 就是现有 `AgentManager` 的演进版本。因为 AgentProfile 就是 AgentTemplate 的演进，所以 **整个 build 流程不变**——AgentServer 只在现有流程上做两个增量：

1. **ContextManager MCP 注入**（新增）：在 Template 的 `domainContext.mcp` 中追加 ContextManager MCP Server，使 Agent 运行时可动态浏览 VFS。
2. **Tool 回注**（新增）：Agent 启动后，将其注册为 ContextManager 的 tool + VFS 资源。

其余全部复用现有 `@actant/agent-runtime`：
- Template 管理 → TemplateRegistry
- Build → WorkspaceBuilder
- 初始化 → InitializationPipeline
- 启动 → ProcessLauncher
- 通道 → ChannelManager
- Prompt → AgentCommunicator
- 生命周期 → AgentManager

AgentServer 与现有 AgentManager 的关系：**AgentServer = AgentManager + 两个增量（ContextManager 注入 + Tool 回注）**。

### 依赖关系（单向 + 回注）

```
ContextManager          AgentServer          @actant/agent-runtime
    │                       │                    │
    │  Source/Tool API      │                    │
    │  MCP Server 配置      │                    │
    │ ◄──────────────────── │                    │
    │                       │  build/launch/     │
    │                       │  channel/prompt    │
    │                       │ ──────────────────►│
    │                       │                    │
    │  ContextManager 不依赖 AgentServer 或 @actant/agent-runtime
    │  AgentServer 依赖 ContextManager（注入 MCP + 回注 tool）
    │  AgentServer 依赖 @actant/agent-runtime（Agent 物理执行）
    │  @actant/agent-runtime 不依赖 ContextManager 或 AgentServer
```

无循环依赖。ContextManager 暴露通用接口（registerTool、registerSource、mountSources），AgentServer 是消费者。@actant/agent-runtime 是纯工具库，被 AgentServer 内部调用。

### 回注机制

AgentServer 创建并启动 Agent 后，通过 ContextManager 的通用接口回注：

```ts
// AgentServer 内部，Agent 创建完成后：

// 1. 将 Agent 注册为 MCP Tool
contextManager.registerTool({
  name: `actant_${agent.name}`,
  description: agent.description,
  inputSchema: agent.profile.toolSchema.inputSchema,
  handler: (params) => agent.handle(params),
});

// 2. 将 Agent 状态注册为 VFS 资源
contextManager.registerSource(
  new AgentStatusSource(agent)  // 暴露 /agents/<name>/status.json 等
);

// Agent 停止时，反注册：
contextManager.unregisterTool(`actant_${agent.name}`);
contextManager.unregisterSource(`agent-status-${agent.name}`);
```

### 与现有包的映射

| 现有包 | 归属模块 | 说明 |
|-------|---------|------|
| `@actant/shared` | 共享 | 类型定义，两个模块都依赖 |
| `@actant/domain` | ContextManager | SkillManager 等被 DomainContextSource 包装 |
| `@actant/vfs` | ContextManager | VFS 是 ContextManager 的核心基础设施 |
| `@actant/mcp-server` | ContextManager | MCP 暴露层 |
| `@actant/agent-runtime` | AgentServer | Agent 生命周期、Launcher、Communicator |
| `@actant/acp` | AgentServer | ACP 连接管理 |
| `@actant/channel-claude` | AgentServer | Claude SDK 后端 |
| `@actant/pi` | AgentServer | Pi 后端 |
| `@actant/api` | 桥接层 | Daemon RPC，连接两个模块 |
| `@actant/cli` | 桥接层 | 用户入口，操作两个模块 |
| `@actant/rest-api` | 桥接层 | HTTP 接口 |
| `@actant/dashboard` | 桥接层 | Web UI |

### 新包结构

```text
packages/context/                        ← ContextManager 模块（上下文平台）
├── package.json
├── src/
│   ├── index.ts
│   ├── types.ts                         // ContextSource, ContextSourceType 等
│   ├── manager/
│   │   └── context-manager.ts           // Source 注册 + VFS 投影 + Tool 注册中心
│   ├── sources/
│   │   ├── domain-context-source.ts     // 包装 SkillManager 等，投影为 /skills, /prompts 等
│   │   ├── project-source.ts            // 通用项目上下文基类
│   │   └── unreal-project-source.ts     // Unreal 特化，投影为 /project/...
│   └── __tests__/

packages/agent-runtime/src/ 中的增量（或独立为 packages/agent-server/）：
├── context-injector/
│   └── rules-context-provider.ts        // 新增：将 template.rules 注入 system prompt
├── manager/
│   └── agent-manager.ts                 // 扩展：Agent 启动后自动回注 tool + VFS 资源
└── registration/                        // 新增目录
    ├── tool-registrar.ts                // 将 Agent 回注为 ContextManager 的 tool
    └── status-source.ts                 // 将 Agent 状态回注为 VFS 资源（ContextSource 实现）
```

依赖关系：

```text
@actant/context（ContextManager 模块）
  ├── @actant/shared
  ├── @actant/domain
  └── @actant/vfs

@actant/agent-server（AgentServer 模块）
  ├── @actant/shared
  ├── @actant/context       ← 单向依赖
  ├── @actant/agent-runtime          ← Agent 生命周期实现
  ├── @actant/acp           ← ACP 后端
  └── @actant/channel-claude ← Claude SDK 后端

不存在反向依赖：
  ✗ @actant/context 不依赖 @actant/agent-server
```

## 与现有模块的关系

### SessionContextInjector → 逐步被 AgentServer 替代

```text
当前（@actant/agent-runtime）：
  SessionContextInjector.prepare()
    → 遍历 ContextProvider[]
    → 简单聚合 MCP servers + tools + system context
    → 返回 SessionContext

反转后（@actant/agent-server）：
  AgentServer.createAgent(profile)
    → 固化 rules → systemPrompt
    → 将 ContextManager 作为 MCP Server 注入（取代 ContextProvider 聚合）
    → 转译 profile → AgentTemplate
    → 委托 @actant/agent-runtime 完成 build + launch + connect
    → 回注 tool 到 ContextManager
```

SessionContextInjector 的"发现"职责不再需要——Agent 运行时自主通过 ContextManager 的 VFS 按需获取。"聚合"职责也不再需要——不做预组装。

**迁移期间两者可共存**：尚未迁移到 AgentServer 的 Agent 仍走 SessionContextInjector，已迁移的走新模式。

### ContextProvider → 迁移为 ContextSource

| 现有 ContextProvider | 迁移到 | 归属 |
|---------------------|--------|------|
| CoreContextProvider | 拆分：identity 部分进 AgentServer，项目发现部分进 ContextManager | 跨模块 |
| CanvasContextProvider | AgentServer 内部（Agent 专属能力） | AgentServer |
| VfsContextProvider | 不再需要（VFS 本身就是 ContextManager 的输出） | 删除 |

### Domain Managers → 被 DomainContextSource 包装

`SkillManager` 等不被替换，而是被 `DomainContextSource`（属于 ContextManager）内部引用。

### AgentTemplate → 原地演进（不改名）

AgentTemplate 继续叫 AgentTemplate，继续在 `@actant/agent-runtime`（或 `@actant/shared`）中定义。只是增加了几个字段：

```text
当前 AgentTemplate（@actant/agent-runtime）:
  { name, archetype, backend, domainContext: { skills, prompts, mcp, ... }, ... }

演进后 AgentTemplate（仍在 @actant/agent-runtime）:
  { name, archetype, backend, domainContext: { skills, prompts, mcp: [..., "actant-context-manager"], ... },
    rules?: string[],          // ← 新增
    toolSchema?: { ... },      // ← 新增
  }
```

不需要改名为 AgentProfile、不需要移动到新包。

### VFS → ContextManager 的核心输出

VFS 不再是 Agent 的子功能，而是 ContextManager 的主要对外接口。所有 ContextSource 通过 `toVfsMounts()` 投影为 VFS 目录。

## 迁移计划

迁移分两个大阶段执行。Phase A 在当前 v0.3.0 基础上做充分清理，产出 **v0.4.0 存档版本**，确保重构前的代码基线干净、可回溯。Phase B 在 v0.4.0 上实施 Context-First 架构重构。

---

### Phase A：工程清理与重构准备（v0.3.0 → v0.4.0 存档）

> **目标**：充分清理整理当前工程，为大幅重构做好准备。v0.4.0 作为重构前的最后一个稳定存档版本。
>
> **预计周期**：5-8 天

#### A-1：废弃代码清理（2-3 天）

清理已标记 `@deprecated` 的 17 处代码和已死的遗留路径：

| 清理目标 | 包 | 动作 |
|----------|-----|------|
| `EventJournal` | @actant/core | 删除，确认 RecordSystem 完全替代 |
| `ActivityRecorder` | @actant/core | 删除，确认 RecordSystem 完全替代 |
| `MockLauncher` | @actant/core | 删除，确认 `createTestLauncher()` 替代 |
| `ContextMaterializer` | @actant/core | 删除，确认 WorkspaceBuilder + BackendBuilder 完全替代 |
| `HookInput`（deprecated） | @actant/core | 清理，确认 HookEventBus + HookRegistry 替代 |
| Legacy proxy handlers | @actant/api | 删除，确认 Direct Bridge 模式已覆盖 |
| Legacy record methods on HookEventBus | @actant/core | 迁移到 `setRecordSystem()` |
| `loadBuiltins()` | @actant/core, @actant/domain | 删除，确认 `loadFromDirectory()` 替代 |
| `AgentBackendDefinition` alias | @actant/shared | 删除，统一用 `BackendDefinition` |
| Legacy channel exports on AgentManager | @actant/core | 删除，统一用 `channelManager` |
| `activityRecorder` / `eventJournal` on AppContext | @actant/api | 删除，统一用 `recordSystem` |

验收标准：
- 全量 `@deprecated` 注解清零
- 全量测试通过，无功能退化
- type-check / lint 全绿

#### A-2：无效依赖清理（0.5 天）

| 清理目标 | 包 | 动作 |
|----------|-----|------|
| `@actant/domain` | @actant/mcp-server | 确认未引用后从 package.json 移除 |
| `@actant/source` | @actant/mcp-server | 确认未引用后从 package.json 移除 |

验收标准：
- `pnpm install` 成功、build 成功、无幽灵依赖

#### A-3：@actant/core 内聚性梳理（1-2 天）

`@actant/core` 当前承载 251 个源文件，内部有与独立包 `@actant/domain`、`@actant/source`、`@actant/vfs` 功能重叠的子目录。本步骤不做拆包，仅做边界梳理和内部重复消除：

- 审查 `packages/core/src/domain/` vs `packages/domain/src/` 的职责重叠，消除重复定义
- 审查 `packages/core/src/source/` vs `packages/source/src/` 的职责重叠，消除重复定义
- 审查 `packages/core/src/vfs/` vs `packages/vfs/src/` 的职责重叠，确认唯一数据源
- 为每个子模块在 `README.md` 或 JSDoc 中标注"Phase B 归宿"（将移入 `@actant/context` / 保留在 `@actant/agent-runtime` / 删除）

验收标准：
- 每个 core 子目录有明确的迁移归属标注
- 消除了跨包重复定义
- 测试无退化

#### A-4：测试补强与质量基线（1-2 天）

- 补充关键路径的集成测试（create → start → prompt → stop 各 archetype）
- 确保耐久测试（endurance tests）可运行且通过
- 生成并记录 coverage baseline（行覆盖率、分支覆盖率）
- 修复已知的 open bugs（#238 race condition, #239 orphan process, #240 leak on failure）

验收标准：
- 端到端流程各 archetype 至少各有 1 个集成测试
- coverage baseline 已记录
- 3 个已知 bug 已修复或有明确的 workaround

#### A-5：版本存档与发布（0.5 天）

- 将全部 package version 同步至 `0.4.0`
- 生成 `docs/stage/v0.4.0/changelog.md`
- 打 git tag `v0.4.0`，作为重构前的存档基线
- 在 CHANGELOG 中标注："v0.4.0 是重构前的最后一个存档版本，后续 v0.5.0 将引入 Context-First 架构"

验收标准：
- `v0.4.0` tag 已创建
- 所有 package.json 版本一致为 `0.4.0`
- CI / type-check / lint / test 全绿

---

### Phase B：Context-First 架构实施（v0.4.0 → v0.5.0）

> **目标**：在 v0.4.0 干净基线上实施本文档描述的 Context-First Multi-Source 架构重构。
>
> **预计周期**：12-20 天

#### B-0：ContextManager 骨架（1-2 天）

创建 `packages/context`（即 `@actant/context`）：

- `ContextSource` 接口（`name`, `type`, `toVfsMounts()`）
- `ContextManager` 实现：Source 注册 / 注销 + VFS 投影 + Tool 注册中心
- `ContextManagerMcpServer`：将 ContextManager 暴露为 MCP Server
- 单元测试：用 mock Source 验证 VFS 投影和 Tool 注册

不属于此阶段：AgentProfile、FrozenContext、任何预算/组装逻辑

验收标准：
- `@actant/context` 可独立 build / test
- mock Source 的 VFS 投影在 MCP Server 上可浏览
- 不依赖 `@actant/core`（仅依赖 `@actant/shared` + `@actant/vfs`）

#### B-1：DomainContextSource（2-3 天）

在 `packages/context` 中实现：

- `DomainContextSource`：包装现有 `@actant/domain` 的 SkillManager / PromptManager 等
- `toVfsMounts()`：投影为 `/skills/...`、`/prompts/...`、`/mcp/...` 等 VFS 目录
- `hasChanged()`：基于文件修改时间判断变更
- 集成测试：用真实 `configs/` 目录验证

验收标准：
- MCP Server 可通过 VFS 暴露 Skills/Prompts/MCP 等资源
- External Agent（如 Cursor）通过 MCP `resources/list` 可浏览完整 domain context

#### B-2：AgentTemplate / AgentManager 增量（1-2 天）

在 `@actant/core`（即未来的 `@actant/agent-runtime`）中原地扩展：

- AgentTemplate 新增 `rules` 和 `toolSchema` 字段
- `RulesContextProvider`：将 `rules` 注入 system prompt
- ContextManager MCP 配置自动注入（在 `domainContext.mcp` 中追加 `actant-context-manager`）
- **回注机制**：Agent 启动后注册为 ContextManager 的 tool + VFS 资源
- `AgentStatusSource`：将 Agent 状态投影为 `/agents/<name>/...`

验收标准：
- 使用扩展后的 AgentTemplate 创建 Agent → 现有 build 流程正常工作
- Agent 运行时可通过 ContextManager VFS 动态获取 skills、project info
- 运行中的 Agent 在 VFS `/agents/` 下可见
- 运行中的 Agent 作为 MCP Tool 可被 External Agent 调用
- **现有 build 流程无需改动**（只是 Template 多了字段 + 多了一个 ContextProvider）

#### B-3：UnrealProjectSource（3-5 天）

在 `packages/context` 中实现：

- `ProjectSource` 通用基类
- `UnrealProjectSource` 实现：解析 `.uproject`、Module 结构、Config 目录
- `toVfsMounts()`：投影为 `/project/overview`、`/project/modules/...`、`/project/config/...`
- 集成测试：指向真实 UE 项目目录

验收标准：
- External Agent 可通过 `vfs_list /project/` 浏览 UE 项目结构
- 对 50+ Module 的大型 UE 项目可在合理时间内完成投影

#### B-4：现有系统桥接（3-5 天）

- MCP Server（`@actant/mcp-server`）切换到 ContextManager 的 VFS 投影
- `actant hub` bootstrap 流程切换到新架构（ContextManager 作为核心启动项）
- CLI 命令适配：`actant agent create` 等走新架构路径
- 保留旧路径作为 fallback，通过 feature flag 控制

验收标准：
- `actant hub` 启动后 ContextManager 自动加载所有 ContextSource
- 现有 CLI 命令在新架构下功能无退化
- feature flag 可切换新旧路径

#### B-5：@actant/core → @actant/agent-runtime 重命名与旧模块收缩（2-3 天）

- `@actant/core` 重命名为 `@actant/agent-runtime`
- 删除已被 ContextManager 替代的模块：
  - `SessionContextInjector`（"发现"归 ContextManager）
  - `CoreContextProvider`、`CanvasContextProvider`、`VfsContextProvider`
  - `packages/core/src/domain/`（已由 `@actant/domain` + `DomainContextSource` 覆盖）
  - `packages/core/src/source/`（已由 `@actant/source` 覆盖）
- `@actant/agent-runtime` **保持**为 Agent 执行工具库（WorkspaceBuilder、Launcher、ChannelManager、Communicator）
- 更新所有上游包的 import 路径

验收标准：
- `@actant/core` 不再存在，所有引用已迁移至 `@actant/agent-runtime`
- 删除的模块无任何外部引用残留
- 全量 build / type-check / lint / test 通过

#### B-6：版本发布与文档收尾（1 天）

- 将全部 package version 同步至 `0.5.0`
- 生成 `docs/stage/v0.5.0/changelog.md`
- 更新 `docs/planning/roadmap.md` 标记 Context-First 架构为已完成
- 更新 README、Wiki、API 文档
- 打 git tag `v0.5.0`

验收标准：
- `v0.5.0` tag 已创建
- 文档与代码一致
- CI / type-check / lint / test 全绿

## 与 Docker 类比的对应

| Docker | Actant（反转后） | 归属模块 |
|--------|-----------------|---------|
| Registry (Docker Hub) | ContextManager（资源平台 + VFS） | ContextManager |
| Volume / Bind mount | ContextSource（上下文源） | ContextManager |
| Dockerfile | AgentTemplate（演进版：+ rules + toolSchema） | @actant/agent-runtime |
| `docker build` | WorkspaceBuilder.build()（完全不变） | @actant/agent-runtime |
| `docker run` | AgentManager.startAgent()（+ ContextManager 注入） | @actant/agent-runtime |
| Container | Agent 实例（持有 rules + 运行时动态获取上下文） | @actant/agent-runtime |
| Container 访问 Volume | Agent 运行时通过 VFS 获取 skills/project/tools | Agent → ContextManager |
| Container 暴露端口 | Agent 回注为 MCP Tool | @actant/agent-runtime → ContextManager |
| `docker ps` | vfs_list /agents/ | ContextManager（数据由 @actant/agent-runtime 回注） |

## 风险

### 风险 1：模块边界模糊，ContextManager 过度膨胀

缓解方式：
- ContextManager 的判定标准：**它知不知道 Agent 是什么？** 如果代码里出现 AgentProfile、FrozenContext、archetype，就不该在 ContextManager 里。
- ContextManager 暴露的接口全部是 agent-agnostic 的：registerSource、registerTool、mountSources。
- ContextManager **没有** assemble()——上下文的选择权在消费者。

### 风险 2：Internal Agent 运行时 VFS 访问开销

Internal Agent 每次处理请求都可能通过 VFS 获取上下文，这引入了运行时开销。

缓解方式：
- VFS 读取是内存操作（不是磁盘 IO），延迟很低
- 后端 LLM 的思考时间远大于 VFS 读取时间，开销可忽略
- 可在 ContextManager 层做缓存

### 风险 3：Internal Agent 可能过度消费上下文

Agent 运行时自主获取上下文，可能读取过多导致 token 超出 LLM 窗口。

缓解方式：
- Agent 的 rules 中可以包含上下文使用指导（"优先读取 /skills/ 相关资源，避免读取整个 /project/"）
- 后端 LLM 自身有 context window 限制，超出时自然截断
- 这是用户管理的——用户通过 rules 引导 Agent 的行为

### 风险 4：AgentServer 回注导致的循环

AgentServer 向 ContextManager 回注 tool 和 VFS 资源。如果 Internal Agent 在运行时浏览 VFS 看到了其他 Agent 的信息并尝试调用，可能产生链式调用。

缓解方式：
- Agent 的 tool 注册发生在创建**之后**，时序上不存在创建时的循环
- Agent 之间的调用是正常的 tool call 行为，不需要特殊处理
- 如果需要限制，可在 rules 中声明"不调用其他 Internal Agent"

## 待决问题

1. 包名 `@actant/context` vs `@actant/context-manager`？`@actant/agent-server` vs `@actant/server`？
2. ~~`ContextFragment.tokens` 由 Source 自行计算，还是由 Assembler 统一计算？~~ **已移除**：不再有 ContextFragment 和 Assembler。
3. ~~Assembler 是否支持"必须包含"语义？~~ **已移除**：不再有 Assembler。
4. `UnrealProjectSource` 放在 `@actant/context` 内还是独立为 `@actant/context-unreal`？
5. ContextManager 的 Tool 注册中心是否需要权限控制（谁可以注册 tool）？
6. External Agent 浏览 VFS 时，是否需要身份认证？
7. AgentServer 回注的 tool handler 如何处理 Agent 停止后的调用（返回错误 vs 自动重启）？
8. `AgentProfile` 是否需要向后兼容现有的 `AgentTemplate` 格式？
9. ~~`@actant/agent-runtime` 最终是被 `@actant/agent-server` 完全替代，还是作为 AgentServer 的内部依赖保留？~~ **已决定**：`@actant/agent-runtime` 作为 AgentServer 的内部依赖保留。
10. Internal Agent 的 rules 是否需要模板化？（如：从 prompt 模板渲染 rules）
11. ContextManager MCP Server 如何注入给 Internal Agent？是作为额外的 MCP Server 加入 SessionContext，还是作为 workspace 中的 MCP 配置？

## 决策建议

1. 不要从零重写整个 Actant。
2. **新增 ContextManager**（`@actant/context`）：上下文平台，管理 Sources + VFS 投影 + Tool 注册。
3. **AgentTemplate 原地演进**：新增 `rules` + `toolSchema` 字段，`domainContext.mcp` 中追加 ContextManager。不改名、不移包。
4. **AgentManager 原地演进**：新增 ContextManager MCP 注入 + Tool 回注。现有 build 流程完全不变。
5. **不做预算组装**——"组装"就是现有的 AgentTemplate → WorkspaceBuilder 流程，由用户管理。没有 Assembler、没有预算分配。
6. **Internal Agent 和 External Agent 统一通过 VFS 获取上下文**——区别仅在于 Internal Agent 有固化的 identity + rules。
7. ContextManager 先行：它不依赖 @actant/agent-runtime，可独立交付和验证。
8. 先用 DomainContextSource 验证 Source + VFS 投影机制。
9. 再扩展 AgentTemplate/AgentManager，验证 ContextManager MCP 注入 + Tool 回注。
10. 最后用 UnrealProjectSource 验证大型项目场景。
