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
- V1 不包含 `workflow`、query/view mount、overlay/fallback 行为实现

历史迁移说明集中放在 `docs/history/legacy-architecture-transition.md`。默认以当前 spec/design/roadmap 为准，只有在处理迁移或清理残留时才读取历史说明。
