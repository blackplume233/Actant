# QA Log - pi-backend-comprehensive Round 1

**Scenario**: pi-backend-comprehensive
**Environment**: ACTANT_HOME=C:\Users\black\AppData\Local\Temp\tmp9A33.tmp, ACTANT_SOCKET=\\.\pipe\actant-qa-pi-WhkbUjJK
**Time**: 2026-02-23

---

### [Step 1] template list -f json
#### Input
node actant.js template list -f json
#### Output
exit_code: 0
--- stdout ---
Templates include pi-basic and pi-with-skills
--- stderr ---
(empty)
#### Judgment: PASS
Template list includes pi-basic and pi-with-skills as expected.

---

### [Step 2] agent create pi-test -t pi-basic -f json
#### Input
node actant.js agent create pi-test -t pi-basic -f json
#### Output
exit_code: 0
--- stdout ---
Agent created successfully. name=pi-test, status=created, backendType=pi
--- stderr ---
(empty)
#### Judgment: PASS
Agent created with name=pi-test, status=created, backendType=pi.

---

### [Step 3] agent status pi-test -f json
#### Input
node actant.js agent status pi-test -f json
#### Output
exit_code: 0
--- stdout ---
status=created, backendType=pi
--- stderr ---
(empty)
#### Judgment: PASS
status=created, backendType=pi as expected.

---

### [Step 4] agent resolve pi-test -f json (expect FAIL)
#### Input
node actant.js agent resolve pi-test -f json
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32603] Backend "pi" does not support "resolve" mode. Supported modes: [acp]. Use agent start or agent run instead.
#### Judgment: PASS
Exit code != 0. Error message correctly states Pi does not support resolve mode.

---

### [Step 5] agent status pi-test -f json (workspace check)
#### Input
node actant.js agent status pi-test -f json
#### Output
exit_code: 0
--- stdout ---
status=created, backendType=pi
--- stderr ---
(empty)
#### Artifacts
AGENTS.md exists, .pi/ exists
#### Judgment: PASS
Workspace exists with AGENTS.md and .pi/ directory.

---

### [Step 6] agent destroy pi-test --force
#### Input
node actant.js agent destroy pi-test --force
#### Output
exit_code: 0
--- stdout ---
Destroyed pi-test
--- stderr ---
(empty)
#### Judgment: PASS
Agent destroyed successfully.

---

### [Step 7] agent list -f json
#### Input
node actant.js agent list -f json
#### Output
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
#### Judgment: PASS
List is empty, pi-test not present.

---

### [Step 8] agent create pi-skill-test -t pi-with-skills -f json
#### Input
node actant.js agent create pi-skill-test -t pi-with-skills -f json
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32006] Skill "coding-assistant" not found in registry. Context: componentType=Skill, componentName=coding-assistant
#### Judgment: FAIL
Expected successful creation. Template pi-with-skills references skill "coding-assistant" which is not in the skill registry.

---

### [Step 9] agent status pi-skill-test -f json
#### Input
node actant.js agent status pi-skill-test -f json
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32003] Agent instance "pi-skill-test" not found
#### Judgment: FAIL
Cascading failure from Step 8.

---

### [Step 10] agent status pi-skill-test -f json (.pi dir check)
#### Input
node actant.js agent status pi-skill-test -f json
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32003] Agent instance "pi-skill-test" not found
#### Judgment: FAIL
Cascading failure from Step 8.

---

### [Step 11] agent destroy pi-skill-test --force
#### Input
node actant.js agent destroy pi-skill-test --force
#### Output
exit_code: 0
--- stdout ---
Destroyed pi-skill-test
--- stderr ---
(empty)
#### Judgment: PASS
Destroy succeeded (idempotent).

---

### [Step 12] agent create pi-run-test -t pi-basic -f json
#### Input
node actant.js agent create pi-run-test -t pi-basic -f json
#### Output
exit_code: 0
--- stdout ---
Agent created successfully.
--- stderr ---
(empty)
#### Judgment: PASS
Agent created successfully.

---

### [Step 13] agent run pi-run-test --prompt "Reply with exactly: HELLO_PI_TEST"
#### Input
node actant.js agent run pi-run-test --prompt "Reply with exactly: HELLO_PI_TEST"
#### Output
exit_code: 0
--- stdout ---
HELLO_PI_TEST
--- stderr ---
(empty)
#### Judgment: PASS
LLM returned exactly HELLO_PI_TEST as requested.

---

### [Step 14] agent destroy pi-run-test --force
#### Input
node actant.js agent destroy pi-run-test --force
#### Output
exit_code: 0
--- stdout ---
Destroyed pi-run-test
--- stderr ---
(empty)
#### Judgment: PASS
Agent destroyed successfully.

---

### [Step 15] agent create pi-acp-test -t pi-basic -f json
#### Input
node actant.js agent create pi-acp-test -t pi-basic -f json
#### Output
exit_code: 0
--- stdout ---
Agent created successfully.
--- stderr ---
(empty)
#### Judgment: PASS
Agent created successfully.

---

### [Step 16] agent start pi-acp-test
#### Input
node actant.js agent start pi-acp-test
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32603] spawn EINVAL
#### Judgment: FAIL
Expected successful start. Got spawn EINVAL - likely Windows-specific failure when spawning Pi ACP bridge subprocess.

---

### [Step 17] agent status pi-acp-test -f json
#### Input
node actant.js agent status pi-acp-test -f json
#### Output
exit_code: 0
--- stdout ---
status=error (expected running)
--- stderr ---
(empty)
#### Judgment: FAIL
Expected status=running. Got status=error due to Step 16 failure.

---

### [Step 18] agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO"
#### Input
node actant.js agent prompt pi-acp-test -m "Reply with exactly: ACP_HELLO"
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32603] Agent "pi-acp-test" has no ACP connection. Start it first with agent start.
#### Judgment: FAIL
Cascading failure from Step 16 - agent never started.

---

### [Step 19] agent stop pi-acp-test
#### Input
node actant.js agent stop pi-acp-test
#### Output
exit_code: 0
--- stdout ---
Stopped pi-acp-test
--- stderr ---
(empty)
#### Judgment: PASS
Stop succeeded.

---

### [Step 20] agent status pi-acp-test -f json
#### Input
node actant.js agent status pi-acp-test -f json
#### Output
exit_code: 0
--- stdout ---
status=stopped
--- stderr ---
(empty)
#### Judgment: PASS
status=stopped as expected.

---

### [Step 21] agent destroy pi-acp-test --force
#### Input
node actant.js agent destroy pi-acp-test --force
#### Output
exit_code: 0
--- stdout ---
Destroyed pi-acp-test
--- stderr ---
(empty)
#### Judgment: PASS
Agent destroyed successfully.

---

### [Step 22] agent create pi-err-test -t pi-basic -f json
#### Input
node actant.js agent create pi-err-test -t pi-basic -f json
#### Output
exit_code: 0
--- stdout ---
Agent created successfully.
--- stderr ---
(empty)
#### Judgment: PASS
Agent created successfully.

---

### [Step 23] agent prompt pi-err-test -m "hello" (expect fail - not started)
#### Input
node actant.js agent prompt pi-err-test -m "hello"
#### Output
exit_code: 1
--- stdout ---
(empty)
--- stderr ---
[RPC -32603] Agent "pi-err-test" has no ACP connection. Start it first with agent start.
#### Judgment: PASS
Expected failure. Error correctly states agent has no ACP connection.

---

### [Step 24] agent destroy pi-err-test --force
#### Input
node actant.js agent destroy pi-err-test --force
#### Output
exit_code: 0
--- stdout ---
Destroyed pi-err-test
--- stderr ---
(empty)
#### Judgment: PASS
Agent destroyed successfully.

---

## Summary

| Result | Count |
|--------|-------|
| PASS  | 18    |
| WARN  | 0     |
| FAIL  | 6     |

### FAIL Steps (with error details)

- **Step 8**: [RPC -32006] Skill "coding-assistant" not found in registry. Template pi-with-skills requires this skill.
- **Step 9**: [RPC -32003] Agent instance "pi-skill-test" not found. Cascading from Step 8.
- **Step 10**: [RPC -32003] Agent instance "pi-skill-test" not found. Cascading from Step 8.
- **Step 16**: [RPC -32603] spawn EINVAL. Pi ACP bridge subprocess spawn fails on Windows.
- **Step 17**: status=error instead of running. Cascading from Step 16.
- **Step 18**: [RPC -32603] Agent has no ACP connection. Cascading from Step 16.
