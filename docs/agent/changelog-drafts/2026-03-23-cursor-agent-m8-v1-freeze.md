# M8 V1 Freeze Breaking Cleanup

## 变更摘要

- 冻结 `HostProfile`、`HostCapability`、component origin、RPC method map 等共享公共契约，切断旧 `bootstrap`、`sourceName`、`proxy.connect` / `proxy.disconnect` 等活跃边界。
- 收口 `@actant/context` 为 projection / manifest / permission helper，移除 legacy source-centric orchestration 实现与导出。
- 将活跃 public surface 中的 `source -> catalog` 统一落到 CLI、REST、dashboard schema、文档与帮助文案，并把 standalone wording 收敛为 `standalone namespace mode`。
- 删除 proxy 的 legacy session lease fallback，只保留 `gateway.lease` 作为正式 public lease path。
- 补齐 terminology gate、shared contract tests、REST contract tests、CLI namespace authoring E2E，并回写 `docs/planning/contextfs-roadmap.md` 使 M8 完成。

## 用户可见影响

- REST catalog 入口从 `/v1/sources` 切换为 `/v1/catalogs`。
- CLI / MCP / hub / help surface 不再出现 `project-context mode`、`setup`、`sourceName` 等旧术语。
- `actant proxy --lease` 现在只走 `gateway.lease`，gateway 不可用时直接失败，不再静默退回 legacy 路径。
- `actant init`、`actant namespace validate`、`actant vfs mount add/remove/list` 的 namespace authoring 主线已具备端到端回归覆盖。

## 破坏性变更/迁移说明

- `normalizeHostProfile()` 不再接受历史旧 profile 名称，传入非法值会直接报错。
- `HostCapability` 中不再使用 `sources`，统一改为 `catalogs`。
- component origin 不再暴露 `sourceName`，统一改为 `catalogName`。
- RPC public contract 不再包含 `proxy.connect` / `proxy.disconnect`。
- REST public route 不再暴露 `/v1/sources`，调用方需要迁移到 `/v1/catalogs`。
- `@actant/context` 不再导出 legacy source-centric orchestration objects。

## 验证结果

- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `pnpm test packages/shared/src/__tests__/host-types.test.ts packages/shared/src/__tests__/contextfs-terminology-gate.test.ts packages/context/src/__tests__/index.test.ts packages/rest-api/src/server.test.ts packages/api/src/services/__tests__/host-profile-compat.test.ts packages/cli/src/commands/__tests__/commands.test.ts packages/mcp-server/src/context-backend.test.ts`
- `pnpm test packages/api/src/handlers/__tests__/gateway-handlers.test.ts packages/api/src/handlers/__tests__/error-contract.test.ts`
- `pnpm test packages/cli/src/__tests__/e2e-cli.test.ts`
- Active-surface grep on `README.md`, `PROJECT_CONTEXT.md`, `.trellis/spec/`, `docs/`, `packages/api`, `packages/cli`, `packages/mcp-server`, `packages/shared`, `packages/context`, `packages/dashboard`, `packages/rest-api` passed with no legacy hits in non-test active files.

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: pending
