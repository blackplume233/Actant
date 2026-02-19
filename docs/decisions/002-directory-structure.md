# ADR-002: Project Directory Structure

> Architecture Decision Record — Finalized 2026-02-19

---

## Status

**Accepted**

## Context

AgentCraft is developed collaboratively by human developers and AI agents. The project needs:

1. A clear monorepo structure for 5+ packages
2. Extensive documentation that grows over time
3. Separation between human-authored work (design, decisions, reviews) and agent-generated work (session logs, auto-generated docs, code analysis)
4. Built-in configurations (templates, skills, workflows) that serve as both product defaults and development references

## Decision

### Complete Directory Structure

```
AgentCraft/
│
├── .trellis/                         # [Trellis] AI development framework (gitignored internals)
│
├── docs/                             # All project documentation
│   ├── decisions/                    # Architecture Decision Records (ADR)
│   │   ├── 001-tech-stack.md
│   │   ├── 002-directory-structure.md
│   │   └── ...
│   ├── design/                       # Feature design documents
│   │   ├── core-architecture.md
│   │   ├── template-system.md
│   │   └── ...
│   ├── human/                        # Human-authored documentation
│   │   ├── onboarding.md             # New developer onboarding guide
│   │   ├── reviews/                  # Human code review notes
│   │   │   └── YYYY-MM-DD-topic.md
│   │   ├── meetings/                 # Meeting notes and decisions
│   │   │   └── YYYY-MM-DD-topic.md
│   │   └── roadmap.md                # Human-maintained roadmap and priorities
│   ├── agent/                        # Agent-generated documentation
│   │   ├── sessions/                 # AI session summaries (auto-generated)
│   │   │   └── YYYY-MM-DD-agent-topic.md
│   │   ├── analysis/                 # AI code analysis reports
│   │   │   └── YYYY-MM-DD-topic.md
│   │   ├── reviews/                  # AI-generated review reports
│   │   │   └── YYYY-MM-DD-topic.md
│   │   └── changelog-drafts/        # AI-drafted changelogs
│   │       └── YYYY-MM-DD.md
│   ├── api/                          # API documentation (auto-generated from OpenAPI)
│   └── guides/                       # Usage guides (tutorials, how-tos)
│       ├── getting-started.md
│       ├── creating-templates.md
│       └── ci-integration.md
│
├── packages/                         # Source code (pnpm workspace)
│   │
│   ├── shared/                       # @agentcraft/shared — Shared utilities
│   │   ├── src/
│   │   │   ├── types/                # Shared type definitions
│   │   │   │   ├── agent.types.ts
│   │   │   │   ├── template.types.ts
│   │   │   │   ├── domain-context.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── config/               # Configuration loading utilities
│   │   │   │   ├── config-loader.ts
│   │   │   │   └── index.ts
│   │   │   ├── errors/               # Error type hierarchy
│   │   │   │   ├── base-error.ts
│   │   │   │   ├── config-errors.ts
│   │   │   │   ├── lifecycle-errors.ts
│   │   │   │   └── index.ts
│   │   │   ├── logger/               # Logging infrastructure
│   │   │   │   ├── logger.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/                # Common utilities
│   │   │   └── index.ts              # Package barrel export
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── core/                         # @agentcraft/core — Core business logic
│   │   ├── src/
│   │   │   ├── template/             # Agent Template management
│   │   │   │   ├── schema/
│   │   │   │   ├── loader/
│   │   │   │   ├── registry/
│   │   │   │   └── index.ts
│   │   │   ├── initializer/          # Agent Instance construction
│   │   │   │   ├── workspace/
│   │   │   │   ├── context/
│   │   │   │   ├── hooks/
│   │   │   │   └── index.ts
│   │   │   ├── manager/              # Agent lifecycle management
│   │   │   │   ├── launcher/
│   │   │   │   ├── monitor/
│   │   │   │   ├── state/
│   │   │   │   └── index.ts
│   │   │   ├── domain/               # Domain Context components
│   │   │   │   ├── skill/
│   │   │   │   ├── workflow/
│   │   │   │   ├── prompt/
│   │   │   │   ├── mcp/
│   │   │   │   ├── plugin/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── cli/                          # @agentcraft/cli — CLI frontend
│   │   ├── src/
│   │   │   ├── commands/             # Command implementations
│   │   │   │   ├── agent/
│   │   │   │   ├── template/
│   │   │   │   ├── skill/
│   │   │   │   ├── config/
│   │   │   │   └── index.ts
│   │   │   ├── repl/                 # Interactive REPL
│   │   │   ├── output/               # Output formatters (table, json, text)
│   │   │   ├── errors/               # CLI error presentation
│   │   │   └── index.ts
│   │   ├── bin/
│   │   │   └── agentcraft.ts         # CLI entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── api/                          # @agentcraft/api — RESTful API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── dto/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── acp/                          # @agentcraft/acp — ACP server
│   │   ├── src/
│   │   │   ├── server/
│   │   │   ├── routing/
│   │   │   ├── adapters/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   └── mcp-server/                   # @agentcraft/mcp-server — MCP server
│       ├── src/
│       │   ├── tools/
│       │   ├── resources/
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── configs/                          # Built-in configurations (product defaults)
│   ├── templates/                    # Built-in Agent Templates
│   │   └── example-agent.json
│   ├── skills/                       # Built-in Skills
│   │   └── code-review.json
│   ├── workflows/                    # Built-in Workflows
│   │   └── trellis-standard.json
│   ├── prompts/                      # Built-in Prompts
│   │   └── system-default.json
│   └── providers/                    # Provider presets
│       ├── anthropic.json
│       └── openai.json
│
├── tests/                            # Cross-package tests
│   ├── integration/                  # Integration tests (multi-package)
│   └── e2e/                          # End-to-end CLI tests
│
├── scripts/                          # Build and dev scripts
│   ├── build.ts                      # Build all packages
│   ├── dev.ts                        # Dev mode launcher
│   └── release.ts                    # Release automation
│
├── .github/                          # GitHub workflows (CI/CD)
│   └── workflows/
│
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml               # pnpm workspace definition
├── tsconfig.base.json                # Shared TypeScript config
├── vitest.workspace.ts               # Shared Vitest config
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── Dockerfile
├── docker-compose.yml
├── LICENSE
├── README.md                         # Project README
├── AGENTS.md                         # Trellis AI agent instructions
└── human_start.md                    # Original project vision (human-authored)
```

## Key Design Decisions

### 1. docs/ — Documentation Hub

Documentation is a first-class concern. The `docs/` directory is the central hub for all project knowledge.

```
docs/
├── decisions/     # ADRs — immutable once accepted, numbered sequentially
├── design/        # Feature designs — evolve with implementation
├── human/         # Human-exclusive zone
├── agent/         # Agent-exclusive zone
├── api/           # Auto-generated API docs
└── guides/        # Usage tutorials
```

### 2. Human vs Agent Work Separation

**Problem**: Human insights (design intent, review context, roadmap priorities) and AI outputs (session logs, analysis reports, auto-reviews) serve different purposes and have different reliability levels.

**Solution**: Explicit directory separation under `docs/`.

| Directory | Author | Content | Review Required |
|-----------|--------|---------|-----------------|
| `docs/human/` | Human developers | Design rationale, meeting notes, roadmap, manual reviews | No (human-authoritative) |
| `docs/agent/` | AI agents | Session summaries, code analysis, auto-reviews, changelog drafts | Yes (human must validate) |
| `docs/decisions/` | Collaborative | ADRs — proposed by either, accepted by human | Yes (explicit acceptance) |
| `docs/design/` | Collaborative | Feature designs — drafted by either | Yes (before implementation) |

**Rules**:
- Content in `docs/human/` is never auto-generated or auto-modified by agents
- Content in `docs/agent/` is always understood as "agent opinion, not fact"
- ADRs in `docs/decisions/` must have explicit `Status: Accepted` to take effect
- Design docs are living documents that both humans and agents can update

### 3. Naming Conventions for Documentation

| Type | Pattern | Example |
|------|---------|---------|
| ADR | `NNN-slug.md` | `001-tech-stack.md` |
| Design | `topic.md` | `template-system.md` |
| Human notes | `YYYY-MM-DD-topic.md` | `2026-02-19-kickoff.md` |
| Agent sessions | `YYYY-MM-DD-agent-topic.md` | `2026-02-19-cursor-spec-update.md` |
| Guides | `verb-noun.md` | `creating-templates.md` |

### 4. configs/ — Product Configuration Defaults

Separate from source code. These are the built-in configurations shipped with AgentCraft.

- Version-controlled alongside code
- Serve as both product defaults and documentation-by-example
- Users can override by placing configs in their own workspace

### 5. tests/ — Cross-Package Tests Only

Unit tests are co-located with source files inside each package. The top-level `tests/` is exclusively for:
- Integration tests that span multiple packages
- E2E tests that exercise the full CLI pipeline

### 6. Module Dependency Graph

```
shared ← core ← cli
              ← api
              ← acp
              ← mcp-server

No cross-dependencies between cli, api, acp, mcp-server.
All go through core.
```

## Consequences

- Documentation scales naturally as the project grows
- Human and agent contributions are clearly distinguished
- New developers can find design context in `docs/human/` and `docs/decisions/`
- AI agents can generate analysis reports without polluting human documentation
- ADR numbering enforces chronological decision tracking
