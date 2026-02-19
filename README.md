# AgentCraft

A platform for building, managing, and composing AI agents. Designed for complex business domains (e.g. game development) where users need to rapidly assemble, reuse, and deploy agents with zero friction.

## Key Scenarios

| Scenario | Description |
|----------|-------------|
| **Custom Business Agent** | Dynamically compose agents with Domain Context — Skills, MCP, Prompts, memory |
| **CI Integration** | Agents callable via CLI for TeamCity-like CI pipelines |
| **Persistent Agent** | Long-running agents with heartbeat, self-growth, long-term memory, scheduled tasks |
| **Agent as Service** | Persistent agents integrated into IM / Email as virtual employees |
| **ACP Integration** | AgentServer exposed via ACP for Unreal/Unity engine communication |
| **Agent-to-Agent** | Agents invoking other agents through MCP |

## Architecture

```
AgentCraft
├── @agentcraft/shared       Shared types, errors, config, logger, utils
├── @agentcraft/core         Template, Initializer, Manager, Domain Context
├── @agentcraft/cli          Interactive CLI (REPL) — primary interface
├── @agentcraft/api          RESTful API (Hono) — enables Docker deployment
├── @agentcraft/acp          Agent Client Protocol server
└── @agentcraft/mcp-server   Model Context Protocol server
```

Module dependency graph:

```
shared ← core ← cli
              ← api
              ← acp
              ← mcp-server
```

> `cli`, `api`, `acp`, and `mcp-server` never depend on each other. All go through `core`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5.7+ (strict) |
| Package Manager | pnpm 9+ (workspace monorepo) |
| Build | tsup |
| Test | Vitest |
| HTTP | Hono |
| Schema | Zod |
| Config | YAML |
| Logging | pino |
| State | better-sqlite3 |
| MCP | @modelcontextprotocol/sdk |

See [ADR-001](docs/decisions/001-tech-stack.md) for full rationale.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22.0.0
- [pnpm](https://pnpm.io/) >= 9.0.0

## Getting Started

```bash
# Clone the repository
git clone https://github.com/blackplume233/AgentCraft.git
cd AgentCraft

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build all packages
pnpm build
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start CLI in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint all source files |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm type-check` | Type-check all packages |
| `pnpm clean` | Clean all build artifacts |

## Project Structure

```
AgentCraft/
├── packages/              Source code (pnpm workspace)
│   ├── shared/            Shared types, errors, utilities
│   ├── core/              Core business logic
│   ├── cli/               CLI frontend (REPL)
│   ├── api/               RESTful API
│   ├── acp/               ACP protocol server
│   └── mcp-server/        MCP protocol server
├── configs/               Built-in configurations (templates, skills, workflows)
├── docs/                  Project documentation
│   ├── decisions/         Architecture Decision Records
│   ├── design/            Feature design documents
│   ├── human/             Human-authored notes and reviews
│   └── agent/             Agent-generated analysis and logs
├── tests/                 Cross-package integration & E2E tests
├── scripts/               Build and dev scripts
└── .trellis/              AI development framework
```

See [ADR-002](docs/decisions/002-directory-structure.md) for full directory rationale.

## Core Concepts

**Agent Template** — A configuration file that defines an agent's Domain Context (Skills, Workflows, Prompts, MCP tools, SubAgents), initialization process, and defaults. Templates compose references rather than embedding full configs.

**Agent Instance** — A runnable agent constructed from a Template, with an assigned Provider, Backend, Domain Context, hooks, and plugins. Can execute one-shot tasks or run as a persistent service.

**Domain Context** — The business-specific context assembled for each agent:

| Component | Description |
|-----------|-------------|
| Workflow | Default instructions, hooks, commands |
| Prompt | System prompts and instruction sets |
| MCP/Tools | Model Context Protocol servers and tools |
| Skills | Behavioral rules and domain knowledge |
| SubAgent | Nested agent references for composition |

**Launch Modes**:

| Mode | Lifecycle Owner | Use Case |
|------|----------------|----------|
| Direct | User | Open IDE / TUI directly |
| ACP Background | Caller | Third-party client manages via ACP |
| ACP Service | AgentCraft | Persistent employee agent |
| One-Shot | AgentCraft | Execute task and auto-terminate |

## Development Principles

1. **CLI-First, UI-Ready** — All features work via text config and CLI before any UI integration
2. **Test-Driven** — All CLI/config behaviors must have comprehensive unit tests
3. **Plan Before Execute** — Explicit design and confirmation before implementation
4. **Thorough Review** — Code quality, extensibility, and maintainability verified before merge

## Documentation

- [Architecture Decisions](docs/decisions/) — ADRs tracking key technical choices
- [Backend Guidelines](.trellis/spec/backend/index.md) — Backend development standards
- [Frontend Guidelines](.trellis/spec/frontend/index.md) — CLI and future UI guidelines
- [Cross-Layer Guide](.trellis/spec/guides/cross-layer-thinking-guide.md) — Thinking through data flow

## License

[MIT](LICENSE)
