# Pi Backend Comprehensive QA 鈥?Round 3

**Date:** 2026-02-23  
**Environment:**
- Working directory: `g:\Workspace\AgentWorkSpace\AgentCraft`
- ACTANT_HOME: `C:\Users\black\AppData\Local\Temp\actant-qa-pi-225745`
- ACTANT_SOCKET: `\\.\pipe\actant-qa-pi`
- Templates: pi-basic, pi-with-skills
- CLI: `node packages/cli/dist/bin/actant.js`

---

## Phase 1 鈥?Lifecycle

### Step 1: template list -f json 鈫?expect pi-basic in list
**Result:** PASS
(pi-basic and pi-with-skills present in JSON output)

### Step 2: agent create pi-test -t pi-basic -f json
**Result:** PASS
Created, backendType=pi. AGENTS.md and .pi\ dir verified.

### Step 3: agent status pi-test -f json
**Result:** PASS
status=created

### Step 4: agent resolve pi-test -f json
**Result:** PASS
command has node.exe, args has acp-bridge.js

### Step 5: agent destroy pi-test --force
**Result:** PASS
exit 0

### Step 6: Wait 1s, agent list -f json
**Result:** PASS
pi-test NOT in list (empty [])

---

## Phase 2 鈥?Builder

### Step 7: agent create pi-skill-test -t pi-with-skills -f json
**Result:** PASS
Created. AGENTS.md, .pi\skills\, .pi\prompts\ exist.

### Step 8: agent destroy pi-skill-test --force
**Result:** PASS
exit 0

---

## Phase 3 鈥?Communicator (real LLM)

### Step 9: agent create pi-run-test -t pi-basic -f json
**Result:** PASS
Created

### Step 10: agent run pi-run-test --prompt "Reply with exactly the text: HELLO_PI_TEST"
**Result:** PASS
Output: HELLO_PI_TEST

### Step 11: agent destroy pi-run-test --force
**Result:** PASS
exit 0

---

## Phase 4 鈥?ACP (real LLM)

### Step 12: agent create pi-acp-test -t pi-basic -f json
**Result:** PASS
Created

### Step 13: agent start pi-acp-test
**Result:** PASS
Started, exit 0

### Step 14: agent status pi-acp-test -f json
**Result:** PASS
status=running

### Step 15: agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO"
**Result:** WARN
Exit 0 but stdout was EMPTY. Expected AI response text.
**Exact output:** (empty)

### Step 16: agent stop pi-acp-test
**Result:** PASS
Stopped, exit 0

### Step 17: agent status pi-acp-test -f json
**Result:** PASS
status=stopped (after brief delay)

### Step 18: agent destroy pi-acp-test --force
**Result:** PASS
exit 0

---

## Phase 5 鈥?Error handling

### Step 19: agent create pi-err-test -t pi-basic -f json
**Result:** PASS
Created

### Step 20: agent prompt pi-err-test -m "hello"
**Result:** PASS
exit 1, error: [RPC -32603] Agent "pi-err-test" has no ACP connection. Start it first with `agent start`.

### Step 21: agent destroy pi-err-test --force
**Result:** PASS
exit 0

---

## Summary Table

| Step | Phase | Result |
|------|-------|--------|
| 1 | Lifecycle | PASS |
| 2 | Lifecycle | PASS |
| 3 | Lifecycle | PASS |
| 4 | Lifecycle | PASS |
| 5 | Lifecycle | PASS |
| 6 | Lifecycle | PASS |
| 7 | Builder | PASS |
| 8 | Builder | PASS |
| 9 | Communicator | PASS |
| 10 | Communicator | PASS |
| 11 | Communicator | PASS |
| 12 | ACP | PASS |
| 13 | ACP | PASS |
| 14 | ACP | PASS |
| 15 | ACP | WARN |
| 16 | ACP | PASS |
| 17 | ACP | PASS |
| 18 | ACP | PASS |
| 19 | Error handling | PASS |
| 20 | Error handling | PASS |
| 21 | Error handling | PASS |

**Totals:** 20 PASS, 1 WARN, 0 FAIL

---

## FAIL/WARN Steps with Exact Error Output

### WARN 鈥?Step 15
**Step:** agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO"
**Expected:** AI response text in stdout, exit 0
**Actual:** Exit 0, stdout empty
**Exact output:** (no text - empty stdout)
