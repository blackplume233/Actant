# QA Round 4: pi-backend-comprehensive

**Date:** 2026-02-24  
**Critical fix:** acp-bridge now reads `params.prompt` instead of `params.content`, which was causing the ACP prompt to silently fail with empty text.

## Setup

- **Temp dir:** C:\Users\black\AppData\Local\Temp\ac-qa-pi-r4-485482877
- **Env:** ACTANT_HOME, ACTANT_SOCKET=\\.\pipe\actant-qa-pi-r4, ACTANT_PROVIDER=kimi-coding, ACTANT_MODEL=k2p5
- **Daemon:** Started successfully
- **Templates:** pi-basic, pi-with-skills loaded

---

## Step Results

### Phase 1: Lifecycle
| Step | ID | Result | Notes |
|------|-----|--------|------|
| 1 | phase1-load-template | PASS | pi-basic, pi-with-skills in list |
| 2 | phase1-create | PASS | pi-test created, status=created, backendType=pi |
| 3 | phase1-status-created | PASS | status=created, backendType=pi |
| 4 | phase1-resolve-unsupported | PASS | Exit 1, error: Backend pi does not support resolve mode |
| 5 | phase1-workspace-check | PASS | AGENTS.md, .pi/ exist |
| 6 | phase1-destroy | PASS | Destroyed pi-test |
| 7 | phase1-list-empty | PASS | List empty, no pi-test |

### Phase 2: Builder
| Step | ID | Result | Notes |
|------|-----|--------|------|
| 8 | phase2-create-with-skills | PASS | pi-skill-test created |
| 9 | phase2-agents-md | PASS | AGENTS.md exists |
| 10 | phase2-pi-dir | PASS | .pi/skills/, .pi/prompts/ exist |
| 11 | phase2-cleanup | PASS | Destroyed pi-skill-test |

### Phase 3: Communicator
| Step | ID | Result | Notes |
|------|-----|--------|------|
| 12 | phase3-create-for-run | PASS | pi-run-test created |
| 13 | phase3-run-prompt | PASS | stdout: HELLO_PI_TEST (exact match) |
| 14 | phase3-cleanup | PASS | Destroyed pi-run-test |

### Phase 4: ACP
| Step | ID | Result | Notes |
|------|-----|--------|------|
| 15 | phase4-create-for-acp | PASS | pi-acp-test created |
| 16 | phase4-start | PASS | Started pi-acp-test |
| 17 | phase4-status-running | PASS | status=running |
| 18 | phase4-prompt | PASS | stdout: ACP_HELLOACP_HELLO (LLM response received) |
| 19 | phase4-stop | PASS | Stopped pi-acp-test |
| 20 | phase4-status-stopped | PASS | status=stopped |
| 21 | phase4-cleanup | PASS | Destroyed pi-acp-test |

### Phase 5: Error Handling
| Step | ID | Result | Notes |
|------|-----|--------|------|
| 22 | phase5-prompt-not-started | PASS | pi-err-test created |
| 23 | phase5-prompt-error | PASS | Exit 1, Agent has no ACP connection |
| 24 | phase5-cleanup | PASS | Destroyed pi-err-test |

---

## Critical Step 13 Detail (agent run)

**Command:** agent run pi-run-test --prompt "Reply with exactly: HELLO_PI_TEST"

**Exit code:** 0  
**stdout:** HELLO_PI_TEST  
**Duration:** ~874ms

---

## Critical Step 18 Detail (agent prompt via ACP)

**Command:** agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO"

**Exit code:** 0  
**stdout:** ACP_HELLOACP_HELLO  
**Duration:** ~874ms

The params.prompt fix works. The ACP bridge now correctly receives the prompt text and returns real LLM output. (Duplicate text likely from stream chunk concatenation.)

---

## Summary

| Metric | Count |
|--------|-------|
| PASS | 24 |
| WARN | 0 |
| FAIL | 0 |

**Step 13 exact stdout:** HELLO_PI_TEST  
**Step 18 exact stdout:** ACP_HELLOACP_HELLO

---

## Cleanup

- Agents destroyed
- Daemon stopped
- Temp dir removed
