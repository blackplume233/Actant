## QA 集成测试报告 — Hook 事件系统

**场景**: 即兴探索 — Hook 系统有效性 + Agent 自注册 Hook
**测试工程师**: QA SubAgent
**时间**: 2026-02-24
**git HEAD**: `c375bd3` (PR #179 — feat(hooks): unified event system)
**结果**: FAILED (7/12 步骤通过, 3 警告, 2 失败)

### 摘要

| # | 步骤 | 命令/检查 | 判定 | 说明 |
|---|------|-----------|------|------|
| 1 | 构建检查 | `pnpm build` | PASS | 全部 packages 构建成功 |
| 2 | Hook 模块单元测试 | `vitest run packages/core/src/hooks/` | PASS | 57/57 通过 |
| 3 | Schema-Type 一致性 | WorkflowDefinitionSchema vs TypeScript | **FAIL** | content 必填 vs 可选 |
| 4 | Workflow 加载（含 content） | `workflow list -f json` | PASS | 加上 content 后正常 |
| 5 | HookRegistry 集成检查 | 代码审查 | **FAIL** | HookRegistry 未在 Daemon 中连接 |
| 6 | Agent 生命周期操作 | create/start/stop/destroy | PASS | CLI 操作全部成功 |
| 7 | CategoryRegistry 测试分析 | 代码审查 | PASS | 42 个测试覆盖全面 |
| 8 | EventBus 测试分析 | 代码审查 | PASS | 15 个测试覆盖全面 |
| 9 | ActionRunner 测试覆盖 | 代码搜索 | **WARN** | 无单元测试 |
| 10 | HookRegistry 测试覆盖 | 代码搜索 | **WARN** | 无单元测试 |
| 11 | Hook CLI 命令 | `actant hook subscribe` | **WARN** | 命令未实现（已知 🚧） |
| 12 | EmitGuard 集成 | 代码审查 | PASS | AppContext 中正确连接 |

### 失败/警告分析

#### FAIL: Step 3 — WorkflowDefinitionSchema content 必填 [#180]

- **期望**: 纯 Hook Workflow（只有 hooks，无 content）应能通过校验
- **实际**: Zod schema 要求 `content: z.string().min(1)` 即必填，导致纯 hook workflow 被静默拒绝
- **根因**: PR #179 更新了 TypeScript 接口但未同步 Zod schema
- **影响**: P1 — 阻碍纯事件驱动 workflow 的使用
- **Issue**: [#180](https://github.com/blackplume233/Actant/issues/180)

#### FAIL: Step 5 — HookRegistry 未在 Daemon 启动流程中连接 [#181]

- **期望**: Daemon 启动时应实例化 HookRegistry 并注册所有 workflow hooks
- **实际**: `AppContext` 和 `Daemon` 代码中完全没有 `HookRegistry` 的引用
- **根因**: PR #179 实现了底层基础设施但未完成上层集成
- **影响**: P1 — 整个 hook 触发链路断裂，workflow hooks 是死数据
- **Issue**: [#181](https://github.com/blackplume233/Actant/issues/181)

#### WARN: Step 9 — ActionRunner 无单元测试

- **风险**: shell/builtin/agent 三种动作执行逻辑、模板插值、best-effort 错误处理缺乏测试覆盖
- **建议**: 补充 action-runner.test.ts，覆盖各动作类型、插值变量、异常分支

#### WARN: Step 10 — HookRegistry 无单元测试

- **风险**: registerWorkflow/unregisterWorkflow/instance 过滤/allowedCallers 过滤等核心逻辑缺乏测试
- **建议**: 补充 hook-registry.test.ts，覆盖注册/注销/事件监听/过滤逻辑

#### WARN: Step 11 — Hook CLI 命令未实现

- **状态**: API contracts §4.8 标记为 🚧 (Phase 4)
- **影响**: Agent 自注册 Hook（订阅模型 C）完全不可用
- **建议**: 作为统一事件系统的下一步优先实现

### Hook 系统架构状态总览

```
层级                  状态     说明
─────────────────────────────────────────────────────────
类型定义              ✅ 完成   hook.types.ts — 完整的类型体系
HookEventBus          ✅ 完成   emit/on/off/guard/dispose — 15 个测试
HookCategoryRegistry  ✅ 完成   类别注册/验证/权限 — 42 个测试
ActionRunner          ⚠️ 完成   shell/builtin/agent — 无测试
HookRegistry          ⚠️ 完成   register/unregister/listen — 无测试
EventBus 集成到 AM    ✅ 完成   AgentManager emit 所有生命周期事件
EmitGuard 集成        ✅ 完成   AppContext 连接 buildEmitGuard
Zod Schema 同步       ❌ 缺失   content 必填 vs 可选 (#180)
HookRegistry 集成     ❌ 缺失   未在 Daemon 中实例化和连接 (#181)
Hook CLI 命令         ❌ 未实现  hook subscribe/unsubscribe/list
Hook RPC Handler      ❌ 未实现  hook.subscribe/hook.unsubscribe/hook.list
```

### 创建的 Issue

| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| [#180](https://github.com/blackplume233/Actant/issues/180) | Bug: WorkflowDefinitionSchema requires content but TypeScript type allows optional | bug | P1 |
| [#181](https://github.com/blackplume233/Actant/issues/181) | Integration: HookRegistry not wired up in Daemon startup flow | bug | P1 |

### 总结

PR #179 成功交付了 Hook 事件系统的**底层基础设施**（类型定义、EventBus、CategoryRegistry、ActionRunner、HookRegistry），质量良好（57 个单元测试全通过）。但存在两个关键集成缺口：

1. **Zod Schema 与 TypeScript 类型不同步**（#180）— 阻碍纯 hook workflow 加载
2. **HookRegistry 未在 Daemon 中连接**（#181）— 整个 hook 触发链路断裂

这两个问题导致**用户可见的 hook 功能实际上不工作**。Event 被正确发射，但没有任何 listener 在接收。建议作为 Phase 4 的紧急优先项修复。

### 完整执行日志

参见 [qa-log-round1.md](./qa-log-round1.md)
