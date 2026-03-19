---
id: 146
title: agent destroy --force should be idempotent for nonexistent agents
status: closed
labels:
  - bug
milestone: null
author: unknown
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#146"
closedAs: completed
createdAt: "2026-02-24T11:33:45Z"
updatedAt: "2026-02-24T15:25:59"
closedAt: "2026-02-24T15:25:59"
---

## Bug

`actant agent destroy <nonexistent> --force` returns exit code 1 with `AgentNotFoundError`, but the `--force` flag should make destroy idempotent — destroying a non-existent agent should succeed silently (exit 0).

## Reproduction

```
actant agent destroy ghost-agent-xyz --force
# Expected: exit 0 (silent success)
# Actual: exit 1 — Agent instance "ghost-agent-xyz" not found
```

## Root Cause

In `packages/cli/src/commands/agent/destroy.ts`, the `--force` flag only skips the confirmation prompt but does not suppress `AgentNotFoundError` from the RPC call.

## Fix

In the CLI destroy command, when `--force` is true, catch the agent-not-found error (code -32003) and treat it as a successful no-op.

---

## Comments

### ### unknown — 2026-02-24T15:25:49

Fix verified: destroy.ts already contains --force + not-found idempotent handling (lines 24-28). Added missing unit test in commands.test.ts to cover the RpcCallError(-32003) 鈫?'already absent' path. All 12 tests pass.

### unknown — 2026-02-24T15:25:59

Closed as completed
