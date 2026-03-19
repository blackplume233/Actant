# Cross-Layer Thinking Guide

> 跨层变更必须先判断它影响的是产品模型、实现分层，还是仅影响局部实现。

---

## Read Order

做跨层改动前，按以下顺序确认：

1. `.trellis/spec/index.md`
2. `docs/design/contextfs-architecture.md`
3. `docs/design/actant-vfs-reference-architecture.md`
4. `.trellis/spec/config-spec.md`
5. `.trellis/spec/api-contracts.md`

---

## Checklist

跨层变更至少检查以下问题：

- 这次改动属于 `Project`、`Source`、`Capability` 中的哪一层
- 是否改变了标准路径或资源寻址方式
- 是否改变了 `read/write/list/stat/watch/stream` 的对外语义
- 是否引入了新的权限边界或生命周期规则
- 是否要求 `VFS Kernel` 新增 mount、middleware、node/backend 或 events 行为
- 是否把旧 `DomainContext` / `workflow` / `ContextManager` 语义带回当前基线

---

## Escalation Rule

如果一次改动同时影响产品语义、实现分层和对外契约，就不能只改代码，必须同步更新 spec、design、roadmap。
