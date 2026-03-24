# #322 Template Registry Boundary

## 变更摘要

- 将 `packages/domain-context/src/template/registry/template-registry.ts` 从 `BaseComponentManager` 继承中拆出，改为 `domain-context` 自己维护本地 template collection、validation 与 persistence。
- 保持 `TemplateRegistry` 现有调用 API 兼容，避免同时扰动 `template-handlers`、`agent-initializer`、`catalog-manager` 和 `api/app-context` 的模板主链路。
- 继续缩小 `@actant/domain-context` 作为跨包 manager 基类的活跃作用域，为后续集中处理 `CatalogManager` 的中心注册职责创造更小 blast radius。

## 用户可见影响

- 模板读取、校验、加载、卸载、持久化与实例初始化行为保持不变。
- 这次变化主要是内部边界治理，后续 `domain-context` 去中心化和 `CatalogManager` 收口可以更稳定地继续推进。

## 破坏性变更/迁移说明

- 无新的用户面破坏性变更。
- `TemplateRegistry` public method 形状保持兼容，但实现不再依赖 `BaseComponentManager`。

## 验证结果

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/domain-context type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/domain-context/src/template/registry/template-registry.test.ts packages/api/src/handlers/__tests__/template-handlers.test.ts packages/catalog/src/catalog-manager.test.ts packages/agent-runtime/src/initializer/agent-initializer.test.ts`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
