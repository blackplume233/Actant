**What Changed**

This round I made the project-context discovery surface explicit instead of leaving it implied.

The core change is in [project-context.ts](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/api/src/services/project-context.ts#L28): `/project/context.json` now includes `entrypoints` and `available` catalogs, and the loader validates declared entrypoint paths, resolves them to concrete files, and warns if they do not exist. The shared manifest contract was extended in [project.types.ts](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/shared/src/types/project.types.ts#L7) with `entrypoints.readFirst` and `entrypoints.knowledge`.

I also made the repository itself consume that path. [actant.project.json](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/actant.project.json#L1) now declares explicit bootstrap entrypoints, [PROJECT_CONTEXT.md](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/PROJECT_CONTEXT.md#L1) provides the project knowledge entry, and I added reusable bootstrap assets in [project-context-reader.json](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/configs/skills/project-context-reader.json#L1) and [project-context-bootstrap.json](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/configs/prompts/project-context-bootstrap.json#L1). I updated the spec contract in [config-spec.md](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/spec/config-spec.md#L1834) and [api-contracts.md](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/.trellis/spec/api-contracts.md#L2330), and added targeted coverage in [context-backend.test.ts](G:/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation/packages/mcp-server/src/context-backend.test.ts#L188).

**Commands Ran**

- `Get-Content` on the mandatory Trellis/spec/task files and the project-context implementation files
- `rg -n "loadProjectContext|createProjectContextRegistrations|actant.project.json|project-context" ...` for impact analysis
- `bash -lc 'source .worktree-env.sh 2>/dev/null || true; pnpm vitest run packages/mcp-server/src/context-backend.test.ts'`
  Result: failed before test execution with Git Bash signal-pipe error on this Windows sandbox
- `pnpm vitest run packages/mcp-server/src/context-backend.test.ts`
  Result: failed before test execution with `EPERM` while resolving `C:\Users\black\AppData`
- `git diff --check`
  Result: no diff-format errors
- `Get-Content <json> | ConvertFrom-Json | ConvertTo-Json -Depth 10` for the new/changed JSON assets
  Result: JSON parse checks passed

**What Still Blocks Final Verification**

Final Node-based verification is still blocked by the environment, not the patch itself. In this worktree there is no `.worktree-env.sh`, Git Bash crashes when trying to run the mandated `source ... || true` pre-step, and direct `pnpm` execution hits a sandbox `EPERM` on `C:\Users\black\AppData` before Vitest starts.

There are also pre-existing dirty task-tracking files in `.trellis/tasks/03-18-issue-298-project-context-validation/`; I left those untouched except for reading them.