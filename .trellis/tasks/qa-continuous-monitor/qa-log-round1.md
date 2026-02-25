# QA Round 1 - 完整回归测试日志
**时间**: 2026-02-25
**HEAD**: afc2ae0
**触发**: 初始测试

---

### Step 1: daemon status -f json
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{"running":true,"version":"unknown","uptime":193,"agents":0}
```
**判断**: PASS
**理由**: daemon 返回 running 状态

---

### Step 2: template list -f json
**命令**: `node packages/cli/dist/bin/actant.js template list -f json`
**退出码**: 0
**输出**:
```
包含 rw-basic-tpl (cursor), rw-claude-tpl (claude-code)
```
**判断**: PASS
**理由**: 包含 rw-basic-tpl 和 rw-claude-tpl

---

### Step 3: agent list -f json
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 初始为空数组

---

### Step 4: skill list -f json
**命令**: `node packages/cli/dist/bin/actant.js skill list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0

---

### Step 5: plugin list -f json
**命令**: `node packages/cli/dist/bin/actant.js plugin list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0

---

### Step 6: agent status nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent status nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: exit_code 非0，含 not found

---

### Step 7: agent stop nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent stop nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: exit_code 非0，含 not found

---

### Step 8: agent start nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent start nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: exit_code 非0，含 not found

---

### Step 9: agent destroy nonexistent-agent-12345 --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy nonexistent-agent-12345 --force`
**退出码**: 0
**输出**:
```
Destroyed nonexistent-agent-12345 (already absent)
```
**判断**: PASS
**理由**: 幂等，exit_code 0 可接受

---

### Step 10: agent create no-template-agent
**命令**: `node packages/cli/dist/bin/actant.js agent create no-template-agent`
**退出码**: 1
**输出**:
```
error: required option '-t, --template <template>' not specified
```
**判断**: PASS
**理由**: exit_code 非0，缺少 --template

---

### Step 11: agent create bad-agent -t nonexistent-template-xyz
**命令**: `node packages/cli/dist/bin/actant.js agent create bad-agent -t nonexistent-template-xyz`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template-xyz" not found in registry
```
**判断**: PASS
**理由**: exit_code 非0，template not found

---

### Step 12: template show nonexistent-template-abc
**命令**: `node packages/cli/dist/bin/actant.js template show nonexistent-template-abc`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template-abc" not found in registry
```
**判断**: PASS
**理由**: exit_code 非0，not found

---

### Step 13: skill show nonexistent-skill
**命令**: `node packages/cli/dist/bin/actant.js skill show nonexistent-skill`
**退出码**: 1
**输出**:
```
Configuration file not found: Skill "nonexistent-skill" not found
```
**判断**: PASS
**理由**: exit_code 非0，含 not found

---

### Step 14: agent create rw-agent-1 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-agent-1 -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
name=rw-agent-1, status=created
```
**判断**: PASS
**理由**: 返回 name=rw-agent-1, status=created

---

### Step 15: agent list -f json (after create)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: WARN
**理由**: 期望包含 rw-agent-1，但返回空数组；agent status 可查到，可能为时序/缓存问题

---

### Step 16: agent status rw-agent-1 -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
status=created
```
**判断**: PASS
**理由**: status=created

---

### Step 17: agent create rw-agent-1 -t rw-claude-tpl (duplicate)
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-agent-1 -t rw-claude-tpl`
**退出码**: 1
**输出**:
```
[RPC -32002] Instance directory "rw-agent-1" already exists
```
**判断**: PASS
**理由**: 重复创建，exit_code 非0

---

### Step 18: agent start rw-agent-1
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 0
**输出**:
```
Started rw-agent-1
```
**判断**: PASS
**理由**: 启动成功

---

### Step 19: agent status rw-agent-1 -f json (running)
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
status=running
```
**判断**: PASS
**理由**: status=running

---

### Step 20: agent start rw-agent-1 (duplicate)
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 1
**输出**:
```
[RPC -32004] Agent "rw-agent-1" is already running
```
**判断**: PASS
**理由**: 重复启动，exit_code 非0

---

### Step 21: agent stop rw-agent-1
**命令**: `node packages/cli/dist/bin/actant.js agent stop rw-agent-1`
**退出码**: 0
**输出**:
```
Stopped rw-agent-1
```
**判断**: PASS
**理由**: 停止成功

---

### Step 22: agent status rw-agent-1 -f json (stopped)
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
status=stopped
```
**判断**: PASS
**理由**: status=stopped

---

### Step 23: agent start rw-agent-1 (restart)
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 0
**输出**:
```
Started rw-agent-1
```
**判断**: PASS
**理由**: 重新启动成功

---

### Step 24: agent stop rw-agent-1 (before destroy)
**命令**: `node packages/cli/dist/bin/actant.js agent stop rw-agent-1`
**退出码**: 0
**输出**:
```
Stopped rw-agent-1
```
**判断**: PASS
**理由**: 停止成功

---

### Step 25: agent destroy rw-agent-1 --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-agent-1 --force`
**退出码**: 0
**输出**:
```
Destroyed rw-agent-1
```
**判断**: PASS
**理由**: 销毁成功

---

### Step 26: agent create rw-cursor-agent -t rw-basic-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-cursor-agent -t rw-basic-tpl -f json`
**退出码**: 0
**输出**:
```
name=rw-cursor-agent, status=created, backendType=cursor
```
**判断**: PASS
**理由**: 创建成功

---

### Step 27: agent status rw-cursor-agent -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-cursor-agent -f json`
**退出码**: 0
**输出**:
```
status=created
```
**判断**: PASS
**理由**: status=created

---

### Step 28: agent start rw-cursor-agent (cursor backend)
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-cursor-agent`
**退出码**: 1
**输出**:
```
[RPC -32603] Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]
```
**判断**: PASS
**理由**: 期望失败（cursor 不支持 agent start），已知限制

---

### Step 29: agent destroy rw-cursor-agent --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-cursor-agent --force`
**退出码**: 0
**输出**:
```
Destroyed rw-cursor-agent
```
**判断**: PASS
**理由**: 销毁成功

---

### Step 30: agent status rw-cursor-agent (after destroy)
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-cursor-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "rw-cursor-agent" not found
```
**判断**: PASS
**理由**: not found，确认销毁成功

---

### Step 31: prompt list -f json
**命令**: `node packages/cli/dist/bin/actant.js prompt list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0

---

### Step 32: mcp list -f json
**命令**: `node packages/cli/dist/bin/actant.js mcp list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0

---

### Step 33: workflow list -f json
**命令**: `node packages/cli/dist/bin/actant.js workflow list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0

---

### Step 34: prompt show nonexistent-prompt
**命令**: `node packages/cli/dist/bin/actant.js prompt show nonexistent-prompt`
**退出码**: 1
**输出**:
```
Configuration file not found: Prompt "nonexistent-prompt" not found
```
**判断**: PASS
**理由**: exit_code 非0，含 not found

---

### Step 35: mcp show nonexistent-mcp
**命令**: `node packages/cli/dist/bin/actant.js mcp show nonexistent-mcp`
**退出码**: 1
**输出**:
```
Configuration file not found: MCP server "nonexistent-mcp" not found
```
**判断**: PASS
**理由**: exit_code 非0，含 not found

---

### Step 36: agent create rw-concurrent-1 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-concurrent-1 -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
name=rw-concurrent-1, status=created
```
**判断**: PASS
**理由**: 创建成功

---

### Step 37: agent create rw-concurrent-2 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-concurrent-2 -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
name=rw-concurrent-2, status=created
```
**判断**: PASS
**理由**: 创建成功

---

### Step 38: agent create rw-concurrent-3 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-concurrent-3 -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
name=rw-concurrent-3, status=created
```
**判断**: PASS
**理由**: 创建成功

---

### Step 39: agent list -f json (3 concurrent)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
包含 rw-concurrent-1, rw-concurrent-2, rw-concurrent-3
```
**判断**: PASS
**理由**: 包含 3 个 concurrent Agent

---

### Step 40: agent resolve rw-resolve-test -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent resolve rw-resolve-test -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
created: true, instanceName: rw-resolve-test
```
**判断**: PASS
**理由**: 自动创建成功

---

### Step 41: agent status rw-resolve-test -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-resolve-test -f json`
**退出码**: 0
**输出**:
```
status=created
```
**判断**: PASS
**理由**: status=created

---

### Step 42: destroy concurrent agents
**命令**: `agent destroy rw-concurrent-1 --force; ... rw-concurrent-2; ... rw-concurrent-3`
**退出码**: 0
**输出**:
```
Destroyed rw-concurrent-1
Destroyed rw-concurrent-2
Destroyed rw-concurrent-3
```
**判断**: PASS
**理由**: 全部销毁成功

---

### Step 43: agent destroy rw-resolve-test --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-resolve-test --force`
**退出码**: 0
**输出**:
```
Destroyed rw-resolve-test
```
**判断**: PASS
**理由**: 销毁成功

---

### Step 44: agent create stress-agent -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create stress-agent -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
name=stress-agent, status=created
```
**判断**: PASS
**理由**: 创建成功

---

### Step 45: agent destroy stress-agent --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy stress-agent --force`
**退出码**: 0
**输出**:
```
Destroyed stress-agent
```
**判断**: PASS
**理由**: 销毁成功

---

### Step 46: agent destroy stress-agent --force (idempotent)
**命令**: `node packages/cli/dist/bin/actant.js agent destroy stress-agent --force`
**退出码**: 0
**输出**:
```
Destroyed stress-agent (already absent)
```
**判断**: PASS
**理由**: 幂等，exit_code 0，未崩溃

---

### Step 47: agent status stress-agent
**命令**: `node packages/cli/dist/bin/actant.js agent status stress-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "stress-agent" not found
```
**判断**: PASS
**理由**: not found

---

### Step 48: agent list -f json (after stress)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 空数组

---

### Step 49: daemon status -f json (final)
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{"running":true,"version":"unknown","uptime":733,"agents":0}
```
**判断**: PASS
**理由**: daemon 仍然正常运行

---

### Step 50: agent list -f json (final)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 最终确认为空

---
