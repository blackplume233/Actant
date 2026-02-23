# Directory Structure

> How backend code is organized in Actant.
>
> **Canonical reference**: See [ADR-002](../../../docs/decisions/002-directory-structure.md) for the full project directory structure and rationale.

---

## Overview

Actant follows a **pnpm monorepo** structure with 6 packages. Business logic lives in `core`, presentation layers (`cli`, `api`, `acp`, `mcp-server`) are thin adapters, and `shared` provides common types and utilities.

---

## Package Layout

```
packages/
├── shared/          # @actant/shared — Types, errors, config, logger, utils
├── core/            # @actant/core  — Template, Initializer, Manager, Domain
├── cli/             # @actant/cli   — CLI REPL and commands
├── api/             # @actant/api   — RESTful API (Hono)
├── acp/             # @actant/acp   — ACP protocol server
└── mcp-server/      # @actant/mcp-server — MCP protocol server
```

## Module Dependency Graph

```
shared ← core ← cli
              ← api
              ← acp
              ← mcp-server
```

> **Rule**: `cli`, `api`, `acp`, `mcp-server` must NEVER depend on each other. All go through `core`.

---

## Core Package Internal Structure

```
packages/core/src/
├── template/           # Agent Template management
│   ├── schema/         # Zod schemas for template validation
│   ├── loader/         # JSON template parsing
│   ├── registry/       # Template CRUD operations
│   └── index.ts
├── initializer/        # Agent Instance construction
│   ├── workspace/      # Working directory setup
│   ├── context/        # Domain Context assembly (resolve references)
│   ├── hooks/          # Initialization lifecycle hooks
│   └── index.ts
├── manager/            # Agent Instance lifecycle
│   ├── launcher/       # Launch strategies (direct, ACP, one-shot)
│   ├── monitor/        # Health check, heartbeat
│   ├── state/          # State persistence (better-sqlite3)
│   └── index.ts
├── domain/             # Domain Context component managers
│   ├── skill/          # Skill registry and resolution
│   ├── workflow/       # Workflow template management
│   ├── prompt/         # Prompt management
│   ├── mcp/            # MCP configuration management
│   ├── plugin/         # Plugin system (memory, scheduler, etc.)
│   └── index.ts
└── index.ts            # Package barrel export
```

---

## File Organization Rules

### Source Files

Each package follows the same pattern:

```
packages/{name}/
├── src/              # Source code
│   └── index.ts      # Barrel export (public API)
├── bin/              # Entry points (CLI only)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Co-located Unit Tests

Unit tests live next to the source file they test:

```
packages/core/src/template/loader/
├── template-loader.ts
├── template-loader.test.ts
└── template-loader.types.ts
```

### Cross-Package Tests

Integration and E2E tests live in the top-level `tests/` directory:

```
tests/
├── integration/      # Tests spanning 2+ packages
└── e2e/              # Full CLI pipeline tests
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Directories | kebab-case | `mcp-server/`, `template-loader/` |
| Source files | kebab-case | `agent-state.ts`, `config-loader.ts` |
| Test files | Source name + `.test` | `agent-state.test.ts` |
| Type files | Source name + `.types` | `agent-state.types.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_HEARTBEAT_INTERVAL` |
| Classes | PascalCase | `AgentManager`, `TemplateRegistry` |
| Functions | camelCase | `createInstance()`, `loadTemplate()` |
| Package names | `@actant/{name}` | `@actant/core` |

---

## New Feature Checklist

1. **Identify the owning package** — which of the 6 packages does it belong to?
2. **Check shared/** — does this need shared types or utilities?
3. **Create a subdirectory** if the feature has 3+ files
4. **Co-locate tests** — unit tests next to source (`*.test.ts`)
5. **Export through index** — expose public API via barrel `index.ts`
6. **Update design doc** — add or update `docs/design/{feature}.md` if non-trivial
7. **Update roadmap** — if feature relates to Phase milestone, update `docs/planning/roadmap.md`

## Documentation Directories

项目文档统一存放在 `docs/` 下，按用途分目录。完整规范见 `docs/README.md`。

| 目录 | 用途 | 何时使用 |
|------|------|---------|
| `docs/guides/` | 使用教程和操作指南 | 添加面向用户的 how-to 文档 |
| `docs/planning/` | Roadmap 和阶段计划 | 里程碑变更、新 Phase 计划 |
| `docs/design/` | 功能设计文档 | 非trivial 功能的设计方案 |
| `docs/decisions/` | 架构决策记录 (ADR) | 重要技术选型 |
| `docs/stage/` | 版本快照 | 由 stage-version 命令自动生成，不手动编辑 |

## Issue 存储与归档

`.trellis/issues/` 存放 GitHub Issue 的本地缓存。为避免已关闭 Issue 污染 AI 上下文窗口，采用归档策略：

```
.trellis/issues/
├── 0120-windows-daemon...     # Open — 活跃 Issue
├── 0121-pi-agent...           # Open — 活跃 Issue
└── archive/                   # Closed — 自动归档
    ├── 0022-processwatcher.md
    └── ...
```

| 操作 | 文件位置变化 |
|------|-------------|
| `issue close <id>` | `issues/` → `issues/archive/` (自动) |
| `issue reopen <id>` | `issues/archive/` → `issues/` (自动) |
| `issue archive --all` | 批量迁移所有 closed → `archive/` |
| `issue show/search` | 跨两个目录搜索 |

> **Pattern**: 关闭即归档，重开即恢复。`list` 只显示活跃 Issue，`show`/`search`/`stats` 跨目录访问。
