## QA Integration Test Report

**Scenario**: cli-hub-bootstrap  
**Engineer**: QA SubAgent  
**Time**: 2026-03-17T12:00:35+08:00  
**Result**: PASSED (11/11 steps passed, 0 warnings)

### Summary
| # | Step | Command | Verdict | Duration |
|---|------|---------|---------|----------|
| 1 | Global actant version | `actant --version` | PASS | — |
| 2 | Global acthub version | `acthub --version` | PASS | — |
| 3 | First hub bootstrap | `actant hub status` | PASS | — |
| 4 | hub status JSON contract | `actant hub status --format json` | PASS | — |
| 5 | daemon status JSON contract | `actant daemon status --format json` | PASS | — |
| 6 | acthub alias behavior | `acthub status --format json` | PASS | — |
| 7 | Hub path alias mapping | `acthub read /project/context.json` | PASS | — |
| 8 | Hub list alias mapping | `acthub list /project --json` | PASS | — |
| 9 | MCP connected mode | `vfs_read(/project/context.json)` + `actant(hub.status)` | PASS | — |
| 10 | MCP detached-readonly mode | `vfs_read(/project/context.json)` + `actant(hub.status)` | PASS | — |
| 11 | Host cleanup | `actant daemon stop` + `actant daemon status --format json` | PASS | — |

### Key Findings
- Global install chain is usable: both `actant` and `acthub` resolve to `0.3.0`.
- First `actant hub status` invocation auto-started a single `bootstrap` host and mounted the repo project context.
- `daemon.ping` now surfaces `hostProfile`, `runtimeState`, `capabilities`, and `hubProject`, matching the intended boundary contract.
- `acthub` is alias-only: it reused the existing host and did not start a second daemon.
- Hub logical roots such as `/project` map correctly onto internal `/hub/...` mounts.
- MCP connected mode reused the same host and successfully proxied `hub.status`.
- MCP detached-readonly mode kept project context access but rejected runtime RPC with the intended `actant hub status` guidance.

### Failures / Warnings
None.

### Full Execution Log
See `G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-log-round3.md`.
