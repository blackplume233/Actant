# QA Report — Full CLI Regression (Round 3-4)

**Date**: 2026-02-24
**Scenario**: `full-cli-regression.json` (82 effective steps across 11 sections)
**Platform**: Windows 10, PowerShell
**Mode**: Real launcher (no mock)
**CLI Version**: 0.2.1

---

## Pass Rate Trend

| Round | Pass | Fail | Warn | Total | Rate |
|-------|------|------|------|-------|------|
| R3 | 81 | 1 | 0 | 82 | 98.8% |
| R4 | 82 | 0 | 0 | 82 | **100%** |

## Issues Found & Fixed

### Issue #146 — `agent destroy --force` not idempotent
- **Severity**: P1 (bug)
- **Symptom**: `actant agent destroy <nonexistent> --force` returned exit 1 instead of expected exit 0
- **Root Cause**: The `--force` flag in `packages/cli/src/commands/agent/destroy.ts` only skipped confirmation prompts but did not suppress `AgentNotFoundError` (RPC code -32003)
- **Fix**: Added error interception in the catch block — when `--force` is true and the error is agent-not-found (-32003), treat as successful no-op with "(already absent)" message
- **Verification**: R4 regression confirms fix; `p10-err-destroy-nonexistent` now passes

## Section Breakdown (R4 — Final)

| Section | Steps | Status |
|---------|-------|--------|
| P1 Infrastructure | 4 | All PASS |
| P1s Setup | 4 | All PASS |
| P2 Templates | 5 | All PASS |
| P3 Domain CRUD (Skill/Prompt/MCP/Workflow/Plugin) | 28 | All PASS |
| P4 Sources | 4 | All PASS |
| P5 Presets | 2 | All PASS |
| P6 Agent Lifecycle | 8 | All PASS |
| P7 Agent Advanced | 8 | All PASS |
| P8 Proxy | 2 | All PASS |
| P9 Schedule | 1 | All PASS |
| P10 Error Handling | 13 | All PASS |
| P11 Cleanup | 3 | All PASS |

## Conclusion

After the backend refactoring (BackendDefinition as VersionedComponent, BackendManager, actant-hub integration), the full CLI regression suite passes at **100%**. The only regression found (destroy --force idempotency) was a pre-existing behavioral gap exposed by the new test scenario, not caused by the refactoring itself. Fix applied and verified.
