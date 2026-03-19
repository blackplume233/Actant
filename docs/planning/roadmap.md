# Product Roadmap

> ContextFS 文档基线重置已完成；下一步进入 M1 契约与类型替换。

---

## Current Priority

Actant 的当前目标是在已完成的文档基线上推进下一阶段替换：

- 产品层统一为 `ContextFS`
- 实现层统一为 `VFS Kernel`
- 文档基线先于实现

当前阶段的直接任务是：

1. 以已完成的 ContextFS 基线为唯一真相源
2. 进入 M1 契约与类型替换
3. 删除与当前基线冲突的遗留公共契约
4. 为 `packages/context` / `packages/vfs` 的后续重建固定边界

详细计划见 [ContextFS Roadmap](./contextfs-roadmap.md)。

---

## Active Roadmap

### ContextFS 文档基线重置

- 状态：`completed`
- 目标：把 spec、design、roadmap 三层文档统一到新的 ContextFS 基线
- 入口文档：[ContextFS Roadmap](./contextfs-roadmap.md)

本阶段完成标准：

- 只有 `ContextFS` / `VFS Kernel` 这一套有效叙述
- spec、design、roadmap 三层文档术语一致
- 历史迁移说明不再占用主线入口
- 下一阶段实现者无需再决定核心对象模型和 V1 范围

下一阶段：

- M1 契约与类型替换
- 以当前文档基线为前提推进实现准备，不再回到基线重写阶段

---

## Deferred Until After Baseline Reset

以下事项在进入更深实现前仍需等 M1 完成：

- ContextFS / VFS Kernel 实际代码重构
- `packages/context` / `packages/vfs` 的 breaking changes
- CLI / API / daemon 接入新内核
- Source / Backend / ProjectManifest 的真实实现
- 任何脱离当前 ContextFS 基线的增量功能扩展

---

## Planning Rule

在当前阶段：

- 不再把 `workflow` 作为 V1 顶层概念写入计划
- 任何后续开发计划都必须引用 [ContextFS Roadmap](./contextfs-roadmap.md)
- 历史迁移信息应放在单独文档中，按需读取
