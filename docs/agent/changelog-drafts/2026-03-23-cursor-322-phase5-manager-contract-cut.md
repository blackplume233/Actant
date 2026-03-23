# #322 Phase 5 Manager Contract Cut

## 变更摘要

- 在 `domain-context` 中补出 `ComponentResolver`、`MutableComponentCollection`、`ComponentCollection` 等窄接口，替代跨包直接依赖 `BaseComponentManager`。
- 将 `agent-runtime` builder 与 `api` domain handler 的合同切到上述窄接口，收紧对 manager-first 抽象的耦合。
- 删除 `OverlayComponentManager`，改为只读 `OverlayComponentView`，让 overlay 读取层不再伪装成可写 manager。

## 用户可见影响

- 本次主要是内部边界收敛，不改变公开 CLI 或 RPC 行为。
- `#322` 的 Workstream A 进一步推进，catalog overlay 与 agent/template 相关读取路径继续维持现有行为，但内部不再要求跨包共享中心 manager 类型。

## 破坏性变更/迁移说明

- 无新增用户面破坏性变更。
- 对仓库内实现者而言，新的依赖方向应优先使用 `ComponentResolver`、`ComponentCollection`、`MutableComponentCollection`，而不是把 `BaseComponentManager` 当作默认跨包合同。

## 验证结果

- `pnpm type-check`
- `pnpm lint`
- `pnpm test`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: `#322`
