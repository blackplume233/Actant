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

- 先完成文档与规格收口，再进入实现。
- V1 只围绕 `Project`、`Source`、`Capability` 和 4 个内置 Source 展开。
- V1 只包含当前规范中声明的对象、操作面与边界。

历史迁移说明见 `docs/history/legacy-architecture-transition.md`；除非需要处理迁移或清理残留，不要把它作为默认入口。
