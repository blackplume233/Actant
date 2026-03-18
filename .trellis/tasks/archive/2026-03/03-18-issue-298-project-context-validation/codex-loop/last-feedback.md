Latest verifier result:

## Check Result
### Diff Summary
- Reviewed the current worktree diff plus untracked bootstrap assets. The functional change expands project-context discovery to expose `entrypoints` and `available` in `/project/context.json`, updates the manifest schema/types, and adds repository-local bootstrap guidance in [actant.project.json](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/actant.project.json), [PROJECT_CONTEXT.md](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/PROJECT_CONTEXT.md), [project-context-bootstrap.json](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/configs/prompts/project-context-bootstrap.json), and [project-context-reader.json](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/configs/skills/project-context-reader.json).
- Relevant Trellis guidance read before verification: [workflow.md](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/workflow.md), [spec/index.md](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/spec/index.md), [backend/index.md](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/spec/backend/index.md), [cross-layer-thinking-guide.md](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/spec/guides/cross-layer-thinking-guide.md), and the task [prd.md](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/tasks/03-18-issue-298-project-context-validation/prd.md).
- Primary implementation surface reviewed: [project-context.ts](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/api/src/services/project-context.ts), [project.types.ts](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/shared/src/types/project.types.ts), [index.ts](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/shared/src/types/index.ts), and [context-backend.test.ts](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/mcp-server/src/context-backend.test.ts).

### Verification
- `pnpm --filter @actant/shared type-check`: passed.
- `pnpm --filter @actant/mcp-server type-check`: passed.
- `pnpm --filter @actant/api type-check`: failed. The failure is `Module '"@actant/shared"' has no exported member 'ActantProjectEntrypoints'` plus missing `entrypoints` on `ActantProjectConfig` from [project-context.ts](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/api/src/services/project-context.ts). In this sandbox, `packages/api/node_modules/@actant/shared` resolves to an external workspace copy under `G:\Workspace\AgentWorkSpace\AgentCraft\packages\shared`, not this worktree, so the API package is type-checking against stale shared types.
- `pnpm vitest run packages/mcp-server/src/context-backend.test.ts`: could not run here. Vite/esbuild fails during startup with `spawn EPERM`, so the configured test file is blocked by sandbox process restrictions.
- Source-level runtime verification from this worktree using `node --experimental-strip-types` passed for the main behavior:
  - `loadProjectContext()` returns absolute `entrypoints.readFirst` and `entrypoints.knowledge`.
  - `available.skills` and `available.prompts` are populated from local configs.
  - missing entrypoint warnings are now emitted once per file.

### Self-fixes
- Fixed duplicate missing-entrypoint warnings in [project-context.ts#L651](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/api/src/services/project-context.ts#L651) by deduping the warning scan over overlapping `knowledge` and `readFirst`.
- Added a focused regression test for that edge case in [context-backend.test.ts#L241](/g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/mcp-server/src/context-backend.test.ts#L241).

### Remaining Problems
- Verification is not clean yet because `@actant/api` does not type-check in this environment. The failure appears to come from workspace dependency resolution outside the current git worktree, but it still blocks a reliable pass result.
- The MCP/Vitest test file could not be executed under this sandbox because esbuild/Vite startup hits `spawn EPERM`. I replaced it with a direct source-level probe for validation, but that is still weaker than the intended test runner path.
- The current change set includes new bootstrap assets as untracked files. They are part of the feature shape, but they have not been exercised by the blocked Vitest path inside the MCP server.

### Marker
CODEX_LOOP_CHECK_FAIL