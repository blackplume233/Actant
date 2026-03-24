# #322 Backend Manager Boundary

## 变更摘要

- 将 `packages/agent-runtime/src/domain/backend/backend-manager.ts` 从 `BaseComponentManager` 继承中拆出，改为 `agent-runtime` 自己维护本地 backend store、persistence 与 validation 逻辑。
- 保持 `BackendManager` 现有外部 API 兼容，避免同时扰动 `backend-registry`、`workspace-builder`、`agent-manager` 与 `api/app-context` 的调用签名。
- 进一步缩小 `@actant/domain-context` 作为跨包 manager 基类的活跃作用域，为后续只剩 `TemplateRegistry` / singleton 生命周期边界的收口做准备。

## 用户可见影响

- 运行时 backend 装载、解析、provider env 构建与目录装载行为保持不变。
- 这次变化主要是内部边界治理，后续 `domain-context` / `manager-first` 收口可以在更小 blast radius 下继续推进。

## 破坏性变更/迁移说明

- 无新的用户面破坏性变更。
- `BackendManager` 的 public method 形状保持兼容，但其实现不再依赖 `@actant/domain-context` 的 `BaseComponentManager`。

## 验证结果

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/agent-runtime type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/agent-runtime/src/domain/backend/backend-manager-install.test.ts packages/agent-runtime/src/manager/launcher/backend-resolver.test.ts packages/agent-runtime/src/manager/launcher/build-provider-env.test.ts`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/api/src/services/__tests__/hub-context.test.ts`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
