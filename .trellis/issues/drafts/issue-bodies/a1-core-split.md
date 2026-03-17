## Background

Pi Mono has clear package separation: `pi-ai` (LLM), `pi-agent-core` (runtime), `pi-tui` (UI) - each single-responsibility, under 2000 LOC. Actant's `@actant/core` contains **20 submodules, 215 .ts files**, re-exporting everything from `index.ts`.

## Current State

`@actant/core` submodules:
- activity, builder, budget, channel, communicator, context-injector, domain (29 files), hooks, initializer, journal, manager, permissions, plugin (8 files), prompts, provider, scheduler (19 files), session, source (13 files), state, template, testing, version, vfs

## Proposed Evaluation

| Submodule | Current | Should Split? | Rationale |
|-----------|---------|--------------|-----------|
| `domain/` (skill, prompt, mcp, workflow, plugin managers) | core | Yes -> `@actant/domain` | 29 files, has BaseComponentManager abstraction, weakly coupled to runtime |
| `source/` (GitHub, Local, Community sources) | core | Yes -> `@actant/source` | 13 files, only used by CLI and builder |
| `scheduler/` (EmployeeScheduler, TaskQueue, InputRouter) | core | Yes -> `@actant/scheduler` | 19 files, only employee archetype uses it |
| `vfs/` (Virtual Filesystem) | core | Yes -> `@actant/vfs` | Independent file abstraction layer |
| `builder/` | core | Keep in core | Tightly coupled with initialization |
| `manager/` | core | Keep in core | Core orchestrator |
| `plugin/` | core | Keep in core (or split) | 8 files, coupled with hooks |

## Expected Outcome

After split: core reduces from 215 files to ~140 files, responsibility converges to "runtime orchestration".

## Acceptance Criteria

- [ ] Evaluate coupling between candidate submodules and core runtime
- [ ] Create dependency graph showing split feasibility
- [ ] If feasible, implement split maintaining backward-compatible re-exports from `@actant/core`

## Priority

P2 - Medium-term architecture improvement

## Reference

Pi Mono: each package is single-responsibility with clear boundaries.
