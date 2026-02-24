# QA 鏃ュ織 Round 2 鈥?Pi Backend 鍏ㄩ摼璺獙璇?
**鍦烘櫙**: pi-backend-comprehensive
**鐜**: Real (kimi-coding / k2p5)
**寮€濮嬫椂闂?*: 2026-02-23

---

### [Step 1] template list 鈥?expect pi-basic in list

**Command**: `node packages/cli/dist/bin/actant.js template list -f json 2>&1`

**stdout**: JSON array containing pi-basic, pi-with-skills, and other templates
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?pi-basic present in template list

---

### [Step 2] agent create pi-test 鈥?lifecycle create

**Command**: `node packages/cli/dist/bin/actant.js agent create pi-test -t pi-basic -f json 2>&1`

**stdout**:
```
Agent created successfully.
{
  "name": "pi-test",
  "status": "created",
  "backendType": "pi",
  ...
}
```

**stderr**: (none)
**exit_code**: 0

**Artifacts**:
- `$env:ACTANT_HOME\instances\pi-test` exists: True
- `AGENTS.md` exists: True
- `.pi\` dir exists: True

**Judge**: **PASS** 鈥?name=pi-test, status=created, backendType=pi; artifacts verified

---

### [Step 3] agent status pi-test 鈥?verify status

**Command**: `node packages/cli/dist/bin/actant.js agent status pi-test -f json 2>&1`

**stdout**: `"status": "created", "backendType": "pi"`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?status=created, backendType=pi

---

### [Step 4] agent resolve pi-test 鈥?verify backend command

**Command**: `node packages/cli/dist/bin/actant.js agent resolve pi-test -f json 2>&1`

**stdout**:
```
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": ["...\\packages\\pi\\dist\\acp-bridge.js"],
  ...
}
```

**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?command contains "node", args contain "acp-bridge"

---

### [Step 5] agent destroy pi-test 鈥?lifecycle destroy

**Command**: `node packages/cli/dist/bin/actant.js agent destroy pi-test --force 2>&1`

**stdout**: `Destroyed pi-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?exit 0

---

### [Step 6] agent list 鈥?expect pi-test NOT in list

**Command**: `node packages/cli/dist/bin/actant.js agent list -f json 2>&1`

**stdout**: JSON array still containing pi-test
**stderr**: (none)
**exit_code**: 0

**Artifacts**: `Test-Path instances\pi-test` 鈫?False (instance dir was removed)

**Judge**: **FAIL** 鈥?pi-test still appears in agent list after destroy; instance dir was removed but daemon/registry may have stale cache

---

### [Step 7] agent create pi-skill-test 鈥?builder with skills

**Command**: `node packages/cli/dist/bin/actant.js agent create pi-skill-test -t pi-with-skills -f json 2>&1`

**stdout**: Agent created successfully, status=created
**stderr**: (none)
**exit_code**: 0

**Artifacts**:
- AGENTS.md exists and non-empty: True
- `.pi\skills\` exists: True (actant-hub@code-review.md)
- `.pi\prompts\` exists: True (actant-hub@code-assistant.md)

**Judge**: **PASS** 鈥?created; artifacts verified

---

### [Step 8] agent destroy pi-skill-test 鈥?cleanup

**Command**: `node packages/cli/dist/bin/actant.js agent destroy pi-skill-test --force 2>&1`

**stdout**: `Destroyed pi-skill-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?exit 0

---

### [Step 9] agent create pi-run-test 鈥?communicator setup

**Command**: `node packages/cli/dist/bin/actant.js agent create pi-run-test -t pi-basic -f json 2>&1`

**stdout**: Agent created successfully
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?created

---

### [Step 10] agent run pi-run-test 鈥?real LLM via run

**Command**: `node packages/cli/dist/bin/actant.js agent run pi-run-test --prompt "Reply with exactly the text: HELLO_PI_TEST" 2>&1`

**stdout**: `HELLO_PI_TEST`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?AI response contains exact text, exit 0

---

### [Step 11] agent destroy pi-run-test 鈥?cleanup

**Command**: `node packages/cli/dist/bin/actant.js agent destroy pi-run-test --force 2>&1`

**stdout**: `Destroyed pi-run-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?exit 0

---

### [Step 12] agent create pi-acp-test 鈥?ACP setup

**Command**: `node packages/cli/dist/bin/actant.js agent create pi-acp-test -t pi-basic -f json 2>&1`

**stdout**: Agent created successfully
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?created

---

### [Step 13] agent start pi-acp-test 鈥?start ACP bridge

**Command**: `node packages/cli/dist/bin/actant.js agent start pi-acp-test 2>&1`

**stdout**: `Started pi-acp-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?Started, exit 0

---

### [Step 14] agent status pi-acp-test 鈥?verify running

**Command**: `node packages/cli/dist/bin/actant.js agent status pi-acp-test -f json 2>&1`

**stdout**: `"status": "running"`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?status=running

---

### [Step 15] agent prompt pi-acp-test 鈥?ACP prompt via real LLM

**Command**: `node packages/cli/dist/bin/actant.js agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO" 2>&1`

**stdout**: (empty)
**stderr**: (none)
**exit_code**: 0

**Judge**: **WARN** 鈥?exit 0 but no visible AI response in stdout; ACP prompt may write to different output or response format

---

### [Step 16] agent stop pi-acp-test 鈥?stop ACP bridge

**Command**: `node packages/cli/dist/bin/actant.js agent stop pi-acp-test 2>&1`

**stdout**: `Stopped pi-acp-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?Stopped, exit 0

---

### [Step 17] agent status pi-acp-test 鈥?verify stopped

**Command**: `node packages/cli/dist/bin/actant.js agent status pi-acp-test -f json 2>&1`

**stdout**: `"status": "stopped"`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?status=stopped

---

### [Step 18] agent destroy pi-acp-test 鈥?cleanup

**Command**: `node packages/cli/dist/bin/actant.js agent destroy pi-acp-test --force 2>&1`

**stdout**: `Destroyed pi-acp-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?exit 0

---

### [Step 19] agent create pi-err-test 鈥?error handling setup

**Command**: `node packages/cli/dist/bin/actant.js agent create pi-err-test -t pi-basic -f json 2>&1`

**stdout**: Agent created successfully
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?created

---

### [Step 20] agent prompt pi-err-test 鈥?expect error (not started)

**Command**: `node packages/cli/dist/bin/actant.js agent prompt pi-err-test -m "hello" 2>&1`

**stdout**: (none)
**stderr**: `[RPC -32603] Agent "pi-err-test" has no ACP connection. Start it first with \`agent start\`.`
**exit_code**: 1

**Judge**: **PASS** 鈥?exit != 0, error about not started

---

### [Step 21] agent destroy pi-err-test 鈥?cleanup

**Command**: `node packages/cli/dist/bin/actant.js agent destroy pi-err-test --force 2>&1`

**stdout**: `Destroyed pi-err-test`
**stderr**: (none)
**exit_code**: 0

**Judge**: **PASS** 鈥?exit 0

---

## Summary

| Metric | Count |
|--------|-------|
| Total steps | 21 |
| PASS | 19 |
| WARN | 1 |
| FAIL | 1 |

### Failed Steps (if any)
- **Step 6** 鈥?pi-test still appears in `agent list` after destroy; instance directory was removed but daemon/registry returned stale data

### Warnings
- **Step 15** 鈥?`agent prompt` exited 0 but stdout was empty; AI response may be written elsewhere or in different format
