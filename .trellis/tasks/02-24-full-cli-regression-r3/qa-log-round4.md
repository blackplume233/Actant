# QA Log - Full CLI Regression Round 4 (Regression)

**Date**: 2026-02-24
**Environment**: Windows 10, PowerShell, Real Launcher Mode
**ACTANT_HOME**: `C:\Users\black\AppData\Local\Temp\ac-qa-r4-5248`
**ACTANT_SOCKET**: `\\.\pipe\actant-qa-r4-5248`
**Purpose**: Regression re-run after fixing `agent destroy --force` idempotency (Issue #146)

---

## Results Summary

| Section | Steps | Pass | Fail | Warn |
|---------|-------|------|------|------|
| P1 Infrastructure | 4 | 4 | 0 | 0 |
| P1s Setup | 4 | 4 | 0 | 0 |
| P2 Templates | 5 | 5 | 0 | 0 |
| P3 Domain CRUD | 28 | 28 | 0 | 0 |
| P4 Sources | 4 | 4 | 0 | 0 |
| P5 Presets | 2 | 2 | 0 | 0 |
| P6 Agent Lifecycle | 8 | 8 | 0 | 0 |
| P7 Agent Advanced | 8 | 8 | 0 | 0 |
| P8 Proxy | 2 | 2 | 0 | 0 |
| P9 Schedule | 1 | 1 | 0 | 0 |
| P10 Error Handling | 13 | 13 | 0 | 0 |
| P11 Cleanup | 3 | 3 | 0 | 0 |
| **Total** | **82** | **82** | **0** | **0** |

**Pass Rate: 100% (82/82)**

## Fix Verification

- **p10-err-destroy-nonexistent**: `agent destroy ghost-agent-xyz --force` now exits 0 with message "Destroyed ghost-agent-xyz (already absent)" — **PASS** (was FAIL in R3)

## All Steps Pass

No failures or warnings. Full regression suite green.
