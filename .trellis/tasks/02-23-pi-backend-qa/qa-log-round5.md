# Pi Backend Comprehensive QA 鈥?Round 5

**Date:** 2026-02-23  
**Environment:**
- Working directory: `g:\Workspace\AgentWorkSpace\AgentCraft`
- KIMI_API_KEY, PI_PROVIDER=kimi-coding, PI_MODEL=k2p5 set
- ACTANT_HOME=C:\Users\black\AppData\Local\Temp\actant-qa-pi-225745
- ACTANT_SOCKET=\\.\pipe\actant-qa-pi
- CLI: `node packages/cli/dist/bin/actant.js`
- Templates: pi-basic, pi-with-skills loaded

---

## Phase 1: Basic lifecycle

### Step 1: `template list -f json` 鈫?pi-basic in list
**Verdict:** PASS

**stdout (excerpt):**
```json
[..., {"name": "pi-basic", "version": "1.0.0", "backend": {"type": "pi", ...}}, {"name": "pi-with-skills", ...}]
```

---

### Step 2: `agent create pi-test -t pi-basic -f json`
**Verdict:** PASS 鈥?created, backendType=pi, AGENTS.md and .pi\ present

**stdout:**
```
Agent created successfully.
{"id":"37c430d0-fb71-4c62-b517-17b10dddafc3","name":"pi-test","templateName":"pi-basic","templateVersion":"1.0.0","backendType":"pi","backendConfig":{"provider":"kimi-coding","model":"k2p5"},"status":"created",...}
```

---

### Step 3: `agent status pi-test -f json`
**Verdict:** PASS 鈥?status=created

**stdout:**
```
{"id":"37c430d0-fb71-4c62-b517-17b10dddafc3","name":"pi-test","status":"created",...}
```

---

### Step 4: `agent resolve pi-test -f json`
**Verdict:** PASS 鈥?command has node, args has acp-bridge

**stdout:**
```
{"workspaceDir":"C:\\Users\\black\\AppData\\Local\\Temp\\actant-qa-pi-225745\\instances\\pi-test","command":"C:\\Program Files\\nodejs\\node.exe","args":["G:\\Workspace\\AgentWorkSpace\\AgentCraft\\packages\\pi\\dist\\acp-bridge.js"],...}
```

---

### Step 5: `agent destroy pi-test --force`
**Verdict:** PASS

**stdout:** `Destroyed pi-test`

---

### Step 6: Wait 1s. `agent list -f json`
**Verdict:** PASS 鈥?pi-test NOT in list

**stdout:** `[]`

---

## Phase 2: Skills template

### Step 7: `agent create pi-skill-test -t pi-with-skills -f json`
**Verdict:** PASS 鈥?AGENTS.md, .pi\skills\, .pi\prompts\ present

**stdout:**
```
Agent created successfully.
{"id":"c485271b-547b-4092-935c-94e1b678ad68","name":"pi-skill-test","templateName":"pi-with-skills","backendType":"pi",...}
```

---

### Step 8: `agent destroy pi-skill-test --force`
**Verdict:** PASS

**stdout:** `Destroyed pi-skill-test`

---

## Phase 3: Direct run

### Step 9: `agent create pi-run-test -t pi-basic -f json`
**Verdict:** PASS

---

### Step 10: `agent run pi-run-test --prompt "Reply with exactly the text: HELLO_PI_TEST"`
**Verdict:** PASS 鈥?non-empty response, exit 0

**stdout:**
```
HELLO_PI_TEST
```

---

### Step 11: `agent destroy pi-run-test --force`
**Verdict:** PASS

**stdout:** `Destroyed pi-run-test`

---

## Phase 4: ACP start/prompt/stop

### Steps 12-18
**Verdict:** All PASS 鈥?create, start, status=running, prompt (ACP_HELLO), stop, status=stopped, destroy

---

## Phase 5: Error case

### Step 19: `agent create pi-err-test -t pi-basic -f json`
**Verdict:** PASS

---

### Step 20: `agent prompt pi-err-test -m "hello"`
**Verdict:** PASS 鈥?exit 1, error as expected

**stderr:**
```
[RPC -32603] Agent "pi-err-test" has no ACP connection. Start it first with `agent start`.
```

---

### Step 21: `agent destroy pi-err-test --force`
**Verdict:** PASS

---

## Summary

| Metric | Count |
|--------|-------|
| Total | 21 |
| PASS | 21 |
| WARN | 0 |
| FAIL | 0 |

**Result:** All 21 steps passed. Pi backend comprehensive QA Round 5 complete.
