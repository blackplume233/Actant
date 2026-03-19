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
- `workflow`、旧 `ContextManager`、旧 `DomainContext` 模型不再作为当前实现依据。

历史文档已移入 `trash/`，不再作为开发或审查依据。
