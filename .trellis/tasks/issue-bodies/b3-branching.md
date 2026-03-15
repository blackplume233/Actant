## Background

Pi Mono sessions use JSONL tree structure (`id/parentId`), supporting in-place branching, jumping, and history preservation. Actant ACP-EX currently only has `newSession()` and `resumeSession()`, with no ability to branch from an existing session.

## Motivation

- **Dashboard debug rollback**: Users want to restart from a conversation node without losing entire history
- **A/B comparison**: Compare results of the same prompt with different models/parameters
- **Error recovery**: Return to correct branch point after agent goes wrong direction

## Spec Changes

### Update `docs/design/channel-protocol/session-setup.md`
- [ ] Add `branchSession(sessionId, options)` method definition
- [ ] Define `BranchOptions` interface: `{ fromMessageId?: string; label?: string }`
- [ ] Update Session Lifecycle state diagram with Branch path
- [ ] Add capability: `capabilities.branching`
- [ ] Describe Platform Session vs Backend Session branch mapping

## Reference

Pi source:
- `/tree` command - visualize session tree, select any history point to continue
- `/fork` command - create new session file from current branch
- JSONL format `id/parentId` branching structure

## Acceptance Criteria

- [ ] ACP-EX spec fully defines branchSession interface
- [ ] Session Lifecycle state diagram includes Branch path
- [ ] At least one adapter branching mapping strategy described

## Priority

P1 - Implement after #279
