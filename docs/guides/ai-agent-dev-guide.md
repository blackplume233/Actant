# Actant 开发手册 — Linux 语义基线

本文档面向需要修改仓库源码的 AI Agent。旧的开发手册与旧对象模型只保留历史价值，不再作为当前实现依据。

---

## 当前阅读顺序

1. `docs/design/contextfs-v1-linux-terminology.md`
2. `.trellis/spec/index.md`
3. `docs/design/contextfs-architecture.md`
4. `docs/design/actant-vfs-reference-architecture.md`
5. `.trellis/spec/config-spec.md`
6. `.trellis/spec/api-contracts.md`
7. `.trellis/spec/backend/index.md`
8. `docs/planning/contextfs-roadmap.md`

---

## 当前开发约束

- 先文档，后实现
- 当前有效对象模型只有 `mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- V1 必要 `filesystem type`：`hostfs`、`runtimefs`、`memfs`
- V1 必要 `node type`：`directory`、`regular`、`control`、`stream`
- V1 不做 `workflow`、query/view mount、overlay/fallback 行为实现

---

## 进入代码前必须确认

- 这个改动落在哪个 `mount namespace`
- 它新增或修改了哪个 `mount instance`
- 它对应哪个 `filesystem type`
- 它最终暴露哪个 `node type`
- 是否需要同步更新 spec/design/roadmap

---

## 历史文档处理规则

历史 journal、archive、旧术语说明不得再作为实现、评审或新设计的依据。
