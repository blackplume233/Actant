# QA 鏃ュ織 Round 1 鈥?Pi Backend 鍏ㄩ摼璺獙璇?
**鍦烘櫙**: pi-backend-comprehensive
**鐜**: Real (kimi-coding / k2p5)
**寮€濮嬫椂闂?*: 2026-02-23

---

### [Step 1] template list 鈥?expect pi-basic in list
**Time**: 2026-02-23T14:59:17Z

#### Input
``````
node packages/cli/dist/bin/actant.js template list -f json
``````

#### Output
``````
exit_code: 0

--- stdout ---
pi-basic and pi-with-skills present in JSON array

--- stderr ---
(empty)
``````

#### Judgment: PASS
pi-basic and pi-with-skills present in template list.

---

### [Step 2] agent create pi-test 鈥?expect name=pi-test, status=created
**Time**: 2026-02-23T14:59:19Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent create pi-test -t pi-basic -f json
``````

#### Output
``````
exit_code: 0

--- stdout ---
Agent created successfully. name=pi-test, status=created

--- stderr ---
(empty)
``````

#### Artifacts
``````
Test-Path instances/pi-test: True
Test-Path instances/pi-test/AGENTS.md: True
Test-Path instances/pi-test/.pi: True
``````

#### Judgment: PASS
Agent created, instance dir has AGENTS.md and .pi/.

---

### [Step 3] agent status pi-test 鈥?expect status=created, backendType=pi
**Time**: 2026-02-23T14:59:20Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent status pi-test -f json
``````

#### Output
``````
exit_code: 0, status=created, backendType=pi

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 4] agent resolve pi-test 鈥?expect command contains pi-acp-bridge
**Time**: 2026-02-23T14:59:21Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent resolve pi-test -f json
``````

#### Output
``````
exit_code: 0, command=pi-acp-bridge.cmd

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 5] agent destroy pi-test 鈥?expect exit 0
**Time**: 2026-02-23T14:59:22Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent destroy pi-test --force
``````

#### Output
``````
exit_code: 0, stdout: Destroyed pi-test

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 6] agent list 鈥?expect pi-test NOT in list
**Time**: 2026-02-23T14:59:23Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent list -f json
``````

#### Output
``````
exit_code: 0, stdout: []

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 7] agent create pi-skill-test 鈥?expect created
**Time**: 2026-02-23T14:59:24Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent create pi-skill-test -t pi-with-skills -f json
``````

#### Output
``````
exit_code: 1

--- stderr ---
[RPC -32006] Skill "coding-assistant" not found in registry
``````

#### Judgment: FAIL
pi-with-skills template references skill "coding-assistant" not in registry.

---

### [Step 8] agent destroy pi-skill-test 鈥?expect exit 0
**Time**: 2026-02-23T14:59:25Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent destroy pi-skill-test --force
``````

#### Output
``````
exit_code: 0, stdout: Destroyed pi-skill-test

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 9] agent create pi-run-test 鈥?expect created
**Time**: 2026-02-23T14:59:31Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent create pi-run-test -t pi-basic -f json
``````

#### Output
``````
exit_code: 0, name=pi-run-test, status=created

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 10] agent run pi-run-test 鈥?expect AI response, exit 0
**Time**: 2026-02-23T14:59:33Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent run pi-run-test --prompt "Reply with exactly the text: HELLO_PI_TEST"
``````
Note: Scenario specified -p; CLI requires --prompt.

#### Output
``````
exit_code: 0, stdout: HELLO_PI_TEST

--- stderr ---
(empty)
``````

#### Judgment: PASS
Real LLM call succeeded.

---

### [Step 11] agent destroy pi-run-test 鈥?expect exit 0
**Time**: 2026-02-23T14:59:35Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent destroy pi-run-test --force
``````

#### Output
``````
exit_code: 0, stdout: Destroyed pi-run-test

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 12] agent create pi-acp-test 鈥?expect created
**Time**: 2026-02-23T14:59:40Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent create pi-acp-test -t pi-basic -f json
``````

#### Output
``````
exit_code: 0, name=pi-acp-test, status=created

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 13] agent start pi-acp-test 鈥?expect Started, exit 0
**Time**: 2026-02-23T14:59:41Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent start pi-acp-test
``````

#### Output
``````
exit_code: 1

--- stderr ---
[RPC -32603] spawn EINVAL
``````

#### Judgment: FAIL
spawn EINVAL when starting pi-acp-bridge (Windows spawn issue).

---

### [Step 14] agent status pi-acp-test 鈥?expect status=running, pid exists
**Time**: 2026-02-23T14:59:42Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent status pi-acp-test -f json
``````

#### Output
``````
exit_code: 0, status=error (not running)

--- stderr ---
(empty)
``````

#### Judgment: FAIL
Cascade from step 13.

---

### [Step 15] agent prompt pi-acp-test 鈥?expect AI response, exit 0
**Time**: 2026-02-23T14:59:43Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO"
``````

#### Output
``````
exit_code: 1

--- stderr ---
[RPC -32603] Agent "pi-acp-test" has no ACP connection. Start it first with agent start.
``````

#### Judgment: FAIL
Cascade from step 13.

---

### [Step 16] agent stop pi-acp-test 鈥?expect Stopped, exit 0
**Time**: 2026-02-23T14:59:44Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent stop pi-acp-test
``````

#### Output
``````
exit_code: 0, stdout: Stopped pi-acp-test

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 17] agent status pi-acp-test 鈥?expect status=stopped
**Time**: 2026-02-23T14:59:45Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent status pi-acp-test -f json
``````

#### Output
``````
exit_code: 0, status=stopped

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 18] agent destroy pi-acp-test 鈥?expect exit 0
**Time**: 2026-02-23T14:59:46Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent destroy pi-acp-test --force
``````

#### Output
``````
exit_code: 0, stdout: Destroyed pi-acp-test

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 19] agent create pi-err-test 鈥?expect created
**Time**: 2026-02-23T14:59:49Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent create pi-err-test -t pi-basic -f json
``````

#### Output
``````
exit_code: 0, name=pi-err-test, status=created

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

### [Step 20] agent prompt pi-err-test 鈥?expect exit != 0, ACP error
**Time**: 2026-02-23T14:59:50Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent prompt pi-err-test -m "hello"
``````

#### Output
``````
exit_code: 1

--- stderr ---
[RPC -32603] Agent "pi-err-test" has no ACP connection. Start it first with agent start.
``````

#### Judgment: PASS
Error about ACP connection as expected.

---

### [Step 21] agent destroy pi-err-test 鈥?expect exit 0
**Time**: 2026-02-23T14:59:51Z

#### Input
``````
node packages/cli/dist/bin/actant.js agent destroy pi-err-test --force
``````

#### Output
``````
exit_code: 0, stdout: Destroyed pi-err-test

--- stderr ---
(empty)
``````

#### Judgment: PASS

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total steps | 21 |
| PASS | 17 |
| WARN | 0 |
| FAIL | 4 |

### Failed steps
- **Step 7**: pi-with-skills template references skill "coding-assistant" not in registry
- **Step 13**: spawn EINVAL when starting pi-acp-bridge (Windows spawn issue)
- **Step 14**: status=error (cascade from step 13)
- **Step 15**: No ACP connection (cascade from step 13)

### Notes
- CLI uses --prompt for agent run, not -p
- CLI uses -m/--message for agent prompt, not -p
- ACP bridge start fails with spawn EINVAL on Windows; direct run (step 10) works
