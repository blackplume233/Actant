## Round 3 — 回归验证（修复 W1/W2/W3 后）

环境: 新 ACTANT_HOME, 重新构建并启动 Daemon

---

### [Step 1] Source sync + template/skill 列表
**时间**: 2026-02-24T13:48 CST

#### 输入
```
actant source sync
actant template list
actant skill list
```

#### 输出
```
exit_code: 0 (all)
Templates: actant-hub@code-reviewer, actant-hub@qa-engineer, actant-hub@doc-writer
Skills: actant-hub@code-review, actant-hub@test-writer, actant-hub@doc-writer
```

#### 判断: PASS
命名空间解析正确（#142 修复持续有效）。

---

### [Step 2] 创建 3 个 hub Agent
**时间**: 2026-02-24T13:48 CST

#### 输入
```
actant agent create reviewer-1 -t "actant-hub@code-reviewer"
actant agent create qa-1 -t "actant-hub@qa-engineer"
actant agent create doc-1 -t "actant-hub@doc-writer"
```

#### 输出
```
exit_code: 0 (all 3)
reviewer-1 → created, template: actant-hub@code-reviewer@1.0.0
qa-1       → created, template: actant-hub@qa-engineer@1.0.0
doc-1      → created, template: actant-hub@doc-writer@1.0.0
```

#### 判断: PASS

---

### [Step 3] W1 验证 — agent start 改进错误消息
**时间**: 2026-02-24T13:48 CST

#### 输入
```
actant agent start reviewer-1
```

#### 输出
```
exit_code: 1
[RPC -32008] Failed to launch agent "reviewer-1"
Context: {"instanceName":"reviewer-1","cause":"Backend \"claude-code\" executable not found. Ensure the required CLI is installed and in your PATH."}
```

#### 判断: PASS
- 错误码从 -32603 (INTERNAL_ERROR) 改为 -32008 (AGENT_LAUNCH)
- 消息从 "spawn EINVAL" 改为清晰的安装指导
- W1 修复验证通过

---

### [Step 4] W2 验证 — dispatch 改进提示
**时间**: 2026-02-24T13:48 CST

#### 输入
```
actant agent dispatch reviewer-1 -m "Review code"
```

#### 输出
```
exit_code: 1
No scheduler for agent "reviewer-1". Task not queued.
Hint: use "actant agent run reviewer-1 --prompt <message>" for one-shot execution.
```

#### 判断: PASS
增加了替代命令建议。W2 修复验证通过。

---

### [Step 5] W3 验证 — destroy 不存在的 agent
**时间**: 2026-02-24T13:49 CST

#### 输入
```
actant agent destroy nonexistent-agent --force
```

#### 输出
```
exit_code: 1
[RPC -32003] Agent instance "nonexistent-agent" not found
Context: {"instanceName":"nonexistent-agent"}
```

#### 判断: PASS
- exit_code 从 0 改为 1
- 消息从 "Destroyed nonexistent-agent" 改为 "Agent instance not found"
- W3 修复验证通过

---

### [Step 6] 正常销毁 3 个 Agent
**时间**: 2026-02-24T13:49 CST

#### 输入
```
actant agent destroy reviewer-1 --force
actant agent destroy qa-1 --force
actant agent destroy doc-1 --force
actant agent list
```

#### 输出
```
exit_code: 0 (all 3 destroy + list)
Destroyed reviewer-1
Destroyed qa-1
Destroyed doc-1
agent list: []
```

#### 判断: PASS
正常销毁流程不受 W3 修复影响。
