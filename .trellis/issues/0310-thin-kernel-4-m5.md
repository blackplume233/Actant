---
id: 310
title: Thin Kernel 反模式预警：4 处框架层膨胀需在 M5 前收敛
status: open
labels:
  - chore
  - "priority:P1"
  - architecture
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/shared/src/types/vfs.types.ts
  - packages/vfs/src/vfs-registry.ts
  - packages/vfs/src/mount/direct-mount-table.ts
  - packages/vfs/src/core/vfs-kernel.ts
taskRef: null
githubRef: "blackplume233/Actant#310"
closedAs: null
createdAt: "2026-03-20T07:37:15"
updatedAt: "2026-03-20T07:37:15"
closedAt: null
---

**Related Files**: `packages/shared/src/types/vfs.types.ts`, `packages/vfs/src/vfs-registry.ts`, `packages/vfs/src/mount/direct-mount-table.ts`, `packages/vfs/src/core/vfs-kernel.ts`

---

见 GitHub #310 详细内容。4 处框架层膨胀反模式：VfsSourceType 名义标签、VfsSourceSpec 中心化 union、VfsRegistry/DirectMountTable 重叠、VFS_CAPABILITIES 膨胀。
