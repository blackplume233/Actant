---
id: 300
title: "bug(core): tighten exec-step validation before spawn"
status: closed
labels:
  - bug
  - core
  - "priority:P2"
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#300"
closedAs: completed
createdAt: "2026-03-18T03:26:55Z"
updatedAt: "2026-03-18T06:39:36"
closedAt: "2026-03-18T06:37:32Z"
---

## Problem
`ExecStep.validate()` currently performs only shallow validation for external step input.

## Why this matters
Initializer steps are part of the project bootstrap path, so invalid configuration should fail early and deterministically during validation instead of surfacing later as `spawn()` runtime failures.

## Current behavior
- `args` is only checked with `Array.isArray(...)`, but element types are not validated.
- `env` is not validated, so non-string values can flow into process spawning.
- `cwd` rejects absolute paths but still allows traversal patterns such as `..`.
- Many invalid configs are only discovered when `spawn()` executes, which makes diagnosis worse and weakens config readability.

## Expected behavior
`ExecStep.validate()` should reject invalid step configuration before execution starts.

## Acceptance Criteria
- [ ] Reject `args` when any element is not a string.
- [ ] Reject `env` when any key or value is not a string.
- [ ] Reject `cwd` values that escape the workspace, including traversal such as `..`.
- [ ] Add focused tests covering invalid `args`, invalid `env`, and traversal `cwd` cases.
- [ ] Keep existing valid command execution behavior unchanged.

## References
- Review finding: `packages/core/src/initializer/steps/exec-step.ts:20`
- Affected path: `packages/core/src/initializer/steps/exec-step.ts`

---
**Related Files**: `packages/core/src/initializer/steps/exec-step.ts`
