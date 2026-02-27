---
id: 161
title: "fix(core): resolve agent status stuck on error while process is running (#155) (Vibe Kanban)"
status: closed
labels: []
milestone: phase-4
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 160
relatedFiles:
  - packages/api/src/services/app-context.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/cli/src/commands/plugin-commands.ts
taskRef: null
githubRef: "blackplume233/Actant#184"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:45"
closedAt: "2026-02-24T15:41:57Z"
---

**Related Issues**: [[0014]], [[0160-heartbeat-plugin]]
**Related Files**: `packages/api/src/services/app-context.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/cli/src/commands/plugin-commands.ts`

---

## Summary

Fixes #155 — Agent instance status gets stuck on `error` in `.actant.json` while the backend process is actually running and responsive.

### Root Cause

When `startAgent()` spawns a backend process via `ProcessLauncher` but the subsequent ACP connection fails, the `catch` block:
- Set status to `"error"` ✅
- Disconnected ACP ✅
- **Did NOT terminate the already-spawned process** ❌ → process leak
- **Did NOT remove the process from the internal map** ❌ → stale state
- **Did NOT clear the PID from `.actant.json`** ❌ → violates INV-PID invariant

Additionally, on daemon restart, `initialize()` only corrected `running`/`starting`/`stopping` states but left `error`/`crashed` instances with stale PIDs unchecked — orphan processes were never reclaimed.

## Changes

### Fix 1: `startAgent()` error path cleanup (`agent-manager.ts`)

- Terminate the spawned process in the `catch` block before setting error status
- Remove the process from the internal `processes` map
- Clear `pid` from `.actant.json` metadata (set to `undefined`)

### Fix 2: Orphan process detection in `initialize()` (`agent-manager.ts`)

- On daemon startup, check `error`/`crashed` instances that still have a PID recorded
- If the PID is alive → reclaim: set status to `running`, register in ProcessWatcher
- If the PID is dead → clear the stale PID from metadata (satisfies `INV-PID` invariant from endurance-testing.md)

### Fix 3: Tests (`agent-manager.test.ts`)

Added 5 new test cases in two new `describe` blocks:

- **`startAgent error cleanup (#155)`** (2 tests):
  - Verifies process is terminated when ACP connection fails
  - Verifies agent can be restarted after a failed start (no stale process blocking)

- **`initialize orphan process detection (#155)`** (3 tests):
  - Verifies alive orphan with `error` status is reclaimed to `running`
  - Verifies alive orphan with `crashed` status is reclaimed to `running`
  - Verifies dead process PID is cleared from `error` status instance

## What was NOT changed

The `handleProcessExit()` exit status logic (`processOwnership === "external" ? "crashed" : "stopped"`) was initially considered for modification but was **kept as-is** after reviewing the endurance testing spec (`endurance-testing.md` shutdown behavior matrix), which explicitly states that externally-attached processes detected by the watcher should be marked as `crashed` (abnormal exit without proper `detach`).

## Test Results

- **agent-manager.test.ts**: 47/47 passed ✅
- **agent-lifecycle-scenarios.test.ts**: 8/9 passed (1 pre-existing flaky test, verified on baseline) ✅
- **endurance tests**: Pre-existing failures (unrelated: `cursor` backend lacks ACP support + hardcoded PIDs) — not introduced by this PR

---

This PR was written using [Vibe Kanban](https://vibekanban.com)
