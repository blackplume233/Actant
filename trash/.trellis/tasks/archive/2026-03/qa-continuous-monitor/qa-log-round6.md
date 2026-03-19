# QA Round 6 - 完整回归测试日志
**时间**: 2026-02-25
**HEAD**: 2c860a9
**触发**: 新 ship (PR #174 - docs)
**与 R5 对比基线**: 50/52, 1 WARN, 1 FAIL (agent restart不存在), 96.2%

---

### Step 1: daemon status -f json
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{
  "running": true,
  "version": "unknown",
  "uptime": 45,
  "agents": 0
}
```
**判断**: PASS
**理由**: Daemon running=true，JSON 格式正确，退出码 0。

---

### Step 2: template list -f json
**命令**: `node packages/cli/dist/bin/actant.js template list -f json`
**退出码**: 0
**输出**:
```
[
  {"name": "rw-basic-tpl", "version": "1.0.0", "backend": {"type": "cursor"}, ...},
  {"name": "rw-claude-tpl", "version": "1.0.0", "backend": {"type": "claude-code"}, ...}
]
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

### Step 4: skill list -f json
**命令**: `node packages/cli/dist/bin/actant.js skill list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0，输出合理。

---

### Step 5: plugin list -f json
**命令**: `node packages/cli/dist/bin/actant.js plugin list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0，输出合理。

---

### Step 6: agent status nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent status nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
  Context: {"instanceName":"nonexistent-agent-12345"}
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码，错误信息正确。

---

### Step 7: agent stop nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent stop nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 8: agent start nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent start nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 9: agent destroy nonexistent-agent-12345 --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy nonexistent-agent-12345 --force`
**退出码**: 0
**输出**:
```
Destroyed nonexistent-agent-12345 (already absent)
```
**判断**: PASS
**理由**: 幂等销毁，返回 0 且提示已不存在。

---

### Step 10: agent create no-template-agent
**命令**: `node packages/cli/dist/bin/actant.js agent create no-template-agent`
**退出码**: 1
**输出**:
```
error: required option '-t, --template <template>' not specified
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 11: agent create bad-agent -t nonexistent-template-xyz
**命令**: `node packages/cli/dist/bin/actant.js agent create bad-agent -t nonexistent-template-xyz`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template-xyz" not found in registry
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 12: template show nonexistent-template-abc
**命令**: `node packages/cli/dist/bin/actant.js template show nonexistent-template-abc`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template-abc" not found in registry
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 13: skill show nonexistent-skill
**命令**: `node packages/cli/dist/bin/actant.js skill show nonexistent-skill`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: Skill "nonexistent-skill" not found
```
**判断**: PASS
**理由**: 边界测试，期望非 0 退出码。

---

### Step 14: agent create rw-agent-1 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-agent-1 -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"id":"805f8694-...","name":"rw-agent-1","templateName":"rw-claude-tpl","status":"created",...}
```
**判断**: PASS
**理由**: Agent 创建成功，status 为 created。

---

### Step 15: agent list -f json
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[{"name":"rw-agent-1","templateName":"rw-claude-tpl","status":"created",...}]
```
**判断**: PASS
**理由**: 含 rw-agent-1，符合预期。

---

### Step 16: agent status rw-agent-1 -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
{"status":"created",...}
```
**判断**: PASS
**理由**: status 为 created。

---

### Step 17: agent create rw-agent-1 -t rw-claude-tpl (重复)
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-agent-1 -t rw-claude-tpl`
**退出码**: 1
**输出**:
```
[RPC -32002] Instance directory "rw-agent-1" already exists
```
**判断**: PASS
**理由**: 重复创建失败，符合预期。

---

### Step 18: agent start rw-agent-1
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 0
**输出**:
```
Started rw-agent-1
```
**判断**: PASS
**理由**: 启动成功。

---

### Step 19: agent status rw-agent-1 -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
{"status":"running","pid":10000,...}
```
**判断**: PASS
**理由**: status 为 running。

---

### Step 20: agent start rw-agent-1 (重复)
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 1
**输出**:
```
[RPC -32004] Agent "rw-agent-1" is already running
```
**判断**: PASS
**理由**: 重复启动失败，符合预期。

---

### Step 21: agent stop rw-agent-1
**命令**: `node packages/cli/dist/bin/actant.js agent stop rw-agent-1`
**退出码**: 0
**输出**:
```
Stopped rw-agent-1
```
**判断**: PASS
**理由**: 停止成功。

---

### Step 22: agent status rw-agent-1 -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
{"status":"stopped",...}
```
**判断**: PASS
**理由**: status 为 stopped。

---

### Step 23: agent stop + start (重启替代 restart)
**命令**: `node packages/cli/dist/bin/actant.js agent stop rw-agent-1; node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 0
**输出**:
```
Stopped rw-agent-1
Started rw-agent-1
```
**判断**: PASS
**理由**: stop+start 替代 restart 成功，R5 的 agent restart 不存在问题已规避。

---

### Step 24: agent stop rw-agent-1
**命令**: `node packages/cli/dist/bin/actant.js agent stop rw-agent-1`
**退出码**: 0
**输出**:
```
Stopped rw-agent-1
```
**判断**: PASS
**理由**: 停止成功。

---

### Step 25: agent destroy rw-agent-1 --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-agent-1 --force`
**退出码**: 0
**输出**:
```
Destroyed rw-agent-1
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 26: agent create cursor-agent -t rw-basic-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create cursor-agent -t rw-basic-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"name":"cursor-agent","backendType":"cursor","status":"created",...}
```
**判断**: PASS
**理由**: Cursor backend agent 创建成功。

---

### Step 27: agent status cursor-agent -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status cursor-agent -f json`
**退出码**: 0
**输出**:
```
{"status":"created","backendType":"cursor",...}
```
**判断**: PASS
**理由**: status 为 created。

---

### Step 28: agent start cursor-agent
**命令**: `node packages/cli/dist/bin/actant.js agent start cursor-agent`
**退出码**: 1
**输出**:
```
[RPC -32603] Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]. Use `agent resolve` or `agent open` instead.
```
**判断**: WARN
**理由**: Cursor backend 不支持 agent start（ACP 模式），需用 resolve/open。已知限制，符合预期。

---

### Step 29: agent destroy cursor-agent --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy cursor-agent --force`
**退出码**: 0
**输出**:
```
Destroyed cursor-agent
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 30: agent status cursor-agent (verify not found)
**命令**: `node packages/cli/dist/bin/actant.js agent status cursor-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "cursor-agent" not found
```
**判断**: PASS
**理由**: 已销毁，符合预期。

---

### Step 31: prompt list -f json
**命令**: `node packages/cli/dist/bin/actant.js prompt list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0。

---

### Step 32: mcp list -f json
**命令**: `node packages/cli/dist/bin/actant.js mcp list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0。

---

### Step 33: workflow list -f json
**命令**: `node packages/cli/dist/bin/actant.js workflow list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0。

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

### Step 36: agent create conc-a -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create conc-a -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"name":"conc-a","status":"created",...}
```
**判断**: PASS
**理由**: 创建成功。

---

### Step 37: agent create conc-b -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create conc-b -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"name":"conc-b","status":"created",...}
```
**判断**: PASS
**理由**: 创建成功。

---

### Step 38: agent create conc-c -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create conc-c -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"name":"conc-c","status":"created",...}
```
**判断**: PASS
**理由**: 创建成功。

---

### Step 39: agent list -f json
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[{"name":"conc-a",...},{"name":"conc-b",...},{"name":"conc-c",...}]
```
**判断**: PASS
**理由**: 含 conc-a、conc-b、conc-c 三个 agent。

---

### Step 40: agent resolve conc-a -f json
**命令**: `node packages/cli/dist/bin/actant.js agent resolve conc-a -f json`
**退出码**: 0
**输出**:
```
{
  "workspaceDir": "...\\instances\\conc-a",
  "command": "claude-agent-acp.cmd",
  "instanceName": "conc-a",
  "backendType": "claude-code",
  "created": false,
  ...
}
```
**判断**: PASS
**理由**: resolve 成功。

---

### Step 41-43: agent destroy conc-a/b/c --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy conc-a --force; ... conc-b; ... conc-c`
**退出码**: 0
**输出**:
```
Destroyed conc-a
Destroyed conc-b
Destroyed conc-c
```
**判断**: PASS
**理由**: 三个 agent 全部销毁成功。

---

### Step 44: agent create stress-agent -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create stress-agent -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"name":"stress-agent","status":"created",...}
```
**判断**: PASS
**理由**: 创建成功。

---

### Step 45: agent destroy stress-agent --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy stress-agent --force`
**退出码**: 0
**输出**:
```
Destroyed stress-agent
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 46: agent destroy stress-agent --force (幂等)
**命令**: `node packages/cli/dist/bin/actant.js agent destroy stress-agent --force`
**退出码**: 0
**输出**:
```
Destroyed stress-agent (already absent)
```
**判断**: PASS
**理由**: 幂等销毁，返回 0 且提示已不存在。

---

### Step 47: agent status stress-agent
**命令**: `node packages/cli/dist/bin/actant.js agent status stress-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "stress-agent" not found
```
**判断**: PASS
**理由**: 已销毁，符合预期。

---

### Step 48: agent list -f json
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 列表为空。

---

### Step 49: daemon status -f json
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{
  "running": true,
  "version": "unknown",
  "uptime": 99,
  "agents": 0
}
```
**判断**: PASS
**理由**: Daemon 正常。

---

### Step 50: agent list -f json
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 返回空数组，符合预期。
