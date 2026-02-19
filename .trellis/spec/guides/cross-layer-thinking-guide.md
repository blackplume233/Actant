# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across AgentCraft's layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

In AgentCraft, there are more boundaries than a typical web app:

```
User ↔ CLI ↔ Core ↔ Agent Process ↔ Model Provider
                ↕           ↕
              API         ACP/MCP
                ↕           ↕
           Web UI    External Clients
                    (Unreal/Unity/IM)
```

Every arrow is a potential source of bugs.

---

## AgentCraft Layer Map

| Layer | Responsibility | Communication |
|-------|---------------|---------------|
| **CLI** | User interaction, command parsing, output formatting | Calls Core directly (in-process) |
| **API** | HTTP interface for external access | Calls Core directly (in-process) |
| **Core** | Business logic, template resolution, lifecycle management | Manages Agent Processes |
| **ACP Server** | Protocol bridge for external Agent Clients | Translates ACP ↔ Core operations |
| **MCP Server** | Protocol bridge for agent-to-platform access | Translates MCP ↔ Core operations |
| **Agent Process** | Running agent instance | Communicates via ACP/MCP/stdin/stdout |
| **Config Files** | Persistent configuration source of truth | Read by Core at resolution time |
| **State Store** | Runtime state persistence | Read/written by Core Manager |

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves through AgentCraft's specific layers:

```
Example: "User creates an agent from template"

User Input (CLI)
  → Command Parser (CLI)
    → CreateAgentCommand (Core)
      → Template Resolution (Core: resolve skill/mcp/workflow references)
        → Config File Read (Config Files)
      → Workspace Setup (Core: Initializer)
        → File System Write
      → Process Launch (Core: Manager)
        → Agent Process spawned
      → State Persist (State Store)
    → Output Formatter (CLI)
  → User sees result
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who validates the data?

### Step 2: Identify AgentCraft-Specific Boundaries

| Boundary | Common Issues |
|----------|---------------|
| CLI ↔ Core | Argument types mismatch, missing validation |
| API ↔ Core | HTTP serialization, enum string values vs typed enums |
| Core ↔ Config Files | File not found, schema version mismatch, parse errors |
| Core ↔ State Store | Stale state, concurrent access, migration needed |
| Core ↔ Agent Process | Process crash, stdout parsing, signal handling |
| ACP Server ↔ Core | Protocol version mismatch, message format differences |
| MCP Server ↔ Core | Tool schema mismatch, permission errors |
| Agent Process ↔ Provider | Network timeout, rate limiting, model errors |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?
- Who is responsible for format conversion?

---

## Common Cross-Layer Mistakes in AgentCraft

### Mistake 1: Config Reference Resolution Timing

**Bad**: Resolving skill references at template load time (stale references)

**Good**: Resolve references at agent creation time (fresh resolution)

**Why**: Skills and other Domain Context components may be updated after the template was loaded. Always resolve at the latest possible moment.

### Mistake 2: Agent Process State Assumptions

**Bad**: Assuming agent process is running because state store says "Running"

**Good**: Verify process is alive (PID check) before operations

**Why**: Agent processes can crash without notifying the manager. State store may be stale.

### Mistake 3: CLI ↔ API Output Mismatch

**Bad**: CLI command returns different data structure than equivalent API endpoint

**Good**: Both CLI and API call the same Core function and format the same result

**Why**: Scripts and CI tools may switch between CLI and API. Inconsistent output breaks automation.

### Mistake 4: ACP/MCP Schema Drift

**Bad**: Core changes data format without updating ACP/MCP protocol handlers

**Good**: Protocol handlers use shared type definitions from `packages/shared/types/`

**Why**: External clients depend on stable protocol schemas. Breaking changes cause silent failures.

### Mistake 5: Leaky Abstraction Across Modules

**Bad**: CLI command directly reads config files, bypassing Core

**Good**: CLI → Core (Template Module) → Config Files

**Why**: Core owns the business rules for config resolution (defaults, overrides, validation). Bypassing it creates inconsistencies.

---

## AgentCraft Cross-Layer Checklist

### Before Implementation

- [ ] Mapped the complete data flow through all involved layers
- [ ] Identified all layer boundaries the feature crosses
- [ ] Defined data format at each boundary
- [ ] Decided where validation happens (validate once at entry point)
- [ ] Shared types defined in `packages/shared/types/`

### During Implementation

- [ ] CLI and API commands call the same Core function
- [ ] Config references resolved at the right time (creation, not load)
- [ ] Agent process state verified before operations
- [ ] Error handling at each boundary (see [Error Handling](../backend/error-handling.md))

### After Implementation

- [ ] Tested with edge cases (null, empty, invalid, not found)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip (CLI create → API read → CLI modify)
- [ ] ACP/MCP protocol schemas updated if data format changed

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Data format is complex (nested Domain Context)
- Feature involves agent-to-agent communication
- Feature has caused bugs before
- External protocol (ACP/MCP) is involved

Store flow docs in the relevant task directory:
```
.trellis/tasks/{task-name}/flow.md
```

---

## Layer Dependency Rules

```
CLI ──→ Core ←── API
           ↕
    ┌──────┼──────┐
    ↓      ↓      ↓
   ACP    MCP   State Store
   Server Server
    ↓      ↓
  External Agents/Clients
```

**Rules**:
1. CLI and API never depend on each other
2. ACP and MCP servers never depend on each other
3. All external-facing layers go through Core
4. Shared types live in `packages/shared/`
5. Config files are only read by Core (never by CLI, API, ACP, or MCP directly)
