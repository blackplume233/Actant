# Version Diff: v0.2.5 → v0.2.6

## Summary

| Metric | v0.2.5 | v0.2.6 | Delta |
|--------|--------|--------|-------|
| RPC Methods | 85 | 92 | +7 |
| CLI Subcommands | 62 | 65 | +3 |
| LOC | 36,437 | 45,140 | +8,703 |
| Test Files | 72 | 78 | +6 |
| Tests | 943 | 1,027 | +84 |
| Issues (total) | ~30 | 38 | +8 |

## New RPC Methods (+7)

| Method | Description |
|--------|-------------|
| `template.create` | Create template from inline JSON |
| `agent.updatePermissions` | Update agent runtime permissions |
| `plugin.runtimeList` | List active plugins from PluginHost |
| `plugin.runtimeStatus` | Query single plugin runtime state |
| `internal.validateToken` | Validate session token |
| `internal.canvasUpdate` | Internal canvas update (from agent) |
| `internal.canvasClear` | Internal canvas clear (from agent) |

## New CLI Commands (+3)

| Command | Description |
|---------|-------------|
| `plugin status` | Show runtime plugin list |
| `plugin status <name>` | Show single plugin runtime state |
| (template subcommand) | Template creation support |

## Key Feature Changes

### Added

- **ActantPlugin system** (#14): Six-plug interface (domainContext, runtime, hooks, contextProviders, subsystems, sources) with PluginHost lifecycle management
- **HeartbeatPlugin builtin**: Bridges EmployeeScheduler with PluginHost tick loop
- **Heartbeat `.heartbeat` file convention**: Agent self-directs its focus via workspace file
- **Stable conversationId**: Persistent conversation threading across session reconnects
- **ACP keepalive ping**: Prevents Windows named pipe idle exit (~14s)
- **SystemBudgetManager**: Tracks service agent runtime, dynamic keepAlive windows
- **Dashboard orchestration UI**: Template creation wizard, budget-aware lifecycle
- **REST API POST /v1/templates**: Template creation endpoint

### Fixed

- Pi backend `baseUrl` not propagating to pi-ai model instances
- Session-not-found errors on reconnect
- Windows process cleanup (tree-kill)
- Dispatch CLI UX improvements

### Breaking Changes

- ⚠️ `HeartbeatConfig.prompt` changed from required to optional (backward compatible — omission uses default seed)
- ⚠️ `SessionLeaseInfo` now includes `conversationId: string` (additive, non-breaking for consumers)
- ⚠️ `SessionPromptResult` now includes `conversationId: string` (additive)

## Spec Updates

| Spec File | Change |
|-----------|--------|
| `session-management.md` | **New** — 4-concept model (lease, session, conversation, recording) |
| `config-spec.md` | HeartbeatConfig.prompt optional, Pi baseUrl env vars |
| `api-contracts.md` | plugin.runtime* RPC, session conversationId, template.create |
| `agent-lifecycle.md` | .heartbeat file convention design |
| `endurance-testing.md` | E-HEART scenario, INV-CONV/INV-ALIVE invariants |
| `quality-guidelines.md` | Pi baseUrl Common Mistake, PowerShell QA convention |
| `cross-platform-guide.md` | Windows Named Pipe idle exit gotcha |
