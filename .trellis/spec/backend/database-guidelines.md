# Database Guidelines

> Persistence patterns and conventions for AgentCraft.

---

## Overview

AgentCraft needs to persist agent configurations, instance states, and operational metadata. The persistence layer must support both local (single-user CLI) and server (multi-user API/Docker) deployment modes.

---

## Data Categories

| Category | Description | Examples |
|----------|-------------|---------|
| **Configuration** | Agent Templates, Skills, Workflows, MCP configs | Template definitions, skill rules |
| **Instance State** | Running agent metadata and status | Instance ID, PID, port, launch mode, health |
| **Operational** | Audit logs, execution history | Command history, agent lifecycle events |
| **Domain Context** | Assembled context for each instance | Resolved prompts, active MCP servers |

---

## Storage Strategy

### File-Based Configuration (Primary)

Agent Templates, Skills, Workflows, and Prompts are stored as **human-readable config files** (YAML/JSON/TOML).

**Rationale**:
- Version-controllable with Git
- Editable by humans and AI agents
- Composable via file references
- CLI-friendly (no database setup needed)

```
configs/
├── templates/
│   ├── code-reviewer.yaml
│   └── ci-agent.yaml
├── skills/
│   ├── typescript-expert.yaml
│   └── code-review.yaml
├── workflows/
│   └── trellis-standard.yaml
└── prompts/
    └── system-prompts/
```

### Runtime State Store

Agent Instance runtime state (running processes, health status) stored in a lightweight embedded store.

**Candidates**: SQLite, LevelDB, or simple JSON file with file locking.

**Requirements**:
- Fast read/write for health checks and status queries
- Survives process restart (agent manager crash recovery)
- No external database server required for CLI mode

### Server-Mode Database (Future)

When deployed as Docker service via API, may upgrade to a proper database (PostgreSQL/SQLite) for:
- Multi-user access
- Query capabilities
- Transaction support

---

## Schema Design Principles

### 1. Config Files Are the Source of Truth

Runtime state references configs by name/path. Never duplicate config content into runtime store.

```typescript
// Good — Reference by name
interface AgentInstanceState {
  instanceId: string;
  templateRef: string;       // "code-reviewer" → resolves to configs/templates/code-reviewer.yaml
  status: InstanceStatus;
  pid?: number;
  launchedAt: string;
}

// Bad — Embedded full config
interface AgentInstanceState {
  instanceId: string;
  template: FullTemplateConfig; // Duplicates file content
}
```

### 2. Idempotent Operations

All state mutations should be idempotent. Calling "stop agent" on an already-stopped agent should succeed silently.

### 3. State Transitions Are Explicit

```
Created → Initializing → Ready → Running → Stopping → Stopped
                │                    │
                └→ Failed            └→ Crashed → Restarting → Running
```

Every state transition must be logged and persisted.

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Config files | kebab-case | `code-reviewer.yaml` |
| Config directories | kebab-case plural | `templates/`, `skills/` |
| State fields | camelCase | `instanceId`, `launchedAt` |
| Enum values | PascalCase | `Running`, `Stopped`, `Crashed` |

---

## Migrations

### Config File Versioning

Config files include a `version` field. When schema changes:

1. Bump the version
2. Write a migration script in `scripts/migrations/`
3. Migration reads old format, writes new format
4. Old files are backed up before migration

```yaml
# Template config with version
version: "1.0"
name: code-reviewer
skills:
  - typescript-expert
  - code-review
```

### Runtime State Migrations

If the state store schema changes, handle migration on startup:

```typescript
async function migrateStateIfNeeded(store: StateStore): Promise<void> {
  const currentVersion = await store.getSchemaVersion();
  if (currentVersion < REQUIRED_VERSION) {
    await runMigrations(store, currentVersion, REQUIRED_VERSION);
  }
}
```

---

## Common Mistakes

### Mistake: Storing Derived State

**Symptom**: State store says agent has 3 skills, but template now has 4.

**Cause**: Skill list was copied into state instead of referencing template.

**Fix**: Store references, resolve at read time.

### Mistake: No File Locking

**Symptom**: Corrupted state when multiple CLI sessions modify simultaneously.

**Fix**: Use file-level locking for state store writes. Consider embedded database (SQLite) for concurrent access.

### Mistake: No Backup Before Migration

**Symptom**: Migration bug destroys all config files.

**Fix**: Always create a backup directory before running migrations.
