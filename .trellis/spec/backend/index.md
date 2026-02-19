# Backend Development Guidelines

> Best practices for backend development in AgentCraft.

---

## Project Overview

**AgentCraft** is a platform for building, managing, and composing AI agents. It targets complex business domains (e.g. game development) where users need to rapidly assemble, reuse, and deploy agents with zero friction.

### Core Scenarios

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Custom Business Agent | Dynamically compose agents with Domain Context (Skills, MCP, Prompts, memory) |
| 2 | CI Integration | Agents callable via CLI for TeamCity-like CI pipelines |
| 3 | Persistent Agent (OpenClaw) | Long-running agents with heartbeat, self-growth, long-term memory, scheduled tasks |
| 4 | Agent as Service | Persistent agents integrated into IM / Email as virtual employees |
| 5 | ACP Integration | AgentServer exposed via ACP for Unreal/Unity engine communication |
| 6 | Agent-to-Agent | Agents invoking other agents |

---

## Terminology Glossary

| Term | Definition |
|------|-----------|
| **Model Provider** | Base model API (e.g. OpenAI, Anthropic) |
| **Agent Client** | Agent frontend — TUI, IDE plugin, dedicated app (e.g. Claude Desktop) |
| **Agent Backend** | Agent's functional implementation without UI (e.g. Claude Code, Cursor core) |
| **Domain Context** | Business-specific context composed of Workflow, Prompt, MCP/Tools, Skills, SubAgents |
| **Agent Template** | Configuration file defining Domain Context, default backend, provider, and initializer |
| **Agent Instance** | A runnable agent with assigned Provider, Backend, Domain Context, hooks, and plugins |
| **Employee** | A continuously running Agent Instance serving as a persistent worker |

### Domain Context Components

| Component | Description | Example |
|-----------|-------------|---------|
| Workflow | Default instructions, hooks, commands (Trellis-like) | `.trellis/` configuration |
| Prompt | System prompts and instruction sets | Role-specific prompts |
| MCP/Tools | Model Context Protocol servers and tools | File system, database access |
| Skills (Rules) | Behavioral rules and domain knowledge | Coding standards, review rules |
| SubAgent | Nested agent references for composition | Specialist agents |

---

## Module Architecture

```
AgentCraft
├── AgentCraftCore          # Core functionality
│   ├── CLI Module          # Interactive command-line interface (Python REPL-like)
│   ├── Template Module     # Agent Template configuration and management
│   ├── Initializer Module  # Construct Agent Instance from Template
│   └── Manager Module      # Lifecycle management of all Agent Instances
│
├── AgentCraft ACP          # Agent Client Protocol server
│                           # External Agent Clients communicate via ACP
│
├── AgentCraft MCP          # MCP server for agent-to-AgentCraft access
│                           # Agents can invoke other agents, control services
│
└── AgentCraft API          # RESTful API layer
                            # All CLI commands exposed as HTTP endpoints
                            # Enables Docker deployment
```

### AgentCraftCore Details

**CLI Module**: Interactive command-line environment. Users execute commands sequentially (similar to Python REPL). All core functionality must be accessible via CLI.

**Template Module**: Manages Agent Template configurations.
- Skills are referenced by name (managed by a central Skill Manager)
- Prompts, Workflows, MCP configs, plugins are all reusable references
- Templates compose references rather than embedding full configs

**Initializer Module**: Constructs Agent Instances from Templates.
- User specifies Agent Backend and Provider (or uses defaults)
- Creates a working directory based on initializer flow
- Optionally starts the agent for service mode

**Manager Module**: Manages all Agent Instance lifecycles.
- Launch modes: direct (open Cursor/Claude Code), ACP background (caller-managed lifecycle), ACP service (AgentCraft-managed), one-shot (execute and terminate)
- Provides start, stop, monitor, status capabilities

---

## Development Principles

1. **CLI-First, UI-Ready**: All core functions must work via text config and CLI. CLI design should anticipate future UI integration.
2. **Test-Driven**: All behaviors exposed as CLI operations or configurations must have comprehensive unit tests.
3. **Plan Before Execute**: Every development task requires explicit design and confirmation before implementation. Keep each commit scope small and focused.
4. **Thorough Review**: Completed features must be reviewed for code quality, extensibility, and maintainability. Iterate agilely while keeping tech debt bounded.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Initial |
| [Database Guidelines](./database-guidelines.md) | Persistence patterns for agent state | Initial |
| [Error Handling](./error-handling.md) | Error types and handling strategies | Initial |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, testing, review | Initial |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging for agent lifecycle | Initial |

---

## Key Design Decisions

### CLI as Primary Interface

All features are first implemented as CLI commands. This ensures:
- CI/CD tools can integrate directly
- Automated testing is straightforward
- Future UI layers call the same underlying logic

### Reference-Based Composition

Agent Templates use **name references** to Domain Context components rather than embedding full configs. This enables:
- Component reuse across templates
- Centralized management of Skills, Workflows, MCP configs
- Independent versioning of components

### Multiple Launch Modes

Agent Instances support multiple launch patterns:

| Mode | Lifecycle Owner | Use Case |
|------|----------------|----------|
| Direct | User | Open IDE / TUI directly |
| ACP Background | Caller | Third-party client manages via ACP |
| ACP Service | AgentCraft | Persistent employee agent |
| One-Shot | AgentCraft | Execute task and auto-terminate |

---

## Reference Projects

| Project | Relevance |
|---------|-----------|
| [PicoClaw](https://picoclaw.net/) | Agent persistent integration |
| [pi-mono/ai](https://github.com/badlogic/pi-mono/tree/main/packages/ai) | Agent backend implementation |
| [ACP](https://agentclientprotocol.com/) | Agent Client Protocol framework |
| [n8n](https://n8n.io/) | Workflow automation patterns |
| [Trellis](https://github.com/mindfold-ai/Trellis) | Engineering initialization and workflow |
| [UnrealFairy](https://github.com/blackplume233/UnrealFairy) | Related project — AgentCraft will replace its agent subsystem |

---

**Language**: See [Language Conventions](./quality-guidelines.md#language-conventions) in Quality Guidelines.
