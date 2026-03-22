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

当前阶段：

- M0-M6 已完成，主线能力已经覆盖文档基线、契约替换、Kernel、编排层、Built-In Sources、执行模型与 facade 统一
- 当前进入 M7：补齐声明式 `Source` 配置、context 用户入口、写路径与持久化闭环
- M8 关注 release hardening：遗留接口清理、全量回归、V1 边界冻结
- live milestone progress 只在 `docs/planning/contextfs-roadmap.md` 维护，本文件不重复标注 checklist 状态

默认以当前 spec/design/roadmap 为准。只有在处理迁移残留或历史清理时，才读取历史说明文档。
