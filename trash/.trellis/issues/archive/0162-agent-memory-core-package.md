---
id: 162
title: "feat(core): backend-aware provider env injection, declarative materialization, env-based provider config (#133 #141 #150)"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 163
relatedFiles:
  - packages/memory/core/src/types.ts
  - packages/memory/core/src/store.ts
taskRef: null
githubRef: "blackplume233/Actant#185"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:46"
closedAt: "2026-02-24T16:22:45Z"
---

**Related Issues**: [[0014]], [[0163-agent-memory-store-lancedb]]
**Related Files**: `packages/memory/core/src/types.ts`, `packages/memory/core/src/store.ts`

---

## Summary

- **#133**: Support reading environment variables as default provider configuration
  - New `provider-env-resolver.ts` with `resolveProviderFromEnv()`, `resolveApiKeyFromEnv()`, `resolveUpstreamBaseUrl()`
  - `agent-initializer.ts` now resolves provider config with template > env > registry fallback chain
  - `buildDefaultProviderEnv` enhanced with upstream env var fallback (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)

- **#141 Phase 2**: Backend-aware provider environment variable injection
  - `BackendManager` extended with `registerBuildProviderEnv()` / `getBuildProviderEnv()` behavioral registry
  - Claude Code backend injects `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` (registered in `builtin-backends.ts`)
  - Pi backend injects `ACTANT_PROVIDER` / `ACTANT_API_KEY` / `ACTANT_BASE_URL` / `ACTANT_MODEL` (registered in `app-context.ts`)
  - `AgentManager.startAgent()` refactored to dispatch via backend-specific strategy, fallback to `buildDefaultProviderEnv`

- **#150 Phase 1**: Declarative backend materialization
  - `MaterializationSpec` type system (7 strategy interfaces + `VerifyCheckSpec`) in `@actant/shared`
  - `DeclarativeBuilder` — generic `BackendBuilder` driven entirely by a `MaterializationSpec`, no hand-written class needed
  - Materialization specs for all 5 built-in backends: cursor, cursor-agent, claude-code, pi, custom
  - `WorkspaceBuilder` enhanced to dynamically resolve builders from `BackendManager` -> `MaterializationSpec` -> fallback
  - `BackendManager` extended with `registerBuilder()` / `getBuilder()` for workspace materialization

- **Bug fixes from vk/0d20-133**: daemon startup timeout fix (PR #156), CI pnpm version fix

## Changed files (21 files, +1463/-27)

| Package | Files | Description |
|---------|-------|-------------|
| `@actant/shared` | `template.types.ts`, `types/index.ts` | `MaterializationSpec` type system + exports |
| `@actant/core` | `backend-manager.ts`, `backend-registry.ts`, `builtin-backends.ts` | BackendManager behavioral extensions + materialization specs |
| `@actant/core` | `declarative-builder.ts` (new) | Generic spec-driven BackendBuilder |
| `@actant/core` | `workspace-builder.ts` | Dynamic builder resolution from BackendManager |
| `@actant/core` | `agent-manager.ts` | Backend-dispatched buildProviderEnv |
| `@actant/core` | `provider-env-resolver.ts` (new) | Env-based provider config resolution |
| `@actant/core` | `agent-initializer.ts` | Provider config env fallback |
| `@actant/api` | `app-context.ts` | Pi backend buildProviderEnv + materialization |
| `.trellis/spec` | `config-spec.md` | Updated MaterializationSpec docs + env injection status |

## Test plan

- [x] 727/728 tests pass (1 pre-existing flaky test: `agent-lifecycle-scenarios` process timing)
- [x] 24 new tests: DeclarativeBuilder (16) + buildProviderEnv (8)
- [x] 6 new tests: provider-env-resolver
- [x] Full build passes across all packages

Closes #133, closes #141, closes #150
