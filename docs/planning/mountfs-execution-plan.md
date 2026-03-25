# MountFS Execution Plan

> Owner: this file
> Scope: replace legacy `packages/vfs/src/sources/*` with `@actant/mountfs-*` packages.

## Goal

- [ ] `mountfs` 成为活跃 spec / design / implementation 术语
- [ ] `@actant/vfs` 只保留 kernel 与稳定 SPI
- [ ] 现有 `packages/vfs/src/sources/*` 被按挂载类型迁移到独立 `@actant/mountfs-*` 包

## Phase 1: Contract Freeze

- [x] 在 spec 中固定 `mountfs` 定义、边界与包职责
- [x] 在设计文档中固定 `mountfs` 与 `VFS` 的分层关系
- [ ] 列出初期目标包命名：`localfs`、`githubfs`、`mcpfs`
- [ ] 明确迁移期间 `packages/vfs/src/sources/*` 只允许收缩，不允许新增

## Phase 2: SPI And Package Skeleton

- [ ] 在 `@actant/vfs` 固定 mountfs 接入 SPI
- [ ] 建立第一批 `@actant/mountfs-*` 包骨架
- [ ] 保证 `@actant/api` / `@actant/agent-runtime` 只通过公开包消费 mountfs

## Phase 3: Low-Risk Migration

- [ ] 迁移 `workspace-source` -> `@actant/mountfs-workspace`
- [ ] 为迁移后的包补 focused tests
- [ ] 删除已完成迁移的旧 `packages/vfs/src/sources/*` 文件

## Phase 4: Runtime Support Migration

- [ ] 迁移 `process-source` -> `@actant/mountfs-process`
- [ ] 迁移 `config-source` -> `@actant/mountfs-config`
- [ ] 迁移 `vcs-source` -> `@actant/mountfs-vcs`
- [ ] 评估 `canvas-source` 是否保留为独立 mountfs 或直接删除

## Phase 5: High-Risk RuntimeFS Migration

- [ ] 迁移 `agent-runtime-source` -> `@actant/mountfs-runtime-agents`
- [ ] 迁移 `mcp-runtime-source` -> `@actant/mountfs-runtime-mcp`
- [ ] 迁移 `mcp-config-source` 到独立 mountfs 包或合并到 config family
- [ ] 迁移 `agent-registry-source` / `daemon-source` 到合适的 runtime mountfs family

## Exit Criteria

- [ ] `packages/vfs/src/sources/` 目录删除
- [ ] `@actant/vfs` 不再公开任何 `*Source*` 命名导出
- [ ] `api` / `agent-runtime` 不再直接依赖 `packages/vfs/src/sources/*`
- [ ] focused regression tests 通过
