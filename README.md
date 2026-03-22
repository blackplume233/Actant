# Actant

Actant 当前以 `ContextFS` 为唯一有效产品基线：把上下文统一为可寻址、可操作、可授权、可管理生命周期的文件系统对象。

当前阅读顺序：

1. `docs/design/contextfs-v1-linux-terminology.md`
2. `.trellis/spec/index.md`
3. `docs/design/contextfs-architecture.md`
4. `docs/design/actant-vfs-reference-architecture.md`
5. `.trellis/spec/config-spec.md`
6. `.trellis/spec/api-contracts.md`
7. `docs/planning/contextfs-roadmap.md`

当前范围说明：

- M0-M6 已完成，当前主线进入 M7 `Mount Namespace` 配置面与 `filesystem type` 闭环，并为 M8 V1 Freeze 做验证准备。
- 当前默认配置入口是 `actant.namespace.json`；`actant.project.json` 仅保留兼容输入。
- 当前活跃模型只围绕 `mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type` 和 V1 规定的操作面展开。
- V1 操作面固定为 `read`、`write`、`list`、`stat`、`watch`、`stream`。
- 里程碑进度与状态只在 `docs/planning/contextfs-roadmap.md` 中原子维护。
- 本文件只提供入口说明，不重复维护里程碑状态。

除非正在处理迁移残留或历史清理，不要把旧术语文档、旧 CLI 叙事或 archive 内容当作默认入口。
