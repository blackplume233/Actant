# #322 / #323 边界收口与历史残留清理

## 变更摘要

- 固化最终包拓扑、bridge 审查结论与 `actant` 最小职责边界，并回写到活跃 spec/design/roadmap/TODO
- 将 `cli hub` 与 `mcp-server` 的 standalone namespace 组装收回 `@actant/api#createStandaloneProjectContextRuntime`
- 新增 ContextFS boundary gate，拦截组合根回流、bridge 越级装配、provider 越界与中心注册结构残留
- 新增 daemon/VFS state convergence 回归，验证 `/daemon`、`/agents`、`/mcp/runtime`、`/skills`、`/hub/*` 等真实状态面统一经 VFS 暴露
- 完成 `packages/core` / `packages/domain` / `packages/catalog` 退场后的活跃引用与治理文档收口

## 用户可见影响

- bridge 层不再自行拼装 standalone kernel；`cli` 与 `mcp-server` 的本地 namespace fallback 走统一 API helper
- 活跃文档现在明确区分 `bridge`、`daemon-hosted modules`、`support modules`、`adapter / UI` 与 `product shell`
- 后续如果有人把 `VfsRegistry`、`VfsKernel`、`createProjectContextRegistrations`、`BaseComponentManager` 等边界违规符号带回活跃实现，门禁会直接失败

## 破坏性变更/迁移说明

- `@actant/context` 继续降级为过渡 helper 包，不得新增独立 orchestration 语义；新增入口统一落在 `@actant/api`
- `packages/core`、`packages/domain`、`packages/catalog` 已确认为历史退场对象；活跃实现与默认入口不得再引用
- `cli` / `mcp-server` 若需要 standalone namespace 能力，只能通过 `@actant/api#createStandaloneProjectContextRuntime`，不得重新在 bridge 内 new/mount `VfsRegistry` / `VfsKernel`

## 验证结果

- `node node_modules/vitest/vitest.mjs run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/shared/src/__tests__/contextfs-boundary-gate.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/api/src/services/__tests__/project-context-standalone-runtime.test.ts packages/api/src/services/__tests__/vfs-state-convergence.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/mcp-server/src/context-backend.test.ts`
- `node node_modules/vitest/vitest.mjs run packages/cli/src/commands/__tests__/commands.test.ts`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322, #323
