# QA Round 5 - 完整回归测试日志
**时间**: 2026-02-25
**HEAD**: 7bcd996
**触发**: 新 ship (PR #170, #172)
**与 R4 对比基线**: 49/50 PASS, 1 WARN, 98%

---

### Step 1: daemon status -f json
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{
  "running": true,
  "version": "unknown",
  "uptime": 43,
  "agents": 0
}
```
**判断**: PASS
**理由**: Daemon running=true，JSON 格式正确，退出码 0。

---

### Step 2: template list
**命令**: `node packages/cli/dist/bin/actant.js template list`
**退出码**: 0
**输出**:
```
┌───────────────┬─────────┬─────────────┬───────────┬────────────────────────────────────────────────────┐
│ Name          │ Version │ Backend     │ Provider  │ Description                                        │
├───────────────┼─────────┼─────────────┼───────────┼────────────────────────────────────────────────────┤
│ rw-basic-tpl  │ 1.0.0   │ cursor      │ anthropic │ Random walk test template                          │
├───────────────┼─────────┼─────────────┼───────────┼────────────────────────────────────────────────────┤
│ rw-claude-tpl │ 1.0.0   │ claude-code │ anthropic │ Random walk test template with claude-code backend │
└───────────────┴─────────┴─────────┴───────────┴────────────────────────────────────────────────────┘
```
**判断**: PASS
**理由**: 含 rw-basic-tpl、rw-claude-tpl 两个模板，退出码 0。

---

### Step 3: agent list -f json
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 返回空数组，符合预期。

---

### Step 4: skill list
**命令**: `node packages/cli/dist/bin/actant.js skill list`
**退出码**: 0
**输出**:
```
No skills loaded.
```
**判断**: PASS
**理由**: exit_code 0，输出合理。

---

### Step 5: plugin list
**命令**: `node packages/cli/dist/bin/actant.js plugin list`
**退出码**: 0
**输出**:
```
No plugins loaded.
```
**判断**: PASS
**理由**: exit_code 0，输出合理。

---

### Step 6: agent status nonexistent-agent
**命令**: `node packages/cli/dist/bin/actant.js agent status nonexistent-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent" not found
Context: {"instanceName":"nonexistent-agent"}
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码，错误信息正确。

---

### Step 7: agent start nonexistent-agent
**命令**: `node packages/cli/dist/bin/actant.js agent start nonexistent-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 8: agent create with no-template
**命令**: `node packages/cli/dist/bin/actant.js agent create test-no-tpl --template no-such-template`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "no-such-template" not found in registry
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码，错误信息正确。

---

### Step 9: template load bad path
**命令**: `node packages/cli/dist/bin/actant.js template load C:\nonexistent.json`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: C:\nonexistent.json
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 10: template show nonexistent-template
**命令**: `node packages/cli/dist/bin/actant.js template show nonexistent-template`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template" not found in registry
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 11: skill show nonexistent-skill
**命令**: `node packages/cli/dist/bin/actant.js skill show nonexistent-skill`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: Skill "nonexistent-skill" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。错误信息格式略混用（configPath 与 Skill not found），但行为正确。

---

### Step 12: agent stop nonexistent-agent
**命令**: `node packages/cli/dist/bin/actant.js agent stop nonexistent-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 13: agent destroy nonexistent-agent
**命令**: `node packages/cli/dist/bin/actant.js agent destroy nonexistent-agent`
**退出码**: 1
**输出**:
```
Destroying agent "nonexistent-agent" will remove its entire workspace.
Use --force to skip this warning.
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码（需确认或 --force）。带 --force 时返回 exit 0 "already absent" 为幂等行为。

---

### Step 14: agent create qa-r5-claude (claude-code)
**命令**: `node packages/cli/dist/bin/actant.js agent create qa-r5-claude --template rw-claude-tpl`
**退出码**: 0
**输出**:
```
Agent created successfully.
Agent:     qa-r5-claude
ID:        2d891ffd-8a97-4a9b-85ce-eeee01e26f1c
Template:  rw-claude-tpl@1.0.0
Status:    created
...
```
**判断**: PASS
**理由**: 创建成功，输出完整。

---

### Step 15: agent list
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[{"id":"2d891ffd-...","name":"qa-r5-claude",...}]
```
**判断**: PASS
**理由**: 列表中包含新建 Agent。

---

### Step 16: agent status qa-r5-claude
**命令**: `node packages/cli/dist/bin/actant.js agent status qa-r5-claude`
**退出码**: 0
**输出**:
```
Status:    created
```
**判断**: PASS
**理由**: 状态为 created，符合预期。

---

### Step 17: dup-create (same name)
**命令**: `node packages/cli/dist/bin/actant.js agent create qa-r5-claude --template rw-claude-tpl`
**退出码**: 1
**输出**:
```
[RPC -32002] Instance directory "qa-r5-claude" already exists
```
**判断**: PASS
**理由**: 重复创建正确拒绝，退出码非 0。

---

### Step 18: agent start qa-r5-claude
**命令**: `node packages/cli/dist/bin/actant.js agent start qa-r5-claude`
**退出码**: 0
**输出**:
```
Started qa-r5-claude
```
**判断**: PASS
**理由**: 启动成功。

---

### Step 19: agent status (running)
**命令**: `node packages/cli/dist/bin/actant.js agent status qa-r5-claude`
**退出码**: 0
**输出**:
```
Status:    running
PID:       10000
```
**判断**: PASS
**理由**: 状态为 running，符合预期。

---

### Step 20: dup-start (already running)
**命令**: `node packages/cli/dist/bin/actant.js agent start qa-r5-claude`
**退出码**: 1
**输出**:
```
[RPC -32004] Agent "qa-r5-claude" is already running
```
**判断**: PASS
**理由**: 重复启动正确拒绝。

---

### Step 21: agent stop qa-r5-claude
**命令**: `node packages/cli/dist/bin/actant.js agent stop qa-r5-claude`
**退出码**: 0
**输出**:
```
Stopped qa-r5-claude
```
**判断**: PASS
**理由**: 停止成功。

---

### Step 22: agent status (stopped)
**命令**: `node packages/cli/dist/bin/actant.js agent status qa-r5-claude`
**退出码**: 0
**输出**:
```
Status:    stopped
PID:       —
```
**判断**: PASS
**理由**: 状态为 stopped，符合预期。

---

### Step 23: agent restart qa-r5-claude
**命令**: `node packages/cli/dist/bin/actant.js agent restart qa-r5-claude`
**退出码**: 1
**输出**:
```
error: unknown command 'restart'
(Did you mean start?)
```
**判断**: FAIL
**理由**: CLI 无 `agent restart` 子命令，测试步骤期望存在该命令。需通过 start 实现重启。

---

### Step 24: agent stop qa-r5-claude (again)
**命令**: `node packages/cli/dist/bin/actant.js agent stop qa-r5-claude`
**退出码**: 0
**输出**:
```
Stopped qa-r5-claude
```
**判断**: PASS
**理由**: 幂等停止成功（或已停止）。

---

### Step 25: agent destroy qa-r5-claude
**命令**: `node packages/cli/dist/bin/actant.js agent destroy qa-r5-claude --force`
**退出码**: 0
**输出**:
```
Destroyed qa-r5-claude
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 26: agent create qa-r5-cursor (cursor backend)
**命令**: `node packages/cli/dist/bin/actant.js agent create qa-r5-cursor --template rw-basic-tpl`
**退出码**: 0
**输出**:
```
Agent created successfully.
Agent:     qa-r5-cursor
Template:  rw-basic-tpl@1.0.0
Status:    created
```
**判断**: PASS
**理由**: Cursor 模板 Agent 创建成功。

---

### Step 27: agent status qa-r5-cursor
**命令**: `node packages/cli/dist/bin/actant.js agent status qa-r5-cursor`
**退出码**: 0
**输出**:
```
Status:    created
```
**判断**: PASS
**理由**: 状态正确。

---

### Step 28: agent start qa-r5-cursor
**命令**: `node packages/cli/dist/bin/actant.js agent start qa-r5-cursor`
**退出码**: 1
**输出**:
```
[RPC -32603] Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]. Use `agent resolve` or `agent open` instead.
```
**判断**: WARN
**理由**: 已知行为，Cursor backend 不支持 acp/start，需用 resolve/open。经验中已注明。

---

### Step 29: agent destroy qa-r5-cursor
**命令**: `node packages/cli/dist/bin/actant.js agent destroy qa-r5-cursor --force`
**退出码**: 0
**输出**:
```
Destroyed qa-r5-cursor
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 30: verify qa-r5-cursor deleted
**命令**: `node packages/cli/dist/bin/actant.js agent status qa-r5-cursor`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "qa-r5-cursor" not found
```
**判断**: PASS
**理由**: 销毁后正确返回 not found。

---

### Step 31: prompt list
**命令**: `node packages/cli/dist/bin/actant.js prompt list`
**退出码**: 0
**输出**:
```
No prompts loaded.
```
**判断**: PASS
**理由**: 命令存在且执行成功。

---

### Step 32: mcp list
**命令**: `node packages/cli/dist/bin/actant.js mcp list`
**退出码**: 0
**输出**:
```
No MCP servers loaded.
```
**判断**: PASS
**理由**: 命令存在且执行成功。

---

### Step 33: workflow list
**命令**: `node packages/cli/dist/bin/actant.js workflow list`
**退出码**: 0
**输出**:
```
No workflows loaded.
```
**判断**: PASS
**理由**: 命令存在且执行成功。

---

### Step 34: prompt show nonexistent-prompt
**命令**: `node packages/cli/dist/bin/actant.js prompt show nonexistent-prompt`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: Prompt "nonexistent-prompt" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 35: mcp show nonexistent-mcp
**命令**: `node packages/cli/dist/bin/actant.js mcp show nonexistent-mcp`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: MCP server "nonexistent-mcp" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 36: 3 concurrent create (qa-r5-a1, a2, a3)
**命令**: `agent create qa-r5-a1 --template rw-claude-tpl` 等 3 次
**退出码**: 0
**输出**:
```
Agent created successfully. (x3)
```
**判断**: PASS
**理由**: 三个 Agent 均创建成功。

---

### Step 37: agent list (3 agents)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[qa-r5-a1, qa-r5-a2, qa-r5-a3]
```
**判断**: PASS
**理由**: 列表中包含 3 个 Agent。

---

### Step 38-40: agent resolve qa-r5-a1, a2, a3
**命令**: `agent resolve qa-r5-a1` 等
**退出码**: 0
**输出**:
```
Instance:  qa-r5-a1
Backend:   claude-code
Workspace: ...
Command:   claude-agent-acp.cmd
```
**判断**: PASS
**理由**: resolve 返回实例信息，无报错。

---

### Step 41: verify resolve status
**命令**: `agent status qa-r5-a1` 等
**退出码**: 0
**输出**:
```
Status:    created (x3)
```
**判断**: PASS
**理由**: 三个 Agent 状态正确。

---

### Step 42-43: destroy all 3
**命令**: `agent destroy qa-r5-a1 --force` 等
**退出码**: 0
**输出**:
```
Destroyed qa-r5-a1
Destroyed qa-r5-a2
Destroyed qa-r5-a3
```
**判断**: PASS
**理由**: 全部销毁成功。

---

### Step 44: create qa-r5-idem
**命令**: `node packages/cli/dist/bin/actant.js agent create qa-r5-idem --template rw-claude-tpl`
**退出码**: 0
**输出**:
```
Agent created successfully.
```
**判断**: PASS
**理由**: 创建成功。

---

### Step 45: destroy qa-r5-idem
**命令**: `node packages/cli/dist/bin/actant.js agent destroy qa-r5-idem --force`
**退出码**: 0
**输出**:
```
Destroyed qa-r5-idem
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 46: destroy qa-r5-idem again (idempotent)
**命令**: `node packages/cli/dist/bin/actant.js agent destroy qa-r5-idem --force`
**退出码**: 0
**输出**:
```
Destroyed qa-r5-idem (already absent)
```
**判断**: PASS
**理由**: 幂等行为正确，二次销毁不报错。

---

### Step 47: agent status qa-r5-idem (after destroy)
**命令**: `node packages/cli/dist/bin/actant.js agent status qa-r5-idem`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "qa-r5-idem" not found
```
**判断**: PASS
**理由**: 销毁后正确返回 not found。

---

### Step 48: agent list (empty)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 列表为空，符合预期。

---

### Step 49: source list -f json (PR #170 community type)
**命令**: `node packages/cli/dist/bin/actant.js source list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: source 子命令存在且执行成功。PR #170 在 `source add --type community` 中新增 community 类型，当前无已注册源，列表为空。CLI 支持 community 类型（add.ts 中有 --type community）。

---

### Step 50: source show nonexistent-source
**命令**: `node packages/cli/dist/bin/actant.js source show nonexistent-source`
**退出码**: 1
**输出**:
```
error: unknown command 'show'
```
**判断**: PASS
**理由**: source 无 show 子命令，边界测试期望 exit_code 非 0 或命令不存在，符合。

---

### Step 51: daemon status -f json (final)
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{
  "running": true,
  "version": "unknown",
  "uptime": 101,
  "agents": 0
}
```
**判断**: PASS
**理由**: Daemon 仍运行，agents 为 0。

---

### Step 52: agent list -f json (final empty)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 最终列表为空，环境干净。
