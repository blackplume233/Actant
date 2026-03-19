# Database Guidelines

> Persistence patterns and conventions for Actant.

---

## Overview

Actant needs to persist agent configurations, instance states, and operational metadata. The persistence layer must support both local (single-user CLI) and server (multi-user API/Docker) deployment modes.

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

Agent Templates, Skills, Workflows, and Prompts are stored as **human-readable config files** (JSON).

**Rationale**:
- Version-controllable with Git
- Editable by humans and AI agents
- Composable via file references
- CLI-friendly (no database setup needed)

```
configs/
├── templates/
│   ├── code-reviewer.json
│   └── ci-agent.json
├── skills/
│   ├── typescript-expert.json
│   └── code-review.json
├── workflows/
│   └── trellis-standard.json
└── prompts/
    └── system-prompts/
```

### Runtime State: Workspace-as-Storage

Agent Instance = a workspace directory. Runtime state lives **inside** the workspace as `.actant.json`.

**No separate database or state store.** The `AgentManager` discovers instances by scanning workspace directories.

**Storage layout**:
```
{instancesBaseDir}/
├── my-reviewer/                 # Instance name = directory name
│   ├── .actant.json         # Instance metadata (id, status, template, timestamps)
│   ├── AGENTS.md                # Materialized skills/rules
│   ├── .cursor/mcp.json         # Materialized MCP config
│   └── ...                      # Other materialized Domain Context files
├── ci-bot/
│   └── .actant.json
└── .corrupted/                  # Damaged instance dirs moved here on recovery
```

**Design**:
- Each Instance is a **directory**, not a database row or standalone JSON file
- `.actant.json` is the only metadata; other files are materialized Domain Context
- On startup, `AgentManager.initialize()` scans all subdirectories and reads `.actant.json`
- **Atomic writes**: write to `.actant.json.tmp`, then `rename` to `.actant.json`
- **Startup recovery**: stale `running`/`starting` states corrected to `stopped` (process lost)
- Corrupted directories (missing or invalid `.actant.json`) moved to `.corrupted/`

**Requirements**:
- Survives process restart (scan directories to recover)
- No external database server required
- Corrupted instances isolated, not blocking startup

### Server-Mode Database (Future)

When deployed as Docker service via API, may add a database layer for:
- Multi-user concurrent access and query capabilities
- The workspace-as-storage model remains the source of truth; database acts as a cache/index

---

## Schema Design Principles

### 1. Config Files Are the Source of Truth

Runtime state references configs by name/path. Never duplicate config content into runtime store.

```typescript
// Good — Reference by name
interface AgentInstanceState {
  instanceId: string;
  templateRef: string;       // "code-reviewer" → resolves to configs/templates/code-reviewer.json
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
| Config files | kebab-case | `code-reviewer.json` |
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

```json
{
  "version": "1.0",
  "name": "code-reviewer",
  "skills": ["typescript-expert", "code-review"]
}
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
