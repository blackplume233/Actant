# Frontend Development Guidelines

> Guidelines for AgentCraft's user-facing interfaces.

---

## Overview

AgentCraft follows a **CLI-First** strategy. The primary interface is an interactive command-line environment (similar to Python REPL). A web-based management UI is planned for future phases.

### Interface Layers

| Layer | Priority | Description | Status |
|-------|----------|-------------|--------|
| **CLI (REPL)** | P0 | Interactive command-line, the primary interface | Active |
| **REST API** | P0 | HTTP endpoints for all operations (enables Docker deployment) | Active |
| **Web UI** | P1 | Management dashboard for agent monitoring and configuration | Planned |
| **ACP Client** | P2 | Protocol adapter for external Agent Clients (Unreal/Unity) | Planned |

---

## CLI-First Principle

All features must be fully operational via CLI before any UI work begins. This means:

1. **Business logic lives in Core** — CLI and UI are thin presentation layers
2. **CLI commands map 1:1 to API endpoints** — same underlying operations
3. **Output formats are structured** — JSON output mode for programmatic consumption
4. **Interactive prompts have non-interactive equivalents** — all params passable as flags

### CLI Design Considerations for Future UI

When designing CLI commands, keep future UI integration in mind:

| CLI Pattern | UI Equivalent |
|-------------|--------------|
| `agent list` | Agent list page with table |
| `agent create --template X` | "New Agent" form with template selector |
| `agent status <id>` | Agent detail panel with live status |
| `agent logs <id> --follow` | Log viewer with streaming |
| `template edit <name>` | Template editor with validation |

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | CLI and future UI file organization | Initial |
| [Component Guidelines](./component-guidelines.md) | CLI output components, future UI components | Template |
| [Hook Guidelines](./hook-guidelines.md) | CLI lifecycle hooks, future React hooks | Template |
| [State Management](./state-management.md) | CLI session state, future UI state | Template |
| [Quality Guidelines](./quality-guidelines.md) | Code standards for frontend layers | Template |
| [Type Safety](./type-safety.md) | Type patterns for CLI and UI | Template |

> **Note**: "Template" status means the file contains placeholder content from Trellis. It will be filled when the corresponding feature is actively developed.

---

## Current Phase: CLI Development

### CLI Architecture

```
CLI Layer
├── Command Parser       # Parse user input into commands
├── Command Registry     # Available commands and their handlers
├── REPL Loop           # Interactive session management
├── Output Formatter    # Render results (table, JSON, text)
└── Error Presenter     # User-friendly error display
```

### CLI Output Modes

Support multiple output formats for different consumers:

| Mode | Flag | Consumer | Example |
|------|------|----------|---------|
| Table | `--format table` (default) | Human users | Formatted ASCII tables |
| JSON | `--format json` | Scripts, CI tools | Machine-parseable JSON |
| Quiet | `--quiet` | Pipelines | Minimal output (IDs only) |

---

## Future Phase: Web UI

When the Web UI phase begins, these guidelines will be expanded with:

- Component architecture (likely React-based)
- State management patterns
- Real-time agent monitoring via WebSocket
- Template visual editor

The web UI will consume the same REST API that the CLI uses, ensuring feature parity.

---

**Language**: All documentation should be written in **English**.
