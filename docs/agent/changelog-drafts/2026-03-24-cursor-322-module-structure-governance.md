# Module Structure Governance

## 变更摘要

- 在 `docs/design/actant-vfs-reference-architecture.md` 固化简化模块结构图，并把依赖方向明确为 `actant -> bridge -> RPC -> daemon -> daemon plugin -> provider contribution -> VFS`
- 在 `.trellis/spec/backend/index.md` 增补当前活跃包归属快照和新增模块约束，明确 bridge、daemon 内部模块、VFS 核心、共享支撑的边界
- 在 `docs/planning/contextfs-roadmap.md` 勾选 Full Todo 主题 2“模块结构治理”下的七项完成项
- 在 `packages/shared/src/__tests__/contextfs-terminology-gate.test.ts` 纳入 `docs/design/actant-vfs-reference-architecture.md` 作为 active truth 文件
- 在 `.trellis/spec/index.md` 同步更新运行时基线简化图，避免与参考架构文档出现 `Daemon Plugins -> VFS` 的旧口径偏差
- 在 `README.md` 与 `PROJECT_CONTEXT.md` 首屏补充固定模块结构与默认判断口径，避免默认入口继续缺席这次模块结构治理结论

## 用户可见影响

- 后续评审和实现可以直接依据统一的模块层级与依赖方向判断越层依赖，不再需要从 issue 讨论中反推
- 活跃入口文档、规范入口、参考架构和 roadmap 对“模块结构治理”主题给出一致口径，降低 ship 时的文档真相源分叉风险

## 破坏性变更/迁移说明

- 无

## 验证结果

- `git diff --check` 通过
- `source .worktree-env.sh 2>/dev/null || true && pnpm lint` 通过
- `source .worktree-env.sh 2>/dev/null || true && pnpm type-check` 通过
- `source .worktree-env.sh 2>/dev/null || true && pnpm vitest run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts --configLoader runner` 通过，确认 active truth 文档术语门禁原生测试可运行
- `README.md` 与 `PROJECT_CONTEXT.md` 已人工复核，默认入口中的模块结构表述与 `.trellis/spec/index.md`、`.trellis/spec/backend/index.md`、`docs/design/actant-vfs-reference-architecture.md` 保持一致
- `source .worktree-env.sh 2>/dev/null || true && pnpm test -- --configLoader runner` 已复跑；当前仓库仍存在与本主题无关的既有失败：
  - `packages/mcp-server/src/context-backend.test.ts`：checked-in example `examples/project-context-discovery` 缺少 `actant.namespace.json`
  - `packages/catalog/src/catalog-validator.test.ts`：`examples/actant-hub` 校验期望未满足
  - `packages/api/src/daemon/__tests__/socket-server.test.ts`：Unix socket `listen EPERM`
  - `packages/cli/src/client/__tests__/rpc-client.test.ts`：Unix socket `listen EPERM`
  - `packages/shared/src/rpc/json-rpc-socket.test.ts`：Unix socket `listen EPERM`
- `packages/channel-claude/src/__tests__/claude-channel-adapter.test.ts` 这次测试主体已通过，但运行期间仍有额外沙箱写入报错，目标路径为 `~/.claude/debug/*.txt`
- 人工复核 `.trellis/spec/index.md`、`.trellis/spec/backend/index.md`、`docs/design/actant-vfs-reference-architecture.md`、`docs/planning/contextfs-roadmap.md` 的模块分层与依赖方向表述已对齐

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
