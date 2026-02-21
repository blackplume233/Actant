# Phase 3 MVP TODO — 通信·管理·构造·调度

> **状态**：执行中
> **更新**：2026-02-21
> **目标**：完成 Phase 3 全部核心功能，达到"组件可管理 + workspace 差异化构建 + 雇员型 Agent 可调度"的里程碑

---

## 总览

| 子阶段 | Epic Issue | 子 Issue | 状态 | 可独立启动 |
|--------|-----------|----------|------|-----------|
| **3a** 统一组件管理 | #38 | #43, #44, #45 | ⬜ 待开始 | ✅ |
| **3b** Workspace 构造器 | #39 | #46, #47 | ⬜ 待开始 | ❌ 依赖 3a |
| **3c** 雇员型 Agent 调度器 | #40 | #48, #49, #50 | ⬜ 待开始 | ✅ |

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

### #43 BaseComponentManager CRUD 增强

- [ ] `add(component, persist?)` 方法实现
- [ ] `update(name, patch)` 方法实现
- [ ] `remove(name, persist?)` 方法实现
- [ ] `importFromFile(filePath)` / `exportToFile(name, filePath)` 实现
- [ ] `search(query)` / `filter(predicate)` 实现
- [ ] `persistDir` 属性 + `setPersistDir()` 方法
- [ ] 单元测试：全部新方法 + 不破坏现有行为

### #44 PluginManager + Schema + 示例

- [ ] `PluginDefinition` Zod schema（shared types）
- [ ] `PluginManager` 实现（extends BaseComponentManager）
- [ ] `configs/plugins/memory-plugin.json`
- [ ] `configs/plugins/web-search-plugin.json`
- [ ] `configs/plugins/github-plugin.json`
- [ ] AppContext 注入 pluginManager + 启动时加载
- [ ] 模板 domainContext 新增 `plugins: string[]` 字段

### #45 RPC Handlers + CLI 命令

- [ ] `domain.skill.add` / `update` / `remove` / `import` RPC handlers
- [ ] `domain.prompt.add` / `update` / `remove` RPC handlers
- [ ] `domain.plugin.list` / `show` / `add` / `remove` / `install` RPC handlers
- [ ] RPC 参数/返回类型定义（rpc.types.ts）
- [ ] CLI `skill add` / `remove` / `export`
- [ ] CLI `prompt add` / `remove` / `export`
- [ ] CLI `plugin list` / `show` / `add` / `remove` / `install`（新文件）
- [ ] 集成测试

### Phase 3a 完成标志

- [ ] lint + typecheck 通过
- [ ] test:changed 通过
- [ ] spec/api-contracts.md 更新
- [ ] spec/config-spec.md 更新

---

## Phase 3b: Workspace 构造器 (#39)

> 前置：Phase 3a 完成（需要 PluginManager）
> 目标：Strategy Pattern 差异化 workspace 构建，替换 ContextMaterializer

### #46 BackendBuilder 接口 + Builder 实现

- [ ] `BackendBuilder` 接口定义
- [ ] `BuildResult` / `VerifyResult` / `PermissionSet` 类型
- [ ] `CursorBuilder` 实现
  - [ ] scaffold: `.cursor/rules/`, `.cursor/mcp.json`, `AGENTS.md`, `prompts/`
  - [ ] materialize: skills→mdc, prompts→system.md, MCP→mcp.json
  - [ ] verify: 文件完整性检查
- [ ] `ClaudeCodeBuilder` 实现
  - [ ] scaffold: `.claude/`, `CLAUDE.md`, `AGENTS.md`
  - [ ] materialize: skills→CLAUDE.md, plugins→plugins.json, permissions→settings.local.json
  - [ ] verify: 文件完整性检查
- [ ] 单元测试：两个 Builder 独立验证

### #47 WorkspaceBuilder Pipeline + 迁移

- [ ] `WorkspaceBuilder` 编排层实现
- [ ] Pipeline: resolve → validate → scaffold → materialize → inject → verify
- [ ] `CustomBuilder` 实现（builderConfig 自定义路径）
- [ ] 迁移 `AgentInitializer` → 使用 WorkspaceBuilder
- [ ] `ContextMaterializer` 标记 @deprecated
- [ ] 现有 E2E 测试通过验证
- [ ] 新增 Builder 集成测试

### Phase 3b 完成标志

- [ ] lint + typecheck 通过
- [ ] test:changed 通过
- [ ] 现有 E2E 测试全部通过

---

## Phase 3c: 雇员型 Agent + 调度器 (#40)

> 前置：Phase 1/2 已完成（可独立启动，与 3a/3b 并行）
> 目标：内置调度器 + AgentManager 集成 + 可选 N8N

### #48 TaskQueue + TaskDispatcher + ExecutionLog

- [ ] `AgentTask` / `ExecutionRecord` 类型定义
- [ ] `TaskQueue` 实现（per-agent 串行 + 优先级排序）
- [ ] `TaskDispatcher` 实现（dequeue → promptAgent → record）
- [ ] `ExecutionLog` 实现（内存 + 文件持久化）
- [ ] 单元测试

### #49 InputRouter + InputSources

- [ ] `InputSource` 接口定义
- [ ] `InputRouter` 实现（register/unregister/dispatch）
- [ ] `HeartbeatInput` 实现（setInterval + 可配置间隔）
- [ ] `CronInput` 实现（croner 库 + 时区）
- [ ] `HookInput` 实现（EventEmitter + 生命周期事件）
- [ ] 新增依赖: `croner`
- [ ] 单元测试

### #50 EmployeeScheduler + 集成 + CLI

- [ ] `EmployeeScheduler` 编排层
- [ ] `ScheduleConfigSchema` Zod schema
- [ ] 模板 `schedule` 字段支持
- [ ] `AgentManager.startAgent()` 集成调度器
- [ ] RPC: `agent.dispatch` / `agent.tasks` / `agent.logs`
- [ ] CLI: `agent dispatch` / `agent tasks` / `agent logs`
- [ ] CLI: `schedule list` / `schedule pause` / `schedule resume`
- [ ] 集成测试
- [ ] (P2 可选) WebhookInput + Hono HTTP handler + HMAC
- [ ] (P2 可选) N8N Bridge

### Phase 3c 完成标志

- [ ] lint + typecheck 通过
- [ ] test:changed 通过
- [ ] spec/api-contracts.md 更新

---

## Phase 3 全局完成标志

- [ ] Phase 3a 全部完成
- [ ] Phase 3b 全部完成
- [ ] Phase 3c 全部完成
- [ ] roadmap.md 更新（Phase 3 标记完成，Phase 4 提为当前）
- [ ] 全量测试 `pnpm test` 通过
- [ ] spec 文档同步（api-contracts.md, config-spec.md）

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
