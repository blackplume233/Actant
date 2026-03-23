---
id: 296
title: "[refactor] 按 5 层架构拆分 @actant/core 为独立包"
status: closed
labels:
  - enhancement
  - core
  - architecture
  - "priority:P1"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#296"
closedAs: not-planned
createdAt: "2026-03-16T14:30:18Z"
updatedAt: "2026-03-23T06:11:00"
closedAt: "2026-03-23T06:11:00"
---

## 目标

将 `@actant/core`（21 个模块、~230 源文件）按 5 层职责拆分为独立包，使 VFS、Domain、Source 等基础能力可独立轻量使用，解除"获取项目上下文必须启动完整 daemon"的耦合。

### 动机

- 任何 Agent 前端（Cursor、Claude Code、Codex Monitor）需要通过一个轻量 MCP 获取项目共享上下文（AgentInstance、Skill 列表、AgentBase、AgentService）
- 当前 `@actant/mcp-server` 依赖 `@actant/core`，而 core 全量 `export *` 导致拉入完整运行时（scheduler、agent-manager、session、hooks……）
- 实际上 MCP server 只需要 VFS + Domain + Source，占 core 的 3/21 模块


## 5 层架构设计

```
Layer 1: @actant/domain     ← Domain Context 管理、维护、构建
Layer 2: @actant/source     ← Domain Source（GitHub/Local/Community）
Layer 3: @actant/vfs        ← Virtual Filesystem
Layer 4: Instance 管理       ← 保留在 @actant/core
Layer 5: 持续性运行时         ← 保留在 @actant/core
```

依赖方向：
```
@actant/shared  (纯类型 + logger + RPC transport + errors)
     ↑
@actant/domain  (Layer 1)     → 仅依赖 shared + zod
     ↑
@actant/source  (Layer 2)     → 依赖 shared + domain
     
@actant/vfs     (Layer 3)     → 仅依赖 shared

@actant/core    (Layer 4+5)   → 依赖 shared + domain + source + vfs
```


## Layer 1: `@actant/domain` — Domain Context 管理、维护、构建

**职责**：定义、校验、加载、构建、管理所有 Domain Context 组件。

**包含模块**（~50 源文件）：

- **domain/** — `base-component-manager.ts` + 6 个子 Manager (Skill, Prompt, Mcp, Workflow, Plugin, Backend)
- **template/** — TemplateRegistry, TemplateLoader, TemplateSchema, config-validators, TemplateFileWatcher
- **builder/** — WorkspaceBuilder, CursorBuilder, ClaudeCodeBuilder, DeclarativeBuilder, CustomBuilder, ComponentTypeHandler + handlers/
- **provider/** — ModelProviderRegistry, BuiltinProviders, ProviderEnvResolver（零 core 依赖）
- **permissions/** — PermissionPresets, PermissionPolicyEnforcer（零 core 依赖）
- **version/** — component-ref.ts, sync-report.ts（零 core 依赖）
- **prompts/** — template-engine.ts（零 core 依赖）

**需解耦的摩擦点**（4 处）：

| 摩擦点 | 当前 import | 解决方案 |
|--------|-----------|---------|
| `template-schema.ts` → `scheduler/schedule-config.ts` | `ScheduleConfigSchema`（纯 Zod schema, 零 deps）| 将 `schedule-config.ts` 移入 domain 或提升到 shared |
| `config-validators.ts` → `initializer/steps` | `createDefaultStepRegistry` | 将 step registry 的 schema 部分提取到 domain，或 validator 接受注入 |
| `config-validators.ts` → `provider/` | `modelProviderRegistry` | provider 已纳入 Layer 1，无需解耦 |
| `workspace-builder.ts` → `manager/launcher/backend-registry.ts` | `getBackendManager()` 单例 | 将 backend-registry.ts 移至 domain/backend/（它本质是 BackendManager 的单例包装） |

**依赖**：仅 `@actant/shared` + `zod`


## Layer 2: `@actant/source` — Domain Source

**职责**：从多种来源获取 Domain Context 组件并注入到 Manager 中。

**包含模块**（~8 源文件）：

- `source-manager.ts` — 多源管理 + 同步 + 版本对比
- `github-source.ts`, `local-source.ts`, `community-source.ts` — 3 种 ComponentSource 实现
- `component-source.ts` — ComponentSource 接口

**需解耦**：

| 摩擦点 | 解决方案 |
|--------|---------|
| `source-manager.ts` → `BaseComponentManager` (type-only) | 从 `@actant/domain` 导入 |
| `source-manager.ts` → `TemplateRegistry` (type-only) | 从 `@actant/domain` 导入 |
| `source-validator.ts` → `template/schema/` | 从 `@actant/domain` 导入，或将 validator 留在 core |

**依赖**：`@actant/shared` + `@actant/domain`


## Layer 3: `@actant/vfs` — Virtual Filesystem

**职责**：统一虚拟文件系统抽象层。

**包含模块**（~26 源文件）：

- `vfs-registry.ts` + `vfs-path-resolver.ts` — 核心
- `vfs-lifecycle-manager.ts` — 生命周期自动卸载
- `vfs-permission-manager.ts` — 权限检查
- `source-factory-registry.ts` — 声明式 spec 转换
- `sources/` — 全部 10 个 source factories
- `storage/` — VfsDataStore
- `index/` — PathIndex

**需解耦**（2 处 type-only import）：

| 摩擦点 | 解决方案 |
|--------|---------|
| `VfsPermissionManager` → `SessionTokenStore` / `SessionToken` | 提取 interface 到 `@actant/shared`，实现类留在 core |
| `VfsContextProvider` → `ContextProvider` | 提取 `ContextProvider` interface（6 行）到 `@actant/shared` |

**注意**：`domain-source.ts` 自己定义了 `MinimalComponent` 和 `ComponentManager` 接口，不依赖 `@actant/domain`，设计上已解耦。

**依赖**：仅 `@actant/shared`


## Layer 4+5: `@actant/core`（瘦身）— Instance 管理 + 持续性运行时

Layer 4 和 5 内部耦合紧密，本阶段不分离：

- `manager` 依赖 `hooks`, `activity`, `channel`, `budget`, `context-injector`
- `scheduler` 依赖 `hooks`
- `initializer` ↔ `manager` 存在循环依赖

**Layer 4 — Instance 管理**：manager/, initializer/, context-injector/, communicator/, state/

**Layer 5 — 持续性运行时**：scheduler/, session/, channel/, hooks/, plugin/, activity/, journal/, record/, budget/

**远期**：当 Layer 4/5 内部解耦成熟后（消除 initializer ↔ manager 循环、hooks 下沉），可进一步拆为 `@actant/instance` + `@actant/runtime`。


## 需提升到 `@actant/shared` 的接口

| 当前位置 | 接口 | 引用者 |
|---------|------|--------|
| context-injector/ | `ContextProvider`（6 行 interface）| vfs, plugin |
| context-injector/ | `SessionTokenStore`, `SessionToken` (interface) | vfs |
| context-injector/ | `AcpMcpServerStdio`, `ActantToolDefinition`, `ToolScope` | vfs, plugin, acp |
| scheduler/ | `ScheduleConfigSchema`（纯 Zod schema, 零 deps）| template |


## 消费者影响

| 消费者 | 当前依赖 | 拆分后依赖 | 变化 |
|--------|---------|-----------|------|
| @actant/mcp-server | core + shared | vfs + shared | 大幅减轻 |
| @actant/api / @actant/cli | core + shared | core + shared（不变）| 透明 |
| 新 context MCP | N/A | domain + source + vfs + shared | 无需 core |
| codex monitor | N/A | domain + source + vfs + shared | 无需 core |


## 双模运行架构（Context MCP Server）

拆分后的新包支持两种运行模式：

**Connected Mode（daemon 在线）**：通过 RPC proxy 转发到 daemon 的完整 VFS，获得运行时数据（live agents、processes、canvas/memory）。仅需 `@actant/shared` 中的 RPC client。

**Standalone Mode（无 daemon）**：用 `@actant/domain` + `@actant/source` + `@actant/vfs` 本地初始化，挂载 domain-source、workspace-source 等，获得静态数据（skills、templates、agent 配置、.trellis）。

启动时先 probe daemon socket，有则走 proxy（最丰富），没有则 fallback 到 standalone。


## 迁移策略

`@actant/core` 的 `index.ts` 过渡期 re-export 新包内容，现有消费者零改动：

```typescript
export * from "@actant/domain";
export * from "@actant/source";
export * from "@actant/vfs";
// ... 本地保留的模块
export * from "./manager/index";
export * from "./scheduler/index";
```


## 实施步骤（按依赖顺序）

- [ ] Step 0: 提升公共接口到 `@actant/shared`（ContextProvider, SessionToken, ScheduleConfigSchema）
- [ ] Step 1: 提取 `@actant/domain`（Layer 1: domain + template + builder + provider + permissions + version + prompts）
- [ ] Step 2: 提取 `@actant/source`（Layer 2: SourceManager + GitHub/Local/Community）
- [ ] Step 3: 提取 `@actant/vfs`（Layer 3: VfsRegistry + Sources + PathResolver）
- [ ] Step 4: 瘦身 `@actant/core`（Layer 4+5: re-export 新包 + 清理 index.ts）
- [ ] Step 5: 创建 context MCP server（基于 Layer 1-3，双模运行）

## 内部依赖分析（参考数据）

21 个模块的内部依赖矩阵：

```
零核心依赖（8个）：activity, budget, communicator, permissions, state, journal, record, provider

vfs           → context-injector（2 处 type-only import）
domain        → (仅测试文件依赖 template, initializer)
source        → domain, template, version
context-injector → hooks, prompts
scheduler     → hooks, prompts
template      → domain, scheduler(ScheduleConfigSchema), state, provider, initializer(config-validators)
builder       → domain, manager(backend-registry), permissions
initializer   → builder, template, permissions, state, provider, manager
manager       → initializer, channel, state, communicator, provider, hooks, activity, context-injector, budget, domain（10 个依赖，最重模块）
```

---

## Comments

### ### cursor-agent — 2026-03-23T06:10:58

--body-file

### cursor-agent — 2026-03-23T06:11:00

Closed as not-planned: Superseded by the current ContextFS package baseline and terminology
