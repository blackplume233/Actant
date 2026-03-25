# plugin-family-taxonomy

## 变更摘要

- 将 `agent-runtime` 在活跃 spec 中明确收口为由 `daemon` 装载的 builtin plugin capability，而不是一般性的中心运行时模块。
- 在 active baseline 中新增 `core / sdk / support / plugins / bridges / third-party / app` 包层级，并说明 `plugin family` 只是逻辑归属维度，不是新的物理目录层。
- 同步术语、backend 分层和 reference architecture，固定 `sdk` 与 `support` 的职责边界，以及 third-party 只负责开发、安装、兼容、审核与物化而不是宿主。

## 用户可见影响

- 后续仓库重组与新插件设计应按 `sdk/support/plugins` 分层推进，而不是把复用层嵌套到单个插件实现目录下。
- 评审插件化改动时，需要同时检查逻辑 family 归属和物理包层级是否被混淆。

## 破坏性变更/迁移说明

- 这次是规范收口，不直接修改运行时行为。
- 后续若实施目录重组，任何原先把实现包当作公共导入面的路径都应迁移到对应 `sdk` 或 `support` 包。

## 验证结果

- `git diff -- .trellis/spec/index.md .trellis/spec/terminology.md .trellis/spec/backend/index.md docs/design/actant-vfs-reference-architecture.md`
- `rg -n "family|sdk|support|third-party|builtin plugin capability" .trellis/spec docs/design/actant-vfs-reference-architecture.md -S`

## 关联 PR / Commit / Issue

- Issue: pending
- Commit: pending
- PR: pending
