# Memory Layer — Agent 进化机制设计

> **Status**: Draft (中期开发备忘)
> **Priority**: Mid-term
> **Created**: 2026-02-20
> **Inspired by**: [OpenViking](https://github.com/volcengine/OpenViking) 文件系统范式 + 分层上下文 + 记忆自迭代

---

## 目录

1. [问题陈述](#1-问题陈述)
2. [设计目标](#2-设计目标)
3. [核心概念](#3-核心概念)
4. [架构设计](#4-架构设计)
5. [类型定义](#5-类型定义)
6. [物化流程变更](#6-物化流程变更)
7. [记忆提取机制](#7-记忆提取机制)
8. [跨实例知识共享](#8-跨实例知识共享)
9. [Template 进化路径](#9-template-进化路径)
10. [分阶段实施计划](#10-分阶段实施计划)
11. [与现有架构的关系](#11-与现有架构的关系)
12. [设计约束与取舍](#12-设计约束与取舍)
13. [OpenViking 参考对照](#13-openviking-参考对照)
14. [附录 A: `ac://` 统一寻址协议](#附录-a-ac-统一寻址协议)

---

## 1. 问题陈述

当前 Template → Instance 的关系是**单向、无反馈**的：

```
AgentTemplate (不可变, v1.0.0)
    │
    │ createInstance() — 一次性物化
    ▼
Instance Workspace (静态文件快照)
    │
    │ launcher.launch() — 启动 IDE Agent
    ▼
Agent Session (Cursor/Claude Code 在 workspace 内工作)
    │
    │ session 结束
    ▼
    ∅  ← 所有经验随 context window 清零
```

### 具体缺陷

| 问题 | 影响 |
|------|------|
| **无跨 session 记忆** | Agent 每次启动都是"失忆"状态，重复犯同样的错误 |
| **无经验积累** | 用户反复纠正的偏好（如 commit 格式、代码风格）无法持久化 |
| **无知识共享** | 实例 A 踩过的坑，实例 B 一无所知 |
| **Template 无进化压力** | 没有结构化的反馈回路来驱动 Template 改进 |

### 根本原因

`AgentInstanceMeta` 只记录运维状态（status、pid），不记录认知状态。
`ContextMaterializer.materialize()` 是纯函数 — 同一 Template 永远产出同一文件，没有"历史"参与。

---

## 2. 设计目标

| 目标 | 描述 | 优先级 |
|------|------|--------|
| 跨 session 记忆 | 实例在多次会话间积累经验 | P0 |
| 记忆参与物化 | 物化产物 = Template + Memory 合并 | P0 |
| 零外部依赖 | 不引入向量数据库、Embedding 模型等 | P0 |
| 跨实例共享 | 高置信度经验可提升到共享层 | P1 |
| Template 进化建议 | 系统可建议 Template 改进 | P2 |
| 向后兼容 | 无 Memory 时行为与当前完全一致 | P0 |

---

## 3. 核心概念

### 3.1 基因-表观遗传类比

| 生物学 | Actant | 说明 |
|--------|-----------|------|
| 基因组 (Genome) | AgentTemplate | 不可变蓝图，定义种族共性 |
| 表观遗传 (Epigenome) | Memory Layer | 后天获得的表达调控，实例独有 |
| 个体 (Organism) | Instance Workspace | 基因 + 表观遗传的物化表达 |
| 生命经历 | Agent Sessions | 与环境交互获得经验 |
| 种群进化 | Template Version Bump | 跨代的有利变异被保留 |

**关键洞察**：Template 不变 ≠ Agent 不变。DNA 一生不变，但人一直在学习。进化发生在记忆层，不需要修改 Template。

### 3.2 Docker 类比扩展

延续 `architecture-docker-analogy.md` 的映射：

| Docker | Actant (当前) | Actant (+ Memory) |
|--------|-------------------|----------------------|
| Image Layer (只读) | Template 物化 | Template 物化（不变） |
| Container Layer (可写) | (不存在) | **Memory Layer (.memory/)** |
| Union FS (合并视图) | (不存在) | **Materialization = Template ∪ Memory** |
| Volume (持久存储) | Domain Context 文件 | Domain Context + Memory 文件 |
| docker commit | (不存在) | **Memory Promotion → Shared Pool** |

### 3.3 三层上下文 (受 OpenViking 启发)

OpenViking 将所有上下文分为 L0/L1/L2 三个粒度层。Actant 采纳此理念，但用**规则生成**替代 VLM 自动生成：

| 层级 | Token 预算 | 内容 | 用途 |
|------|-----------|------|------|
| L0 (Abstract) | ~20 tokens/组件 | name + 一句话 summary | Agent 快速浏览可用组件 |
| L1 (Overview) | ~200 tokens/组件 | description + tags + dependencies | Agent 规划决策 |
| L2 (Detail) | 完整内容 | 原始 content | 物化到 workspace |

**当前状态**：所有组件直接以 L2 物化，无分层。
**目标**：支持按需加载 — 先给 Agent L0 列表，Agent 自选后再物化 L2。

---

## 4. 架构设计

### 4.1 进化层级架构

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Layer 3: Template Evolution (种群进化)               │
│  ┌─────────────────────────────────────────┐         │
│  │ Template v1.0 → v1.1 → v2.0            │         │
│  │ 高置信度经验经人工审核写回 Template       │         │
│  └──────────────────▲──────────────────────┘         │
│                     │ promote (需人工审核)             │
│                                                      │
│  Layer 2: Shared Memory (跨实例共享记忆)              │
│  ┌──────────────────┴──────────────────────┐         │
│  │ ~/.actant/memory/                   │         │
│  │  ├── user/coding-style.json             │         │
│  │  ├── user/project-conventions.json      │         │
│  │  └── learnings/common-errors.json       │         │
│  └──────────────────▲──────────────────────┘         │
│                     │ confidence > threshold           │
│                     │ + 出现在 2+ 个 instances 中      │
│                                                      │
│  Layer 1: Instance Memory (实例级记忆)                │
│  ┌──────────────────┴──────────────────────┐         │
│  │ instances/{name}/.memory/               │         │
│  │  ├── meta.json                          │         │
│  │  ├── task-history.jsonl                 │         │
│  │  ├── error-patterns.json                │         │
│  │  └── insights.md                        │         │
│  └──────────────────▲──────────────────────┘         │
│                     │ session end → extract            │
│                                                      │
│  Layer 0: Session (会话，天然存在)                     │
│  ┌──────────────────┴──────────────────────┐         │
│  │ Agent 在 context window 内工作           │         │
│  │ 产出 git diff / error logs / artifacts   │         │
│  └─────────────────────────────────────────┘         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.2 Instance Workspace 目录结构变更

```
instances/{name}/
├── AGENTS.md                  ← Template 物化 + Memory Insights 合并
├── .cursor/mcp.json           ← Template 物化（不受 Memory 影响）
├── .trellis/workflow.md       ← Template 物化（不受 Memory 影响）
├── prompts/system.md          ← Template 物化（不受 Memory 影响）
├── .memory/                   ← 【新增】记忆层（可写，跨 session 持久化）
│   ├── meta.json              # 记忆元数据（version, stats）
│   ├── task-history.jsonl     # 任务执行日志（append-only）
│   ├── error-patterns.json    # 错误模式库（merge-on-write）
│   └── insights.md            # 凝练后的高价值经验（由 consolidator 生成）
└── .actant.json           ← 增加 memory 相关字段
```

### 4.3 数据流

```
                ┌─────────────┐
                │  Template   │
                │  Registry   │
                └──────┬──────┘
                       │ resolve skills/prompts/workflow
                       ▼
              ┌─────────────────┐
              │ ContextBroker   │ ← 替代 ContextMaterializer
              │                 │
              │  inputs:        │
              │   - template    │
  ┌──────────▶│   - instance    │
  │           │     memory      │
  │           │   - shared      │
  │           │     memory      │
  │           └────────┬────────┘
  │                    │ merge & materialize
  │                    ▼
  │           ┌─────────────────┐
  │           │    Workspace    │
  │           │   (物理文件)     │
  │           └────────┬────────┘
  │                    │ Agent 在此工作
  │                    ▼
  │           ┌─────────────────┐
  │           │  Agent Session  │
  │           └────────┬────────┘
  │                    │ session end
  │                    ▼
  │           ┌─────────────────┐
  │           │   Session       │
  │           │   Extractor     │
  │           └────────┬────────┘
  │                    │ extract memories
  │                    ▼
  │           ┌─────────────────┐
  └───────────│ Instance Memory │
              │  (.memory/)     │
              └─────────────────┘
```

---

## 5. 类型定义

### 5.1 Memory 核心类型

```typescript
// ---- packages/shared/src/types/memory.types.ts ----

/** 记忆条目的分类 */
export type MemoryKind =
  | "task-history"       // 任务执行记录
  | "error-pattern"      // 错误模式
  | "user-preference"    // 用户偏好
  | "tool-usage"         // 工具使用经验
  | "best-practice";     // 最佳实践

/** 单条记忆 */
export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  content: string;
  confidence: number;          // 0.0 - 1.0，多次确认后递增
  tags: string[];
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
}

/** 记忆来源追溯 */
export interface MemorySource {
  instanceName: string;
  sessionId?: string;
  commitHash?: string;
  timestamp: string;
}

/** Instance Memory 元数据 */
export interface InstanceMemoryMeta {
  version: number;             // 每次 consolidate 递增
  totalEntries: number;
  totalSessions: number;
  lastExtractedAt?: string;
  lastConsolidatedAt?: string;
}

/** 完整的 Instance Memory */
export interface InstanceMemory {
  meta: InstanceMemoryMeta;
  entries: MemoryEntry[];
  insights?: string;           // 凝练后的 markdown（注入到 AGENTS.md）
}
```

### 5.2 AgentInstanceMeta 扩展

```typescript
export interface AgentInstanceMeta {
  // ...现有字段不变...

  // ---- 进化相关（新增，全部 optional 保持兼容） ----
  memoryVersion?: number;      // .memory/meta.json version 的镜像
  totalSessions?: number;      // 累计会话数
  lastSessionAt?: string;      // 最后会话时间
}
```

### 5.3 分层上下文节点

```typescript
// ---- packages/shared/src/types/context-layer.types.ts ----

/** L0: 最小摘要，用于列举和快速筛选 */
export interface ContextL0 {
  uri: string;                 // 组件标识（可为 name，未来可扩展为 URI）
  name: string;
  summary: string;             // 一句话描述（~20 tokens）
}

/** L1: 元数据层，用于 Agent 规划决策 */
export interface ContextL1 extends ContextL0 {
  description?: string;
  tags?: string[];
  dependencies?: string[];     // 依赖的其他组件名
}

/** L2: 完整内容层 */
export interface ContextL2<T = unknown> extends ContextL1 {
  data: T;                     // SkillDefinition | PromptDefinition | ...
}
```

---

## 6. 物化流程变更

### 6.1 当前 → 目标

```
当前:
  materialize(workspaceDir, domainContext)
  → 纯 Template 投射，无记忆参与

目标:
  materialize(workspaceDir, domainContext, memory?)
  → Template + Memory 合并物化
  → memory 为 undefined 时行为与当前完全一致（向后兼容）
```

### 6.2 AGENTS.md 合并策略

```markdown
# Agent Skills

## code-review
> TypeScript code review rules

Check error handling
Review types
...

---

## ts-expert
> TypeScript expert

Use strict mode
Prefer unknown over any
...

---

# Instance Insights

> The following insights are accumulated from previous sessions
> of this agent instance. They supplement the skills above.

- This project uses pnpm workspace monorepo; cross-package imports
  require building the shared package first
- User prefers commit messages in Chinese
- Known issue: vitest --pool=forks has compatibility problems under
  Node 22, use --pool=threads instead
- When modifying shared types, always run `pnpm -r build` before testing
```

### 6.3 ContextBroker 接口

```typescript
// ---- packages/core/src/initializer/context/context-broker.ts ----

export interface MaterializeOptions {
  memory?: InstanceMemory;
  sharedMemory?: MemoryEntry[];
}

export class ContextBroker {
  constructor(private readonly managers?: DomainManagers) {}

  /**
   * 物化 = Template 解析 + Memory 合并。
   * 当 options.memory 为空时退化为当前 ContextMaterializer 行为。
   */
  async materialize(
    workspaceDir: string,
    domainContext: DomainContextConfig,
    options?: MaterializeOptions,
  ): Promise<void>;
}
```

### 6.4 AgentManager 生命周期变更

```typescript
// startAgent 增加 re-materialize
async startAgent(name: string): Promise<void> {
  const meta = this.requireAgent(name);
  const dir = join(this.instancesBaseDir, name);

  // 【新增】读取实例记忆
  const memory = await this.memoryStore.load(dir);

  // 【新增】重新物化（Template + Memory 合并）
  const template = this.templateRegistry.getOrThrow(meta.templateName);
  await this.broker.materialize(dir, template.domainContext, { memory });

  // 启动 Agent（现有逻辑不变）
  const starting = await updateInstanceMeta(dir, { status: "starting" });
  this.cache.set(name, starting);
  const process = await this.launcher.launch(dir, starting);
  // ...
}

// stopAgent 增加 memory extraction
async stopAgent(name: string): Promise<void> {
  // ...现有停止逻辑...

  // 【新增】提取 session 经验
  const artifacts = await this.collectSessionArtifacts(dir);
  const entries = await this.extractor.extract(artifacts);
  await this.memoryStore.append(dir, entries);

  // 【新增】更新认知状态
  await updateInstanceMeta(dir, {
    totalSessions: (meta.totalSessions ?? 0) + 1,
    lastSessionAt: new Date().toISOString(),
  });
}
```

---

## 7. 记忆提取机制

### 7.1 Session Artifacts

```typescript
/** Agent session 结束后可收集到的产物 */
export interface SessionArtifacts {
  gitDiff?: string;
  gitCommitMessages?: string[];
  errorLogs?: string[];
  modifiedFiles?: string[];
  // Phase 2: conversationLog, userCorrections
}
```

### 7.2 Extractor 接口

```typescript
export interface SessionExtractor {
  extract(artifacts: SessionArtifacts): Promise<MemoryEntry[]>;
}
```

### 7.3 两种实现策略

| 策略 | 实现 | 外部依赖 | 精度 | 阶段 |
|------|------|---------|------|------|
| Rule-based | 正则 + 模式匹配 | 无 | 中 | Phase 1 |
| LLM-assisted | 调用 LLM 分析 session log | 需要模型 API | 高 | Phase 2 |

#### Rule-based Extractor（Phase 1）

```typescript
class RuleBasedExtractor implements SessionExtractor {
  async extract(artifacts: SessionArtifacts): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];

    // 规则 1: commit messages → task-history
    for (const msg of artifacts.gitCommitMessages ?? []) {
      entries.push(makeEntry("task-history", msg, 1.0));
    }

    // 规则 2: 重复出现的 error patterns
    const errorCounts = countPatterns(artifacts.errorLogs ?? []);
    for (const [pattern, count] of errorCounts) {
      if (count >= 2) {
        entries.push(makeEntry("error-pattern", pattern, Math.min(count * 0.3, 1.0)));
      }
    }

    // 规则 3: 从 git diff 提取修改过的配置文件
    // → 可能揭示项目约定

    return entries;
  }
}
```

### 7.4 Memory Consolidator

将碎片化的 `task-history.jsonl` 定期凝练为 `insights.md`：

```typescript
export interface MemoryConsolidator {
  /**
   * 读取全部 entries，聚合重复项，提升 confidence，
   * 生成人类可读的 insights.md。
   */
  consolidate(memory: InstanceMemory): Promise<ConsolidateResult>;
}

export interface ConsolidateResult {
  updatedEntries: MemoryEntry[];  // 去重 + confidence 更新后的条目
  insights: string;               // 生成的 markdown
  removedCount: number;           // 被合并掉的条目数
}
```

**凝练策略**：

1. 相似 content 的 entries 合并，confidence 取最高值
2. confidence < 0.2 的旧条目淘汰
3. 按 kind 分组渲染为 markdown sections
4. 总 token 预算控制在 ~1000 tokens（避免挤占 Agent context window）

---

## 8. 跨实例知识共享

### 8.1 Shared Memory Pool

```
~/.actant/memory/
├── user/                      # 用户偏好（最高优先级）
│   ├── coding-style.json
│   └── project-conventions.json
└── learnings/                 # 跨实例经验
    ├── common-errors.json
    └── best-practices.json
```

### 8.2 Memory Promoter

```typescript
export interface PromotionCriteria {
  minConfidence: number;       // 默认 0.8
  minInstances: number;        // 默认 2
}

export class MemoryPromoter {
  /**
   * 扫描所有 instance memory，
   * 将满足条件的经验提升到 shared pool。
   */
  async promote(
    instancesDir: string,
    sharedMemoryDir: string,
    criteria?: PromotionCriteria,
  ): Promise<PromotionResult>;
}

export interface PromotionResult {
  promoted: MemoryEntry[];     // 提升到 shared pool 的条目
  totalScanned: number;
  instancesScanned: number;
}
```

### 8.3 物化时的 Memory 合并优先级

```
最终 Insights = merge(
  Shared Memory (user/)       ← 最高优先级（用户说了算）
  Shared Memory (learnings/)  ← 跨实例验证过的经验
  Instance Memory             ← 实例自身积累
)
```

冲突解决：相同 kind + 相似 content → 保留 confidence 更高的。

---

## 9. Template 进化路径

### 9.1 Evolution Advisor（P2，长期目标）

当 Shared Memory 中的某些经验被充分验证后，系统可以**建议**更新 Template：

```
Shared Memory                    Template Registry
    │                                │
    │ entry.confidence > 0.95        │
    │ entry.kind == "best-practice"  │
    │ verified across 3+ instances   │
    │                                │
    └──→ EvolutionAdvisor ──────────→│  建议:
                                     │  skills/code-review 增加
                                     │  monorepo 相关章节
                                     │
                                     ▼
                              Template v1.0.0 → v1.1.0
                              (需人工审核确认)
```

### 9.2 进化不是自动的

**设计约束**：Template 的更改始终需要人工审核。系统只产出建议，不自动修改 Template。

理由：
- AI 积累的经验不一定都正确（幻觉、过拟合）
- Template 是可分享的公共资产，修改影响所有使用者
- 版本控制语义要求每次 Template 变更都是有意识的

---

## 10. 分阶段实施计划

### Phase 1: Instance Memory（最小闭环）

**目标**：单个实例跨 session 记忆。

| 任务 | 涉及包 | 改动量 |
|------|--------|--------|
| 定义 Memory 类型 | `@actant/shared` | 新文件 |
| 实现 InstanceMemoryStore (读写 .memory/) | `@actant/core` | 新文件 |
| 实现 RuleBasedExtractor | `@actant/core` | 新文件 |
| ContextMaterializer 增加 memory 参数 | `@actant/core` | 改动现有 |
| AgentManager.startAgent 增加 re-materialize | `@actant/core` | 改动现有 |
| AgentManager.stopAgent 增加 extraction | `@actant/core` | 改动现有 |
| AgentInstanceMeta 增加 memory 字段 | `@actant/shared` | 改动现有 |

**验收标准**：
- Agent 实例第二次启动时，AGENTS.md 包含第一次 session 的 insights
- 无 memory 时行为与当前完全一致

### Phase 2: Memory Consolidation + Shared Memory

**目标**：碎片记忆凝练 + 跨实例共享。

| 任务 | 涉及包 |
|------|--------|
| 实现 MemoryConsolidator | `@actant/core` |
| 实现 MemoryPromoter | `@actant/core` |
| Shared Memory 目录管理 | `@actant/core` |
| CLI: `actant memory list/consolidate/promote` | `@actant/cli` |
| RPC: memory.* handlers | `@actant/api` |

### Phase 3: Context Layers + Evolution Advisor

**目标**：分层上下文 + Template 进化建议。

| 任务 | 涉及包 |
|------|--------|
| ContextL0/L1/L2 类型和自动派生 | `@actant/shared`, `@actant/core` |
| ContextBroker 替代 ContextMaterializer | `@actant/core` |
| LLM-assisted Extractor（可选） | `@actant/core` |
| EvolutionAdvisor | `@actant/core` |
| CLI: `actant template suggest-upgrade` | `@actant/cli` |

---

## 11. 与现有架构的关系

### 渐进增强，不是推翻重来

```
Phase 0 (当前):
  Template ──name──→ Manager.resolve() ──→ Materializer ──→ 物理文件
                     (Map<string,T>)       (writeFile)
                     无记忆参与

Phase 1 (Instance Memory):
  Template ──name──→ Manager.resolve() ──→ Materializer ──→ 物理文件
                                               ▲
                                               │ merge
                                         InstanceMemory
                                         (.memory/)

Phase 2 (Shared Memory):
  Template ──name──→ Manager.resolve() ──→ Materializer ──→ 物理文件
                                               ▲
                                               │ merge (优先级排序)
                                         SharedMemory + InstanceMemory

Phase 3 (Context Layers + ContextBroker):
  Template ──uri──→ ContextStore ──L0/L1──→ ContextBroker ──L2+Memory──→ 物理文件
```

### 向后兼容保证

- `materialize(dir, domainContext)` 不传 memory → 行为不变
- `AgentInstanceMeta` 新字段全部 optional → 旧实例不受影响
- `.memory/` 目录不存在时 → 跳过记忆加载
- `ContextBroker` 在 Phase 3 才引入 → Phase 1/2 继续使用 `ContextMaterializer`

---

## 12. 设计约束与取舍

### 采纳的约束

| 约束 | 理由 |
|------|------|
| 零外部依赖 | Actant 是轻量编排框架，不应强制引入向量数据库 |
| Template 不可变 | 保持可分享、可版本控制、可复现的纯净性 |
| Memory 是增量的 | 只添加不删除 Template 原有内容，Memory 是补充层 |
| Template 进化需人工审核 | AI 经验不一定正确，防止幻觉污染公共模板 |
| Insights 有 token 预算 | 防止记忆膨胀挤占 Agent context window |

### 明确不做的事

| 不做 | 理由 |
|------|------|
| 向量语义检索 | 当前组件规模小（几十个），tag 匹配足够 |
| 自动 Template 升级 | 风险过高，必须人工审核 |
| 记忆在实例间自动同步 | Promote 是显式操作，避免噪声扩散 |
| 对话日志的完整存储 | 隐私 + 存储开销，只提取结构化记忆 |

---

## 13. OpenViking 参考对照

本设计受 [OpenViking](https://github.com/volcengine/OpenViking) 启发，以下是借鉴与差异：

| 维度 | OpenViking | 本设计 | 差异原因 |
|------|-----------|--------|---------|
| URI 协议 | `viking://` | `ac://` 三命名空间（memory/assets/components），分阶段引入 | 渐进式：先 memory → assets → components |
| 上下文分层 | L0/L1/L2 (VLM 自动生成) | L0/L1/L2 (规则 + 组件元数据) | 不依赖 AI 模型 |
| 存储后端 | 自建向量数据库 + C++ 扩展 | JSON 文件 / JSONL | 零依赖 |
| 检索 | 向量语义 + 目录递归 | tag 匹配 + glob | 组件规模小 |
| 记忆提取 | VLM 自动分析对话 | 规则引擎（Phase 2 可选 LLM） | 渐进式引入 |
| 记忆更新 | 自动写入 viking://user/ | 写入 .memory/，promote 到 shared | 显式控制 |
| 物化 | Agent 通过 API 按需读取 | 写入物理文件供 IDE Agent 消费 | 适配下游 (Cursor/Claude Code) |
| 文件系统范式 | 核心架构 | 借鉴目录结构，不引入虚拟 FS | 当前不需要抽象层 |

**核心差异总结**：OpenViking 是通用上下文数据库（重型），本设计是 Agent 编排框架的轻量记忆层。借鉴了分层思想和记忆自迭代理念，但用"零依赖 + 规则驱动 + 文件存储"替代了"向量数据库 + AI 模型"的方案。

---

## 附录 A: `ac://` 统一寻址协议

`ac://` 是 Actant 的统一资源寻址协议，覆盖三大命名空间：**组件**（Hub 内容）、**记忆**（分层记忆系统）和**资产**（运行时产物 + 人类委托资源）。

### A.1 完整命名空间

```
ac://
├── components/                    ← Hub 组件（Phase 3 预留）
│   ├── skills/{name}
│   ├── prompts/{name}
│   ├── workflows/{name}
│   └── mcp-servers/{name}
│
├── memory/                        ← 记忆系统
│   ├── {instance}/{layer}/{id}    # 实例级记忆条目
│   ├── user/                      # 用户偏好（shared pool）
│   └── learnings/                 # 跨实例经验（shared pool）
│
├── assets/                        ← 人类委托的资产
│   ├── workspace/{name}           # 工作目录
│   ├── docker/{name}              # Docker 容器
│   ├── repo/{name}                # Git 仓库
│   ├── process/{pid}              # 托管进程
│   ├── config/{name}              # 配置文件
│   ├── secret/{name}              # 密钥（只记 ref，不存值）
│   ├── data/{name}                # 通用数据集
│   └── custom/{type}/{name}       # 用户自定义类型
│
├── records/                       ← 执行记录
│   └── {instance}/{type}          # 任务记录、错误日志、审计记录
│
├── artifacts/                     ← Agent 产物
│   └── {instance}/{name}          # 生成的文件、报告、代码片段
│
└── instances/{name}/              ← 实例视图（聚合）
    ├── workspace/
    ├── memory/
    └── sessions/
```

### A.2 资产系统核心模型

> 详见 [Hub Agent Kernel (#204)](https://github.com/blackplume233/Actant/issues/204) — Curator Asset System

资产系统遵循 **"一切即文件"** 哲学，人类可以将 Docker 容器、工作目录、Git 仓库、后台进程等外部资源委托给 Actant（通过 Curator agent）管理：

```typescript
interface ManagedAsset {
  uri: string;                  // ac:// URI
  type: AssetType;
  name: string;
  status: AssetStatus;
  owner: string;                // 委托人或创建该资产的 Agent
  localPath?: string;
  containerRef?: string;        // Docker container ID
  processRef?: { pid: number };
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string;
  healthStatus: "healthy" | "degraded" | "unreachable" | "unknown";
  retentionPolicy?: RetentionPolicy;
  backupPolicy?: BackupPolicy;
  tags: string[];
  notes?: string;
}

type AssetType =
  | "workspace" | "docker" | "repo" | "process"
  | "config" | "secret" | "data" | "custom";

interface RetentionPolicy {
  maxAge?: string;              // e.g. "30d", "1y"
  maxSize?: string;             // e.g. "10GB"
  onExpiry: "archive" | "delete" | "notify";
}
```

### A.3 记忆系统 vs 资产系统

| 维度 | Memory System | Asset System |
|------|--------------|--------------|
| 管辖范围 | 记忆记录（L0/L1/L2） | 记忆 + 非记忆性资源（Docker、目录、进程等） |
| URI 前缀 | `ac://memory/` | `ac://assets/`, `ac://records/`, `ac://artifacts/` |
| 数据性质 | 认知性（经验、模式、偏好） | 操作性（进程、容器、文件） |
| 生命周期 | confidence 衰减 + promote | retentionPolicy + healthCheck |
| 管理者 | Memory Store / Promoter | Curator agent |

**关系**：资产系统是记忆系统的超集。`ac://memory/` 命名空间由 Memory 子系统原生管理，Curator 作为上层治理者在资产视图中统一呈现。

### A.4 引入时机

| 命名空间 | 引入阶段 | 判断标准 |
|----------|---------|---------|
| `ac://memory/` | Phase 5（Memory 系统） | Instance Memory 实现后 |
| `ac://assets/` | Phase 4+（Curator agent） | Curator 实现后 |
| `ac://components/` | Phase 6+ | 组件数量 > 50 或需跨层引用 |
| `ac://records/`, `ac://artifacts/` | 与 Memory/Curator 同步 | 需要结构化追溯时 |

在对应阶段之前，name-based resolution 是更简单正确的选择。
