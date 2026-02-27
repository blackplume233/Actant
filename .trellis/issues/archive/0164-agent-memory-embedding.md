---
id: 164
title: "docs(trellis): update developer identity spec to use Actant Agent model"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 162
  - 163
  - 168
relatedFiles:
  - packages/memory/embedding/src/embedding-client.ts
taskRef: null
githubRef: "blackplume233/Actant#187"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:49"
closedAt: "2026-02-25T01:56:26Z"
---

**Related Issues**: [[0162-agent-memory-core-package]], [[0163-agent-memory-store-lancedb]], [[0168-gpu-embedding-sidecar]]
**Related Files**: `packages/memory/embedding/src/embedding-client.ts`

---

## Summary

- Update developer identity spec to use Actant Agent model with `actant` prefix
- Add Step 0.2 (Initialize Developer Identity) to both Cursor and Claude `plan-start` commands
- Standardize all identity names: `actant-cursor-agent`, `actant-claude-agent`, `actant-<name>`

## Changes

### `workflow.md`
- Add Actant Agent model description: AI developers are Actant Agent instances
- Replace naming suggestions with structured table, all with `actant` prefix
- Update issue assign example accordingly

### `.cursor/commands/trellis-plan-start.md`
- Add Step 0.2: auto-check and init `actant-cursor-agent` identity
- Renumber subsequent steps

### `.claude/commands/trellis/plan-start.md`
- Add Step 0.2: auto-check and init `actant-claude-agent` identity
- Renumber subsequent steps

## Test plan

- [ ] Verify all identity names in `workflow.md` have `actant` prefix
- [ ] Verify Cursor and Claude `plan-start` commands include Step 0.2
- [ ] Verify `init-developer.sh actant-cursor-agent` creates workspace correctly
