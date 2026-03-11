## 问题概述

在 Capability-Driven Backend Model 的代码审查中，发现框架设计与规范文档存在多处不一致，需要系统性修复以确保行为符合规范。

## 发现的问题

### 🔴 P0: `repo` archetype 的 `interactionModes` 包含非法值

**规范位置**: `agent-lifecycle.md` §1.3
> `repo` — **N/A** — 通过 actant 命令 acp direct 连接

**当前实现**: `archetype-defaults.ts`
```typescript
repo: {
  launchMode: "direct",
  interactionModes: ["open", "start", "chat"], // ❌ 错误：不应有 start/chat
  autoStart: false,
}
```

**影响**: 用户可能尝试对 repo 类型 Agent 执行 `agent start` 或 `agent chat`，导致不可预期的行为。

### 🔴 P0: 缺少 launchMode + archetype + backend 组合验证

**规范定义的组合规则**:
| Archetype | 允许的 LaunchMode | 允许的 Backend |
|-----------|------------------|----------------|
| repo | direct | cursor, cursor-agent, claude-code |
| service | acp-service | claude-code, pi |
| employee | acp-background, acp-service | claude-code, pi |

**当前问题**: `agent-initializer.ts` 只验证 backend + archetype，不验证 launchMode。

**风险**: 可能创建非法组合（如 repo + acp-service），运行时崩溃。

### 🟡 P1: 缺少 LaunchMode 与 WorkspacePolicy 的关联验证

**规范要求** (`agent-lifecycle.md` §3.3):
> `acp-service` 必须 `persistent` workspace

**当前问题**: 没有验证，用户可以创建 acp-service + ephemeral 的非法组合。

### 🟡 P1: 缺少 schedule + archetype 验证

**规范要求** (`agent-lifecycle.md` §1.3):
> - `service` 无调度器 —— 不允许配置 `schedule`
> - `employee` 必须有 `schedule` 配置 —— 至少包含 heartbeat

**当前问题**: `template-schema.ts` 和 `agent-initializer.ts` 都没有这个校验。

## 修复计划

- [ ] 修复 repo archetype 的 interactionModes
- [ ] 添加 launchMode + archetype + backend 组合验证
- [ ] 添加 LaunchMode 与 WorkspacePolicy 关联验证
- [ ] 添加 schedule + archetype 验证
- [ ] 更新相关测试
- [ ] 更新文档

## 相关文件

- `packages/core/src/initializer/archetype-defaults.ts`
- `packages/core/src/initializer/agent-initializer.ts`
- `packages/core/src/template/schema/template-schema.ts`
- `packages/core/src/manager/launcher/builtin-backends.ts`
- `packages/core/src/manager/launcher/backend-resolver.ts`

## 规范参考

- `agent-lifecycle.md` §1.3 Archetype 执行策略
- `agent-lifecycle.md` §3 LaunchMode
- `config-spec.md` §BackendDefinition
