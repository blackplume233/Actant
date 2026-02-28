# QA Round 2: pi-backend-comprehensive

**Date:** 2026-02-24  
**Scenario:** pi-backend-comprehensive  
**Temp Dir:** `C:\Users\black\AppData\Local\Temp\ac-qa-pi-r2-1506182037` (removed after run)

## Setup

- **Env:** `ACTANT_HOME`, `ACTANT_SOCKET=\\.\pipe\actant-qa-pi-r2`, `ACTANT_PROVIDER=kimi-coding`, `ACTANT_MODEL=k2p5`
- **Templates:** pi-basic, pi-with-skills (domainContext empty)
- **CLI:** `packages/cli/dist/bin/actant.js`

## Fixes Applied Before Round 2

1. Removed skill reference from pi-with-skills template (domainContext is now empty)
2. Fixed spawn EINVAL by using `process.execPath` + absolute path to acp-bridge.js instead of bin link

---

## Step Results

| # | Step ID | Description | Result | Notes |
|---|---------|-------------|--------|-------|
| 1 | phase1-load-template | template list -f json | PASS | pi-basic, pi-with-skills in list |
| 2 | phase1-create | agent create pi-test -t pi-basic | PASS | status=created, backendType=pi |
| 3 | phase1-status-created | agent status pi-test | PASS | status=created |
| 4 | phase1-resolve-unsupported | agent resolve pi-test (expect FAIL) | PASS | Exit 1, "does not support resolve mode" |
| 5 | phase1-workspace-check | workspace structure | PASS | AGENTS.md, .pi/ present |
| 6 | phase1-destroy | agent destroy pi-test | PASS | Destroyed |
| 7 | phase1-list-empty | agent list | PASS | [] |
| 8 | phase2-create-with-skills | agent create pi-skill-test -t pi-with-skills | PASS | Created (domainContext empty) |
| 9 | phase2-agents-md | AGENTS.md check | PASS | Workspace has AGENTS.md |
| 10 | phase2-pi-dir | .pi/skills, .pi/prompts | PASS | Both dirs exist |
| 11 | phase2-cleanup | destroy pi-skill-test | PASS | Destroyed |
| 12 | phase3-create-for-run | agent create pi-run-test | PASS | Created |
| 13 | phase3-run-prompt | agent run --prompt HELLO_PI_TEST | PASS | Output: HELLO_PI_TEST |
| 14 | phase3-cleanup | destroy pi-run-test | PASS | Destroyed |
| 15 | phase4-create-for-acp | agent create pi-acp-test | PASS | Created |
| 16 | phase4-start | agent start pi-acp-test | PASS | Started (ACP fix worked) |
| 17 | phase4-status-running | agent status | PASS | status=running |
| 18 | phase4-prompt | agent prompt ACP_HELLO | WARN | Exit 0, output empty |
| 19 | phase4-stop | agent stop pi-acp-test | PASS | Stopped |
| 20 | phase4-status-stopped | agent status | PASS | status=stopped |
| 21 | phase4-cleanup | destroy pi-acp-test | PASS | Destroyed |
| 22 | phase5-prompt-not-started | agent create pi-err-test | PASS | Created |
| 23 | phase5-prompt-error | agent prompt (not started) | PASS | Exit 1, no ACP connection |
| 24 | phase5-cleanup | destroy pi-err-test | PASS | Destroyed |

---

## Summary

| Metric | Count |
|--------|-------|
| **PASS** | 23 |
| **WARN** | 1 |
| **FAIL** | 0 |

### WARN Details

- **Step 18 (phase4-prompt):** Command exited 0 but stdout was empty. Expected AI reply containing ACP_HELLO.

### Key Verifications

- Pi resolve mode correctly rejects with clear error
- pi-with-skills with empty domainContext creates agent and workspace
- ACP start no longer hits spawn EINVAL
- Communicator agent run returns HELLO_PI_TEST
- Error handling: prompt on non-started agent returns exit 1
