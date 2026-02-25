# Core Agent 配置系统 — Roadmap

> 设计文档 — 2026-02-19
>
> 目标：以测试驱动方式，分阶段构建 Core 包中 Agent 配置、创建、启动的完整链路。
> **优先级原则**：先交付可测试的 Agent 创建与启动基线，再逐步丰富 Domain Context。

---

## 目录

1. [总览](#总览)
2. [阶段划分](#阶段划分)
3. [各阶段详细说明](#各阶段详细说明)
4. [依赖关系图](#依赖关系图)
5. [测试策略](#测试策略)
6. [风险与约束](#风险与约束)

---

## 总览

### 要构建的能力

```
Agent Template (JSON) → 加载/验证 → 注册表 → 创建 Instance → 启动/停止/监控
                                                    ↑
                                          Domain Context 组装
                                          (Skill, Prompt, MCP, Workflow)
```

### 涉及的包

| 包 | 职责 |
|----|------|
| `@actant/shared` | 共享类型、错误层级、日志、工具函数 |
| `@actant/core` | Template/Initializer/Manager/Domain 全部业务逻辑 |

### 核心交付物

1. **Agent Template Schema** — Zod schema 定义 + JSON 加载
2. **Template Registry** — 模板增删改查
3. **Agent Instance 创建** — 从 Template 构造可运行实例
4. **Agent Manager 基线** — 启动、停止、状态查询
5. **Domain Context 管理器** — Skill/Prompt/MCP/Workflow 注册与解析

---

## 阶段划分

```
Phase 0 ─── 基础设施搭建 ──────────────────── [前置，全阶段依赖]
   │
Phase 1 ─── 共享类型与错误体系 ────────────── [shared 包]
   │
Phase 2 ─── Agent Template Schema ─────────── [core/template/schema]
   │
Phase 3 ─── Template 加载器 ───────────────── [core/template/loader]
   │
Phase 4 ─── Template 注册表 ───────────────── [core/template/registry]
   │
Phase 5 ─── Agent Instance 创建 (基线) ───── [core/initializer] ← 首个可测试里程碑
   │
Phase 6 ─── Agent Manager 基线 ────────────── [core/manager]     ← 创建+启动 E2E
   │
Phase 7 ─── Domain Context 组件管理器 ─────── [core/domain]
   │
Phase 8 ─── CLI 集成 ─────────────────────── [cli 包，后续独立 Roadmap]
```

### 里程碑

| 里程碑 | 对应阶段 | 可验证能力 |
|--------|---------|-----------|
| **M1: Template 可定义可验证** | Phase 0-2 | 用 Zod schema 验证 JSON 模板，测试全部通过 |
| **M2: Template 可加载可注册** | Phase 3-4 | 从文件系统加载模板并注册到 Registry，CRUD 测试通过 |
| **M3: Agent 可创建可启动** | Phase 5-6 | 从 Template 创建 Instance，执行启动/停止，生命周期测试通过 |
| **M4: Domain Context 完整** | Phase 7 | Skill/Prompt/MCP/Workflow 引用解析，组合测试通过 |

---

## 各阶段详细说明

### Phase 0: 基础设施搭建

**目标**：让代码能写、能编译、能测试。

| 任务 | 文件/位置 | 说明 |
|------|----------|------|
| 安装核心依赖 | `root package.json` | zod, pino, execa |
| 安装开发依赖 | `root package.json` | vitest, tsup, tsx, rimraf, typescript |
| 配置 vitest | `packages/*/vitest.config.ts` | 各包测试配置 |
| 配置 tsup | `packages/core/tsup.config.ts` | 构建配置 |
| 验证构建链路 | — | `pnpm build && pnpm test` 可运行 |

**交付件**：
- [ ] `pnpm install` 成功
- [ ] `pnpm build` 各包编译成功
- [ ] `pnpm test` 框架可运行（即使无测试用例）

---

### Phase 1: 共享类型与错误体系

**目标**：定义 Agent 系统的核心类型合约和错误层级。

#### 1.1 基础错误类型 (`shared/src/errors/`)

```typescript
// base-error.ts
abstract class ActantError extends Error {
  abstract readonly code: string;
}

// config-errors.ts
class ConfigNotFoundError extends ActantError { ... }
class ConfigValidationError extends ActantError { ... }
class TemplateNotFoundError extends ActantError { ... }

// lifecycle-errors.ts
class AgentLaunchError extends ActantError { ... }
class AgentNotFoundError extends ActantError { ... }
class AgentAlreadyRunningError extends ActantError { ... }
class InstanceCorruptedError extends ActantError { ... }
```

#### 1.2 核心类型 (`shared/src/types/`)

```typescript
// agent.types.ts — Agent Instance 类型
//
// 核心概念：Agent Instance 的实体是一个工作目录。
// 工作目录中包含物化后的 Domain Context 文件（AGENTS.md、mcp.json 等），
// Agent Backend（Cursor / Claude Code）直接指向此目录即可工作。
// 下面的 interface 是工作目录中 .actant.json 的结构，
// 是对工作目录的元数据描述，不是 Instance 本身。

interface AgentInstanceMeta {
  id: string;                // 系统生成的唯一标识
  name: string;              // 用户指定的逻辑名称，即工作目录名
  templateName: string;      // 来源 Template 名称
  templateVersion: string;   // 创建时的 Template 版本
  status: AgentStatus;
  launchMode: LaunchMode;
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
  pid?: number;              // 运行中的进程 PID（运行时字段）
  metadata?: Record<string, string>;
}

type AgentStatus = 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
type LaunchMode = 'direct' | 'acp-background' | 'normal' | 'one-shot';

// template.types.ts — Agent Template 类型
interface AgentTemplate {
  name: string;
  version: string;
  description?: string;
  backend: AgentBackendConfig;
  provider: ModelProviderConfig;
  domainContext: DomainContextConfig;
  initializer?: InitializerConfig;
  metadata?: Record<string, string>;
}

// domain-context.types.ts — Domain Context 类型
interface DomainContextConfig {
  skills?: string[];        // 按名称引用
  prompts?: string[];
  mcpServers?: string[];
  workflow?: string;
  subAgents?: string[];
}
```

> **关键区分**：
> - `AgentInstanceMeta` 是元数据（`.actant.json` 的内容），描述"这个工作目录是什么"
> - 工作目录本身才是 Instance 的实体，包含物化后的所有 Domain Context 文件
> - `name` 即工作目录名，全局唯一

#### 1.3 日志基础设施 (`shared/src/logger/`)

```typescript
// logger.ts — 基于 pino 的结构化日志
function createLogger(module: string): Logger { ... }
```

**交付件**：
- [ ] 所有基础类型定义，带 JSDoc 注释
- [ ] 错误类型层级完整
- [ ] Logger 工厂函数
- [ ] 类型导出测试（确保 barrel export 正确）

---

### Phase 2: Agent Template Schema

**目标**：用 Zod 定义 Agent Template 的完整 schema，确保模板配置可在运行时验证。

**位置**：`packages/core/src/template/schema/`

```typescript
// template-schema.ts
import { z } from 'zod';

export const AgentTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),
  backend: AgentBackendSchema,
  provider: ModelProviderSchema,
  domainContext: DomainContextSchema,
  initializer: InitializerSchema.optional(),
  metadata: z.record(z.string()).optional(),
});

export const DomainContextSchema = z.object({
  skills: z.array(z.string()).optional().default([]),
  prompts: z.array(z.string()).optional().default([]),
  mcpServers: z.array(McpServerRefSchema).optional().default([]),
  workflow: z.string().optional(),
  subAgents: z.array(z.string()).optional().default([]),
});
```

**测试要点**：
- 有效模板通过验证
- 缺少必填字段 → 明确错误信息
- 字段类型错误 → 类型校验错误
- 边界值测试（空字符串、超长名称等）

**交付件**：
- [ ] `template-schema.ts` — 完整 Zod schema
- [ ] `template-schema.test.ts` — schema 验证测试 (>=10 cases)
- [ ] Schema 与 shared types 类型对齐（`z.infer` 匹配 `AgentTemplate`）

---

### Phase 3: Template 加载器

**目标**：从 JSON 文件解析 Agent Template 并通过 schema 验证。

**位置**：`packages/core/src/template/loader/`

```typescript
// template-loader.ts
export class TemplateLoader {
  async loadFromFile(filePath: string): Promise<AgentTemplate> { ... }
  async loadFromString(content: string): Promise<AgentTemplate> { ... }
  async loadFromDirectory(dirPath: string): Promise<AgentTemplate[]> { ... }
}
```

**测试要点**：
- 加载有效 JSON → 返回类型化的 Template 对象
- 加载不存在的文件 → `TemplateNotFoundError`
- 加载格式错误的 JSON → `ConfigValidationError`
- 从目录批量加载
- 使用 fixture 文件（`__fixtures__/` 目录）

**交付件**：
- [ ] `template-loader.ts`
- [ ] `template-loader.test.ts` (>=8 cases)
- [ ] `__fixtures__/` 目录包含测试用 JSON 文件

---

### Phase 4: Template 注册表

**目标**：提供 Template 的 CRUD 操作和查询能力。

**位置**：`packages/core/src/template/registry/`

```typescript
// template-registry.ts
export class TemplateRegistry {
  register(template: AgentTemplate): void { ... }
  unregister(name: string): boolean { ... }
  get(name: string): AgentTemplate | undefined { ... }
  list(): AgentTemplate[] { ... }
  has(name: string): boolean { ... }
  loadBuiltins(configDir: string): Promise<void> { ... }
}
```

**测试要点**：
- 注册/注销/查询/列表 CRUD
- 重复注册 → 错误或覆盖策略
- 不存在的 template → `undefined` 或 `TemplateNotFoundError`
- 加载内置模板（`configs/templates/`）

**交付件**：
- [ ] `template-registry.ts`
- [ ] `template-registry.test.ts` (>=10 cases)
- [ ] barrel export `template/index.ts`

---

### Phase 5: Agent Instance 创建（基线） ⭐ 首个测试里程碑

**目标**：从 Template 构造 Instance 工作目录，将 Domain Context 物化为实际文件。

> **核心理念**：Agent Instance = 一个被初始化好的工作目录。
> Initializer 的职责是**构造这个目录并写入所有必要文件**，使得 Agent Backend 指向该目录即可工作。

**位置**：`packages/core/src/initializer/`

#### Instance 工作目录结构

```
{instancesBaseDir}/
└── my-reviewer/                        ← name 即目录名，全局唯一
    ├── .actant.json                ← Instance 元数据（AgentInstanceMeta）
    ├── AGENTS.md                       ← 物化的 Skills/Rules
    ├── .cursor/
    │   └── mcp.json                    ← 物化的 MCP Server 配置
    ├── .trellis/                       ← 物化的 Workflow 模板
    │   └── workflow.md
    ├── prompts/
    │   └── system.md                   ← 物化的 System Prompt
    └── ...                             ← 其他物化的 Domain Context 文件
```

> `.actant.json` 是唯一的元数据文件。其他文件都是 Domain Context 的物化产物，
> 由 Initializer 从 Template 引用的组件解析并写入。

#### 接口设计

```typescript
// agent-initializer.ts
export class AgentInitializer {
  constructor(
    private templateRegistry: TemplateRegistry,
    private instancesBaseDir: string,        // 所有 Instance 目录的根路径
    private options?: InitializerOptions,
  ) {}

  /**
   * 创建新 Instance（始终创建新目录）
   * 1. 从 Registry 获取 Template
   * 2. 创建 {instancesBaseDir}/{name}/ 目录
   * 3. 解析 Domain Context 引用，物化为文件
   * 4. 写入 .actant.json 元数据
   */
  async createInstance(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<AgentInstanceMeta> { ... }

  /**
   * 查找已有 Instance 或创建新 Instance（幂等操作）
   * - 目录 {instancesBaseDir}/{name}/ 存在且 .actant.json 有效 → 返回已有
   * - 目录不存在 → 创建新 Instance
   */
  async findOrCreateInstance(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<{ meta: AgentInstanceMeta; created: boolean }> { ... }

  /** 删除 Instance（清理工作目录） */
  async destroyInstance(name: string): Promise<void> { ... }
}

// context/context-materializer.ts
export class ContextMaterializer {
  /**
   * 将 Template 中引用的 Domain Context 组件解析并写入工作目录
   * - skills → AGENTS.md
   * - mcpServers → .cursor/mcp.json
   * - workflow → .trellis/
   * - prompts → prompts/system.md
   */
  async materialize(
    workspaceDir: string,
    domainContext: DomainContextConfig,
  ): Promise<void> { ... }
}
```

#### 物化规则

| Domain Context 组件 | 物化目标文件 | 说明 |
|---------------------|-------------|------|
| `skills` | `AGENTS.md` | 多个 Skill 合并写入，Agent Backend 会自动读取 |
| `mcpServers` | `.cursor/mcp.json` | Cursor/Claude Code 标准 MCP 配置路径 |
| `workflow` | `.trellis/` 目录 | Workflow 模板整体复制 |
| `prompts` | `prompts/system.md` | 系统提示词合并写入 |
| `subAgents` | `.actant.json` 中记录引用 | 子 Agent 不物化，运行时解析 |

#### FindOrCreate 行为

| 场景 | 判断条件 | 行为 |
|------|---------|------|
| Instance 不存在 | `{name}/` 目录不存在 | 创建新目录 + 物化 + 写元数据 |
| Instance 存在且有效 | 目录存在，`.actant.json` 合法 | 读取元数据返回 |
| Instance 存在但损坏 | 目录存在，`.actant.json` 缺失或非法 | 抛出 `InstanceCorruptedError` |

> `name` 全局唯一（即目录名唯一），不再需要 `templateName + name` 组合作为唯一键。
> `templateName` 仅作为元数据记录来源。

**测试要点**：
- **创建 Instance** → 目录存在、`.actant.json` 内容正确、Domain Context 文件已物化
- Template 不存在 → `TemplateNotFoundError`
- `name` 冲突（目录已存在）→ 明确错误
- 物化验证：skills → AGENTS.md 内容正确
- 物化验证：mcpServers → `.cursor/mcp.json` 内容正确
- **destroyInstance** → 目录被完整删除
- **findOrCreate 首次调用** → created: true，目录已创建
- **findOrCreate 重复调用（同 name）** → created: false，返回已有元数据
- **findOrCreate 目录存在但损坏** → 报错
- **集成测试**：TemplateRegistry + Initializer 联合

**交付件**：
- [ ] `agent-initializer.ts`
- [ ] `context-materializer.ts`（Domain Context 物化逻辑）
- [ ] `agent-initializer.test.ts` (>=12 cases)
- [ ] `context-materializer.test.ts` (>=8 cases)
- [ ] barrel export `initializer/index.ts`

---

### Phase 6: Agent Manager 基线 ⭐ 创建+启动 E2E

**目标**：管理 Agent Instance 的生命周期 — 启动、停止、状态查询、重启恢复。

> **核心理念**：Instance 的元数据（`.actant.json`）就在工作目录中。
> 不需要独立的数据库或外部 JSON 存储——扫描 Instance 目录就能恢复全部状态。

**位置**：`packages/core/src/manager/`

#### 状态发现机制

系统不维护独立的 Instance 注册表。所有 Instance 信息通过**扫描工作目录**获得：

```
{instancesBaseDir}/
├── my-reviewer/
│   └── .actant.json     ← 读取此文件 = 获得这个 Instance 的所有元数据
├── ci-bot/
│   └── .actant.json
└── .corrupted/               ← 损坏的 Instance 目录移到这里
```

```
系统启动 / listAgents()
  │
  ├─ 扫描 {instancesBaseDir}/ 下所有子目录
  │
  ├─ 对每个子目录读取 .actant.json
  │   ├─ Zod 验证通过 → 加入内存缓存
  │   └─ 验证失败 → 记录日志，移至 .corrupted/
  │
  └─ 状态修正（重启恢复）：
      ├─ running / starting → 改为 stopped（进程已丢失），回写 .actant.json
      └─ stopping → 改为 stopped
```

#### 接口设计

```typescript
// agent-manager.ts
export class AgentManager {
  private cache: Map<string, AgentInstanceMeta>;  // name → meta 内存缓存

  constructor(
    private initializer: AgentInitializer,
    private instancesBaseDir: string,
    private options?: ManagerOptions,
  ) {}

  /** 启动时扫描所有工作目录，加载元数据到缓存，修正遗留状态 */
  async initialize(): Promise<void> { ... }

  /** 创建新 Agent（委托给 Initializer） */
  async createAgent(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<AgentInstanceMeta> { ... }

  /** 查找或创建 Agent（幂等入口） */
  async getOrCreateAgent(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<{ meta: AgentInstanceMeta; created: boolean }> { ... }

  /** 启动 Agent — 将 Agent Backend 指向工作目录 */
  async startAgent(name: string): Promise<void> { ... }

  /** 停止 Agent */
  async stopAgent(name: string): Promise<void> { ... }

  /** 删除 Agent（销毁工作目录） */
  async destroyAgent(name: string): Promise<void> { ... }

  /** 按 name 查询（name = 目录名 = 唯一标识） */
  getAgent(name: string): AgentInstanceMeta | undefined { ... }
  getStatus(name: string): AgentStatus | undefined { ... }
  listAgents(): AgentInstanceMeta[] { ... }
}

// launcher/agent-launcher.ts (基线：one-shot 模式)
export interface AgentLauncher {
  launch(workspaceDir: string, meta: AgentInstanceMeta): Promise<AgentProcess>;
  terminate(process: AgentProcess): Promise<void>;
}

// AgentProcess — 运行中的进程信息
interface AgentProcess {
  pid: number;
  workspaceDir: string;
  instanceName: string;
}
```

#### 元数据读写

Manager 对 `.actant.json` 的操作封装为工具函数：

```typescript
// state/instance-meta-io.ts

/** 从工作目录读取 .actant.json */
async function readInstanceMeta(workspaceDir: string): Promise<AgentInstanceMeta> { ... }

/** 原子写入 .actant.json（write-tmp + rename） */
async function writeInstanceMeta(workspaceDir: string, meta: AgentInstanceMeta): Promise<void> { ... }

/** 更新 .actant.json 的部分字段 */
async function updateInstanceMeta(
  workspaceDir: string,
  patch: Partial<AgentInstanceMeta>,
): Promise<AgentInstanceMeta> { ... }

/** 扫描 instancesBaseDir，返回所有有效 Instance 的元数据 */
async function scanInstances(instancesBaseDir: string): Promise<AgentInstanceMeta[]> { ... }
```

#### 状态流转

```
createAgent()        → status: created    → 写入 .actant.json
startAgent()         → status: starting   → 启动进程 → status: running
                                                        ↓ (进程退出)
                                                     status: stopped
stopAgent()          → status: stopping   → 终止进程 → status: stopped
destroyAgent()       → 删除整个工作目录
系统重启 initialize() → running → stopped（进程已丢失）
```

**测试要点**：
- **生命周期**：created → starting → running → stopping → stopped 完整流转
- 重复启动 → `AgentAlreadyRunningError`
- 停止未运行的 Agent → 错误处理
- **getOrCreateAgent 幂等性**：相同 name 多次调用返回同一实例
- **getOrCreateAgent + startAgent 组合**：找到已停止实例 → 重新启动
- **destroyAgent**：工作目录被完整删除，缓存清除
- **listAgents**：列出所有实例，状态正确
- **重启恢复**：创建实例 → 新建 Manager → initialize → 实例恢复
- **遗留状态修正**：手动写入 `status: running` → initialize 后变为 `stopped`
- **损坏目录处理**：`.actant.json` 缺失或非法 → 移至 `.corrupted/`
- **元数据 I/O**：原子写入验证、并发安全
- **E2E 测试**：Template → Registry → Initializer → Manager → 重启恢复 全链路

**交付件**：
- [ ] `agent-manager.ts`
- [ ] `agent-launcher.ts`（接口 + mock 实现）
- [ ] `instance-meta-io.ts`（元数据读写工具函数）
- [ ] `instance-meta-io.test.ts` (>=8 cases)
- [ ] `agent-manager.test.ts` (>=15 cases)
- [ ] `tests/integration/agent-lifecycle.test.ts` — 跨模块集成测试

---

### Phase 7: Domain Context 组件管理器

**目标**：实现 Skill/Prompt/MCP/Workflow 的注册、解析、引用消解。

**位置**：`packages/core/src/domain/`

| 组件 | 管理器 | 职责 |
|------|--------|------|
| Skill | `SkillManager` | 加载 skill 定义（JSON），按名称注册和解析 |
| Prompt | `PromptManager` | 系统提示词管理，支持变量插值 |
| MCP | `McpConfigManager` | MCP Server 配置加载和引用解析 |
| Workflow | `WorkflowManager` | Workflow 模板管理 |

```typescript
// domain/skill/skill-manager.ts
export class SkillManager {
  register(skill: SkillDefinition): void { ... }
  resolve(names: string[]): SkillDefinition[] { ... }
  loadFromDirectory(dir: string): Promise<void> { ... }
}
```

**每个管理器的测试要点**：
- 注册/解析/列表 CRUD
- 引用不存在的组件 → 明确错误
- 从 JSON 文件加载
- 与 Initializer 集成（Domain Context 组装）

**交付件**：
- [ ] 4 个 Manager 实现
- [ ] 4 组测试文件 (每组 >=6 cases)
- [ ] 集成测试：Template → Domain Context 解析

---

### Phase 8: CLI 集成（后续独立 Roadmap）

Phase 8 不在本次 Roadmap 核心范围内，但列出接口以确保 Phase 1-7 的设计预留 CLI 适配能力。

```
actant template create <name>        # 创建模板
actant template list                 # 列表模板
actant template show <name>          # 查看模板详情
actant template validate <file>      # 验证模板文件

actant agent create <name> --template <template>  # 从模板创建 Agent
actant agent start <name>            # 启动 Agent
actant agent stop <name>             # 停止 Agent
actant agent status [name]           # 查看状态
actant agent list                    # 列出所有 Agent
actant agent destroy <name>          # 销毁 Agent（删除工作目录）
```

---

## 依赖关系图

```
Phase 0: 基础设施
    ↓
Phase 1: 共享类型 (shared)
    ↓
Phase 2: Template Schema (core/template/schema)
    ↓
Phase 3: Template Loader (core/template/loader)
    ↓
Phase 4: Template Registry (core/template/registry)
    ↓              ↘
Phase 5: Initializer    Phase 7: Domain Managers (可并行)
    ↓              ↙
Phase 6: Agent Manager
    ↓
Phase 8: CLI (独立 Roadmap)
```

> Phase 7 与 Phase 5-6 可以**部分并行**开发。Phase 5-6 先用 mock Domain Context，Phase 7 完成后再接入真实解析。

---

## 测试策略

### 分层测试金字塔

```
         ╱╲
        ╱E2E╲               1-2 个全链路测试
       ╱──────╲
      ╱ 集成测试 ╲           模块间交互测试
     ╱────────────╲
    ╱   单元测试     ╲       每个类/函数的独立测试
   ╱──────────────────╲
```

| 层级 | 位置 | 覆盖目标 |
|------|------|---------|
| 单元测试 | `*.test.ts`（与源码同目录） | Schema 验证、Loader 解析、Registry CRUD、状态机转换 |
| 集成测试 | `tests/integration/` | Template→Initializer→Manager 链路 |
| E2E 测试 | `tests/e2e/` | 完整 CLI 命令流程（Phase 8） |

### 测试优先级

1. **Phase 2 的 Schema 测试** — 最早可测试的单元
2. **Phase 5 的 Initializer 测试** — 首个涉及多模块的集成点
3. **Phase 6 的生命周期测试** — 验证核心创建→启动流程

### Fixture 管理

```
packages/core/src/template/loader/__fixtures__/
├── valid-template.json
├── minimal-template.json
├── invalid-missing-name.json
├── invalid-bad-version.json
└── complex-template.json
```

---

## 风险与约束

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Schema 设计过早定型 | Template 格式后期需大改 | Schema 分层设计，核心字段先定，扩展字段用 `metadata` |
| 进程管理跨平台差异 | Windows/Linux 行为不一致 | Phase 6 先用 mock launcher，真实进程管理单独迭代 |
| Domain Context 引用循环 | SubAgent 引用形成环 | 引用解析时做循环检测 |
| 工作目录损坏 | `.actant.json` 丢失或非法 | 启动时自动隔离到 `.corrupted/`，不阻塞其他 Instance |
| 物化文件与 Template 不同步 | Template 更新后已有 Instance 的物化文件过时 | 提供 `reinitialize` 操作重新物化，不影响元数据 |
| 并发写 `.actant.json` | 状态数据竞争 | 原子写入（write-tmp + rename），内存缓存为单一写入点 |

---

## 开发顺序建议

考虑到**测试优先**的原则，推荐的实际开发顺序为：

```
Session 1: Phase 0 + Phase 1          → 基础可编译可测试
Session 2: Phase 2                     → Schema 测试全绿 (M1)
Session 3: Phase 3 + Phase 4          → Template 全链路测试全绿 (M2)
Session 4: Phase 5                     → Instance 创建测试全绿
Session 5: Phase 6                     → 创建+启动 E2E 全绿 (M3)
Session 6: Phase 7                     → Domain Context 测试全绿 (M4)
```

每个 Session 结束时：
1. 所有测试通过
2. 类型检查通过
3. 可以演示该阶段的能力

---

## 附录 A：Employee（持久化 Agent）扩展备忘

> 以下为未来扩展方向的对齐记录，不在本 Roadmap（Phase 0-7）范围内。

**定位**：Employee 是 Agent Instance 的高级运行模式，在 Phase 6 Manager 基线完成后作为增量扩展实现。

**已对齐的结论**：

| 项目 | 结论 |
|------|------|
| Backend | 与常规 Agent 相同（Claude Code / Cursor），不需要专门的 headless 后端 |
| 自我成长 | 机制待持续探索，不预设方案 |
| 实现阶段 | Phase 6 之后，作为 Manager 的高级模式 |

**Employee 相对常规 Agent 的增量能力**：

- `launchMode: 'normal'` — Actant 全权管理生命周期
- 崩溃自动重启 + 心跳健康检查
- 长期记忆（memory plugin）
- 定时任务（scheduler plugin）
- 通信渠道接入（IM / Email）
- 自我成长（待探索）

**设计预留**：当前 Roadmap 的 `AgentInstanceMeta` 类型中 `metadata` 字段和 Plugin 机制（Phase 7）
为 Employee 扩展提供了扩展点，不需要修改核心接口。

---

## 附录 B：示例 Agent Template JSON

```json
{
  "$schema": "https://actant.dev/schemas/agent-template.json",
  "name": "code-review-agent",
  "version": "1.0.0",
  "description": "A code review agent powered by Claude",

  "backend": {
    "type": "claude-code",
    "config": {
      "model": "claude-sonnet-4-20250514"
    }
  },

  "provider": {
    "type": "anthropic",
    "config": {
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    }
  },

  "domainContext": {
    "skills": ["code-review", "typescript-expert"],
    "prompts": ["system-code-reviewer"],
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@anthropic/mcp-filesystem"]
      }
    ],
    "workflow": "trellis-standard"
  },

  "initializer": {
    "steps": [
      { "type": "create-workspace" },
      { "type": "install-dependencies" },
      { "type": "apply-workflow" }
    ]
  },

  "metadata": {
    "author": "Actant Team",
    "tags": ["code-review", "typescript"]
  }
}
```
