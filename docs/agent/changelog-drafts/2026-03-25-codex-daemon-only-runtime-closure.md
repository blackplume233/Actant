# daemon-only-runtime-closure

## 变更摘要

- 删除 daemon runtime plugin host 相关实现、共享类型、CLI 状态命令与 RPC surface。
- 移除 `cli hub` 与 `mcp-server` 的 standalone namespace fallback，bridge 访问统一收口为 `RPC -> daemon`。
- 同步 backend spec、reference architecture 与 context smoke 脚本，使活跃文档和验收脚本匹配新的 daemon-only runtime 口径。

## 用户可见影响

- `actant hub` 在 daemon 不可用时不再降级到本地 namespace mode，而是要求先启动 daemon。
- `mcp-server` 在无法连接 daemon 时直接报错，不再尝试本地 standalone context。
- `plugin runtime` 相关 CLI / RPC 状态面已移除。

## 破坏性变更/迁移说明

- 依赖 `createStandaloneProjectContextRuntime` 语义的 bridge fallback 流程需要迁移到显式启动 daemon 后再通过 RPC 访问。
- 依赖 `plugin.runtimeList` / `plugin.runtimeStatus` 或 `actant plugin status` 的调用方需要移除这些入口。
- 本次变更尚未处理主工作区 `packages/context` 的物理残留与 `createStandaloneProjectContextRuntime` 本体删除，后续需要继续收口。

## 验证结果

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- `pnpm vitest run packages/tui/src/__tests__/chat-view.test.ts`

## 关联 PR / Commit / Issue

- Issue: `daemon-only-runtime-closure`
- Commit: pending
- PR: pending
