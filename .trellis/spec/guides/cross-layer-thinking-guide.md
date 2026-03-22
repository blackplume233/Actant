# Cross-Layer Thinking Guide

> 跨层变更必须先判断它影响的是命名空间、挂载模型、节点模型，还是仅影响局部实现。

---

## Read Order

做跨层改动前，按以下顺序确认：

1. `.trellis/spec/index.md`
2. `docs/design/contextfs-v1-linux-terminology.md`
3. `docs/design/contextfs-architecture.md`
4. `docs/design/actant-vfs-reference-architecture.md`
5. `.trellis/spec/config-spec.md`
6. `.trellis/spec/api-contracts.md`

---

## Checklist

跨层变更至少检查以下问题：

- 这次改动属于 `mount namespace`、`mount table`、`filesystem type`、`node type` 中的哪一层
- 是否改变了标准路径或资源寻址方式
- 是否改变了 `read/write/list/stat/watch/stream` 的对外语义
- 是否引入了新的权限边界或生命周期规则
- 是否要求 `VFS` 新增 mount、middleware、node/backend 或 events 行为
- 是否把 consumer interpretation 重新写回 VFS 核心

---

## Escalation Rule

如果一次改动同时影响产品语义、实现分层和对外契约，就不能只改代码，必须同步更新 spec、design、roadmap。
