## QA Integration Test Report

**Scenario**: cli-hub-bootstrap standalone SEA bootstrap  
**Engineer**: QA SubAgent  
**Time**: 2026-03-17T15:40:00+08:00  
**Result**: PASSED (5/5 steps passed)

### Summary
| # | Step | Command | Verdict |
|---|------|---------|---------|
| 1 | Targeted regression suite | `pnpm -r run type-check` + targeted `vitest` | PASS |
| 2 | Standalone rebuild | `node scripts/build-standalone.mjs` | PASS |
| 3 | Formal install chain | `node scripts/install-local.mjs --standalone` | PASS |
| 4 | Fresh bootstrap auto-start | `acthub.exe status --format json` + `actant.exe daemon status --format json` | PASS |
| 5 | Host reuse and cleanup | second `acthub.exe status` + `actant.exe daemon stop` | PASS |

### Key Findings
- Standalone bundle now resolves workspace `@actant/*` imports from source, eliminating stale `dist` contamination during SEA packaging.
- Standalone daemon spawn is now gated by a shared helper that accepts either `ACTANT_STANDALONE=1` or native SEA detection, so CLI cold-start no longer falls back to `daemon-entry.js`.
- Fresh standalone bootstrap host comes up in `bootstrap` profile with `runtimeState: inactive`, and no `AgentService` side effects were observed.
- `daemon.ping.version` is restored to `0.3.0` in standalone mode.
- Formal install chain produces working `actant.exe` and `acthub.exe` binaries from the rebuilt SEA artifact.

### Harness Notes
- In this Codex shell, the first cold-start `acthub.exe status --format json` sometimes returns `exit_code: 0` with stdout not surfaced by the harness. This did not block validation because follow-up `daemon status` proved the bootstrap host was started successfully, and second `acthub status` returned the expected JSON contract.

### Full Execution Log
See `G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-log-round9.md`.
