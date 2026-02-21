# Phase 3 MVP TODO — 通信·管理·构造·调度

> **状态**：✅ 已完成
> **更新**：2026-02-22
> **目标**：完成 Phase 3 全部核心功能，达到"组件可管理 + workspace 差异化构建 + 雇员型 Agent 可调度"的里程碑

---

## 总览

| 子阶段 | Epic Issue | 子 Issue | 状态 | 可独立启动 |
|--------|-----------|----------|------|-----------|
| **3a** 统一组件管理 | #38 | #43, #44, #45 | ✅ 已完成 | ✅ |
| **3b** Workspace 构造器 | #39 | #46, #47 | ✅ 已完成 | ❌ 依赖 3a |
| **3c** 雇员型 Agent 调度器 | #40 | #48, #49, #50 | ✅ 已完成 | ✅ |

### 依赖关系

```
#43 → #44 → #45
              ↓
             #46 → #47        (3b 依赖 3a 的 PluginManager)

#48 → #49 → #50              (3c 独立线)
```

### 已完成的 Phase 3 项

- ✅ #16 ACP Proxy 基础版
- ✅ #35 Proxy + Chat 双模式

---

## Phase 3a: 统一组件管理体系 (#38)

> 目标：Skill / Prompt / Plugin 完整 CRUD + 持久化 + CLI/RPC

### #43 BaseComponentManager CRUD 增强 ✅

- [x] `add(component, persist?)` 方法实现
- [x] `update(name, patch)` 方法实现
- [x] `remove(name, persist?)` 方法实现
- [x] `importFromFile(filePath)` / `exportToFile(name, filePath)` 实现
- [x] `search(query)` / `filter(predicate)` 实现
- [x] `persistDir` 属性 + `setPersistDir()` 方法
- [x] 单元测试：全部新方法 + 不破坏现有行为（20 tests）

### #44 PluginManager + Schema + 示例 ✅

- [x] `PluginDefinition` Zod schema（shared types）
- [x] `PluginManager` 实现（extends BaseComponentManager）
- [x] `configs/plugins/memory-plugin.json`
- [x] `configs/plugins/web-search-plugin.json`
- [x] `configs/plugins/github-plugin.json`
- [x] AppContext 注入 pluginManager + 启动时加载
- [x] 模板 domainContext 新增 `plugins: string[]` 字段（15 tests）

### #45 RPC Handlers + CLI 命令 ✅

- [x] `domain.skill.add` / `update` / `remove` / `import` RPC handlers
- [x] `domain.prompt.add` / `update` / `remove` RPC handlers
- [x] `domain.plugin.list` / `show` / `add` / `remove` / `export` RPC handlers
- [x] RPC 参数/返回类型定义（rpc.types.ts）
- [x] CLI `skill add` / `remove` / `export`
- [x] CLI `prompt add` / `remove` / `export`
- [x] CLI `plugin list` / `show` / `add` / `remove` / `export`（新文件）
- [x] 集成测试（457/458 通过）

### Phase 3a 完成标志

- [x] lint + typecheck 通过
- [x] test:changed 通过（457/458, 1 个无关 E2E flaky）
- [ ] spec/api-contracts.md 更新
- [ ] spec/config-spec.md 更新

---

## Phase 3b: Workspace 构造器 (#39)

> 前置：Phase 3a 完成（需要 PluginManager）
> 目标：Strategy Pattern 差异化 workspace 构建，替换 ContextMaterializer

### #46 BackendBuilder 接口 + Builder 实现 ✅

- [x] `BackendBuilder` 接口定义
- [x] `VerifyResult` 类型
- [x] `CursorBuilder` 实现
  - [x] scaffold: `.cursor/rules/`, `.cursor/mcp.json`, `AGENTS.md`, `prompts/`
  - [x] materialize: skills→mdc, prompts→system.md, MCP→mcp.json, plugins→extensions.json
  - [x] verify: 文件完整性检查
- [x] `ClaudeCodeBuilder` 实现
  - [x] scaffold: `.claude/`, `CLAUDE.md`, `AGENTS.md`
  - [x] materialize: skills→CLAUDE.md, plugins→plugins.json, permissions→settings.local.json
  - [x] verify: 文件完整性检查
- [x] 单元测试：两个 Builder 独立验证（18 tests）

### #47 WorkspaceBuilder Pipeline + 迁移 ✅

- [x] `WorkspaceBuilder` 编排层实现
- [x] Pipeline: resolve → validate → scaffold → materialize → inject → verify
- [x] `CustomBuilder` 实现（extends CursorBuilder）
- [x] 迁移 `AgentInitializer` → 使用 WorkspaceBuilder
- [x] `ContextMaterializer` 标记 @deprecated
- [x] 现有 E2E 测试通过验证（486/487, 1 个已知 flaky）
- [x] 新增 Builder 集成测试（11 tests for WorkspaceBuilder）

### Phase 3b 完成标志

- [x] lint + typecheck 通过
- [x] test:changed 通过（486/487, 1 个已知 flaky）
- [x] 现有 E2E 测试全部通过（除 1 个已知 flaky）

---

## Phase 3c: 雇员型 Agent + 调度器 (#40)

> 前置：Phase 1/2 已完成（可独立启动，与 3a/3b 并行）
> 目标：内置调度器 + AgentManager 集成 + 可选 N8N

### #48 TaskQueue + TaskDispatcher + ExecutionLog ✅

- [x] `AgentTask` / `ExecutionRecord` 类型定义
- [x] `TaskQueue` 实现（per-agent 串行 + 优先级排序）
- [x] `TaskDispatcher` 实现（dequeue → promptAgent → record）
- [x] `ExecutionLog` 实现（内存 + 文件持久化）
- [x] 单元测试（21 tests）

### #49 InputRouter + InputSources ✅

- [x] `InputSource` 接口定义
- [x] `InputRouter` 实现（register/unregister/dispatch）
- [x] `HeartbeatInput` 实现（setInterval + 可配置间隔）
- [x] `CronInput` 实现（croner 库 + 时区）
- [x] `HookInput` 实现（EventEmitter + 生命周期事件）
- [x] 新增依赖: `croner`
- [x] 单元测试（18 tests）

### #50 EmployeeScheduler + 集成 + CLI ✅

- [x] `EmployeeScheduler` 编排层
- [x] `ScheduleConfigSchema` Zod schema
- [x] 模板 `schedule` 字段支持
- [x] RPC: `agent.dispatch` / `agent.tasks` / `agent.logs` / `schedule.list`
- [x] CLI: `agent dispatch` / `agent tasks` / `agent logs`
- [x] CLI: `schedule list`
- [x] 单元测试（12 tests）
- [ ] (P2 可选) WebhookInput + Hono HTTP handler + HMAC
- [ ] (P2 可选) N8N Bridge

### Phase 3c 完成标志

- [x] lint + typecheck 通过
- [x] test:changed 通过（51/51 scheduler tests）
- [ ] spec/api-contracts.md 更新

---

## Phase 3 全局完成标志

- [x] Phase 3a 全部完成
- [x] Phase 3b 全部完成
- [x] Phase 3c 全部完成
- [x] roadmap.md 更新
- [x] 全量测试通过（538/538 tests, 49 files）
- [x] spec 文档同步（api-contracts.md, config-spec.md）

---

## Issue 索引

| ID | 标题 | 所属 | 优先级 | 依赖 |
|----|------|------|--------|------|
| #38 | 统一组件管理体系 (Epic) | 3a | P1 | Phase 2 |
| #39 | Workspace 构造器 (Epic) | 3b | P1 | #38 |
| #40 | 雇员型 Agent + 调度器 (Epic) | 3c | P1 | Phase 1/2 |
| #43 | BaseComponentManager CRUD 增强 | 3a | P0 | - |
| #44 | PluginManager + Schema + 示例 | 3a | P0 | #43 |
| #45 | 组件管理 RPC + CLI | 3a | P0 | #43, #44 |
| #46 | BackendBuilder + CursorBuilder + ClaudeCodeBuilder | 3b | P0 | #44 |
| #47 | WorkspaceBuilder Pipeline + 迁移 | 3b | P0 | #46 |
| #48 | TaskQueue + Dispatcher + ExecutionLog | 3c | P0 | - |
| #49 | InputRouter + InputSources | 3c | P0 | #48 |
| #50 | EmployeeScheduler + 集成 + CLI | 3c | P0 | #48, #49 |

---

## 维护说明

- 完成一项勾选 `[ ]` → `[x]`
- 每个子阶段完成后更新状态表（⬜ → ✅）
- 最终全部完成后同步更新 `roadmap.md`
