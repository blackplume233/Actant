# QA Log — Round 1

**范围**: 修复 #118 — toAgentTemplate() 丢失 schedule/permissions/plugins/extensions
**环境**: Windows real mode
**时间**: 2026-02-22

---

### [Step 1] 启动 Daemon
**时间**: 2026-02-22T23:16:21+08:00

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qaloop-1666673550"
$env:ACTANT_SOCKET = "\\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qaloop-1666673550"
node packages/cli/dist/bin/actant.js daemon start --foreground
```

#### 输出
```
exit_code: 0 (running)

--- stdout ---
Daemon started (foreground). PID: 57332
Press Ctrl+C to stop.

--- stderr ---
(empty)
```

#### 判断: PASS
Daemon 正常启动，daemon status 确认 running，uptime=54s，agents=0。

---

### [Step 2] 加载包含 schedule/permissions/plugins/extensions 的模板
**时间**: 2026-02-22T23:17:15+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template load packages/core/src/template/loader/__fixtures__/full-featured-template.json
```

#### 输出
```
exit_code: 0

--- stdout ---
Loaded scheduled-web-searcher@1.2.0

--- stderr ---
(empty)
```

#### 产物检查
```
cat C:\Users\black\AppData\Local\Temp\ac-qaloop-1666673550\configs\templates\scheduled-web-searcher.json
→ 完整包含: schedule.heartbeat.intervalMs=20000, schedule.cron[0].pattern="0 */6 * * *",
  schedule.hooks[0].eventName="user:request", permissions.allow=["WebSearch","WebFetch","Read"],
  permissions.deny=["Write"], permissions.sandbox.enabled=true,
  domainContext.plugins=["rate-limiter","cache"],
  domainContext.extensions.customSources=["rss-feed","api-endpoint"]
```

#### 判断: PASS
模板正确加载，所有新增字段（schedule、permissions、plugins、extensions）完整持久化到 JSON 文件。
修复前这些字段会被 toAgentTemplate() 静默丢弃。

---

### [Step 3] template show 验证字段渲染
**时间**: 2026-02-22T23:17:30+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template show scheduled-web-searcher
```

#### 输出
```
exit_code: 0

--- stdout ---
Template: scheduled-web-searcher
Version:  1.2.0
Backend:  claude-code
Provider: anthropic
Desc:     A scheduled web search agent with permissions and plugins

Domain Context:
  Skills:      1 ref(s)   web-search
  Prompts:     1 ref(s)   system-searcher
  MCP Servers: 0 ref(s)   none
  Plugins:     2 ref(s)   rate-limiter, cache
  Workflow:    search-workflow
  SubAgents:   none

Metadata:
  author: QA Team
  tags: search,scheduled

--- stderr ---
(empty)
```

#### 判断: PASS
`Plugins: 2 ref(s)` 正确显示。table view 中 plugins 被正确渲染。

---

### [Step 4] template show --format json 完整 JSON 输出
**时间**: 2026-02-22T23:17:45+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template show scheduled-web-searcher --format json
```

#### 输出
```
exit_code: 0

--- stdout ---
{
  "name": "scheduled-web-searcher",
  ...
  "permissions": {
    "allow": ["WebSearch", "WebFetch", "Read"],
    "deny": ["Write"],
    "defaultMode": "default",
    "sandbox": { "enabled": true, "autoAllowBashIfSandboxed": false, "network": { "allowedDomains": ["*.example.com"] } }
  },
  "schedule": {
    "heartbeat": { "intervalMs": 20000, "prompt": "Perform a random web search", "priority": "normal" },
    "cron": [{ "pattern": "0 */6 * * *", "prompt": "Generate daily summary", "timezone": "Asia/Shanghai", "priority": "high" }],
    "hooks": [{ "eventName": "user:request", "prompt": "Handle user search request", "priority": "critical" }]
  },
  ...
}

--- stderr ---
(empty)
```

#### 判断: PASS
JSON 输出完整包含 schedule（heartbeat + cron + hooks）、permissions（allow/deny/defaultMode/sandbox）。
所有子字段值与原始模板 JSON 完全一致。

---

### [Step 5] 回归：加载最小模板（无可选字段）
**时间**: 2026-02-22T23:18:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template load packages/core/src/template/loader/__fixtures__/minimal-template.json
```

#### 输出
```
exit_code: 0

--- stdout ---
Loaded minimal-agent@0.1.0

--- stderr ---
(empty)
```

#### 产物检查
```
cat C:\Users\black\AppData\Local\Temp\ac-qaloop-1666673550\configs\templates\minimal-agent.json
→ {"name":"minimal-agent","version":"0.1.0","backend":{"type":"cursor"},"provider":{"type":"openai"},"domainContext":{}}
→ 没有多余的空 schedule/permissions/plugins 字段
```

#### 判断: PASS
最小模板正确加载，持久化 JSON 不包含多余空字段。向后兼容性无问题。

---

### [Step 6] 回归：加载标准模板（无新字段）
**时间**: 2026-02-22T23:18:15+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template load packages/core/src/template/loader/__fixtures__/valid-template.json
```

#### 输出
```
exit_code: 0

--- stdout ---
Loaded code-review-agent@1.0.0

--- stderr ---
(empty)
```

#### 判断: PASS
标准模板正常加载，无回归问题。

---

### [Step 7] template list 验证全部模板
**时间**: 2026-02-22T23:18:30+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js template list
```

#### 输出
```
exit_code: 0

--- stdout ---
┌────────────────────────┬─────────┬─────────────┬───────────┬───────────────────────────────────────────────────────────┐
│ Name                   │ Version │ Backend     │ Provider  │ Description                                               │
├────────────────────────┼─────────┼─────────────┼───────────┼───────────────────────────────────────────────────────────┤
│ scheduled-web-searcher │ 1.2.0   │ claude-code │ anthropic │ A scheduled web search agent with permissions and plugins │
│ minimal-agent          │ 0.1.0   │ cursor      │ openai    │ —                                                         │
│ code-review-agent      │ 1.0.0   │ claude-code │ anthropic │ A code review agent powered by Claude                     │
└────────────────────────┴─────────┴─────────────┴───────────┴───────────────────────────────────────────────────────────┘

--- stderr ---
(empty)
```

#### 判断: PASS
3 个模板全部正确列出，格式正常。

---

### [Step 8] 单元测试 — template 模块全量
**时间**: 2026-02-22T23:15:10+08:00

#### 输入
```
npx vitest run src/template --reporter=verbose
```

#### 输出
```
exit_code: 0

--- stdout ---
Test Files  4 passed (4)
      Tests  64 passed (64)

--- stderr ---
(empty)
```

#### 判断: PASS
64 项测试全部通过，包括 3 项新增的 schedule/permissions/plugins/extensions 专项测试。

---

### [Step 9] 停止 Daemon + 清理
**时间**: 2026-02-22T23:19:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js daemon stop
```

#### 输出
```
exit_code: 0

--- stdout ---
Daemon stopping...

--- stderr ---
(empty)
```

#### 判断: PASS
Daemon 正常停止。
