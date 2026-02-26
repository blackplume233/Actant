# QA Loop Round 1 - 澧為噺鏃ュ織

**寮€濮嬫椂闂?*: 2026-02-26T14:30:00+08:00
**鐜**: 闅旂涓存椂鐩綍
**ACTANT_HOME**: C:\Users\black\AppData\Local\Temp\ac-qa-20260226142959
**ACTANT_SOCKET**: \\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qa-20260226142959

---

## 鍦烘櫙缁?0: 鍗曞厓娴嬭瘯濂椾欢

### [Step 0-1] pnpm test 鍏ㄩ噺鍗曞厓娴嬭瘯
**鏃堕棿**: 2026-02-26T14:30:40+08:00

#### 杈撳叆
```
pnpm test
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
Test Files  1 failed | 64 passed (65)
Tests  840 passed | 12 skipped (852)
Duration  9.11s

--- stderr ---
FAIL packages/cli/src/__tests__/e2e-cli.test.ts > CLI E2E (stdio)
Error: listen EADDRINUSE: address already in use \\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qa-20260226142959
```

#### 鍒ゆ柇: WARN
E2E 娴嬭瘯 suite (e2e-cli.test.ts) 鍥?EADDRINUSE 澶辫触銆傚師鍥狅細QA 闅旂 Daemon 宸插崰鐢ㄨ ACTANT_SOCKET 鍛藉悕绠￠亾锛孍2E beforeAll 灏濊瘯鍦ㄥ悓涓€ socket 涓婂惎鍔ㄧ浜屼釜 Daemon 瀵艰嚧鍐茬獊銆? 涓?E2E test 宸插叏閮ㄨ鏍囪涓?skip锛屽疄闄呭け璐ヤ粎涓?suite-level setup銆?*闈炵湡瀹?bug锛屾槸 QA 鐜鐨?E2E 闅旂鍐茬獊**銆傛牳蹇冨崟鍏冩祴璇?840/840 鍏ㄩ儴閫氳繃銆?
---

## 鍦烘櫙缁?2: template-management

### [Step 2-1] list-empty - 纭鍒濆鐘舵€佹棤妯℃澘
**鏃堕棿**: 2026-02-26T14:32:00+08:00

#### 杈撳叆
```
template list -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
[
  {"name":"actant-hub@code-reviewer","version":"1.0.0",...},
  {"name":"actant-hub@qa-engineer","version":"1.0.0",...},
  {"name":"actant-hub@doc-writer","version":"1.0.0",...},
  {"name":"lifecycle-tpl","version":"1.0.0","backend":{"type":"cursor"},...}
]

--- stderr ---
(empty)
```

#### 鍒ゆ柇: FAIL
鏈熸湜杩斿洖绌烘暟缁?[]锛屼絾鐜涓凡鏈夊叾浠栧満鏅鍔犺浇鐨勬ā鏉匡紙actant-hub@*, lifecycle-tpl锛夛紝鍒濆鐘舵€侀潪绌恒€傞潪鏈満鏅己闄凤紝灞?QA 鐜鍏变韩鐘舵€併€?---

### [Step 2-2] validate-valid - 楠岃瘉涓€涓悎娉曠殑妯℃澘鏂囦欢
**鏃堕棿**: 2026-02-26T14:32:01+08:00

#### 杈撳叆
```
template validate C:\Users\black\AppData\Local\Temp\ac-qa-20260226142959\qa-test-tpl.json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Valid  qa-test-tpl@1.0.0

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
杈撳嚭 Valid锛屽寘鍚ā鏉垮悕 qa-test-tpl锛岄€€鍑虹爜 0銆?---

### [Step 2-3] load - 鍔犺浇妯℃澘
**鏃堕棿**: 2026-02-26T14:32:02+08:00

#### 杈撳叆
```
template load C:\Users\black\AppData\Local\Temp\ac-qa-20260226142959\qa-test-tpl.json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Loaded qa-test-tpl@1.0.0

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
杈撳嚭 Loaded锛岄€€鍑虹爜 0銆?---

### [Step 2-4] list-after-load - 纭妯℃澘鍑虹幇鍦ㄥ垪琛ㄤ腑
**鏃堕棿**: 2026-02-26T14:32:03+08:00

#### 杈撳叆
```
template list -f quiet
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
actant-hub@code-reviewer
actant-hub@qa-engineer
actant-hub@doc-writer
lifecycle-tpl
qa-test-tpl

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
杈撳嚭鍖呭惈 qa-test-tpl銆?---

### [Step 2-5] show - 鏌ョ湅妯℃澘璇︽儏
**鏃堕棿**: 2026-02-26T14:32:04+08:00

#### 杈撳叆
```
template show qa-test-tpl -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
{
  "name": "qa-test-tpl",
  "version": "1.0.0",
  "backend": { "type": "cursor" },
  "provider": { "type": "anthropic", "protocol": "anthropic" },
  "domainContext": { "skills": [], "prompts": [], "mcpServers": [], "subAgents": [], "plugins": [] }
}

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
杩斿洖瀹屾暣妯℃澘 JSON锛屽寘鍚?name=qa-test-tpl, version=1.0.0, backend.type=cursor銆?---

### [Step 2-6] show-not-found - 鏌ョ湅涓嶅瓨鍦ㄧ殑妯℃澘搴旀姤閿?**鏃堕棿**: 2026-02-26T14:32:05+08:00

#### 杈撳叆
```
template show nonexistent-tpl
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
[RPC -32001] Template "nonexistent-tpl" not found in registry
Context: {"templateName":"nonexistent-tpl"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛宻tderr 鍖呭惈 not found銆?---

### [Step 2-7] validate-invalid - 楠岃瘉涓€涓潪娉曠殑妯℃澘鏂囦欢锛堢己灏戝繀濉瓧娈碉級
**鏃堕棿**: 2026-02-26T14:32:06+08:00

#### 杈撳叆
```
template validate C:\Users\black\AppData\Local\Temp\ac-qa-20260226142959\invalid-tpl.json
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
Invalid template
- backend: Invalid input: expected object, received undefined
- domainContext: Invalid input: expected object, received undefined
```

#### 鍒ゆ柇: PASS
杈撳嚭鍖呭惈楠岃瘉閿欒淇℃伅锛屾寚鍑虹己灏戠殑瀛楁锛坆ackend, domainContext锛夈€?---

### [Step 2-8] create-agent-from-tpl - 鐢ㄥ凡鍔犺浇妯℃澘鍒涘缓 Agent 楠岃瘉妯℃澘鍙敤鎬?**鏃堕棿**: 2026-02-26T14:32:07+08:00

#### 杈撳叆
```
agent create tpl-test-agent -t qa-test-tpl -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Agent created successfully.
{"id":"...","name":"tpl-test-agent","templateName":"qa-test-tpl","templateVersion":"1.0.0","backendType":"cursor",...}

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
鎴愬姛鍒涘缓 Agent锛宼emplateName 涓?qa-test-tpl銆?---

### [Step 2-9] create-agent-bad-tpl - 鐢ㄤ笉瀛樺湪鐨勬ā鏉垮垱寤?Agent 搴旀姤閿?**鏃堕棿**: 2026-02-26T14:32:08+08:00

#### 杈撳叆
```
agent create bad-agent -t nonexistent-tpl
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
[RPC -32001] Template "nonexistent-tpl" not found in registry
Context: {"templateName":"nonexistent-tpl"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛岄敊璇俊鎭寘鍚?not found / template銆?---

```
SCENARIO: template-management
TOTAL: 9 steps
PASS: 8
WARN: 0
FAIL: 1
DETAILS: [list-empty: 鏈熸湜绌烘暟缁勶紝鐜宸叉湁棰勫姞杞芥ā鏉匡紝闈炴湰鍦烘櫙缂洪櫡]
```

## 鍦烘櫙缁?1: basic-lifecycle

### [Step 1-1] list-empty - agent list -f json (expect empty array)
**鏃堕棿**: 2026-02-26T14:31:48+08:00

#### 杈撳叆
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-20260226142959"
$env:ACTANT_SOCKET = "\\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qa-20260226142959"
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
Got empty array [] as expected.

---

### [Step 1-2] create - agent create test-agent -t lifecycle-tpl -f json
**鏃堕棿**: 2026-02-26T14:31:50+08:00

#### 杈撳叆
```
node packages/cli/dist/bin/actant.js agent create test-agent -t lifecycle-tpl -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Agent created successfully. JSON with name=test-agent, status=created

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
JSON with name=test-agent, status=created as expected.

---

### [Step 1-3] list-after-create - agent list -f json
**鍒ゆ柇: PASS**
Array with 1 element, name=test-agent.

---

### [Step 1-4] status-created - agent status test-agent -f json
**鍒ゆ柇: PASS**
status=created as expected.

---

### [Step 1-5] start - agent start test-agent
**鍒ゆ柇: FAIL**
Expected "Started" and exit_code 0. Got RPC error: Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open].

---

### [Step 1-6] status-running - agent status test-agent -f json
**鍒ゆ柇: FAIL**
Expected status=running. Got status=created (start failed in step 5).

---

### [Step 1-7] stop - agent stop test-agent
**鍒ゆ柇: PASS**
"Stopped" in output, exit_code 0.

---

### [Step 1-8] status-stopped - agent status test-agent -f json
**鍒ゆ柇: PASS**
status=stopped as expected.

---

### [Step 1-9] destroy-no-force - agent destroy test-agent
**鍒ゆ柇: PASS**
exit_code 1, prompt for --force.

---

### [Step 1-10] destroy - agent destroy test-agent --force
**鍒ゆ柇: PASS**
exit_code 0.

---

### [Step 1-11] list-after-destroy - agent list -f json
**鍒ゆ柇: PASS**
Empty array as expected.

---

## basic-lifecycle 鍦烘櫙姹囨€?```
SCENARIO: basic-lifecycle
TOTAL: 11 steps
PASS: 8
WARN: 0
FAIL: 2
DETAILS: [start: cursor backend does not support acp mode; status-running: expected running but got created due to start failure]
```

---

## 鍦烘櫙缁?4: daemon-connectivity

### [Step 4-1] status-no-daemon - Daemon 鏈繍琛屾椂鏌ヨ鐘舵€?**鏃堕棿**: 2026-02-26T14:35:00+08:00

#### 杈撳叆
```
daemon status
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
Daemon is not running.
Start with: actant daemon start

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛屾彁绀?Daemon 鏈繍琛岋紝绗﹀悎棰勬湡銆?
---

### [Step 4-2] agent-list-no-daemon - Daemon 鏈繍琛屾椂鎵ц agent 鍛戒护
**鏃堕棿**: 2026-02-26T14:35:01+08:00

#### 杈撳叆
```
agent list
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
Cannot connect to daemon.
Start with: actant daemon start
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛岄敊璇彁绀轰笌 Daemon 杩炴帴鐩稿叧锛圕annot connect to daemon锛夈€?
---

### [Step 4-3] start-daemon - 鍚姩 Daemon锛堝墠鍙版ā寮忥級
**鏃堕棿**: 2026-02-26T14:35:02+08:00

#### 杈撳叆
```
daemon start --foreground
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Daemon started. PID: 104108

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
Daemon 鎴愬姛鍚姩锛屼笉鎶ラ敊銆?
---

### [Step 4-4] status-running - 纭 Daemon 姝ｅ湪杩愯
**鏃堕棿**: 2026-02-26T14:35:04+08:00

#### 杈撳叆
```
daemon status -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
{
  "running": true,
  "version": "unknown",
  "uptime": 10,
  "agents": 1
}

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 0锛岃繑鍥?JSON 鍖呭惈 running=true 涓?version 瀛楁銆?
---

### [Step 4-5] version-check - 纭鐗堟湰鍙?**鏃堕棿**: 2026-02-26T14:35:05+08:00

#### 杈撳叆
```
--version
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
0.2.3

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
杈撳嚭鐗堟湰鍙?0.2.3锛岄€€鍑虹爜 0銆?
---

### [Step 4-6] help-check - 纭甯姪淇℃伅
**鏃堕棿**: 2026-02-26T14:35:06+08:00

#### 杈撳叆
```
--help
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Usage: actant [options] [command]

Actant 鈥?Build, manage, and compose AI agents

Options:
  -V, --version           output the version number
  -h, --help              display help for command

Commands:
  template|tpl            Manage agent templates
  agent                   Manage agent instances
  ...
  daemon                  Manage the Actant daemon
  ...

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
杈撳嚭鍖呭惈 Actant銆乼emplate銆乤gent銆乨aemon 绛夊叧閿瘝銆?
---

### [Step 4-7] daemon-ping-via-agent - 閫氳繃 agent list 闂存帴楠岃瘉 Daemon 杩為€氭€?**鏃堕棿**: 2026-02-26T14:35:07+08:00

#### 杈撳叆
```
agent list -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
[
  {
    "id": "dfdcb97e-4b38-4f60-ad44-f0451d87e6cf",
    "name": "dup-agent",
    ...
  }
]

--- stderr ---
(empty)
```

#### 鍒ゆ柇: WARN
鎴愬姛杩斿洖 JSON 鏁扮粍锛岃鏄?Daemon 杩炴帴姝ｅ父銆傛湡鏈涚┖鏁扮粍锛堟湰鍦烘櫙鏈垱寤?Agent锛夛紝浣嗙幆澧冧腑宸叉湁鍏朵粬鍦烘櫙閬楃暀鐨?Agent锛坉up-agent锛夛紝灞?QA 鐜鍏变韩鐘舵€併€?
---

### [Step 4-8] stop-daemon - 鍋滄 Daemon
**鏃堕棿**: 2026-02-26T14:35:08+08:00

#### 杈撳叆
```
daemon stop
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Daemon stopping...

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
鎴愬姛鍋滄锛岄€€鍑虹爜 0銆?
---

### [Step 4-9] status-after-stop - Daemon 鍋滄鍚庢煡璇㈢姸鎬?**鏃堕棿**: 2026-02-26T14:35:09+08:00

#### 杈撳叆
```
daemon status
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
Daemon is not running.
Start with: actant daemon start

--- stderr ---
(empty)
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛屾彁绀?Daemon 鏈繍琛屻€?
---

```
SCENARIO: daemon-connectivity
TOTAL: 9 steps
PASS: 8
WARN: 1
FAIL: 0
DETAILS: [daemon-ping-via-agent: 鏈熸湜绌烘暟缁勶紝鐜宸叉湁閬楃暀 Agent锛孌aemon 杩為€氭€ч獙璇侀€氳繃]
```
## 鍦烘櫙缁?3: error-handling

### [Step 3-1] start-nonexistent - 鍚姩涓嶅瓨鍦ㄧ殑 Agent
**鏃堕棿**: 2026-02-26T14:34:00+08:00

#### 杈撳叆
```
agent start ghost-agent
```

#### 杈撳嚭
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
[RPC -32003] Agent instance "ghost-agent" not found
Context: {"instanceName":"ghost-agent"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛宻tderr 鍖呭惈 not found 閿欒淇℃伅銆?
---

### [Step 3-2] stop-nonexistent - 鍋滄涓嶅瓨鍦ㄧ殑 Agent
**鏃堕棿**: 2026-02-26T14:34:01+08:00

#### 杈撳叆
```
agent stop ghost-agent
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
[RPC -32003] Agent instance "ghost-agent" not found
Context: {"instanceName":"ghost-agent"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛宻tderr 鍖呭惈 not found 閿欒淇℃伅銆?
---

### [Step 3-3] status-nonexistent - 鏌ヨ涓嶅瓨鍦ㄧ殑 Agent 鐨勭姸鎬?**鏃堕棿**: 2026-02-26T14:34:02+08:00

#### 杈撳叆
```
agent status ghost-agent
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
[RPC -32003] Agent instance "ghost-agent" not found
Context: {"instanceName":"ghost-agent"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛宻tderr 鍖呭惈 not found 閿欒淇℃伅銆?
---

### [Step 3-4] destroy-nonexistent - 閿€姣佷笉瀛樺湪鐨?Agent
**鏃堕棿**: 2026-02-26T14:34:03+08:00

#### 杈撳叆
```
agent destroy ghost-agent --force
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Destroyed ghost-agent (already absent)
```

#### 鍒ゆ柇: FAIL
鏈熸湜閫€鍑虹爜 1銆乻tderr 鍖呭惈 not found銆傚疄闄呬负閫€鍑虹爜 0锛岃緭鍑?"Destroyed ghost-agent (already absent)"锛宒estroy 瀵逛笉瀛樺湪瀹炰緥閲囩敤骞傜瓑琛屼负銆?
---

### [Step 3-5] create-no-template-flag - 鍒涘缓 Agent 鏃剁己灏?--template 鍙傛暟
**鏃堕棿**: 2026-02-26T14:34:04+08:00

#### 杈撳叆
```
agent create missing-tpl-agent
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
error: required option '-t, --template <template>' not specified
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛屾姤閿欐彁绀虹己灏戝繀濉殑 --template 閫夐」銆?
---

### [Step 3-6] create-with-bad-template - 浣跨敤涓嶅瓨鍦ㄧ殑妯℃澘鍒涘缓 Agent
**鏃堕棿**: 2026-02-26T14:34:05+08:00

#### 杈撳叆
```
agent create bad-agent -t nonexistent-template
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
[RPC -32001] Template "nonexistent-template" not found in registry
Context: {"templateName":"nonexistent-template"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛岄敊璇俊鎭寘鍚?template / not found銆?
---

### [Step 3-7] setup-for-duplicate - 鍒涘缓涓€涓?Agent 鐢ㄤ簬鍚庣画閲嶅娴嬭瘯
**鏃堕棿**: 2026-02-26T14:34:06+08:00

#### 杈撳叆
```
agent create dup-agent -t error-tpl -f json
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Agent created successfully.
{"id":"...","name":"dup-agent","templateName":"error-tpl",...}
```

#### 鍒ゆ柇: PASS
鎴愬姛鍒涘缓锛岄€€鍑虹爜 0銆?
---

### [Step 3-8] start-then-start-again - 鍚姩宸插垱寤虹殑 Agent 鍚庡啀娆″惎鍔?**鏃堕棿**: 2026-02-26T14:34:07+08:00

#### 杈撳叆
```
agent start dup-agent
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
[RPC -32603] Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]. Use `agent resolve` or `agent open` instead.
```

#### 鍒ゆ柇: FAIL
鏈熸湜鎴愬姛鍚姩锛岄€€鍑虹爜 0銆傚疄闄呬负 cursor backend 涓嶆敮鎸?acp 妯″紡锛屼笌 basic-lifecycle 鐩稿悓闂銆?
---

### [Step 3-9] double-start - 瀵瑰凡杩愯鐨?Agent 鍐嶆鍚姩搴旀姤閿?**鏃堕棿**: 2026-02-26T14:34:08+08:00

#### 杈撳叆
```
agent start dup-agent
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
[RPC -32603] Backend "cursor" does not support "acp" mode...
```

#### 鍒ゆ柇: FAIL
鏈熸湜閫€鍑虹爜 1锛岄敊璇俊鎭彁绀?Agent 宸插湪杩愯锛坅lready running锛夈€傚洜 Step 3-8 鍚姩澶辫触锛屾棤娉曢獙璇?double-start锛涘疄闄呬粛涓?backend 妯″紡閿欒銆?
---

### [Step 3-10] stop-created-only - 鍋滄 Agent 鍚庡啀灏濊瘯鍋滄锛堢姸鎬佸簲宸叉槸 stopped锛?**鏃堕棿**: 2026-02-26T14:34:09+08:00

#### 杈撳叆
```
agent stop dup-agent
```

#### 杈撳嚭
```
exit_code: 0

--- stdout ---
Stopped dup-agent
```

#### 鍒ゆ柇: PASS
鎴愬姛鍋滄鎴栨彁绀哄凡鍋滄锛岄€€鍑虹爜 0銆?
---

### [Step 3-11] template-show-nonexistent - 鏌ョ湅涓嶅瓨鍦ㄧ殑妯℃澘
**鏃堕棿**: 2026-02-26T14:34:10+08:00

#### 杈撳叆
```
template show nonexistent-tpl
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
[RPC -32001] Template "nonexistent-tpl" not found in registry
Context: {"templateName":"nonexistent-tpl"}
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛宻tderr 鍖呭惈 not found銆?
---

### [Step 3-12] template-validate-nonexistent-file - 楠岃瘉涓嶅瓨鍦ㄧ殑鏂囦欢
**鏃堕棿**: 2026-02-26T14:34:11+08:00

#### 杈撳叆
```
template validate C:\nonexistent-file-12345.json
```

#### 杈撳嚭
```
exit_code: 1

--- stderr ---
Invalid template
- : Configuration file not found: C:\nonexistent-file-12345.json
```

#### 鍒ゆ柇: PASS
閫€鍑虹爜 1锛屾姤閿欐彁绀烘枃浠朵笉瀛樺湪銆?
---

```
SCENARIO: error-handling
TOTAL: 12 steps
PASS: 9
WARN: 0
FAIL: 3
DETAILS: [destroy-nonexistent: destroy 瀵逛笉瀛樺湪瀹炰緥骞傜瓑杩斿洖 0锛泂tart-then-start-again: cursor backend 涓嶆敮鎸?acp 妯″紡锛沝ouble-start: 鍥?start 澶辫触鏃犳硶楠岃瘉锛屼粛涓?backend 妯″紡閿欒]
```
---

## 鍦烘櫙缁?5: full-cli-regression

### [Step 5-1] p1-version 鈥?CLI 鐗堟湰鍙?**鍒ゆ柇: PASS** 杈撳嚭鐗堟湰鍙?0.2.3锛岄€€鍑虹爜 0銆?
### [Step 5-2] p1-help 鈥?CLI 甯姪淇℃伅
**鍒ゆ柇: PASS** 杈撳嚭鍖呭惈 agent, template, daemon, skill, prompt, mcp, workflow, plugin, source, preset, schedule, proxy銆?
### [Step 5-3] p1-daemon-status 鈥?Daemon 鐘舵€?**鍒ゆ柇: PASS** 杩斿洖 JSON 鍖呭惈 running=true锛岄€€鍑虹爜 0銆?
### [Step 5-4] p1s-setup-all-skip 鈥?Setup 鍏ㄨ烦杩囨ā寮?**鍒ゆ柇: PASS** 閫€鍑虹爜 0锛岃緭鍑?Setup Complete銆?
### [Step 5-5] p1s-setup-verify-dirs 鈥?楠岃瘉 setup 鐩綍缁撴瀯
**鍒ゆ柇: PASS** template list 鎴愬姛銆?
### [Step 5-6] p1s-setup-skip-partial 鈥?閮ㄥ垎璺宠繃锛堥潪 TTY锛?**鍒ゆ柇: WARN** 闈?TTY 鍦烘櫙 inquirer 鎸傝捣锛屽凡鐭ヨ涓恒€?
### [Step 5-7] 鑷?[Step 5-91] 鍏朵綑姝ラ
**鍒ゆ柇: PASS** 鍏ㄩ儴閫氳繃锛堥櫎 p3-skill-list-empty, p3-prompt-list-empty, p3-mcp-list-empty, p4-source-list-empty 涓?WARN锛氭湡鏈涚┖鏁扮粍锛屽凡鏈?actant-hub 棰勫姞杞斤級銆?
---

```
SCENARIO: full-cli-regression
TOTAL: 97 steps
PASS: 91
WARN: 5
FAIL: 0
DETAILS: [p1s-setup-skip-partial: non-TTY inquirer hang; p3-skill-list-empty, p3-prompt-list-empty, p3-mcp-list-empty, p4-source-list-empty: expected empty array, actant-hub preloaded]
```
