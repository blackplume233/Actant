## Round 2 — 回归验证（修复 #142 后）

环境: 新 ACTANT_HOME, 重新构建并启动 Daemon

---

### [Step 1] Source sync
**时间**: 2026-02-24T13:39 CST

#### 输入
```
actant source sync
```

#### 输出
```
exit_code: 0
Synced: actant-hub
```

#### 判断: PASS

---

### [Step 2] 创建 3 个 hub Agent
**时间**: 2026-02-24T13:39 CST

#### 输入
```
actant agent create reviewer-1 -t "actant-hub@code-reviewer" -f json
actant agent create qa-1 -t "actant-hub@qa-engineer" -f json
actant agent create doc-1 -t "actant-hub@doc-writer" -f json
```

#### 输出
```
exit_code: 0 (all 3)
reviewer-1 → id: 7ea71b31..., status: created, template: actant-hub@code-reviewer
qa-1       → id: f9e92f61..., status: created, template: actant-hub@qa-engineer
doc-1      → id: dda85ab4..., status: created, template: actant-hub@doc-writer
所有 agent providerConfig: { type: "anthropic", protocol: "anthropic" }
```

#### 判断: PASS
3 个 hub 模板 Agent 全部创建成功。#142 修复验证通过。

---

### [Step 3] Agent 列表
**时间**: 2026-02-24T13:39 CST

#### 输入
```
actant agent list -f json
```

#### 输出
```
exit_code: 0
返回 3 个 agent: reviewer-1, qa-1, doc-1
```

#### 判断: PASS

---

### [Step 4] 白盒 — Workspace 产物检查
**时间**: 2026-02-24T13:40 CST

#### 输入
```
Get-ChildItem $ACTANT_HOME\instances\reviewer-1 -Recurse
rg "apiKey" $ACTANT_HOME\instances\
```

#### 输出
```
Workspace 文件:
  .actant.json, AGENTS.md, CLAUDE.md, prompts/system.md, .claude/mcp.json, .claude/settings.local.json

apiKey grep: No matches found
```

#### 判断: PASS
Workspace 结构完整。无 apiKey 泄露。

---

### [Step 5] 交互 — agent run (one-shot)
**时间**: 2026-02-24T13:40 CST

#### 输入
```
actant agent run reviewer-1 --prompt "Hello, can you review this?"
```

#### 输出
```
exit_code: 0
duration: 17219ms
Agent 响应: "I'd be happy to help with a code review. What would you like me to review?
You can: Share a file path for me to read, Paste code directly, ..."
session_id: f5594288-9a3a-479e-a3f0-3bc16634ec5a
model: kimi-for-coding (via configured provider)
tools: 71 tools loaded (Bash, Read, Write, mcp__playwright__*, mcp__vibe_kanban__*, etc.)
mcp_servers: playwright=connected, vibe_kanban=connected
```

#### 判断: PASS
One-shot 交互成功。Agent 使用 Claude Code CLI 后端，正确加载了 MCP servers 和工具列表，返回了有意义的代码审查引导响应。

---

### [Step 6] 启动 Agent (start)
**时间**: 2026-02-24T13:40 CST

#### 输入
```
actant agent start reviewer-1
```

#### 输出
```
exit_code: 1
[RPC -32603] spawn EINVAL
```

#### 白盒分析
`claude-code` 后端 `start` 命令需要 `claude-agent-acp.cmd`，测试环境未安装。
`where.exe claude-agent-acp.cmd` → not found

#### 判断: WARN (环境限制)
`agent start` 失败是因为 ACP 桥接二进制未安装，非代码缺陷。`agent run` 通过 Claude CLI 一次性模式已正常工作。

---

### [Step 7] Dispatch 任务
**时间**: 2026-02-24T13:40 CST

#### 输入
```
actant agent dispatch reviewer-1 -m "Review the main file"
```

#### 输出
```
exit_code: 1
No scheduler for agent "reviewer-1". Task not queued.
```

#### 判断: WARN (功能限制)
Agent launch-mode=direct 没有内置 scheduler，dispatch 不可用。这是设计行为（scheduler 需要 employee 模式），但错误消息可改进。

---

### [Step 8] 删除所有 Agent
**时间**: 2026-02-24T13:41 CST

#### 输入
```
actant agent destroy reviewer-1 --force
actant agent destroy qa-1 --force
actant agent destroy doc-1 --force
```

#### 输出
```
exit_code: 0 (all 3)
Destroyed reviewer-1
Destroyed qa-1
Destroyed doc-1
```

#### 验证
```
actant agent list → []
Test-Path instances/reviewer-1 → False
Test-Path instances/qa-1 → False
Test-Path instances/doc-1 → False
```

#### 判断: PASS
3 个 Agent 全部删除成功，workspace 目录已清理。

---

### [Step 9] 随机干扰 — Destroy 不存在的 Agent
**时间**: 2026-02-24T13:41 CST

#### 输入
```
actant agent destroy nonexistent-agent --force
```

#### 输出
```
exit_code: 0
Destroyed nonexistent-agent
```

#### 判断: WARN
Destroy 不存在的 agent 返回 exit_code 0 且输出 "Destroyed"，应当返回错误或提示 agent 不存在。

---

### [Step 10] 随机干扰 — 不存在的模板
**时间**: 2026-02-24T13:41 CST

#### 输入
```
actant agent create bad-agent -t "nonexistent-template"
```

#### 输出
```
exit_code: 1
[RPC -32001] Template "nonexistent-template" not found in registry
```

#### 判断: PASS
错误处理正确。

---

### [Step 11] 随机干扰 — 重复创建同名 Agent
**时间**: 2026-02-24T13:41 CST

#### 输入
```
actant agent create dup-test -t "actant-hub@doc-writer"
actant agent create dup-test -t "actant-hub@doc-writer"  # 重复
```

#### 输出
```
第一次: exit_code 0 — 创建成功
第二次: exit_code 1 — [RPC -32002] Instance directory "dup-test" already exists
```

#### 判断: PASS
重名检测正确。
