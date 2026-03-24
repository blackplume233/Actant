---
id: 323
title: 清理 packages/core 与 packages/domain 历史残留，完成去 core 化治理
status: closed
labels:
  - chore
  - "priority:P1"
  - architecture
  - cleanup
  - legacy
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 322
relatedFiles:
  - packages/core
  - packages/domain
  - packages/actant/package.json
  - docs/design/channel-protocol/README.md
  - docs/design/channel-protocol/migration.md
  - docs/design/channel-protocol/stream-chunk.md
taskRef: null
githubRef: "blackplume233/Actant#323"
closedAs: completed
createdAt: "2026-03-23T09:53:58"
updatedAt: "2026-03-24T11:43:35"
closedAt: "2026-03-24T11:43:35"
---

**Related Issues**: [[0322-file-first-domain-context-vfs-manager]]
**Related Files**: `packages/core`, `packages/domain`, `packages/actant/package.json`, `docs/design/channel-protocol/README.md`, `docs/design/channel-protocol/migration.md`, `docs/design/channel-protocol/stream-chunk.md`

---

> Issue cache note:
> This file tracks issue `#323` as local delivery memory.
> Treat it as historical cleanup context, not as roadmap/spec truth.


## 背景

在当前 `file-first / VFS-centered` 收口方向下，`packages/core` 与 `packages/domain` 已不属于目标包结构。

当前检查结果：

- `packages/domain` 没有有效源码与 package 定义，仅剩构建残留
- `packages/core` 没有活跃源码入口与 package 定义，`src/` 为空，主体为 `dist/` 与构建残留
- 但仓库内仍存在文档、历史 issue、说明文本对 `packages/core` 的大量引用

这意味着：

- 从实现层看，这两个目录已不应继续保留
- 从治理层看，不能只删目录而不清理语义残留，否则会继续误导后续架构判断

## 目标

把 `packages/core` / `packages/domain` 作为 **历史残留目录** 完整退场，并与 `#322` 的 VFS 中心架构收口保持一致。

## 范围

- `packages/core`
- `packages/domain`
- 对上述目录的文档、issue、设计稿、导出别名、说明文字引用

## 需要确认的判断

1. `packages/domain` 是否可直接删除
2. `packages/core` 是否可直接删除目录本体
3. 哪些引用属于：
   - 活文档，需要修正
   - 历史记录，可以保留但应标注 legacy
   - 聚合导出，需要改名或移除，避免继续制造 `core` 概念混淆

## 当前判断

- `packages/domain`：可直接删除
- `packages/core`：代码层可删除，但需要同步做一轮“去 core 化”治理
- `actant` 中的 `./core` 导出别名应被单独审视，避免继续制造不存在的层级概念

## 验收标准

- `packages/domain` 被删除
- `packages/core` 被删除
- 活文档中不再把 `packages/core` / `packages/domain` 当作当前有效架构层
- `#322` 中定义的三层 VFS 架构成为唯一有效口径
- 历史内容若保留，需明确标记为 legacy / archive

---

## Comments

### cursor-agent — 2026-03-24T11:43:35

Closed as completed
