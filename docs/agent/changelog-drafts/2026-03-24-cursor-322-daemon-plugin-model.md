# Daemon Plugin Model

## 变更摘要

- 在 `@actant/shared` 与 `@actant/agent-runtime` 中固定 `daemon plugin` 治理模型：新增 plugin metadata、contribution summary、lifecycle timestamps，并把 runtime inspection 结果统一到 `PluginRef`
- 在 `PluginHost` 中把 plugin 状态暴露收口为 `metadata / lifecycle / contributions / lastTickAt / errorMessage`，同时为 legacy adapter 和内置 `HeartbeatPlugin` 补齐 daemon plugin 语义
- 回写 `.trellis/spec/backend/index.md`、`docs/design/actant-vfs-reference-architecture.md`、`.trellis/spec/api-contracts.md` 与 roadmap，使主题 3“插件模型治理”完整闭环

## 用户可见影响

- CLI / RPC 查看 plugin runtime 状态时，可以看到更稳定的 daemon plugin 结构化信息，而不再只暴露裸运行状态
- 活跃设计文档和 roadmap 现在明确 `daemon plugin` 是唯一有效扩展单元，`provider` 只是其子能力，bridge 不得直接装载 plugin

## 破坏性变更/迁移说明

- `ActantPlugin` 继续作为 deprecated type alias 保留，但新的活跃契约和文档口径都以 `DaemonPlugin` 为准
- `provider` 不再允许被描述为系统顶层插件模型；后续扩展应经 `daemon plugin -> provider contribution` 路径进入

## 验证结果

- `npx gitnexus analyze`
- `pnpm --filter @actant/agent-runtime type-check`
- `pnpm --filter @actant/shared type-check`
- `pnpm vitest run --configLoader runner packages/agent-runtime/src/plugin/plugin-host.test.ts packages/agent-runtime/src/plugin/builtins/heartbeat-plugin.test.ts`
- `git diff --check`
- 人工复核 `.trellis/spec/backend/index.md`、`.trellis/spec/api-contracts.md`、`docs/design/actant-vfs-reference-architecture.md`、`docs/planning/contextfs-roadmap.md` 的 plugin 治理表述已对齐

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
