# #322 Phase 1 Audit and Package Baseline

## 变更摘要

- 将 `#322` 正式切为当前 roadmap 主线，并把 Phase 1 的违规路径盘点与包边界决策写入 active roadmap。
- 新增详细审计记录，明确 `catalog -> manager`、`manager -> VFS`、`register / unregister / inject` 的现状热点。
- 给后续 Workstream A / B / C 形成 `keep / converge / delete` 包边界基线。

## 用户可见影响

- 当前活跃 roadmap 已不再停留在抽象目标，而是包含可执行的 Phase 1 审计基线。
- 后续实现阶段可以直接以本次审计记录为输入，不再重复大范围搜集现状。

## 破坏性变更/迁移说明

- 无。本阶段只更新审计与规划真相源，不修改运行时代码路径。

## 验证结果

- `codex-loop` Phase 1 audit round used for initial path discovery, then manual convergence completed the final audit diff.
- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
