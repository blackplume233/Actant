# Directory Structure

> How backend code is organized in Actant.
>
> **Canonical reference**: See [ADR-002](../../../docs/decisions/002-directory-structure.md) for the full project directory structure and rationale.

---

## Overview

Actant follows a **pnpm monorepo** structure with 8 packages plus a facade. Business logic lives in `core`, presentation layers (`cli`, `api`, `acp`, `mcp-server`) are thin adapters, `shared` provides common types and utilities, `pi` provides the Pi Agent backend, and `actant` is the unified npm entry point.

---

## Package Layout

```
packages/
├── shared/          # @actant/shared     — Types, errors, config, logger, utils
├── core/            # @actant/core       — Template, Initializer, Manager, Domain
├── pi/              # @actant/pi         — Pi Agent backend (pi-agent-core, pi-ai)
├── acp/             # @actant/acp        — ACP protocol server
├── mcp-server/      # @actant/mcp-server — MCP protocol server
├── api/             # @actant/api        — RESTful API daemon
├── cli/             # @actant/cli        — CLI REPL and commands
└── actant/          # actant             — Facade: re-exports all sub-packages + CLI bin
```

## Module Dependency Graph

```
shared ← core ← pi
              ← acp
              ← mcp-server
              ← api ← cli ← actant (facade)
```

### `actant` Facade Package

`actant`（无 scope）是面向用户的统一入口：

- **npm 安装**：`npm i -g actant`（CLI）或 `npm i actant`（库）
- **本地开发安装**：`pnpm install:local`（构建 + `pnpm link --global`，后续 rebuild 自动生效）
- **Sub-path exports**：`actant/core`、`actant/shared`、`actant/acp`、`actant/mcp`、`actant/pi`、`actant/cli`
- **依赖关系**：facade 依赖所有 `@actant/*` 子包，通过 `workspace:*` 链接
- **子包仍可独立安装**：`npm i @actant/core` 用于只需部分功能的场景

> **Warning**: 用户安装的 npm 包名是 **`actant`**（门面包），不是 `@actant/cli`。安装脚本 `install.sh` / `install.ps1` 内部也使用 `npm install -g actant`。在文档和 Landing Page 中引用安装命令时，始终使用 `actant` 而非 `@actant/cli`。

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
| Package names | `@actant/{name}` (facade: `actant`) | `@actant/core`, `actant` |

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
