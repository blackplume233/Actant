# Actant

Actant 当前以 `ContextFS` 为唯一有效产品基线：把上下文统一为可寻址、可操作、可授权、可管理生命周期的文件式资源。

当前阅读顺序：

1. `.trellis/spec/index.md`
2. `docs/design/contextfs-architecture.md`
3. `docs/design/actant-vfs-reference-architecture.md`
4. `.trellis/spec/config-spec.md`
5. `.trellis/spec/api-contracts.md`
6. `docs/planning/contextfs-roadmap.md`

当前阶段说明：

- M0-M6 已完成，当前主线进入 M7 `Source` 配置面 + 自举就绪，并为 M8 V1 Freeze 做验证收口。
- 运行时主线已具备 ContextFS 编排、Built-In Sources、执行模型与 facade 统一；当前重点是补齐用户入口、写路径和交付验证。
- live progress 只在 `docs/planning/contextfs-roadmap.md` 原子维护；本文件只提供入口说明，不重复维护里程碑状态。
- V1 只围绕 `Project`、`SourceType`、`Source`、`Trait`、`Capability` 和当前规范声明的内置 Source 展开。
- V1 只包含当前规范中声明的对象、操作面与边界。

除非正在处理迁移残留或历史清理，不要把历史说明文档当作默认入口。
