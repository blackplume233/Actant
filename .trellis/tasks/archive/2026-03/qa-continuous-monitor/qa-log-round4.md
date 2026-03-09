# QA Round 4 - 完整回归测试日志
**时间**: 2026-02-25
**HEAD**: 7f57024
**触发**: 新 ship (PR #169)
**与 R2 对比基线**: 48 PASS / 4 WARN / 0 FAIL (92.3%)

---

### Step 1: daemon status -f json
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{
  "running": true,
  "version": "unknown",
  "uptime": 51,
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
[{"name":"rw-basic-tpl",...},{"name":"rw-claude-tpl",...}]
```
**判断**: PASS
**理由**: 含 rw-basic-tpl、rw-claude-tpl 两个模板。

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
**理由**: exit_code 0，返回空数组。

---

### Step 5: plugin list -f json
**命令**: `node packages/cli/dist/bin/actant.js plugin list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: exit_code 0，返回空数组。

---

### Step 6: agent status nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent status nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: 非 0 退出码，正确返回 not found。

---

### Step 7: agent stop nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent stop nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: 非 0 退出码，正确返回 not found。

---

### Step 8: agent start nonexistent-agent-12345
**命令**: `node packages/cli/dist/bin/actant.js agent start nonexistent-agent-12345`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "nonexistent-agent-12345" not found
```
**判断**: PASS
**理由**: 非 0 退出码，正确返回 not found。

---

### Step 9: agent destroy nonexistent-agent-12345 --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy nonexistent-agent-12345 --force`
**退出码**: 0
**输出**:
```
Destroyed nonexistent-agent-12345 (already absent)
```
**判断**: PASS
**理由**: 幂等行为正确，返回 already absent。

---

### Step 10: agent create no-template-agent
**命令**: `node packages/cli/dist/bin/actant.js agent create no-template-agent`
**退出码**: 1
**输出**:
```
error: required option '-t, --template <template>' not specified
```
**判断**: PASS
**理由**: 非 0 退出码，正确提示缺少 -t 参数。

---

### Step 11: agent create bad-agent -t nonexistent-template-xyz
**命令**: `node packages/cli/dist/bin/actant.js agent create bad-agent -t nonexistent-template-xyz`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template-xyz" not found in registry
```
**判断**: PASS
**理由**: 非 0 退出码，正确提示模板不存在。

---

### Step 12: template show nonexistent-template-abc
**命令**: `node packages/cli/dist/bin/actant.js template show nonexistent-template-abc`
**退出码**: 1
**输出**:
```
[RPC -32001] Template "nonexistent-template-abc" not found in registry
```
**判断**: PASS
**理由**: 非 0 退出码，正确提示模板不存在。

---

### Step 13: skill show nonexistent-skill
**命令**: `node packages/cli/dist/bin/actant.js skill show nonexistent-skill`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: Skill "nonexistent-skill" not found
```
**判断**: PASS
**理由**: 非 0 退出码，正确提示 skill 不存在。

---

### Step 14: agent create rw-agent-1 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-agent-1 -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"id":"c011064d-f15f-4da7-80f1-a81a1bb41632","name":"rw-agent-1","templateName":"rw-claude-tpl","status":"created",...}
```
**判断**: PASS
**理由**: 创建成功，status=created，JSON 输出完整。

---

### Step 15: agent list -f json (含 rw-agent-1)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[{"id":"c011064d-f15f-4da7-80f1-a81a1bb41632","name":"rw-agent-1",...}]
```
**判断**: PASS
**理由**: list 含 rw-agent-1，R1 Step 15 的 agent list 时序问题未复现。

---

### Step 16: agent status rw-agent-1 -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
{"status":"created",...}
```
**判断**: PASS
**理由**: status=created，符合预期。

---

### Step 17: agent create rw-agent-1 -t rw-claude-tpl (duplicate)
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-agent-1 -t rw-claude-tpl`
**退出码**: 1
**输出**:
```
[RPC -32002] Instance directory "rw-agent-1" already exists
```
**判断**: PASS
**理由**: 正确拒绝重复创建。

---

### Step 18: agent start rw-agent-1
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 0
**输出**:
```
Started rw-agent-1
```
**判断**: PASS
**理由**: 启动成功，退出码 0。

---

### Step 19: agent status rw-agent-1 -f json (running)
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
{"status":"running","pid":10000,...}
```
**判断**: PASS
**理由**: status=running，符合预期。

---

### Step 20: agent start rw-agent-1 (already running)
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 1
**输出**:
```
[RPC -32004] Agent "rw-agent-1" is already running
```
**判断**: PASS
**理由**: 非 0 退出码，正确拒绝重复启动。

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

### Step 22: agent status rw-agent-1 -f json (stopped)
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-agent-1 -f json`
**退出码**: 0
**输出**:
```
{"status":"stopped",...}
```
**判断**: PASS
**理由**: status=stopped，符合预期。

---

### Step 23: agent start rw-agent-1 (again)
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-agent-1`
**退出码**: 0
**输出**:
```
Started rw-agent-1
```
**判断**: PASS
**理由**: 再次启动成功。

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

### Step 26: agent create rw-cursor-agent -t rw-basic-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-cursor-agent -t rw-basic-tpl -f json`
**退出码**: 0
**输出**:
```
Agent created successfully.
{"name":"rw-cursor-agent","backendType":"cursor","status":"created",...}
```
**判断**: PASS
**理由**: 创建成功，backendType=cursor。

---

### Step 27: agent status rw-cursor-agent -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-cursor-agent -f json`
**退出码**: 0
**输出**:
```
{"status":"created","backendType":"cursor",...}
```
**判断**: PASS
**理由**: status=created，符合预期。

---

### Step 28: agent start rw-cursor-agent
**命令**: `node packages/cli/dist/bin/actant.js agent start rw-cursor-agent`
**退出码**: 1
**输出**:
```
[RPC -32603] Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]. Use `agent resolve` or `agent open` instead.
```
**判断**: WARN
**理由**: 已知限制，cursor backend 不支持 start/acp 模式，需用 resolve/open。符合预期，标记为 WARN。

---

### Step 29: agent destroy rw-cursor-agent --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-cursor-agent --force`
**退出码**: 0
**输出**:
```
Destroyed rw-cursor-agent
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 30: agent status rw-cursor-agent (not found)
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-cursor-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "rw-cursor-agent" not found
```
**判断**: PASS
**理由**: 销毁后 status 正确返回 not found。

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
**理由**: 非 0 退出码，正确提示不存在。

---

### Step 35: mcp show nonexistent-mcp
**命令**: `node packages/cli/dist/bin/actant.js mcp show nonexistent-mcp`
**退出码**: 1
**输出**:
```
[RPC -32000] Configuration file not found: MCP server "nonexistent-mcp" not found
```
**判断**: PASS
**理由**: 非 0 退出码，正确提示不存在。

---

### Step 36: agent create rw-concurrent-1 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-concurrent-1 -t rw-claude-tpl -f json`
**退出码**: 0
**判断**: PASS
**理由**: 创建成功。

---

### Step 37: agent create rw-concurrent-2 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-concurrent-2 -t rw-claude-tpl -f json`
**退出码**: 0
**判断**: PASS
**理由**: 创建成功。

---

### Step 38: agent create rw-concurrent-3 -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create rw-concurrent-3 -t rw-claude-tpl -f json`
**退出码**: 0
**判断**: PASS
**理由**: 创建成功。

---

### Step 39: agent list -f json (含 3 个)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**: 含 rw-concurrent-1, rw-concurrent-2, rw-concurrent-3
**判断**: PASS
**理由**: list 含 3 个 agent。

---

### Step 40: agent resolve rw-resolve-test -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent resolve rw-resolve-test -t rw-claude-tpl -f json`
**退出码**: 0
**输出**:
```
{"workspaceDir":"...","command":"claude-agent-acp.cmd","created":true,...}
```
**判断**: PASS
**理由**: resolve 成功，created=true。

---

### Step 41: agent status rw-resolve-test -f json
**命令**: `node packages/cli/dist/bin/actant.js agent status rw-resolve-test -f json`
**退出码**: 0
**输出**:
```
{"status":"created",...}
```
**判断**: PASS
**理由**: status=created，符合预期。

---

### Step 42: agent destroy rw-concurrent-1/2/3 --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-concurrent-1 --force` 等
**退出码**: 0
**输出**:
```
Destroyed rw-concurrent-1
Destroyed rw-concurrent-2
Destroyed rw-concurrent-3
```
**判断**: PASS
**理由**: 全部销毁成功。

---

### Step 43: agent destroy rw-resolve-test --force
**命令**: `node packages/cli/dist/bin/actant.js agent destroy rw-resolve-test --force`
**退出码**: 0
**输出**:
```
Destroyed rw-resolve-test
```
**判断**: PASS
**理由**: 销毁成功。

---

### Step 44: agent create stress-agent -t rw-claude-tpl -f json
**命令**: `node packages/cli/dist/bin/actant.js agent create stress-agent -t rw-claude-tpl -f json`
**退出码**: 0
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
**理由**: 幂等正确，返回 already absent。

---

### Step 47: agent status stress-agent (not found)
**命令**: `node packages/cli/dist/bin/actant.js agent status stress-agent`
**退出码**: 1
**输出**:
```
[RPC -32003] Agent instance "stress-agent" not found
```
**判断**: PASS
**理由**: 销毁后 status 正确返回 not found。

---

### Step 48: agent list -f json (empty)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 返回空数组，符合预期。

---

### Step 49: daemon status -f json (final)
**命令**: `node packages/cli/dist/bin/actant.js daemon status -f json`
**退出码**: 0
**输出**:
```
{"running":true,"version":"unknown","uptime":108,"agents":0}
```
**判断**: PASS
**理由**: Daemon 正常，agents=0 与 agent list 一致。

---

### Step 50: agent list -f json (empty)
**命令**: `node packages/cli/dist/bin/actant.js agent list -f json`
**退出码**: 0
**输出**:
```
[]
```
**判断**: PASS
**理由**: 最终 list 为空，符合预期。

---

## 汇总统计
| 指标 | 数值 |
|------|------|
| 总步骤 | 50 |
| PASS | 49 |
| WARN | 1 |
| FAIL | 0 |
| 通过率 | 98% |
