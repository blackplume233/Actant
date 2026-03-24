# Actant 0.5.0 Changelog

## Summary

`0.5.0` 冻结了当前 ContextFS / VFS V1 基线，并完成 `#322` / `#323` 的架构收口与历史残留清理。

本版本的核心结果：

- `daemon -> plugin -> provider -> VFS` 与 `bridge -> RPC -> daemon` 边界固定
- `mount namespace` / `mount table` / `filesystem type` / `node type` 成为唯一活跃对象模型
- `cli` / `mcp-server` 的 standalone namespace fallback 收口到统一 API helper
- `packages/catalog`、`packages/core`、`packages/domain` 与相关活跃引用退场
- 活跃 spec/design/roadmap/TODO 与代码门禁已经对齐

## User-Visible Changes

- 新的 namespace / standalone 读取路径统一围绕 `actant.namespace.json` 与 `ContextFS` Linux 术语工作
- bridge 层不再自行装配 kernel；本地 fallback 走 `@actant/api#createStandaloneProjectContextRuntime`
- CLI、MCP、daemon、VFS 的边界术语与导出面更统一，减少旧模型混淆

## Architecture Freeze

- `@actant/vfs`：唯一内核与唯一挂载/路径/节点真相源
- `@actant/api`、`@actant/agent-runtime`：daemon-hosted modules
- `@actant/domain-context`、`@actant/acp`、`@actant/pi`、`@actant/shared`：support modules
- `@actant/cli`、`@actant/rest-api`、`@actant/dashboard`、`@actant/mcp-server`：bridge packages
- `@actant/tui`、`@actant/channel-*`：adapter / UI packages
- `@actant/actant`：打包层 / 分发层 / 产品壳
- `@actant/context`：仅保留过渡 helper 身份，继续并入 `@actant/api`

## Removed / Retired

- `packages/catalog`
- `packages/core`
- `packages/domain`
- `packages/actant/src/core.ts`
- bridge 自组装 standalone kernel 的活跃路径
- `BaseComponentManager` / `createDomainSource` / `createSkillSource` / catalog overlay 等中心注册残留

## Verification

- `node node_modules/vitest/vitest.mjs run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/shared/src/__tests__/contextfs-boundary-gate.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/api/src/services/__tests__/project-context-standalone-runtime.test.ts packages/api/src/services/__tests__/vfs-state-convergence.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/mcp-server/src/context-backend.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/cli/src/commands/__tests__/commands.test.ts`

## Related Issues

- `#322` File-First 下 `domain-context` 最终定位与 VFS 中心边界收口
- `#323` 清理 `packages/core` 与 `packages/domain` 历史残留，完成去 core 化治理
