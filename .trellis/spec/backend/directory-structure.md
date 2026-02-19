# Directory Structure

> How backend code is organized in AgentCraft.
>
> **Canonical reference**: See [ADR-002](../../../docs/decisions/002-directory-structure.md) for the full project directory structure and rationale.

---

## Overview

AgentCraft follows a **pnpm monorepo** structure with 6 packages. Business logic lives in `core`, presentation layers (`cli`, `api`, `acp`, `mcp-server`) are thin adapters, and `shared` provides common types and utilities.

---

## Package Layout

```
packages/
├── shared/          # @agentcraft/shared — Types, errors, config, logger, utils
├── core/            # @agentcraft/core  — Template, Initializer, Manager, Domain
├── cli/             # @agentcraft/cli   — CLI REPL and commands
├── api/             # @agentcraft/api   — RESTful API (Hono)
├── acp/             # @agentcraft/acp   — ACP protocol server
└── mcp-server/      # @agentcraft/mcp-server — MCP protocol server
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
| Package names | `@agentcraft/{name}` | `@agentcraft/core` |

---

## New Feature Checklist

1. **Identify the owning package** — which of the 6 packages does it belong to?
2. **Check shared/** — does this need shared types or utilities?
3. **Create a subdirectory** if the feature has 3+ files
4. **Co-locate tests** — unit tests next to source (`*.test.ts`)
5. **Export through index** — expose public API via barrel `index.ts`
6. **Update design doc** — add or update `docs/design/{feature}.md` if non-trivial
