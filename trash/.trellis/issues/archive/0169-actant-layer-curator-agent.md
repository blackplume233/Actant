---
id: 169
title: "docs(guides): add comprehensive dev workflow guide covering Plan-Code-Review-PR-Ship-QA-Stage pipeline (Vibe Kanban)"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 12
  - 165
  - 166
relatedFiles:
  - packages/actant-memory/src/layers/actant-layer.ts
  - packages/actant-memory/src/curator/curator-agent.ts
  - packages/actant-memory/src/broker/context-broker.ts
taskRef: null
githubRef: "blackplume233/Actant#192"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:55"
closedAt: "2026-02-25T03:04:21Z"
---

**Related Issues**: [[0012]], [[0165-memory-plugin-instance-layer]], [[0166-template-layer-promote]]
**Related Files**: `packages/actant-memory/src/layers/actant-layer.ts`, `packages/actant-memory/src/curator/curator-agent.ts`, `packages/actant-memory/src/broker/context-broker.ts`

---

## Summary

Add a comprehensive development workflow guide (`docs/guides/dev-workflow-guide.md`) that documents the full **Plan - Code - Review - PR - Ship - QA - Stage** development lifecycle, serving as the primary onboarding reference for both human developers and AI agents working on the Actant project.

## Motivation

The project has a rich set of built-in Trellis commands, shell scripts, Sub Agent workflows, and slash commands spread across `.claude/commands/`, `.cursor/rules/`, `.trellis/scripts/`, and `.agents/skills/`. However, there was no single document that tied them all together into a coherent, end-to-end development flow. New contributors (human or AI) had to piece together the workflow from multiple sources. This guide consolidates everything into one authoritative reference.

## What's Included

The 750+ line guide covers:

- **Flow overview** — ASCII pipeline diagram mapping each phase to its corresponding Trellis command, with a decision table for choosing the right entry point
- **Phase 1: Plan** — Plan-first workflow via `/trellis:plan-start`, Plan document structure, user approval flow, Task creation with `task.sh`
- **Phase 2: Code** — Spec reading requirements, Sub Agent system (Research - Implement - Check - Debug), coding standards, Conventional Commits convention
- **Phase 3: Review** — `/trellis:finish-work` checklist, Spec sync trigger rules, code review dimensions, cross-layer verification, deep bug analysis
- **Phase 4: PR** — `/trellis:create-pr` (Rebase - Validate - Push - Create), `/handle-pr` five-phase merge pipeline
- **Phase 5: Ship** — `/trellis:ship` four-phase delivery (Review - Commit - Push - Issue Sync), Issue reference parsing rules, safety constraints
- **Phase 6: QA** — `/qa` black-box testing with four modes (run/create/list/explore), test strategy (black-box primary, white-box auxiliary), automatic Issue creation on FAIL
- **Phase 7: Stage** — `/trellis:stage-version` full snapshot pipeline (architecture doc, API surface, config schemas, metrics, changelog, test report, diff)
- **Multi-branch collaboration** — Three scenarios (serial, multi-agent parallel via `/trellis:parallel` with Git Worktrees, human-AI hybrid), best practices, complete Issue - Task - PR - Ship flow
- **Command cheat sheet** — All Trellis slash commands, shell scripts, and build/test commands in quick-reference tables
- **FAQ** — Common questions on Plan vs Start, Ship vs Create PR, Rebase conflicts, QA modes, Issue-driven development

## Implementation Details

- Written entirely in Chinese (Simplified) to match the project's primary documentation language
- References all existing command definitions from `.claude/commands/trellis/`, `.agents/skills/`, and `.trellis/scripts/`
- Follows the project's documentation directory conventions (`docs/guides/`)
- No code changes — documentation only

---

*This PR was written using [Vibe Kanban](https://vibekanban.com)*
