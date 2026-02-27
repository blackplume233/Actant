---
id: 246
title: "feat(dashboard): Instance layered display - repo/service/employee differentiated UI"
status: open
labels:
  - enhancement
  - "priority:P1"
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues:
  - 228
  - 219
relatedFiles:
  - packages/dashboard/client/src/pages/agents.tsx
  - packages/dashboard/client/src/pages/agent-detail.tsx
  - packages/dashboard/client/src/pages/agent-chat.tsx
  - packages/dashboard/client/src/pages/live-canvas.tsx
  - packages/dashboard/client/src/components/agents/agent-card.tsx
  - packages/dashboard/client/src/components/agents/agent-grid.tsx
taskRef: null
githubRef: "blackplume233/Actant#246"
closedAs: null
createdAt: "2026-02-27T06:02:23"
updatedAt: "2026-02-27T06:02:23"
closedAt: null
---

**Related Issues**: [[0228-rfc-agent-three-tier-classification]], [[0219-service-agent-session-management-api]]
**Related Files**: `packages/dashboard/client/src/pages/agents.tsx`, `packages/dashboard/client/src/pages/agent-detail.tsx`, `packages/dashboard/client/src/pages/agent-chat.tsx`, `packages/dashboard/client/src/pages/live-canvas.tsx`, `packages/dashboard/client/src/components/agents/agent-card.tsx`, `packages/dashboard/client/src/components/agents/agent-grid.tsx`

---

## Goal

Based on RFC #228 (Agent three-tier reclassification: repo / service / employee), optimize Instance display in the Dashboard. Group instances by category, show differentiated content on detail pages per archetype, and eliminate the current "one-size-fits-all" UI.

## Background

The current Dashboard treats all archetype instances uniformly:

- **List page**: Flat grid, no category grouping, all instances mixed together
- **Detail page**: Same Overview / Sessions / Logs tabs for all types
- **Chat page**: All types allow manual session creation
- **Live Canvas**: Standalone `/canvas` page, filters employee only, not integrated into employee detail

## Design

### 1. List Page Category Grouping

| Category | Theme | Display Content |
|----------|-------|----------------|
| `repo` | Purple | Name, template, workspace path |
| `service` | Orange | Name, template, connection status, session count |
| `employee` | Blue | Name, template, running status, task queue, last heartbeat |

### 2. Detail Page Differentiation

- **repo**: Overview only, Open/Destroy actions, no process control
- **service**: Overview/Sessions/Chat/Logs, Chat/Destroy actions (no Start/Stop)
- **employee**: Overview/Sessions/Canvas/Logs, Start/Stop/Chat/Destroy actions

### 3. Chat Interface

- **service**: Allow session create/select
- **employee**: Disable manual session creation, show Actant-managed sessions only
- **repo**: No Chat entry

### 4. Employee Canvas Integration

Extract Canvas rendering into reusable component, embed in employee detail Canvas tab.
