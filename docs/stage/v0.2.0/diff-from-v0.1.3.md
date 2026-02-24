# Version Diff: v0.1.3 → v0.2.0

> Generated: 2026-02-24

---

## RPC Methods

| Change | Method |
|--------|--------|
| ✅ **Added** | `agent.open` |

**Total**: 74 → 75 methods (+1)

No methods removed. No breaking changes to existing RPC methods.

---

## CLI Commands

| Change | Command |
|--------|---------|
| ✅ **Added** | `agent open <name>` |

**Total**: 61 → 62 subcommands (+1)

No commands removed.

---

## Type Changes

### New Types (template.types.ts)

| Type | Description |
|------|-------------|
| `AgentOpenMode` | `"resolve" \| "open" \| "acp"` |
| `PlatformCommand` | `{ win32: string; default: string }` |
| `BackendDescriptor` | Backend capability descriptor |

### Modified Types

| Type | Change |
|------|--------|
| `AgentBackendType` | Added `"cursor-agent"` and `"pi"` to union |

### New RPC Types (rpc.types.ts)

| Type | Fields |
|------|--------|
| `AgentOpenParams` | `{ name: string }` |
| `AgentOpenResult` | `{ command: string; args: string[] }` |

---

## Environment Variables

| Change | Variable | Description |
|--------|----------|-------------|
| ✅ **Added** | `ACTANT_PROVIDER` | Unified LLM provider |
| ✅ **Added** | `ACTANT_MODEL` | Unified LLM model name |
| ✅ **Added** | `ACTANT_THINKING_LEVEL` | Thinking/reasoning level |

---

## New Packages

| Package | Description |
|---------|-------------|
| `@actant/pi` | Pi Agent backend (pi-ai + pi-agent-core) |
| `actant` | Facade package re-exporting all sub-packages |

---

## New Modules (core)

| Module | Description |
|--------|-------------|
| `backend-registry.ts` | Extensible backend capability registry |
| `builtin-backends.ts` | Built-in backend descriptor registration |

---

## Test Changes

| Metric | v0.1.3 | v0.2.0 | Delta |
|--------|--------|--------|-------|
| Test files | 49 | 55 | +6 |
| Test cases | 538 | 631 | +93 |

---

## Breaking Changes

**None.** All changes are additive:
- New RPC method (`agent.open`)
- New backend types (`cursor-agent`, `pi`)
- New types (`AgentOpenMode`, `BackendDescriptor`)
- New environment variables (`ACTANT_*`)
