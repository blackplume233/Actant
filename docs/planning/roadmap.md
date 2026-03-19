# Product Roadmap

> 当前主线只有一条：先完成 ContextFS 文档基线重置，再进入实现。

---

## Current Priority

Actant 的当前目标不是继续扩展旧 Agent 平台模型，而是完成一次架构基线替换：

- 产品层统一为 `ContextFS`
- 实现层统一为 `VFS Kernel`
- 旧 `ContextManager` / `DomainContext` 聚合模型退出当前主线
- 文档清理先于实现

当前阶段不进入代码开发，先完成：

1. 重写 spec
2. 重写 design
3. 建立新的 ContextFS roadmap
4. 删除过时文档，消除双重真相

详细计划见 [ContextFS Roadmap](./contextfs-roadmap.md)。

---

## Active Roadmap

### ContextFS 文档基线重置

- 状态：`in progress`
- 目标：把 spec、design、roadmap 三层文档统一到新的 ContextFS 基线
- 入口文档：[ContextFS Roadmap](./contextfs-roadmap.md)

本阶段完成标准：

- 只有 `ContextFS` / `VFS Kernel` 这一套有效叙述
- spec、design、roadmap 三层文档术语一致
- 与新基线冲突的旧设计文档已删除或明确废弃
- 下一阶段实现者无需再决定核心对象模型和 V1 范围

---

## Deferred Until After Baseline Reset

以下事项在文档基线完成前不进入实现排期：

- ContextFS / VFS Kernel 实际代码重构
- `packages/context` / `packages/vfs` 的 breaking changes
- CLI / API / daemon 接入新内核
- Source / Backend / ProjectManifest 的真实实现
- 任何以旧模型为基础的增量功能扩展

---

## Planning Rule

在 ContextFS 基线未完成前：

- 不再把旧 `ContextManager` 路线作为未来方向继续推进
- 不再新增基于 `DomainContext` 聚合模型的设计文档
- 不再把 `workflow` 作为 V1 顶层概念写入计划
- 任何后续开发计划都必须引用 [ContextFS Roadmap](./contextfs-roadmap.md)
