# Actant Specifications

> **核心原则**：文档、契约、接口、配置是项目的主要产出，代码是对它们的实现。
>
> **任何功能扩展或修改，必须先输出文档再实现。** 未经文档化的变更不得进入代码库。

---

## Documentation-First 原则（最高优先级）

本项目遵循严格的「文档先行」开发模式。以下四类产物的优先级 **高于代码实现**：

| 优先级 | 产物 | 说明 | 示例 |
|--------|------|------|------|
| 1 | **契约（Contracts）** | 模块间通信的协议规范 | `api-contracts.md` 中的 RPC 方法签名、错误码 |
| 2 | **接口（Interfaces）** | TypeScript 类型定义与公共 API | `@actant/shared` 中的类型、`index.ts` barrel exports |
| 3 | **配置（Configuration）** | Schema 定义与配置结构 | `config-spec.md` 中的 JSON Schema、环境变量 |
| 4 | **文档（Documentation）** | 设计文档、决策记录、行为规范 | `agent-lifecycle.md`、ADR、spec 文件 |

### 强制流程

```
需求 → 文档/规范 → 接口/类型 → 实现 → 测试 → 审查
         ↑                                    |
         └────── 实现中发现规范缺陷 → 先修规范 ──┘
```

1. **新功能**：先在相关 spec 文件中描述行为和接口，review 通过后再写代码
2. **修改功能**：先更新受影响的 spec/契约/配置文档，再修改代码
3. **Bug 修复**：如果 bug 暴露了规范缺陷，先修正规范再修复代码
4. **重构**：如果重构改变了公共接口，先更新接口文档

> **违反此原则的 PR 应被 reject。** 即使代码正确，缺少同步文档更新也不应合并。

---

## 文档层次

```
spec/
├── agent-lifecycle.md    ← Agent 生命周期与使用模式（主要产出）
├── config-spec.md        ← 配置规范（主要产出）
├── api-contracts.md      ← 接口契约（主要产出）
│
├── backend/              ← 后端实现指南（实现层）
├── frontend/             ← 前端实现指南（实现层）
└── guides/               ← 辅助思考指南
```

### 第一层：规范（Specification）

**规范定义系统"是什么"**。所有代码必须符合规范；若代码与规范冲突，以规范为准，修正代码。

| 文档 | 内容 | 约束力 |
|------|------|--------|
| [Agent 生命周期](./agent-lifecycle.md) | 运行模式、接入方式、使用场景、状态转换 | **强制** — 理解系统行为的核心文档 |
| [配置规范](./config-spec.md) | 所有配置结构、Schema、枚举、环境变量 | **强制** — 任何配置变更必须先更新此文档 |
| [接口契约](./api-contracts.md) | RPC 方法、CLI 命令、ACP Proxy、MCP Server、错误码 | **强制** — 任何接口变更必须先更新此文档 |
| [Session 管理](./session-management.md) | 三种 session 的概念、生命周期、按 archetype 的路由规则 | **强制** — 涉及 Chat/Session 相关代码必读 |
| [耐久测试规范](./endurance-testing.md) | 覆盖矩阵、不变量、演进策略、维护规范 | **强制** — 生命周期/通信变更必须同步更新耐久测试 |

### 重要设计文档

以下设计文档对理解系统架构至关重要，实现时应作为核心参考：

| 文档 | 内容 | 重要性 |
|------|------|--------|
| [统一事件系统设计](../../docs/design/event-system-unified-design.md) | EventBus 统一架构、事件分类与订阅模型、Archetype 感知执行策略、Event-First 设计原则 | **核心** — 所有 Hook/Event/Workflow 相关实现的架构依据 |
| [Agent 启动场景与 ACP 架构](../../docs/design/agent-launch-scenarios.md) | 7 种启动/交互场景、ACP Gateway 架构、协议分层、控制权谱系 | **核心** — 所有 ACP/Proxy/Chat 相关实现的架构依据 |
| [架构 Docker 类比](../../docs/design/architecture-docker-analogy.md) | CLI-Daemon 分层设计的概念映射 | 参考 — 理解整体架构思路 |
| [Plugin/Memory 审查报告](../../docs/design/plugin-memory-review-report.md) | Plugin 三插口设计、Memory 12 轮审查、安全/性能/兼容性 | **核心** — Phase 4 Plugin 和 Memory 系统的设计依据 |
| [记忆层与 Agent 演进](../../docs/design/memory-layer-agent-evolution.md) | 四层记忆架构、MemoryRecord、Promote 机制、Context Broker | **核心** — Phase 5 Memory 系统的蓝图 |
| [Phase 4 推进步骤](../../docs/planning/phase4-employee-steps.md) | 14 步实施计划、依赖关系、并行策略、验收标准 | **活跃** — 当前阶段的执行指南 |
| [Agent 动态监听场景分析](../../docs/design/scenario-agent-dynamic-listen.md) | Agent 运行时动态注册事件订阅的场景、通信通道选择（ACP/CLI）、三种订阅模型 | 参考 — Agent 自主性扩展的设计分析 |
| [Subsystem 子系统设计](../../docs/design/subsystem-design.md) | 参考 UE Subsystem 的可热插拔辅助系统框架，四层作用域、声明式注册、生命周期绑定 | **核心** — 插件深层集成和系统功能模块化的架构基础 |
| [actant-hub 组件仓库设计](../../docs/design/actant-hub-registry-design.md) | 官方 Hub 结构、组件类型、Skill 双格式、Source 集成 | **核心** — Hub 内容和 Source 系统的架构依据 |
| [Hub Agent 内核设计 (#204)](https://github.com/blackplume233/Actant/issues/204) | 三层平台级 Agent 体系（Kernel/Auxiliary/Spark）、资产系统、`ac://` 统一寻址 | **核心** — actant-hub 初始内容和资产管理的蓝图 |

### 第二层：实现指南（Implementation Guidelines）

**指南描述如何"正确地实现"**。为开发者提供编码规范、错误处理模式、日志策略等。

| 文档 | 描述 |
|------|------|
| [后端指南](./backend/index.md) | 模块架构、错误处理、日志、质量标准 |
| [前端指南](./frontend/index.md) | 组件规范、状态管理、类型安全 |

### 第三层：思考指南（Thinking Guides）

**辅助决策和设计思维**，预防"没想到"导致的缺陷。

| 文档 | 描述 |
|------|------|
| [思考指南索引](./guides/index.md) | 跨层、复用、跨平台等思考框架 |

### 项目上下文文档

以下文档不属于规范层，但对理解项目状态和方向至关重要：

| 文档 | 内容 | 位置 |
|------|------|------|
| 产品路线图 | Phase 规划、里程碑、Issue 对齐 | `docs/planning/roadmap.md` |
| 文档目录规范 | docs/ 各子目录职责、写入权限、命名规范 | `docs/README.md` |
| 目录结构 ADR | 项目目录结构决策及演进记录 | `docs/decisions/002-directory-structure.md` |

---

## 变更规则

1. **文档先行**：任何功能扩展或修改，**必须先输出文档再写代码**。未文档化的实现不得合并
2. **契约驱动**：接口变更先更新 `api-contracts.md` / 类型定义，代码实现必须符合已发布的契约
3. **配置即规范**：配置 Schema 变更先更新 `config-spec.md`，实现跟随 Schema
4. **同步提交**：配置/接口的代码变更与规范更新必须在**同一次提交**中
5. **规范即真相**：若代码行为与规范不一致，视为 Bug — 修正代码，不修正规范（除非规范本身有缺陷）
6. **审查检查项**：Code Review 必须确认：(a) 相关规范文档已同步更新 (b) 接口/类型先于实现定义 (c) 配置 Schema 与实现一致
7. **跨层一致性**：跨越前后端的约束（如 archetype 功能限制、接口错误码）必须在**所有涉及层**的 spec 文件中保持一致描述。变更时须同步检查 `agent-lifecycle.md`、`api-contracts.md`、`frontend/index.md`、`quality-guidelines.md` 等所有引用点
8. **引用而非重复**：子层文件（如 `backend/index.md`）应通过链接引用上层权威定义（如 `spec/index.md`），而非复制相同内容。重复描述会在内容变更时产生不一致

---

## Spec 维护常见错误

### 跨层约束不一致

**场景**：archetype 限制（如"只有 employee 才能使用 Canvas"）在不同 spec 文件中描述不同。

**成因**：在一处更新了约束，但遗漏了其他涉及该约束的文件。

**防止方法**：修改任何 archetype / 接口 / 错误码约束时，先搜索所有 spec 文件中的相关关键词，确认全量同步。

```bash
# 检查 Canvas 相关约束的所有出现位置
grep -r "Canvas\|canvas" .trellis/spec/ --include="*.md" -l
```

### 占位文件污染索引

**场景**：spec 文件仅包含 "To be filled by the team" 之类的占位内容，但仍列在索引中，误导读者以为有实质规范。

**防止方法**：未填写内容的主题合并为单一 `*-todo.md` 文件，并在索引中明确标注 "Todo"。

### 计划内容混入规范层

**场景**：Phase N 预定设计（尚未实现）与当前有效规范写在同一章节，读者无法判断哪些立即适用。

**防止方法**：预定/计划内容必须：(a) 在文件顶部加免责声明 (b) 章节标题标注 `⚠️ 待启用` (c) 或移入 `docs/design/` 等计划目录
