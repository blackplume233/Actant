# #322 Theme 6: Agent Runtime Positioning

## Summary

- 把 `agent-runtime` 的活跃定位固定为 `daemon` 装载的运行机制模块，而不是组合根或中心层。
- 把 `acp` 与 `pi` 的活跃定位锁定为协议/transport 模块与 backend package，明确它们不能越级成为新的宿主层。
- 删除 `packages/agent-runtime/src/domain/index.ts` 与 `packages/agent-runtime/src/template/index.ts` 两个死掉的兼容入口，避免旧 manager/template 边界从 `@actant/agent-runtime` 回流。
- 收紧 `domain-context` 根导出与本地 collection 文案，把 `TemplateRegistry` / `TemplateFileWatcher` 明确为 authoring helper，而不是系统真相源。
- 扩展 terminology gate，把 `agent-runtime` 插件口径和死掉的兼容导出路径纳入活跃门禁。

## Verification

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/agent-runtime type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/domain-context type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/catalog type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/agent-runtime/src/plugin/plugin-host.test.ts packages/agent-runtime/src/plugin/builtins/heartbeat-plugin.test.ts packages/shared/src/__tests__/contextfs-terminology-gate.test.ts`
