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
- 核心对象：`Project`、`SourceType`、`Source`、`Trait`、`Capability`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`
- V1 不包含 `workflow`、query/view mount、overlay/fallback 行为实现
- 里程碑进度与状态只在 `docs/planning/contextfs-roadmap.md` 中原子维护

当前进度：

- 以 `docs/planning/contextfs-roadmap.md` 为唯一 live progress truth file

默认以当前 spec/design/roadmap 为准。只有在处理迁移残留或历史清理时，才读取历史说明文档。
