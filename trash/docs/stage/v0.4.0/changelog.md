# v0.4.0 Changelog — Phase A Engineering Cleanup

> Released: 2026-03-18
> Tag: `v0.4.0`
> Predecessor: v0.3.0

## Summary

Phase A engineering cleanup on v0.3.0 baseline. Produces a clean, well-tested
codebase ready for the Context-First architecture refactoring in Phase B.

## Changes

### A-1: Deprecated Code Cleanup

- Removed `EventJournal` — fully replaced by `RecordSystem`
- Removed `ContextMaterializer` — replaced by `WorkspaceBuilder` + `BackendBuilder`
- Removed legacy proxy handlers from `@actant/api`
- Removed `BackendDescriptor` / `AcpConnectionManagerLike` aliases
- Removed legacy channel exports on `AgentManager`
- Cleaned `activityRecorder` / `eventJournal` from `AppContext` (replaced by `recordSystem`)
- 18 of 20 `@deprecated` annotations cleared; remaining 2 (`ActivityRecorder`, `HookInput`) deferred to Phase B

### A-2: Phantom Dependency Cleanup

- Removed `@actant/domain` and `@actant/source` phantom dependencies from `@actant/mcp-server`

### A-3: @actant/core Cohesion Audit

- Deleted redundant `@actant/domain` and `@actant/source` packages
- Annotated 9 `core` subdirectories with Phase B migration targets
- No functional changes; boundary documentation only

### A-4: Test Hardening & Quality Baseline

- Fixed #238 (AgentManager dispose race condition)
- Fixed #239 (orphan process on crash)
- Fixed #240 (ACP connection leak on failure)
- Coverage baseline: Stmts 52.31% | Branch 42.97% | Funcs 54.83% | Lines 53.45%
- 1315 tests across 114 files

### A-5: Version Archive

- All 14 packages bumped to `0.4.0`
- Git tag `v0.4.0` created

## Breaking Changes

None. v0.4.0 is a cleanup release with no API changes.
