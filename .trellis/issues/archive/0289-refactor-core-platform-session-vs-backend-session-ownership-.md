---
id: 289
title: "refactor(core): Platform Session vs Backend Session ownership model [Pi-A7]"
status: closed
labels:
  - enhancement
  - core
  - acp
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#289"
closedAs: completed
createdAt: "2026-03-15T08:04:17Z"
updatedAt: "2026-03-18T06:39:28"
closedAt: "2026-03-18T06:37:16Z"
---

## Background

Pi's session is a first-class citizen: the agent fully owns session storage, branching, and compaction. Actant's session ownership is scattered across multiple modules.

## Current State: Scattered Session Ownership

| Module | Session Responsibility |
|--------|----------------------|
| `SessionRegistry` (core) | Session metadata management |
| `SessionContextInjector` (core) | MCP/Tool injection into sessions |
| `communication-layer.md` (spec) | Lease/conversation semantics |
| Backend adapter | Actual session state (claude-code/Pi SDK internal) |

## Proposed Change

Establish clear **Platform Session** vs **Backend Session** layering:

- **Platform Session** = Actant-level logical session with:
  - Stable session ID
  - Branching support (from session-branching issue)
  - Compaction policy (from context-compaction issue)
  - Lease/conversation bindings
  - Activity recording
- **Backend Session** = Adapter-internal session with:
  - Backend-specific state (ACP session, Claude SDK session, Pi session)
  - Mapped from Platform Session

`ActantChannelManager` owns the Platform Session layer. Backend adapters own their Backend Sessions.

## Acceptance Criteria

- [ ] Platform Session concept documented in communication-layer.md or channel-protocol spec
- [ ] Clear mapping from Platform Session to Backend Session in each adapter
- [ ] branchSession() and compact() operate at Platform Session level

## Priority

P2 - Related to session branching and compaction issues

## Reference

Pi: Agent fully owns session (JSONL tree, branching, compaction) as single source of truth
