# #322 B3: Provider SPI / RuntimeFS Contract Freeze

## Summary

- 为 `runtimefs` provider contribution 增加 focused regression，固定 `/agents` 与 `/mcp/runtime` 只接受 `kind: "data-source"` 的 provider 输入。
- 冻结 `runtimefs` provider 的最小契约：必须显式声明 `filesystemType: "runtimefs"` 与精确 `mountPoint`，避免运行时挂载继续接受模糊 provider 形态。
- 补充 mount metadata 断言，保证通过 `createAgentRuntimeSource()` 与 `createMcpRuntimeSource()` 创建出的挂载显式携带 `filesystemType=runtimefs` 与 `mountType=direct`。

## Verification

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/vfs type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/vfs/src/__tests__/b3-runtimefs-provider-contract.test.ts packages/vfs/src/__tests__/m5-control-stream-e2e.test.ts`
