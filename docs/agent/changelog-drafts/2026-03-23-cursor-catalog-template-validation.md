# Catalog Template Validation Hardening

## 变更摘要

- 将 local catalog 的 template 读取切回正式 `TemplateLoader` 校验链，不再直接把裸 JSON 注入 template registry。
- 为 legacy `domainContext` template 增加显式校验提示，返回结构化 `CONFIG_VALIDATION_ERROR`，避免 `catalog add/sync` 抛出不透明 `TypeError`。
- 将 `CatalogManager` 的 add/sync/initialize 流程改为更接近原子提交：新 catalog 状态只有在完整装载成功后才生效，sync 失败时保留旧状态。
- 更新 QA 场景：真实协作 happy path 改用当前 `project` schema；新增一个专门覆盖 legacy template 失败行为的回归场景。

## 用户可见影响

- 用户在本地 catalog 中误用 legacy `domainContext` template 时，会看到可诊断的模板校验错误，而不是 `[RPC -32603] Cannot read properties of undefined`。
- 已成功同步的 catalog 再次同步时，如果新 template 非法，不会破坏现有已加载的 skill/prompt/template 状态。
- 当前 schema 的 catalog/template 安装主链保持可用。

## 破坏性变更/迁移说明

- legacy `domainContext` template 仍然不被支持；需要手工改为 `project` 字段。
- 本次不提供自动迁移或兼容映射。

## 验证结果

- `pnpm vitest run packages/domain-context/src/template/loader/template-loader.test.ts packages/catalog/src/catalog-manager.test.ts`
- `pnpm eslint packages/domain-context/src/template/loader/template-loader.ts packages/catalog/src/local-catalog.ts packages/catalog/src/catalog-manager.ts packages/domain-context/src/template/loader/template-loader.test.ts packages/catalog/src/catalog-manager.test.ts`
- 真实 CLI smoke:
  - legacy template 的 `catalog add` 返回 `CONFIG_VALIDATION_ERROR`，并包含 `project` / `domainContext` 校验信息
  - current schema 的 `catalog add -> catalog sync -> template install` 继续成功

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #321
