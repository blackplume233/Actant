# Changelog v0.3.0

> v0.2.6 → v0.3.0 | 2026-03-16
>
> **Breaking**: 本版本引入 `ActantChannel` 统一通信层，替代原有的直接 ACP bridge 绑定。
> `AgentManager` 通信路径从 `AcpConnectionManagerLike` 迁移至 `ActantChannel`。

## Highlights

v0.3.0 是 Actant Phase 4 的里程碑版本，核心变更为 **#279 统一通信层收敛**：

- **ActantChannel 抽象层**：定义统一的 session/prompt/stream/cancel/notification 接口，AgentManager 不再直接依赖 ACP bridge binary
- **@actant/tui 统一 TUI 层**：独立包提供终端交互界面，配合 @actant/channel-claude SDK adapter
- **RecordSystem**：合并 EventJournal + ActivityRecorder 为单一记录系统
- **ChannelPermissions**：协议级权限控制，doc-first 变更流程
- **VFS (Virtual Filesystem)**：注册式虚拟文件系统，跨 runtime surface 可用
- **Capability-driven Backend Model**：后端能力声明式验证与运行时模型

## Stats

- **44 commits** (42 non-merge + 2 merges)
- **685 files changed**, 30,772 insertions(+), 28,604 deletions(-)
- **1,259 tests** across 104 test files — all passing

## Features

- feat(core): introduce ActantChannel abstraction and migrate AgentManager (#279) (14242b5)
- feat(tui): add @actant/tui unified TUI layer and @actant/channel-claude SDK adapter (#279) (a9773fc)
- feat(core): unify EventJournal + ActivityRecorder into RecordSystem (#279) (f1a96f6)
- feat(channel): add protocol-level ChannelPermissions and enforce doc-first change process (5312499)
- feat(channel): finish protocol adapter alignment (721b4cf)
- feat(core): close phase 4 runtime gaps and align specs (c2fc0eb)
- feat(backend): implement capability-driven backend model (5760fe8)
- feat(vfs): add registry-based virtual filesystem across runtime surfaces (87d7da9)

## Bug Fixes

- fix(security): address 8 bugs — path traversal, shell injection, resource leaks, error handling (0dc6fda)
- fix: address review #256 findings — resource leaks, idempotency, cross-platform hardening (a034151)
- fix(core): stabilize channel lifecycle regressions (9b97a6f)
- fix(core): forward setAgentBackend through RecordingChannelManager (242a2b8)
- fix(core): align crash status with launch-mode restart semantics (#155) (3c9f6f1)
- fix(cli): normalize Windows shorthand IPC overrides (402a388)
- fix(cli): improve startup diagnostics and normalize Windows IPC paths (4272bf0)
- fix(rest-api): route webhook events through explicit event ingress (f1b55fa)
- fix(acp): clean up failed connection state for issue 261 (e107b5f)
- fix(backend): address lint errors and update spec docs (afaf364)
- fix(template): preserve QA evidence for service startup flow (972925a)
- fix(tooling): ignore Claude worktrees during lint (8ca69e4)
- fix(lint): resolve all 22 eslint errors across VFS modules and dashboard (7ec9c94)
- fix(dashboard): unblock lint and sync trellis artifacts (b2692c5)
- fix: resolve type-check errors and test failures across packages (cebff05)

## Refactor

- refactor(core): implement capability-driven backend validation (#277) (4920184)
- refactor(api): introduce structured session and ACP runtime errors (1108e1d)
- refactor(shared): centralize JSON-RPC socket transport core (79aa19c)

## Documentation

- docs(spec): align service communication contract (d32d566)
- docs(spec): document VFS RPC/CLI contracts and backend integration notes (fe2f8f8)
- docs(guides): add encoding/i18n checklist to guides index (a4b3e26)
- docs(guides): document PowerShell mojibake and WSL bash pitfalls (3718728)
- docs: update README and landing page for v0.2.6 (ed2b750)

## Merges

- merge: PR #292 - feat: unified ActantChannel protocol, TUI, RecordSystem and ChannelPermissions (#279) (cb73baa)
- merge: integrate codex/review-256-fixes into master (6460574)
