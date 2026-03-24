# Host Runtime Governance

## 变更摘要

- 删除 `@actant/mcp-server` 中 bridge 自装配出口：`ContextBackend` 收口为 daemon-connected only，移除 `createStandaloneContext`、本地 `VFS` 装配与相关 standalone 测试基线。
- 保持 `cli hub` 的 daemon-only 收口，并把 `actant api` help 文案改成 daemon-hosted bridge，避免继续向用户暴露 standalone REST 叙述。
- 回写活跃 spec / design / roadmap：明确 `cli`、`rest-api`、`mcp-server` 等 bridge 包不得在本地调用 `loadProjectContext` / `VfsKernel` / `VfsRegistry` 重新装配 namespace，并将 `#322` 主题 1 标记完成。

## 用户可见影响

- MCP bridge 现在必须连接 daemon；daemon socket 或 host 不可用时会直接失败，不再在本地拼装 namespace 视图。
- `actant api --help` 不再把 REST 入口描述为 standalone server，而是明确为 daemon-hosted bridge。
- 活跃文档和 roadmap 对运行时宿主口径统一为 `daemon` 唯一宿主 / 唯一组合根，bridge 仅通过 RPC 交互。

## 破坏性变更/迁移说明

- `@actant/mcp-server` 不再导出或支持 standalone context backend；依赖本地自装配行为的调用方需要先启动 daemon，再通过 RPC 访问同一挂载面。

## 验证结果

- `pnpm lint`
- `pnpm type-check`
- `pnpm test` currently fails in this sandbox with `EPERM` because Vitest cannot write `node_modules/.vite-temp`.
- `pnpm vitest run --configLoader runner packages/cli/src/commands/__tests__/commands.test.ts packages/mcp-server/src/context-backend.test.ts`
- `git diff --check`
- Active-surface grep on `packages/cli`, `packages/mcp-server`, `.trellis/spec`, `docs/design`, `docs/planning` confirmed the bridge surface no longer exposes `createStandaloneContext` or `standalone REST API server`.

## 关联 PR / Commit / Issue

- PR: pending
- Commit: blocked in current sandbox because Git cannot create `.git/worktrees/03-24-322-host-runtime-governance/index.lock`
- Issue: #322
