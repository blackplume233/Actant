# Diff: v0.2.4 → v0.2.5

> Generated: 2026-02-27

## RPC Methods

| Metric | v0.2.4 | v0.2.5 | Delta |
|--------|---------|---------|-------|
| Total | 85 | 85 | +0 |

No changes to RPC method set.

## CLI Commands

| Metric | v0.2.4 | v0.2.5 | Delta |
|--------|---------|---------|-------|
| Total Subcommands | 62 | 62 | +0 |

## Config Schemas

No changes to schema set.

### AgentArchetypeSchema Changes

| | v0.2.4 | v0.2.5 |
|---|---------|----------|
| Default | {"name":"AgentArchetypeSchema","kind":"enum","fields":[{"name":"_values","zodType":"tool,employee,service"}]} | {"name":"AgentArchetypeSchema","kind":"enum","fields":[{"name":"_values","zodType":"repo,service,employee"}]} |

## Code Metrics

| Metric | v0.2.4 | v0.2.5 | Delta |
|--------|---------|---------|-------|
| LOC | 42460 | 36437 | -6023 |
| Files | 415 | 321 | -94 |
| Exports | 10 | 35 | +25 |

## Tests

| Metric | v0.2.4 | v0.2.5 | Delta |
|--------|---------|---------|-------|
| Test Files | 65 | 72 | +7 |
| Tests | 852 | 943 | +91 |
| Failed | 0 | 0 | 0 |

## Key Semantic Changes

- **AgentArchetype reclassified**: `tool | employee | service` → `repo | service | employee` (#228)
- **ToolScope hierarchy introduced**: Numeric level-based tool access filtering
- **Canvas access expanded**: From `employee`-only to `service` + `employee`
- **Legacy migration**: `"tool"` → `"repo"` via Zod transform on instance meta load
- **Hardening**: 22 ToolRegistry bug fixes, buffer DoS guards, UTF-8 safe truncation
- **PI agent chat**: interactionModes, ACP PID tracking, prompt timeout fixes
