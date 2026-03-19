---
id: 170
title: "feat(source): add community source type for Agent Skills repositories #145 (Vibe Kanban)"
status: closed
labels: []
milestone: phase-4-5
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 159
  - 160
  - 161
  - 162
  - 163
  - 164
  - 165
  - 166
  - 167
  - 168
  - 169
relatedFiles:
  - .cursor/plans/actant_plugin_system_design.plan.md
  - .cursor/plans/unified_memory_design_02e5f4f6.plan.md
  - docs/design/memory-layer-agent-evolution.md
  - docs/design/plugin-memory-review-report.md
taskRef: null
githubRef: "blackplume233/Actant#173"
closedAs: null
createdAt: "2026-02-25T12:00:00"
updatedAt: "2026-02-27T12:28:56"
closedAt: "2026-02-25T03:56:21Z"
---

**Related Issues**: [[0014]], [[0159]], [[0160-heartbeat-plugin]], [[0161-plugin-appcontext-integration]], [[0162-agent-memory-core-package]], [[0163-agent-memory-store-lancedb]], [[0164-agent-memory-embedding]], [[0165-memory-plugin-instance-layer]], [[0166-template-layer-promote]], [[0167-template-memory-sharing]], [[0168-gpu-embedding-sidecar]], [[0169-actant-layer-curator-agent]]
**Related Files**: `.cursor/plans/actant_plugin_system_design.plan.md`, `.cursor/plans/unified_memory_design_02e5f4f6.plan.md`, `docs/design/memory-layer-agent-evolution.md`, `docs/design/plugin-memory-review-report.md`

---

## Summary

Implements **`community` source type** (#145) — enables registering community Agent Skills repositories (e.g. `anthropics/skills`) as ActantHub sources **without requiring `actant.json` manifests**. Skills are auto-discovered by recursively scanning for `SKILL.md` files.

### What changed

- **New `CommunitySourceConfig` type** in `source.types.ts` — extends the `SourceConfig` discriminated union with `type: "community"`, supporting `url`, `branch`, and optional `filter` (glob) fields
- **New `CommunitySource` class** (`community-source.ts`) — core implementation:
  - Shallow-clones the target repository via git
  - Recursively scans all directories for `SKILL.md` files (skips `.git`, `node_modules`)
  - Parses each SKILL.md using the existing `skill-md-parser`
  - Supports glob-based filtering via `picomatch` (match on skill name or relative path)
  - Produces a virtual `FetchResult` with discovered skills (no prompts/mcp/workflows)
- **`SourceManager` integration** — `createSource()` now handles `community` type, routing to `CommunitySource`
- **`SourceValidator` community mode** — new `community` option skips manifest validation, recursively validates all SKILL.md files with optional Agent Skills compat checks
- **CLI updates**:
  - `actant source add` accepts `--type community` and `--filter <glob>`
  - `actant source validate` accepts `--community` flag
  - Setup wizard includes community Agent Skills repository as a source type option
- **API handler** — `source.validate` auto-detects community sources and applies relaxed validation

### Why

The existing `SourceConfig` only supported `github` (requires `actant.json`) and `local` types. Community Agent Skills repositories like Anthropic's official `anthropics/skills` follow the [Agent Skills](https://agentskills.io/) open standard with `SKILL.md` files but have no `actant.json` manifest. This feature bridges that gap, making ActantHub a first-class consumer of community skills.

Related to #144 (Hub format compatibility with Agent Skills standard) — this PR provides the **source architecture** side while #144 addresses format-level alignment.

### Implementation details

- `CommunitySource` reuses the same clone/pull pattern as `GitHubSource` but replaces the `LocalSource`-based file loading with a custom recursive SKILL.md scanner
- Added `picomatch` (^4.0.3) as a dependency for robust glob matching in the filter feature
- The scanner stops recursing into a directory once a `SKILL.md` is found there (treats each SKILL.md directory as a leaf skill)
- Validator's community mode (`validateCommunitySource`) reuses the existing `validateSkillMd` and `validateSkillDirConventions` methods

### Testing

- **8 new tests** in `community-source.test.ts` covering: recursive discovery, glob filtering (by name and path), empty repo handling, and cache cleanup
- **67 total source tests pass** (0 regressions across `source-manager`, `source-validator`, `skill-md-parser`)
- TypeScript type-check passes for `shared` and `core` packages

### Files changed (14 files, +570 / -9)

| Package | File | Change |
|---------|------|--------|
| shared | `types/source.types.ts` | New `CommunitySourceConfig` interface |
| shared | `types/index.ts` | Export new type |
| shared | `types/rpc.types.ts` | Add `community` to `SourceValidateParams` |
| core | `source/community-source.ts` | **New** — `CommunitySource` class |
| core | `source/community-source.test.ts` | **New** — 8 unit tests |
| core | `source/source-manager.ts` | Register community type in `createSource()` |
| core | `source/source-validator.ts` | Add community validation mode |
| core | `source/index.ts` | Export `CommunitySource` |
| core | `package.json` | Add `picomatch` dependency |
| cli | `commands/source/add.ts` | Support `--type community` + `--filter` |
| cli | `commands/source/validate.ts` | Support `--community` flag |
| cli | `commands/setup/steps/configure-source.ts` | Add community option to wizard |
| api | `handlers/source-handlers.ts` | Auto-detect community sources |

---

This PR was written using [Vibe Kanban](https://vibekanban.com)

---

## Comments

### ### cursor-agent — 2026-02-25T12:00:00

Epic 创建。合并 Phase 4 Plugin 体系 (4 issue) + Phase 5 统一记忆系统 (8 issue) 共 12 个子 issue。关闭已被替代的 #10/#11/#12。12 轮多视角审阅完成，行动项已分配到对应子 issue。
