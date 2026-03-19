---
id: 163
title: "feat(trellis): add create-pr slash command"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 162
  - 164
relatedFiles:
  - packages/memory/store-lancedb/src/lance-store.ts
  - packages/memory/store-lancedb/src/lance-schema.ts
taskRef: null
githubRef: "blackplume233/Actant#186"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:48"
closedAt: "2026-02-24T16:10:24Z"
---

**Related Issues**: [[0162-agent-memory-core-package]], [[0164-agent-memory-embedding]]
**Related Files**: `packages/memory/store-lancedb/src/lance-store.ts`, `packages/memory/store-lancedb/src/lance-schema.ts`

---

## Summary
- Add `/trellis-create-pr` command for both Cursor and Claude Code
- Automates the PR creation workflow: Rebase → Validate (simplified Ship) → Push → Create PR

## Changes
- `.cursor/commands/trellis-create-pr.md`: Cursor slash command definition
- `.claude/commands/trellis/create-pr.md`: Claude Code slash command definition

## Command Flow
1. **Phase 0: Context** — Collect branch info, verify clean working directory
2. **Phase 1: Rebase** — Fetch + rebase onto latest target branch
3. **Phase 2: Validate** — Simplified Ship gate (lint + type-check + test + pattern scan)
4. **Phase 3: Push & Create PR** — Force-with-lease push + `gh pr create`

## Test Plan
- [x] lint passes
- [x] type-check passes
- [x] tests pass (1 pre-existing flaky test, unrelated)
- [x] command file structure matches existing conventions

## Related Issues
Closes #1093
