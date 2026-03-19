# QA Alpha Round 1 - 随机漫步深度测试日志

**开始时间**: 2026-02-28T17:52:30+08:00
**环境**: QA Alpha 持久化 (mock launcher)
**Socket**: \\.\pipe\actant-qa-alpha
**ACTANT_HOME**: .trellis/qa-alpha/home

---

## Group 1: Daemon + 基础设施 (10 steps)

### [Step 1] daemon-ping
```
$ node packages/cli/dist/bin/actant.js daemon status -f json
exit_code: 0
--- stdout ---
{"running":true,"version":"0.2.3","uptime":103,"agents":0}
--- stderr ---
(empty)
```
#### Judgment: PASS
running=true, version present.

### [Step 2] version-check
```
$ node packages/cli/dist/bin/actant.js --version
exit_code: 0
--- stdout ---
0.2.3
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 3] help-check
```
$ node packages/cli/dist/bin/actant.js --help
exit_code: 0
--- stdout ---
Usage: actant [options] [command]
Commands: template|tpl, agent, skill, prompt, mcp, workflow, plugin, source, preset, schedule, daemon, proxy, help, self-update, setup, dashboard, api, internal
--- stderr ---
(empty)
```
#### Judgment: PASS
All subcommands present.

### [Step 4] template-list
```
$ node packages/cli/dist/bin/actant.js template list -f json
exit_code: 0
--- stdout ---
[{"name":"rw-basic-tpl",...},{"name":"rw-claude-tpl",...}]
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 5] agent-list-empty
```
$ node packages/cli/dist/bin/actant.js agent list -f json
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 6] skill-list
```
$ node packages/cli/dist/bin/actant.js skill list -f json
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 7] prompt-list
```
$ node packages/cli/dist/bin/actant.js prompt list -f json
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 8] mcp-list
```
$ node packages/cli/dist/bin/actant.js mcp list -f json
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 9] workflow-list
```
$ node packages/cli/dist/bin/actant.js workflow list -f json
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
```
#### Judgment: PASS

### [Step 10] plugin-list
```
$ node packages/cli/dist/bin/actant.js plugin list -f json
exit_code: 0
--- stdout ---
[]
--- stderr ---
(empty)
```
#### Judgment: PASS

---

## Group 2: 错误处理边界测试 (15 steps)

### [Step 11] start-nonexistent
```
$ node packages/cli/dist/bin/actant.js agent start ghost-agent-99
exit_code: 1
--- stderr ---
[RPC -32003] Agent instance "ghost-agent-99" not found
```
#### Judgment: PASS

### [Step 12] stop-nonexistent
```
$ node packages/cli/dist/bin/actant.js agent stop ghost-agent-99
exit_code: 1
--- stderr ---
[RPC -32003] Agent instance "ghost-agent-99" not found
```
#### Judgment: PASS

### [Step 13] status-nonexistent
```
$ node packages/cli/dist/bin/actant.js agent status ghost-agent-99
exit_code: 1
--- stderr ---
[RPC -32003] Agent instance "ghost-agent-99" not found
```
#### Judgment: PASS

### [Step 14] destroy-nonexistent-force
```
$ node packages/cli/dist/bin/actant.js agent destroy ghost-agent-99 --force
exit_code: 0
--- stdout ---
Destroyed ghost-agent-99 (already absent)
```
#### Judgment: PASS
--force is idempotent.

### [Step 15] create-no-template
```
$ node packages/cli/dist/bin/actant.js agent create no-tpl-agent-99
exit_code: 1
--- stderr ---
error: required option '-t, --template <template>' not specified
```
#### Judgment: PASS

### [Step 16] create-bad-template
```
$ node packages/cli/dist/bin/actant.js agent create bad-agent-99 -t nonexistent-template-xyz
exit_code: 1
--- stderr ---
[RPC -32001] Template "nonexistent-template-xyz" not found in registry
```
#### Judgment: PASS

### [Step 17] template-show-nonexistent
```
$ node packages/cli/dist/bin/actant.js template show nonexistent-tpl-xyz
exit_code: 1
--- stderr ---
[RPC -32001] Template "nonexistent-tpl-xyz" not found in registry
```
#### Judgment: PASS

### [Step 18] template-validate-nofile
```
$ node packages/cli/dist/bin/actant.js template validate C:\tmp\this-file-does-not-exist-12345.json
exit_code: 1
--- stderr ---
Invalid template - Configuration file not found
```
#### Judgment: PASS

### [Step 19] skill-show-nonexistent
```
$ node packages/cli/dist/bin/actant.js skill show nonexistent-skill-xyz
exit_code: 1
--- stderr ---
[RPC -32000] Configuration file not found: Skill "nonexistent-skill-xyz" not found
```
#### Judgment: PASS

### [Step 20] prompt-show-nonexistent
```
$ node packages/cli/dist/bin/actant.js prompt show nonexistent-prompt-xyz
exit_code: 1
--- stderr ---
[RPC -32000] Configuration file not found: Prompt "nonexistent-prompt-xyz" not found
```
#### Judgment: PASS

### [Step 21] mcp-show-nonexistent
```
$ node packages/cli/dist/bin/actant.js mcp show nonexistent-mcp-xyz
exit_code: 1
--- stderr ---
[RPC -32000] Configuration file not found: MCP server "nonexistent-mcp-xyz" not found
```
#### Judgment: PASS

### [Step 22] workflow-show-nonexistent
```
$ node packages/cli/dist/bin/actant.js workflow show nonexistent-wf-xyz
exit_code: 1
--- stderr ---
[RPC -32000] Configuration file not found: Workflow "nonexistent-wf-xyz" not found
```
#### Judgment: PASS

### [Step 23] plugin-show-nonexistent
```
$ node packages/cli/dist/bin/actant.js plugin show nonexistent-plugin-xyz
exit_code: 1
--- stderr ---
[RPC -32000] Configuration file not found: Plugin "nonexistent-plugin-xyz" not found
```
#### Judgment: PASS

### [Step 24] proxy-nonexistent
```
$ node packages/cli/dist/bin/actant.js proxy nonexistent-proxy-agent-99
exit_code: 1
--- stderr ---
[RPC -32003] Agent instance "nonexistent-proxy-agent-99" not found
```
#### Judgment: PASS

### [Step 25] proxy-help
```
$ node packages/cli/dist/bin/actant.js proxy --help
exit_code: 0
--- stdout ---
Usage: actant proxy [options] <name>
Options: --lease, -t --template <template>
```
#### Judgment: PASS

---

## Group 3: Agent 生命周期 (cursor 后端) (30 steps)

### [Step 26] create-agent-1 (cursor)
```
$ node packages/cli/dist/bin/actant.js agent create qa-loop-agent-1 -t rw-basic-tpl -f json
exit_code: 0
--- stdout ---
{"name":"qa-loop-agent-1","status":"created","templateName":"rw-basic-tpl","interactionModes":["open"]}
```
#### Judgment: PASS

### [Step 27] list-after-create
```
$ node packages/cli/dist/bin/actant.js agent list -f json
exit_code: 0
--- stdout ---
[{"name":"qa-loop-agent-1",...}]
```
#### Judgment: PASS

### [Step 28] status-created
```
$ node packages/cli/dist/bin/actant.js agent status qa-loop-agent-1 -f json
exit_code: 0
--- stdout ---
{"status":"created",...}
```
#### Judgment: PASS

### [Step 29] duplicate-create
```
$ node packages/cli/dist/bin/actant.js agent create qa-loop-agent-1 -t rw-basic-tpl
exit_code: 1
--- stderr ---
[RPC -32002] Instance directory "qa-loop-agent-1" already exists
```
#### Judgment: PASS

### [Step 30] resolve-agent
```
$ node packages/cli/dist/bin/actant.js agent resolve qa-loop-agent-1
exit_code: 0
--- stdout ---
Instance: qa-loop-agent-1, Backend: cursor, Command: cursor.cmd
```
#### Judgment: PASS

### [Step 31] status-after-resolve
```
$ node packages/cli/dist/bin/actant.js agent status qa-loop-agent-1 -f json
exit_code: 0
--- stdout ---
{"status":"created",...}
```
#### Judgment: PASS

### [Step 32] start-agent (cursor)
```
$ node packages/cli/dist/bin/actant.js agent start qa-loop-agent-1
exit_code: 1
--- stderr ---
[RPC -32603] Agent "qa-loop-agent-1" (cursor) does not support "start" mode. Supported modes: open
```
#### Judgment: WARN
cursor 后端仅支持 open 模式，不支持 start。这是后端设计限制，非代码 bug。测试场景应改用 claude-code 后端测试 start/stop。

### [Step 33-36] double-start, stop, status-stopped, stop-already-stopped
- stop: exit 0, PASS
- status-stopped: status=stopped, PASS
- stop-already-stopped: exit 0 (幂等), PASS

### [Step 37] restart-agent (cursor)
```
$ node packages/cli/dist/bin/actant.js agent start qa-loop-agent-1
exit_code: 1
--- stderr ---
[RPC -32603] Agent "qa-loop-agent-1" (cursor) does not support "start" mode.
```
#### Judgment: WARN
同 Step 32，cursor 后端限制。

### [Step 38-42] destroy lifecycle
- destroy-no-force: exit 1 "Use --force", PASS
- destroy-with-force: exit 0, PASS
- list-after-destroy: [], PASS

### [Step 43-48] 并发创建/启动/销毁
- create qa-conc-1,2,3: 全部 PASS
- start qa-conc-1,2 (cursor): exit 1, WARN (cursor 不支持 start)
- stop all: PASS
- destroy all: PASS
- final list: [], PASS

---

## Group 4: 模板 + 域组件 CRUD (15 steps)

### [Step 49] tpl-list
exit_code: 0, contains rw-basic-tpl, rw-claude-tpl
#### Judgment: PASS

### [Step 50] tpl-show-basic
exit_code: 0, full JSON
#### Judgment: PASS

### [Step 51] tpl-show-claude
exit_code: 0, backend.type=claude-code
#### Judgment: PASS

### [Step 52] tpl-validate-valid
exit_code: 0, "Valid — qa-test-tpl@1.0.0"
#### Judgment: PASS

### [Step 53] tpl-validate-invalid
exit_code: 1, "Invalid template - backend: Invalid input"
#### Judgment: PASS

### [Step 54] tpl-load-new
exit_code: 0, "Loaded qa-test-tpl@1.0.0"
#### Judgment: PASS

### [Step 55] tpl-list-after-load
exit_code: 0, contains qa-test-tpl
#### Judgment: PASS

### [Step 56] tpl-show-new
exit_code: 0, name=qa-test-tpl
#### Judgment: PASS

### [Step 57] agent-from-tpl
exit_code: 0, templateName=qa-test-tpl
#### Judgment: PASS

### [Step 58] agent-from-bad-tpl
exit_code: 1, "Template not found"
#### Judgment: PASS

### [Step 59] cleanup-tpl-agent
exit_code: 0, destroyed
#### Judgment: PASS

### [Step 60] setup-all-skip
exit_code: 0, "Setup Complete!" 摘要输出
#### Judgment: PASS

### [Step 61] resolve-auto-create
exit_code: 0, created=true
#### Judgment: PASS

### [Step 62] verify-resolve-auto
exit_code: 0, status=created
#### Judgment: PASS

### [Step 63] cleanup-resolve
exit_code: 0, destroyed
#### Judgment: PASS

---

## Group 5: Claude-code 后端完整生命周期 (8 steps)

### [Step 64] create claude-code agent
exit_code: 0, interactionModes: ["open","start","chat","run","proxy"]
#### Judgment: PASS

### [Step 65] start claude-code agent
exit_code: 0, "Started qa-cc-agent"
#### Judgment: PASS

### [Step 66] status running
exit_code: 0, status=running, pid=10000
#### Judgment: PASS

### [Step 67] double-start
exit_code: 1, "Agent already running"
#### Judgment: PASS

### [Step 68] stop
exit_code: 0, "Stopped qa-cc-agent"
#### Judgment: PASS

### [Step 69] status stopped
exit_code: 0, status=stopped
#### Judgment: PASS

### [Step 70] restart + full destroy cycle
exit_code: 0 for restart → running → destroy(no-force) rejected → stop → destroy(force) → agent list []
#### Judgment: PASS

---

## Group 6: 白盒验证 + 额外探索 (6 steps)

### [Step 71] White-box: Home directory structure
```
.trellis/qa-alpha/home/
├── backups/
├── configs/
│   ├── mcp/
│   ├── plugins/
│   ├── prompts/
│   ├── skills/
│   ├── templates/
│   │   ├── qa-test-tpl.json
│   │   ├── rw-basic-tpl.json
│   │   └── rw-claude-tpl.json
│   └── workflows/
├── instances/
│   └── registry.json
├── journal/
│   └── 2026-02-28.jsonl
├── logs/
├── sources/cache/
├── config.json
└── daemon.pid
```
#### Judgment: PASS
目录结构完整，模板已持久化，registry 存在，journal 正在记录。

### [Step 72] schedule-list-nonexistent
exit_code: 1, "No scheduler for agent"
#### Judgment: PASS

### [Step 73] dispatch-nonexistent
exit_code: 1, "No scheduler for agent. Task not queued."
#### Judgment: PASS

### [Step 74] tasks-nonexistent
exit_code: 0, "Queued: 0 Processing: false"
#### Judgment: WARN
对不存在的 Agent 返回 exit 0（空队列），而其他命令对不存在资源返回 exit 1。行为不一致。

### [Step 75] logs-nonexistent
exit_code: 0, "No execution logs."
#### Judgment: WARN
同上，对不存在的 Agent 返回 exit 0。

### [Step 76] daemon-final-ping
exit_code: 0, running=true, uptime=274, agents=0
#### Judgment: PASS

---

## 单元测试

### pnpm test
```
Test Files  78 passed (78)
     Tests  1027 passed (1027)
  Duration  14.61s
```
#### Judgment: PASS

---

**日志结束时间**: 2026-02-28T17:58:00+08:00
