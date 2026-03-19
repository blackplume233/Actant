---
name: "Phase 3 全量执行计划"
overview: "按依赖顺序完成 Phase 3 全部 8 个子 Issue，每个子 Issue 完成后 QA 验证"
todos:
  - id: verify-43
    content: "P0: 验证 #43 BaseComponentManager CRUD 已完成 — 运行测试确认"
    status: pending
  - id: impl-44
    content: "P0: #44 PluginManager + PluginDefinition Schema + 示例配置"
    status: pending
  - id: impl-45
    content: "P0: #45 Plugin RPC Handlers + CLI 命令 + 集成测试"
    status: pending
  - id: qa-3a
    content: "P0: Phase 3a QA Loop — lint + typecheck + test:changed + spec 更新"
    status: pending
  - id: impl-46
    content: "P0: #46 BackendBuilder 接口 + CursorBuilder + ClaudeCodeBuilder"
    status: pending
  - id: impl-47
    content: "P0: #47 WorkspaceBuilder Pipeline + AgentInitializer 迁移"
    status: pending
  - id: qa-3b
    content: "P0: Phase 3b QA Loop — lint + typecheck + 现有 E2E 测试通过"
    status: pending
  - id: impl-48
    content: "P0: #48 TaskQueue + TaskDispatcher + ExecutionLog"
    status: pending
  - id: impl-49
    content: "P0: #49 InputRouter + HeartbeatInput + CronInput + HookInput"
    status: pending
  - id: impl-50
    content: "P0: #50 EmployeeScheduler + AgentManager 集成 + CLI"
    status: pending
  - id: qa-3c
    content: "P0: Phase 3c QA Loop — lint + typecheck + test:changed + spec 更新"
    status: pending
  - id: final-qa
    content: "P0: Phase 3 全局 QA — 全量测试 + roadmap 更新"
    status: pending
isProject: true
---

# Phase 3 全量执行计划

> 目标：按依赖顺序完成 Phase 3 全部核心功能，每个子功能完成后通过 QA Loop 验证

## 执行顺序

```
Phase 3a: #43(已完成) → #44 → #45 → QA 3a
                                       ↓
Phase 3b:                   #46 → #47 → QA 3b
                                       ↓
Phase 3c: #48 → #49 → #50 → QA 3c     ↓
                                       ↓
                               最终全局 QA
```

## 当前状态

- #43 BaseComponentManager CRUD — **已实现**（需验证测试通过）
- Skill/Prompt/MCP 的 CRUD RPC + CLI — **已实现**
- PluginManager 及以后全部 — **未开始**

## 估计工作量

| Issue | 预估 | 说明 |
|-------|------|------|
| #43 验证 | 5min | 运行已有测试 |
| #44 | 中等 | Schema + Manager + 3 示例 + AppContext |
| #45 | 中等 | Plugin CRUD handlers + CLI plugin 命令 |
| #46 | 大 | 2 个 Builder 实现 + 接口 + 类型 |
| #47 | 大 | Pipeline 编排 + 迁移 + deprecate |
| #48 | 中等 | 队列 + 调度器 + 日志 |
| #49 | 大 | 3 个 InputSource + Router + croner 依赖 |
| #50 | 大 | 编排层 + AgentManager 集成 + CLI + RPC |
