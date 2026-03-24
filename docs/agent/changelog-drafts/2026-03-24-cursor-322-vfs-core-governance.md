# VFS Core Governance

## 变更摘要

- 收口 `@actant/vfs` core terminology，把 `SourceNodeAdapter` 改为 `ResolvedNodeAdapter`，并将 `VfsRegistry`、`DirectMountTable`、`VfsPathResolver`、`VfsLifecycleManager` 的核心描述统一到 `mount / node / filesystem` 语义
- 为当前活跃 mount factory 和 runtime source 显式补齐 `metadata.filesystemType` 与 `metadata.mountType`，切断 `vfs-registry`、`direct-mount-table`、RPC handler 对 `name/label` 的 `filesystemType` 猜测逻辑
- 切断 `@actant/agent-runtime` 根导出的 `domain-context` manager/template 兼容出口，并将 `domain-handlers`、`workspace-builder` 收口到最小 collection 合同；同步补出 `domain-context` keep / migrate / delete 基线文档

## 用户可见影响

- `describe` / `mount list` / VFS 内核现在优先依赖显式 mount metadata，而不是历史命名约定
- `@actant/agent-runtime` 不再继续作为 `domain-context` manager/template 的活跃公共入口，后续调用方应直接依赖 `@actant/domain-context`
- 活跃架构文档已经把 VFS core file mapping 和 `mount / watch / stream / dispose` 生命周期契约写成显式真相

## 破坏性变更/迁移说明

- breaking:
  - `@actant/agent-runtime` 根导出已移除 `./domain/index` 与 `./template/index` 的兼容转发
  - 需要访问 manager/template 对象的调用方应改为从 `@actant/domain-context` 导入
- `VfsMountRegistration.metadata` 现在应优先显式提供 `filesystemType` / `mountType`

## 验证结果

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/vfs type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/agent-runtime type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/vfs/src/__tests__/vfs-registry.test.ts packages/vfs/src/__tests__/m5-filesystem-type-features-e2e.test.ts packages/vfs/src/__tests__/vfs-kernel.test.ts`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/agent-runtime/src/builder/workspace-builder.test.ts`
- 已确认 `pnpm --filter @actant/api type-check` 当前仍失败于 worktree 缺失 ACP / PI / TUI 外部依赖，不是本主题新增类型错误

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
