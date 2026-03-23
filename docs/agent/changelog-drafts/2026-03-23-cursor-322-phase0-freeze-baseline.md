# #322 Phase 0 Baseline Freeze

## 变更摘要

- 冻结 `#322` Phase 0 的 hosted/runtime 边界表述，明确 `bridge -> RPC -> daemon` 与 `daemon -> plugin -> provider -> VFS` 是当前活跃真相。
- 更新 active spec/design/planning 文档，固定 `domain-context` 与 `manager` 的最终职责边界。
- 补回 checked-in namespace example 与 catalog fixture，修复被过时测试假设阻断的 ship gate。
- 调整治理测试的 git 环境选择，避免本机系统 `git`/Xcode license 状态影响仓库级门禁。

## 用户可见影响

- 仓库中重新提供了可直接读取的 `examples/project-context-discovery` namespace 示例。
- `Phase 0` 相关文档、规划入口与测试门禁对同一套 hosted/runtime 术语保持一致。
- 交付前质量门恢复到可执行、可通过状态，不再被缺失 fixture 或错误 git 路径阻断。

## 破坏性变更/迁移说明

- 无。

## 验证结果

- `codex-loop` Phase 0 baseline freeze round passed in round 1。
- `pnpm vitest run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts packages/catalog/src/catalog-validator.test.ts packages/shared/src/__tests__/trellis-governance.test.ts packages/mcp-server/src/context-backend.test.ts --configLoader runner`
- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
