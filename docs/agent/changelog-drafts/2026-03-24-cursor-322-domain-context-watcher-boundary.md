# #322 Domain-Context Watcher / API Boundary

## Summary

- 把 `TemplateFileWatcher` 从 `domain-context` 活跃包边界迁到 `packages/api/src/services/template-directory-watcher.ts`，明确它只服务本地 authoring 路径。
- 删除 `packages/domain-context/src/template/watcher/*` 这条已经无活跃调用者的死边界，避免 watcher 作为 `domain-context` 内部残留继续回流。
- `packages/api` 改为直接依赖 `@actant/domain-context` 与 `@actant/vfs`，不再经 `@actant/agent-runtime` 转发 `TemplateRegistry`、manager 与 VFS factory/source。
- 顺手修掉 `domain-handlers` 的旧 mutable contract 误配，以及 `template-handlers` 对 `validateTemplate` 的旧 `@actant/agent-runtime` 动态依赖。

## Verification

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/domain-context type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/shared/src/__tests__/contextfs-terminology-gate.test.ts`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/api/src/services/__tests__/hub-context.test.ts packages/api/src/services/__tests__/namespace-authoring.test.ts packages/api/src/handlers/__tests__/template-handlers.test.ts packages/api/src/handlers/__tests__/domain-handlers.test.ts`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/api type-check`
  - 结果：本轮引入的 `domain-handlers` / `template-handlers` 错误已消失；剩余失败仍为 `@mariozechner/pi-tui`、`chalk`、`@anthropic-ai/claude-agent-sdk` 等外部依赖缺失
