---
id: 160
title: "feat(core): auto-install missing backend CLI dependencies via resolvePackage / install methods (Vibe Kanban)"
status: closed
labels: []
milestone: phase-4
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 161
relatedFiles:
  - packages/core/src/plugins/builtin/heartbeat-plugin.ts
taskRef: null
githubRef: "blackplume233/Actant#183"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:43"
closedAt: "2026-02-24T16:00:31Z"
---

**Related Issues**: [[0014]], [[0161-plugin-appcontext-integration]]
**Related Files**: `packages/core/src/plugins/builtin/heartbeat-plugin.ts`

---

## Summary

- **Auto-install backend CLI dependencies** when `agent start` / `agent open` / `agent resolve` detects a missing backend binary, controlled by `--auto-install` / `--no-install` CLI flags
- **Smart package manager detection**: when `npm` is unavailable, automatically falls back to `pnpm` → `yarn` → `bun`; when no JS package manager exists, tries platform-specific managers (`brew` / `winget` / `choco`)
- **New `BackendManager.ensureAvailable()` method** orchestrates the existence check → auto-install → re-verify flow

Closes #153

## Motivation

Previously, `BackendDefinition.install` and `resolvePackage` fields were purely informational — when a backend like `claude-code` was missing, the system threw `BackendNotFoundError` with a text hint, requiring users to manually run install commands. For `claude-code`, users needed to install **two** separate npm packages (`@anthropic-ai/claude-code` + `@zed-industries/claude-agent-acp`), creating unnecessary friction for new users.

Since `BackendDefinition` already declares complete install methods, the system should be able to execute them automatically.

## Changes

### New: `backend-installer.ts` (Core)
- `detectJsPackageManager()` — probes `npm` → `pnpm` → `yarn` → `bun` with result caching
- `detectSystemManagers()` — probes platform-appropriate system managers (`brew` on macOS, `winget`/`choco` on Windows)
- `executeInstall(method)` — executes a single `BackendInstallMethod` with the detected package manager
- `tryInstallMethods(methods)` — tries all applicable methods in order, stops at first success
- `ensureResolvePackage(pkg)` — installs `resolvePackage` npm dependencies

### Modified: `BackendManager` (Core)
- `ensureAvailable(name, { autoInstall })` — check → (optional) install → re-check flow
- `installBackend(name)` — delegates to `tryInstallMethods` with platform-filtered methods
- `ensureResolvePackageAvailable(name, { autoInstall })` — handles secondary binaries like `claude-agent-acp`

### Modified: `AgentManager` (Core)
- `startAgent(name, { autoInstall? })` — pre-flight backend availability check before spawn
- `openAgent(name, template?, { autoInstall? })` — same pre-flight check
- `resolveAgent(name, template?, overrides?, { autoInstall? })` — same pre-flight check
- Only performs the check when `autoInstall` is explicitly set (true/false), preserving backward compatibility

### Modified: RPC & CLI Layer
- `AgentStartParams`, `AgentOpenParams`, `AgentResolveParams` — new optional `autoInstall` field
- `agent start`, `agent open`, `agent resolve` CLI commands — `--auto-install` / `--no-install` flags
- RPC handlers pass `autoInstall` through to core methods

### Spec Documentation
- `config-spec.md` — documents the auto-install mechanism and npm-missing fallback strategy
- `api-contracts.md` — documents `autoInstall` parameter, CLI flags, and install strategy

## Install Fallback Strategy

When `npm` is not available on the system:

| Priority | Package Manager | Command |
|----------|----------------|---------|
| 1 | npm | `npm install -g <pkg>` |
| 2 | pnpm | `pnpm add -g <pkg>` |
| 3 | yarn | `yarn global add <pkg>` |
| 4 | bun | `bun install -g <pkg>` |
| 5 | brew/winget/choco | Platform-specific install |
| 6 | url/manual | Human-readable instructions in error message |

## Test Plan

- [x] `backend-installer.test.ts`: 20 tests — JS package manager detection, fallback logic, install execution, platform filtering
- [x] `backend-manager-install.test.ts`: 12 tests — `ensureAvailable()`, `installBackend()`, `ensureResolvePackageAvailable()` integration
- [x] `agent-manager.test.ts`: 42/42 existing tests pass (no regression)
- [x] `backend-resolver.test.ts`: 22/22 existing tests pass (no regression)

---

This PR was written using [Vibe Kanban](https://vibekanban.com)
