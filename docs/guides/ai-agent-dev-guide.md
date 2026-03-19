# Actant 开发手册 — ContextFS 基线

本文档面向需要修改仓库源码的 AI Agent。旧的开发手册已移入 `trash/`，不再作为当前实现依据。

---

## 当前阅读顺序

1. `.trellis/spec/index.md`
2. `docs/design/contextfs-architecture.md`
3. `docs/design/actant-vfs-reference-architecture.md`
4. `.trellis/spec/config-spec.md`
5. `.trellis/spec/api-contracts.md`
6. `.trellis/spec/backend/index.md`
7. `docs/planning/contextfs-roadmap.md`

---

## 当前开发约束

- 先文档，后实现
- 当前有效对象模型只有 `Project`、`Source`、`Capability`
- V1 只围绕 `SkillSource`、`McpConfigSource`、`McpRuntimeSource`、`AgentRuntime`
- V1 不做 `workflow`、query/view mount、overlay/fallback 行为实现

---

## 进入代码前必须确认

- 这个改动落在哪个 `Source`
- 它暴露什么路径
- 它支持哪些操作面
- 权限和生命周期由谁持有
- 是否需要同步更新 spec/design/roadmap

---

## 历史文档处理规则

`trash/` 下的内容只保留历史记录价值，不得再作为实现、评审或新设计的依据。
