You are the implement worker for a Codex Ralph Loop.

Work only in this git worktree:
- /g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation

Task:
- Name: issue-298-project-context-validation
- Type: backend
- Requirement: Validate
- Round: 2 / 3

Mandatory files to read first:
- .trellis/workflow.md
- .trellis/spec/backend/index.md (if backend/fullstack/test/docs touch backend code)
- .trellis/spec/guides/cross-layer-thinking-guide.md
- .trellis/tasks/03-18-issue-298-project-context-validation/prd.md
- .trellis/tasks/03-18-issue-298-project-context-validation/implement.jsonl
- .trellis/tasks/03-18-issue-298-project-context-validation/check.jsonl

Constraints:
- Do not touch the main worktree at /g/Workspace/AgentWorkSpace/AgentCraft
- Do not stop at analysis only
- Make concrete progress this round
- Before Node-based commands, run: source .worktree-env.sh 2>/dev/null || true
- Do not spend the whole round gathering context. After the required reads, move to either:
  1. a concrete code edit, or
  2. a concrete validation command whose failure directly informs the next edit
- If you find yourself only reading docs or code for too long, stop and act.
- This round is only successful if the git diff changes or you produce a concrete failing validation result and then react to it.

Previous verifier feedback:
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
Expected output:
- What you changed this round
- What commands you ran
- What still blocks final verification, if anything
