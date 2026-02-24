---
id: 146
title: agent destroy --force should be idempotent for nonexistent agents
status: open
labels:
  - bug
milestone: null
author: unknown
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#146"
closedAs: null
createdAt: "2026-02-24T11:33:45Z"
updatedAt: "2026-02-24T15:18:40"
closedAt: null
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
