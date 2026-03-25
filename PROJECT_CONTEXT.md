# Actant Project Context

本仓库当前采用 `ContextFS` 的 Linux 术语基线。

建议读取顺序：

1. `actant.namespace.json`
2. `docs/design/contextfs-v1-linux-terminology.md`
3. `.trellis/spec/index.md`
4. `.trellis/spec/terminology.md`
5. `docs/design/contextfs-architecture.md`
6. `docs/design/actant-vfs-reference-architecture.md`
7. `docs/planning/roadmap.md`
8. `docs/planning/workspace-normalization-todo.md`

当前有效约束：

- 产品层：`ContextFS`
- 实现层：`VFS`
- 核心对象：`mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`
- V1 必要 `mount type`：`root`、`direct`
- 用户配置面只声明 `direct`；`root` 由 namespace 根投影隐式承载
- V1 必要 `filesystem type`：`hostfs`、`runtimefs`
- V1 必要 `node type`：`directory`、`regular`、`control`、`stream`
- V1 不包含 `workflow`、query/view mount、overlay/fallback 行为实现
- 当前 planning 入口只在 `docs/planning/roadmap.md` 维护
- 当前 cleanup backlog 只在 `docs/planning/workspace-normalization-todo.md` 维护

当前阶段：

- M0-M8 已完成，主线已进入 post-freeze boundary maintenance 与文档/工作区清理阶段
- 当前默认用户入口固定为 `actant init`、`actant hub status`、`actant namespace validate`、`actant vfs mount add/remove/list`
- 当前关注点是活跃文档收口、入口去歧义和后续 planning intake
- 预冻结里程碑执行记录已归档到 `docs/history/contextfs-roadmap-pre-stack-freeze.md`

默认以当前 spec/design/roadmap 为准。只有在处理迁移残留或历史清理时，才读取历史说明文档。
