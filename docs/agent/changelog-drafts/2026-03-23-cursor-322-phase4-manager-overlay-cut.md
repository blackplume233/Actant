# #322 Phase 4 catalog snapshot overlay cut

## 变更摘要

- `packages/catalog` 中的 `CatalogManager` 改为持有 namespaced snapshot state，不再把 catalog 组件直接注入 `SkillManager` / `PromptManager` / `McpConfigManager` / `WorkflowManager` / `TemplateRegistry`
- `packages/api` 中的 daemon `AppContext` 新增 aggregate read / overlay resolver 路径，catalog-backed `skill/prompt/mcp/workflow/template` 可在不污染本地 managers 的前提下继续支持 VFS 投影与 `agent create`
- `packages/api` 中的 standalone `project-context` 改为 local manager + catalog resolved snapshot 双层聚合，catalog 组件不再写入 local managers
- 新增回归测试覆盖 daemon 与 standalone 两条路径的 catalog 聚合读面

## 用户可见影响

- `catalog add` / `catalog sync` 后，`/skills`、`/prompts`、`/mcp`、`/workflows`、`/templates` 仍然会正常暴露 catalog 组件，但底层不再依赖 catalog 注入本地 domain managers
- 使用 catalog template 创建 agent 的主链路保持可用，`catalog -> template -> agent create` 在 daemon 场景下继续工作
- standalone `project-context` 读取 catalog 组件时不再出现“catalog 组件已经被写进 local manager”这一类中心注册副作用

## 破坏性变更/迁移说明

- 无新的公共 breaking rename
- 内部实现边界发生调整：catalog 组件读取应通过 aggregate view / resolved snapshot，不应再假设它们会出现在本地 mutable managers 中

## 验证结果

- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- 新增并通过：
  - `packages/api/src/services/__tests__/catalog-overlay-integration.test.ts`
  - `packages/api/src/services/__tests__/project-context-catalog-projection.test.ts`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
