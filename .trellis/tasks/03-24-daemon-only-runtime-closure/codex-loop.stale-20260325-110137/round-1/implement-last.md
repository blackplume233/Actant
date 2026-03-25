**What Changed**

This round removed the active bridge-side standalone runtime path and cut the runtime plugin surface.

- [packages/cli/src/commands/hub/index.ts](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/packages/cli/src/commands/hub/index.ts) no longer falls back to `createStandaloneProjectContextRuntime`; `hub` now stays on `RPC -> daemon` only.
- [packages/mcp-server/src/context-backend.ts](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/packages/mcp-server/src/context-backend.ts) no longer creates a standalone context; MCP now errors when the daemon/socket is unavailable instead of exposing a local VFS view.
- [packages/api/src/services/app-context.ts](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/packages/api/src/services/app-context.ts) and [packages/api/src/handlers/domain-handlers.ts](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/packages/api/src/handlers/domain-handlers.ts) no longer wire or expose `PluginHost` / `plugin.runtime*`.
- I deleted the physical plugin runtime subtree under `packages/agent-runtime/src/plugin/` and removed the shared plugin runtime type residue in `packages/shared`.
- I removed the CLI runtime-plugin status command by deleting [packages/cli/src/commands/plugin/status.ts](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/packages/cli/src/commands/plugin/status.ts) and related formatter/RPC type support.
- I updated active docs and smoke scripts to match the new contract:
  - [.trellis/spec/backend/index.md](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/.trellis/spec/backend/index.md)
  - [docs/design/actant-vfs-reference-architecture.md](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/docs/design/actant-vfs-reference-architecture.md)
  - [scripts/context-smoke.sh](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/scripts/context-smoke.sh)
  - [scripts/context-smoke.mjs](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/scripts/context-smoke.mjs)

`git diff --stat` at this point is 27 files changed, with 52 insertions and 2435 deletions.

**Commands Run**

- `sed -n '...'` on the required Trellis/task files and follow-up spec/check files
- `git status --short`
- several `rg -n ...` searches to locate standalone runtime and plugin surfaces
- `source .worktree-env.sh 2>/dev/null || true; pnpm type-check`
- `source .worktree-env.sh 2>/dev/null || true; bash scripts/context-smoke.sh`
- `source .worktree-env.sh 2>/dev/null || true; pnpm --filter @actant/cli test -- src/commands/__tests__/commands.test.ts`

**Verification / Remaining Blockers**

- `pnpm type-check` passes repo-wide after the edits.
- End-to-end smoke is blocked in this sandbox because daemon startup cannot `listen()` on a Unix socket: `listen EPERM`.
- Targeted Vitest is blocked in this sandbox because Vite cannot write its temp config bundle under `node_modules/.vite-temp`: `open ... EPERM`.

For full task completion, there is still follow-up scope left:
- `createStandaloneProjectContextRuntime` itself still exists in [packages/api/src/services/project-context.ts](/Users/muyuli/Workspace/trellis-worktrees/codex/03-24-daemon-only-runtime-closure/packages/api/src/services/project-context.ts), with its export and tests still present.
- Historical/changelog docs still mention standalone fallback; active docs are updated, but archive residue remains.