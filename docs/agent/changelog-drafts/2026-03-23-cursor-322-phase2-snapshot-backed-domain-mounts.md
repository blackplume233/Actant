# #322 Phase 2 Snapshot-Backed Domain Mounts

## 变更摘要

- 为 `@actant/vfs` 新增 snapshot-backed domain source，允许 derived mounts 基于冻结快照而不是 live manager state 暴露内容。
- 将 standalone/project-context 的 `/skills`、`/prompts`、`/mcp`、`/workflows`、`/templates` 切换到 snapshot-backed mounts。
- 新增 focused tests，验证 snapshot mount 与 live manager-backed mount 的边界差异。

## 用户可见影响

- standalone namespace 读取 derived views 时，不再把 manager registry 当作 VFS 真相源。
- `/project` 语义与 `context-backend` 行为保持不变，但内部边界更接近 `#322` 的 VFS-first 目标。

## 破坏性变更/迁移说明

- 无用户面 breaking change。
- 本阶段只切 standalone/project-context path；daemon app-context 与 catalog/manager 中心职责仍会在后续阶段继续收敛。

## 验证结果

- `pnpm --filter @actant/vfs type-check`
- `pnpm --filter @actant/api type-check`
- `pnpm --filter @actant/mcp-server type-check`
- `pnpm exec vitest run packages/vfs/src/__tests__/domain-source.test.ts packages/mcp-server/src/context-backend.test.ts`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
