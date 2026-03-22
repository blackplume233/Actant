# Actant Project Context

本仓库当前采用 `ContextFS` 的 Linux 术语基线。

建议读取顺序：

1. `actant.namespace.json`
2. `docs/design/contextfs-v1-linux-terminology.md`
3. `.trellis/spec/index.md`
4. `.trellis/spec/terminology.md`
5. `docs/design/contextfs-architecture.md`
6. `docs/design/actant-vfs-reference-architecture.md`
7. `docs/planning/contextfs-roadmap.md`

当前有效约束：

- 产品层：`ContextFS`
- 实现层：`VFS`
- 核心对象：`mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`
- V1 必要 `mount type`：`root`、`direct`
- V1 必要 `filesystem type`：`hostfs`、`runtimefs`、`memfs`
- V1 必要 `node type`：`directory`、`regular`、`control`、`stream`
- V1 不包含 `workflow`、query/view mount、overlay/fallback 行为实现
- 里程碑进度与状态只在 `docs/planning/contextfs-roadmap.md` 中原子维护

当前阶段：

- M0-M7 已完成，主线能力已经覆盖文档基线、契约替换、Kernel、编排层、执行模型、facade 统一与 namespace 写路径闭环
- 当前默认用户入口固定为 `actant init`、`actant hub status`、`actant namespace validate`、`actant vfs mount add/remove/list`
- M8 关注 release hardening：遗留接口清理、全量回归、V1 边界冻结
- live milestone progress 只在 `docs/planning/contextfs-roadmap.md` 维护，本文件不重复标注 checklist 状态

默认以当前 spec/design/roadmap 为准。只有在处理迁移残留或历史清理时，才读取历史说明文档。
