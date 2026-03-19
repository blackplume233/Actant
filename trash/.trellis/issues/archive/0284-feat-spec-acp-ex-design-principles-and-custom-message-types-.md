---
id: 284
title: "feat(spec): ACP-EX Design Principles and Custom Message Types [Pi-B1/B7]"
status: closed
labels:
  - enhancement
  - acp
  - docs
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#284"
closedAs: completed
createdAt: "2026-03-15T08:03:42Z"
updatedAt: "2026-03-18T06:39:22"
closedAt: "2026-03-18T06:37:02Z"
---

## Background

Through deep architectural comparison with [Pi Mono](https://github.com/badlogic/pi-mono), we identified key design principles from Pi's simplicity philosophy that should be formally documented in ACP-EX.

## Spec Changes

### Update `docs/design/channel-protocol/README.md` - Design Principles
- [ ] Add "Minimal Core, Hooks Out" principle: `ActantChannel` keeps REQUIRED methods minimal (only `prompt()`), all advanced features via capability + optional methods
- [ ] Add "Platform Session vs Backend Session" layering principle
- [ ] Reference Pi Agent's ~400-line core as simplicity benchmark

### Update `docs/design/channel-protocol/content.md` - Custom Message Types
- [ ] Define `x_custom` content type extension point
- [ ] Describe TypeScript declaration merging pattern for Agent App message type extensions
- [ ] Reference Pi's `CustomAgentMessages` interface design

### Update `.trellis/spec/index.md` - References
- [ ] Add Pi Mono comparison analysis reference in important design documents table

## Acceptance Criteria

- [ ] README.md contains Pi-inspired design principles
- [ ] content.md describes custom message type extension mechanism
- [ ] spec/index.md references the comparison analysis

## Priority

P2 - Can be done alongside other spec updates
