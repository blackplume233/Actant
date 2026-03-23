# TODO

> Task: `#322`
> Working view only. Authority remains `docs/planning/contextfs-roadmap.md`.

## Execution Order

- [x] 先串行冻结 `#322` 基线
- [x] 再串行完成违规路径盘点与包边界决策
- [ ] 在基线冻结后并行推进三条工作流：
  - [ ] Workstream A: 去中心注册结构
  - [ ] Workstream B: 收口 `daemon / plugin / provider / VFS` 契约
  - [ ] Workstream C: 同步活文档与门禁
- [ ] 最后与 `#323` 联动完成历史残留清理与最终验收

## Progress Notes

- [x] Phase 0 baseline freeze 已完成并通过 `ship-sub`
- [x] Draft PR: `#324`
- [x] Merged to `master`: `d4ff12a`
- [x] Phase 1 audit and package-boundary baseline 已完成
- [x] Draft PR: `#325`
- [x] Merged to `master`: `15bdfc9`
- [x] Phase 2 standalone/project-context derived mounts 已完成
- [x] Draft PR: `#326`
- [x] Merged to `master`: `2f34108`
- [x] Phase 3 daemon app-context derived mounts 已完成
- [x] Draft PR: `#327`
- [x] Merged to `master`: `PR #327`
- [x] Phase 4 catalog snapshot / overlay cut 已完成
- [x] `CatalogManager` 改为持有 namespaced snapshot state，daemon 与 project-context 不再依赖 catalog 注入 domain managers
- [x] verification passed:
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
- [x] Phase 5 manager contract cut 已完成
- [x] builder / API handler 合同已从 `BaseComponentManager` 收窄到 `ComponentResolver` / `MutableComponentCollection`
- [x] overlay 读取层已改为只读 `OverlayComponentView`，不再伪装成 manager
- [x] verification passed:
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
- [ ] Remaining Workstream A scope: `BaseComponentManager` 已降级为 `domain-context` 本地 mutable collection；后续仍需继续删除 manager-first 实现与中心抽象

## Current Cut

- [x] `CatalogManager` 不再把 catalog 组件写入 `SkillManager` / `PromptManager` / `McpConfigManager` / `WorkflowManager` / `TemplateRegistry`
- [x] daemon `AppContext` 通过 overlay resolver + aggregate reads 支持 catalog-backed `skill/prompt/mcp/workflow/template` 读取与 `agent create`
- [x] standalone `project-context` 通过 local manager + catalog resolved snapshot 聚合读取 catalog 组件
- [x] 新增回归测试：
  - `packages/api/src/services/__tests__/catalog-overlay-integration.test.ts`
  - `packages/api/src/services/__tests__/project-context-catalog-projection.test.ts`
- [x] `BaseComponentManager` 不再作为 builder / API / overlay 的跨包合同类型
- [x] 读取侧 overlay 已收敛到 `ComponentCollection` 只读视图

## Sync Rule

- [ ] 本文件是 `#322` 的实时执行视图
- [ ] `docs/planning/contextfs-roadmap.md` 中的 `#322` 节是权威清单真相源
- [ ] 后续围绕 `#322` 的任务推进、拆分、状态变更都必须持续回写 roadmap，并保持本文件同步
