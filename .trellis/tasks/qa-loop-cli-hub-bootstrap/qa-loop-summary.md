## /qa-loop Summary

**Scope**: cli-hub-bootstrap  
**Environment**: real CLI + isolated `ACTANT_HOME` / named pipe  
**Rounds**: 4 recorded checkpoints  
**Final Result**: PASS

### Round Trend
| Round | Status | Notes |
|------|--------|-------|
| R1 | Harness FAIL | Node-based harness invoked the Windows npm shim incorrectly (`actant.cmd` path issue). Not a product regression. |
| R2 | Harness FAIL | Harness still hung on first auto-start call when nesting the global CLI inside a secondary PowerShell process. Not a product regression. |
| R3 | PASS | Re-ran the same black-box command set directly through the installed CLI and MCP SDK client; 11/11 checks passed. |
| R9 | PASS | Revalidated the standalone/SEA install chain end-to-end after fixing daemon cold-start gating, package-version fallback, and workspace-source standalone bundling. |

### Final Evidence
- Log: `G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-log-round3.md`
- Report: `G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-report-round3.md`
- Log: `G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-log-round9.md`
- Report: `G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-report-round9.md`

### Validation Coverage
- Official install chain: `actant`, `acthub`
- CLI-first bootstrap: `actant hub status`
- Single-host reuse: `acthub status`
- Hub VFS alias mapping: `read` / `list` against `/project`
- `daemon.ping` contract surface: profile, runtime, capabilities, hub project
- MCP convergence:
  - connected mode via host + `hub.status`
  - detached-readonly mode + runtime RPC rejection
- Cleanup: daemon stop + stopped status
- Standalone SEA bootstrap:
  - source-driven bundling of workspace packages
  - formal `install-local --standalone` path
  - isolated `acthub.exe` cold-start on named pipe
  - standalone `daemon.ping.version`

### Additional Baseline Validation
- `pnpm build` rerun passed during this turn.
- Earlier implementation validation for the code changes had already passed `pnpm -r run type-check`, `pnpm lint`, and `pnpm test` with `111` test files / `1311` tests green.
