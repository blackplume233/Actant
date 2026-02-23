# QA Log — Round 2 (Deep Integration)

**范围**: 验证 schedule/permissions/plugins 在 Agent 创建/启动流程中的真实端到端行为
**环境**: Windows real mode
**时间**: 2026-02-22
**隔离目录**: C:\Users\black\AppData\Local\Temp\ac-qaloop-r2-2104373845

---

### [Step 1] 启动 Daemon + 加载测试模板
**时间**: 2026-02-22T23:26:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js daemon start --foreground
node packages/cli/dist/bin/actant.js template load $ACTANT_HOME\qa-integration-test.json
```

#### 输出
```
exit_code: 0
Daemon started (foreground). PID: ...
Loaded qa-integration-test@1.0.0
```

#### 判断: PASS

---

### [Step 2] agent create — 验证 permissions 物化到 .claude/settings.local.json
**时间**: 2026-02-22T23:27:45+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js agent create qa-deep-test -t qa-integration-test -f json
```

#### 输出
```
exit_code: 0

--- stdout (关键字段) ---
"effectivePermissions": {
  "allow": ["WebSearch", "WebFetch", "Read"],
  "deny": ["Write", "Edit"],
  "defaultMode": "default"
}
```

#### 产物检查
```
.claude/settings.local.json:
{
  "permissions": {
    "allow": ["WebSearch", "WebFetch", "Read"],
    "deny": ["Write", "Edit"],
    "ask": []
  }
}

.actant.json effectivePermissions:
  allow: ["WebSearch", "WebFetch", "Read"]
  deny: ["Write", "Edit"]
  defaultMode: "default"
```

#### 判断: PASS
permissions 从模板定义 → Zod 验证 → toAgentTemplate() → resolvePermissions() → .claude/settings.local.json，端到端完整。

---

### [Step 3] schedule list — 确认 Scheduler 未集成
**时间**: 2026-02-22T23:28:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js schedule list qa-deep-test -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "sources": [], "running": false }
```

#### 判断: WARN
schedule 字段成功持久化在模板中，但 ctx.schedulers 为空。EmployeeScheduler 从未在 startAgent() 中创建。
这是已知的架构缺口（#103），非 #118 回归。

---

### [Step 4] agent.dispatch RPC — 确认 dispatch 在无 scheduler 时的行为
**时间**: 2026-02-22T23:28:15+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js agent dispatch qa-deep-test -m "Test dispatch task" -p high
```

#### 输出
```
exit_code: 0

--- stdout ---
No scheduler for agent "qa-deep-test". Task not queued.
```

#### 判断: PASS
错误信息清晰友好，exit_code=0（非致命），行为合理。

---

### [Step 5] Permission Preset "permissive" — 端到端
**时间**: 2026-02-22T23:29:09+08:00

#### 输入
```
template: { "permissions": "permissive" }
agent create qa-preset-agent -t qa-preset-perms -f json
```

#### 输出
```
effectivePermissions: {
  "allow": ["*"], "deny": [], "ask": [],
  "defaultMode": "bypassPermissions"
}

.claude/settings.local.json:
{ "permissions": { "allow": ["*"], "deny": [], "ask": [] } }
```

#### 判断: PASS
"permissive" 预设正确展开为 allow: ["*"], defaultMode: "bypassPermissions"。

---

### [Step 6] Permission Preset "restricted" — 端到端
**时间**: 2026-02-22T23:29:28+08:00

#### 输入
```
template: { "permissions": "restricted" }
agent create qa-restricted-agent -t qa-restricted-perms -f json
```

#### 输出
```
effectivePermissions: {
  "allow": ["Read", "WebSearch"],
  "deny": ["Bash", "WebFetch"],
  "ask": ["Edit", "Write"],
  "defaultMode": "dontAsk"
}

.claude/settings.local.json:
{ "permissions": { "allow": ["Read", "WebSearch"], "deny": ["Bash", "WebFetch"], "ask": ["Edit", "Write"] } }
```

#### 判断: PASS
"restricted" 预设正确展开。

---

### [Step 7] 无效 Permission Preset "super-admin" — 验证拒绝
**时间**: 2026-02-22T23:29:45+08:00

#### 输入
```
template: { "permissions": "super-admin" }
template load
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32002] Template validation failed
Context: {"validationErrors":[{"path":"permissions","message":"Invalid input"}]}
```

#### 判断: PASS
无效预设被正确拒绝，Zod 验证输出清晰。

---

### [Step 8] 无效 Schedule (intervalMs=100) — 验证拒绝
**时间**: 2026-02-22T23:30:00+08:00

#### 输入
```
template: { "schedule": { "heartbeat": { "intervalMs": 100, "prompt": "Too fast" } } }
template load
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32002] Template validation failed
Context: {"validationErrors":[{"path":"schedule.heartbeat.intervalMs","message":"Too small: expected number to be >=1000"}]}
```

#### 判断: PASS
intervalMs < 1000 被 Zod 正确拒绝，错误信息精确指向字段。

---

### [Step 9] Sandbox + additionalDirectories — 端到端
**时间**: 2026-02-22T23:30:09+08:00

#### 输入
```
template: {
  "permissions": {
    "allow": ["Read"], "deny": [],
    "sandbox": { "enabled": true, "autoAllowBashIfSandboxed": true,
                 "network": { "allowedDomains": ["api.github.com", "*.anthropic.com"], "allowLocalBinding": false } },
    "additionalDirectories": ["/tmp/shared-data", "C:\\Users\\shared"]
  }
}
agent create qa-sandbox-inst -t qa-sandbox-agent -f json
```

#### 输出
```
.actant.json effectivePermissions:
  allow: ["Read"], deny: [],
  sandbox: { enabled: true, autoAllowBashIfSandboxed: true, network: { allowedDomains: [...], allowLocalBinding: false } },
  additionalDirectories: ["/tmp/shared-data", "C:\\Users\\shared"]

.claude/settings.local.json:
  permissions: { allow: ["Read"], deny: [], ask: [] }
  sandbox: { enabled: true, autoAllowBashIfSandboxed: true, network: { allowedDomains: [...], allowLocalBinding: false } }
```

#### 判断: WARN
sandbox 正确物化到 settings.local.json 顶层（符合 Claude Code 格式）。
但 additionalDirectories 仅存储在 .actant.json 中，未写入 settings.local.json。
injectPermissions() 函数未处理 additionalDirectories 字段。

---

### [Step 10] extensions 字段 roundtrip
**时间**: 2026-02-22T23:30:30+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template show qa-integration-test -f json | node -e "..." 
```

#### 输出
```
extensions: {"testFeature":["a","b"]}
schedule: {"intervalMs":15000,"prompt":"Check for updates","priority":"normal"}
permissions.allow: ["WebSearch","WebFetch","Read"]
```

#### 判断: PASS
extensions 字段完整 roundtrip 通过模板的 load → persist → show → JSON output。

---

### [Step 11] 多 Agent 共存验证
**时间**: 2026-02-22T23:31:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
4 agents listed, 每个 effectivePermissions 独立且正确:
- qa-deep-test: allow=[WebSearch,WebFetch,Read], deny=[Write,Edit]
- qa-preset-agent: allow=[*], defaultMode=bypassPermissions
- qa-restricted-agent: allow=[Read,WebSearch], deny=[Bash,WebFetch], ask=[Edit,Write]
- qa-sandbox-inst: allow=[Read], sandbox={enabled:true,...}, additionalDirectories=[...]
```

#### 判断: PASS
不同权限配置的 Agent 互不干扰，各自 effectivePermissions 独立正确。

---

### [Step 12] agent destroy + workspace 清理验证
**时间**: 2026-02-22T23:31:15+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy qa-preset-agent --force
Test-Path "$ACTANT_HOME\instances\qa-preset-agent"
```

#### 输出
```
exit_code: 0
Destroyed qa-preset-agent
Test-Path: False
```

#### 判断: PASS
Agent workspace 完全清理，包括 .claude/settings.local.json。

---

### [Step 13] 停止 Daemon + 环境清理
**时间**: 2026-02-22T23:31:30+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js daemon stop
Remove-Item -Recurse -Force $tmpDir
```

#### 输出
```
Daemon stopping...
Cleaned
```

#### 判断: PASS
