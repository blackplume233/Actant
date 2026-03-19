# Actant Project Context

本仓库当前采用 `ContextFS` 文档基线。

建议读取顺序：

1. `actant.project.json`
2. `.trellis/spec/index.md`
3. `.trellis/spec/terminology.md`
4. `docs/design/contextfs-architecture.md`
5. `docs/design/actant-vfs-reference-architecture.md`
6. `docs/planning/contextfs-roadmap.md`

当前有效约束：

- 产品层：`ContextFS`
- 实现层：`VFS Kernel`
- 核心对象：`Project`、`Source`、`Capability`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`
- V1 不包含 `workflow`、query/view mount、overlay/fallback 行为实现、旧 `ContextManager`

历史架构材料已移入 `trash/`。如目录结构与历史命名存在残留，以 spec/design/roadmap 新基线为准，不以旧目录名推断产品模型。
