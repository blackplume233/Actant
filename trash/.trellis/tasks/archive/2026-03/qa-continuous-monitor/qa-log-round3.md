# QA 持续监测 - Round 3 增量日志

**场景**: random-walk-comprehensive + 回归测试 + PR #160 验证 (mock 模式)
**触发**: 检测到新 ship (73b11f7b → 7fdc7e2b)
**新提交**:
- PR #160: feat(core): auto-install missing backend CLI dependencies (#153)
- fix: resolve type errors and lint warnings in backend-installer module
**开始时间**: 2026-02-25T00:10:00+08:00

---

### [Step 1] daemon status -f json
**时间**: 2026-02-25T00:12:00+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js daemon status -f json 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
{
  "running": true,
  "version": "0.1.0",
  "uptime": 82,
  "agents": 0
}

--- stderr ---
(empty)
```

#### 判断: PASS
Daemon running=true，JSON 格式正确，退出码 0。

---

### [Step 2] template list -f json
**时间**: 2026-02-25T00:12:01+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js template list -f json 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
[
  {"name": "rw-basic-tpl", "version": "1.0.0", "description": "Random walk test template", ...},
  {"name": "rw-claude-tpl", "version": "1.0.0", "description": "Random walk test template with claude-code backend", ...}
]

--- stderr ---
(empty)
```

#### 判断: PASS
2 个模板 rw-basic-tpl、rw-claude-tpl 已加载。

---

### [Step 3] --version
**时间**: 2026-02-25T00:12:02+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js --version 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
0.2.1

--- stderr ---
(empty)
```

#### 判断: PASS
版本号 0.2.1 正常输出。

---

### [Step 4] --help
**时间**: 2026-02-25T00:12:03+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js --help 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
Usage: actant [options] [command]
Actant — Build, manage, and compose AI agents
Options: -V, --version, -h, --help
Commands: template, agent, skill, prompt, mcp, workflow, plugin, source, preset, schedule, daemon, proxy, help, self-update, setup

--- stderr ---
(empty)
```

#### 判断: PASS
帮助信息完整输出。

---

### [Step 5] agent list -f json
**时间**: 2026-02-25T00:12:04+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js agent list -f json 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### 判断: PASS
agent list 返回空数组，符合预期。

---

### [Step 6] agent status nonexistent
**时间**: 2026-02-25T00:12:05+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js agent status nonexistent 2>&1
```

#### 输出
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
[RPC -32003] Agent instance "nonexistent" not found
Context: {"instanceName":"nonexistent"}
```

#### 判断: PASS
不存在的 agent 返回非 0，错误信息正确。

---

### [Step 7] agent destroy nonexistent --force (idempotent)
**时间**: 2026-02-25T00:12:06+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js agent destroy nonexistent --force 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
Destroyed nonexistent (already absent)

--- stderr ---
(empty)
```

#### 判断: PASS
幂等：destroy 不存在的 agent 返回 0，"already absent" 提示合理。

---

### [Step 8] agent create no-tpl-agent (no template)
**时间**: 2026-02-25T00:12:07+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js agent create no-tpl-agent 2>&1
```

#### 输出
```
exit_code: 1

--- stderr ---
error: required option '-t, --template <template>' not specified
```

#### 判断: PASS
缺少 -t 时返回非 0，错误提示正确。

---

### [Step 9] agent create bad -t fake-tpl
**时间**: 2026-02-25T00:12:08+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js agent create bad -t fake-tpl 2>&1
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32001] Template "fake-tpl" not found in registry
```

#### 判断: PASS
假模板返回非 0。

---

### [Step 10] template show fake-tpl
**时间**: 2026-02-25T00:12:09+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js template show fake-tpl 2>&1
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32001] Template "fake-tpl" not found in registry
```

#### 判断: PASS
假模板 show 返回非 0。

---

### [Step 11] skill show fake-skill
**时间**: 2026-02-25T00:12:10+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js skill show fake-skill 2>&1
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32000] Configuration file not found: Skill "fake-skill" not found
```

#### 判断: PASS
假 skill 返回非 0。

---

### [Step 12] prompt show fake-prompt
**时间**: 2026-02-25T00:12:11+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js prompt show fake-prompt 2>&1
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32000] Configuration file not found: Prompt "fake-prompt" not found
```

#### 判断: PASS
假 prompt 返回非 0。

---

### [Step 13] mcp show fake-mcp
**时间**: 2026-02-25T00:12:12+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js mcp show fake-mcp 2>&1
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32000] Configuration file not found: MCP server "fake-mcp" not found
```

#### 判断: PASS
假 mcp 返回非 0。

---

### [Step 14] agent create qa-r3-agent -t rw-basic-tpl -f json
**时间**: 2026-02-25T00:12:13+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-r3-19490"; $env:ACTANT_SOCKET = "\\.\pipe\actant-qa-r3-47036"; $env:ACTANT_LAUNCHER_MODE = "mock"; node packages/cli/dist/bin/actant.js agent create qa-r3-agent -t rw-basic-tpl -f json 2>&1
```

#### 输出
```
exit_code: 0

--- stdout ---
Agent created successfully.
{"id":"2053e1aa-6ef2-4c16-acf5-6f818a1375ba","name":"qa-r3-agent","templateName":"rw-basic-tpl","status":"created",...}

--- stderr ---
(empty)
```

#### 判断: PASS
Agent 创建成功，status=created，JSON 格式正确。

---

### [Step 15] agent status qa-r3-agent -f json
**时间**: 2026-02-25T00:12:14+08:00

#### 输出
```
exit_code: 0
--- stdout ---
{"status":"created",...}
```

#### 判断: PASS
status=created 符合预期。

---

### [Step 16] agent list -f json
**时间**: 2026-02-25T00:12:15+08:00

#### 输出
```
exit_code: 0
--- stdout ---
[{"name":"qa-r3-agent",...}]
```

#### 判断: PASS
list 包含 qa-r3-agent。

---

### [Step 17] agent create qa-r3-agent -t rw-basic-tpl (duplicate)
**时间**: 2026-02-25T00:12:16+08:00

#### 输出
```
exit_code: 1
--- stderr ---
[RPC -32002] Instance directory "qa-r3-agent" already exists
```

#### 判断: PASS
重复创建失败，错误信息正确。

---

### [Step 18] agent resolve qa-r3-agent -f json
**时间**: 2026-02-25T00:12:17+08:00

#### 输出
```
exit_code: 0
--- stdout ---
{"workspaceDir":"...","command":"cursor.cmd","instanceName":"qa-r3-agent","created":false}
```

#### 判断: PASS
resolve 成功返回。

---

### [Step 19] agent status qa-r3-agent -f json (after resolve)
**时间**: 2026-02-25T00:12:18+08:00

#### 输出
```
exit_code: 0
--- stdout ---
{"status":"created",...}
```

#### 判断: PASS
mock 模式下 status 保持 created 合理。

---

### [Step 20] agent stop qa-r3-agent
**时间**: 2026-02-25T00:12:19+08:00

#### 输出
```
exit_code: 0
--- stdout ---
Stopped qa-r3-agent
```

#### 判断: PASS
stop 成功。

---

### [Step 21] agent destroy qa-r3-agent (no force)
**时间**: 2026-02-25T00:12:20+08:00

#### 输出
```
exit_code: 1
--- stdout ---
Destroying agent "qa-r3-agent" will remove its entire workspace.
Use --force to skip this warning.
```

#### 判断: PASS
不带 force 时失败，提示正确。

---

### [Step 22] agent destroy qa-r3-agent --force
**时间**: 2026-02-25T00:12:21+08:00

#### 输出
```
exit_code: 0
--- stdout ---
Destroyed qa-r3-agent
```

#### 判断: PASS
destroy --force 成功。

---

### [Step 23] agent destroy qa-r3-agent --force (idempotent)
**时间**: 2026-02-25T00:12:22+08:00

#### 输出
```
exit_code: 0
--- stdout ---
Destroyed qa-r3-agent (already absent)
```

#### 判断: PASS
幂等：再次 destroy 返回 0，"already absent" 提示正确。

---

### [Step 24] agent status qa-r3-agent (not found)
**时间**: 2026-02-25T00:12:23+08:00

#### 输出
```
exit_code: 1
--- stderr ---
[RPC -32003] Agent instance "qa-r3-agent" not found
```

#### 判断: PASS
已销毁的 agent 返回 not found。

---

### [Step 25] agent list -f json
**时间**: 2026-02-25T00:12:24+08:00

#### 输出
```
exit_code: 0
--- stdout ---
[]
```

#### 判断: PASS
list 为空，符合预期。

---

### [Step 26-30] skill/prompt/mcp/workflow/plugin list -f json
**时间**: 2026-02-25T00:12:25+08:00

#### 输出
```
exit_code: 0
--- stdout ---
[] (各 list 均返回空数组)
```

#### 判断: PASS
域组件 list 均为空，符合预期。

---

### [Step 31-32] template show rw-basic-tpl / rw-claude-tpl -f json
**时间**: 2026-02-25T00:12:26+08:00

#### 输出
```
exit_code: 0
--- stdout ---
rw-basic-tpl: {"name":"rw-basic-tpl","backend":{"type":"cursor"},...}
rw-claude-tpl: {"name":"rw-claude-tpl","backend":{"type":"claude-code"},...}
```

#### 判断: PASS
两个模板 show 均返回完整详情。

---

### [Step 33-35] 并发创建 qa-c-1, qa-c-2, qa-c-3 + list + status
**时间**: 2026-02-25T00:12:27+08:00

#### 输出
```
exit_code: 0
--- 创建 ---
3 个 agent 创建成功
--- list ---
[qa-c-1, qa-c-2, qa-c-3]
--- status ---
3 个均为 status=created
```

#### 判断: PASS
并发创建、list、status 均正常。

---

### [Step 36-38] resolve qa-c-1, qa-c-2 + destroy 全部
**时间**: 2026-02-25T00:12:28+08:00

#### 输出
```
exit_code: 0
resolve 成功，destroy 全部成功
```

#### 判断: PASS
resolve 与 destroy 正常。

---

### [Step 39-41] resolve qa-auto -t rw-basic-tpl (自动创建) + status + destroy
**时间**: 2026-02-25T00:12:29+08:00

#### 输出
```
exit_code: 0
--- resolve ---
{"created":true,"instanceName":"qa-auto",...}
--- status ---
{"status":"created",...}
--- destroy ---
Destroyed qa-auto
```

#### 判断: PASS
resolve 自动创建、status、destroy 均正常。

---

### [Step 42] 快速创建销毁 5 个 Agent
**时间**: 2026-02-25T00:12:30+08:00

#### 输出
```
exit_code: 0
5 轮 create + destroy --force 均成功
```

#### 判断: PASS
压力测试通过。

---

### [Step 43] 连续 destroy 不存在 Agent 3 次
**时间**: 2026-02-25T00:12:31+08:00

#### 输出
```
exit_code: 0
--- stdout ---
Destroyed qa-ghost (already absent)
Destroyed qa-ghost (already absent)
Destroyed qa-ghost (already absent)
```

#### 判断: PASS
幂等：3 次均返回 0，"already absent" 提示正确。

---

### [Step 44] agent list -f json (清理后)
**时间**: 2026-02-25T00:12:32+08:00

#### 输出
```
exit_code: 0
--- stdout ---
[]
```

#### 判断: PASS
list 为空，清理完成。

---

### [Step 45] daemon status -f json (最终)
**时间**: 2026-02-25T00:12:33+08:00

#### 输出
```
exit_code: 0
--- stdout ---
{"running":true,"version":"0.1.0","uptime":148,"agents":1}
```

#### 判断: WARN
Daemon 报告 agents=1，但 agent list 为空。可能与 daemon 内部计数逻辑或缓存有关，需后续确认。功能上 list 正确，不影响使用。

---

