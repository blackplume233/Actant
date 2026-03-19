**What Changed**

I fixed the validation path in [packages/api/package.json](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/api/package.json) and [packages/api/tsconfig.json](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/api/tsconfig.json). The API package now type-checks against the current worktree’s local Actant packages instead of stale `node_modules` junctions pointing back to the main worktree, and its `type-check` script now uses `tsc -b` so referenced local packages are built as part of validation.

This directly clears the verifier’s previous blocker: `@actant/api` no longer fails on missing `ActantProjectEntrypoints` / `entrypoints` when validating this worktree.

**Commands Ran**

- `pnpm --filter @actant/api type-check`
  Result: failed initially with missing `ActantProjectEntrypoints` / missing `entrypoints` on `ActantProjectConfig`.
- `bash -lc 'source .worktree-env.sh 2>/dev/null || true; pnpm --filter @actant/api type-check'`
  Result: unusable here because `bash` failed with Win32 error 5; `.worktree-env.sh` is also not present in this worktree.
- `pnpm exec tsc -b packages/shared packages/core packages/acp packages/pi packages/api`
  Result: passed.
- `pnpm --filter @actant/api exec tsc -b --clean`
  Result: passed.
- `pnpm --filter @actant/api type-check`
  Result: passed.
- `pnpm --filter @actant/shared type-check`
  Result: passed.
- `pnpm --filter @actant/mcp-server type-check`
  Result: passed.
- `pnpm vitest run packages/mcp-server/src/context-backend.test.ts`
  Result: still fails at startup with `spawn EPERM`.
- Source-level probe via `node --experimental-strip-types -`
  Result: passed; `loadProjectContext()` returned populated `entrypoints`, populated `available.skills/prompts/...`, and `warnings: []`.

**Still Blocks Final Verification**

The remaining blocker is the Vitest path, not the implementation. `pnpm vitest run packages/mcp-server/src/context-backend.test.ts` still cannot start in this sandbox because Vite/esbuild hits `spawn EPERM`. Static validation is now clean, and the direct runtime probe succeeded, but the intended test-runner path is still sandbox-blocked.