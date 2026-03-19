# QA 全量测试日志 - Round 1

**时间**: 2026-03-02T14:41:27+08:00
**环境**: 隔离测试 (ACTANT_HOME=C:\Users\black\AppData\Local\Temp\ac-qa-20260302-144127)
**Socket**: \\.\pipe\actant-qa-20260302-144127
**Dashboard**: http://localhost:3200

---

## 场景 1: basic-lifecycle (mock 模式)

### [Step 1] list-empty - 确认初始状态无 Agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
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
返回空数组 `[]`，退出码 0，符合期望。

---

### [Step 2] load-template - 加载 lifecycle-tpl 模板

#### 输入
```
node packages/cli/dist/bin/actant.js template load lifecycle-tpl.json
```

#### 输出
```
exit_code: 0
--- stdout ---
Loaded lifecycle-tpl@1.0.0
--- stderr ---
(empty)
```

#### 判断: PASS
模板加载成功。注意：首次尝试因 PowerShell Set-Content 添加 UTF-8 BOM 导致 JSON 解析失败，使用 .NET API 写入无 BOM 文件后重试成功。

---

### [Step 3] create - 创建 Agent 实例

#### 输入
```
node packages/cli/dist/bin/actant.js agent create test-agent -t lifecycle-tpl -f json
```

#### 输出
```
exit_code: 0
--- stdout ---
Agent created successfully.
{
  "id": "ab7cd24c-d4a6-4bd7-8ac4-61a2deba2cfa",
  "name": "test-agent",
  "templateName": "lifecycle-tpl",
  "templateVersion": "1.0.0",
  "backendType": "cursor",
  "status": "created",
  ...
}
--- stderr ---
(empty)
```

#### 判断: PASS
Agent 创建成功，name=test-agent，status=created，templateName=lifecycle-tpl，符合期望。

---

### [Step 4] list-after-create - 确认 Agent 出现在列表中

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
exit_code: 0
--- stdout ---
[{ "name": "test-agent", "status": "created", ... }]
--- stderr ---
(empty)
```

#### 判断: PASS
列表包含 1 个元素，name 为 test-agent。

---

### [Step 5] status-created - 确认 Agent 状态为 created

#### 输入
```
node packages/cli/dist/bin/actant.js agent status test-agent -f json
```

#### 输出
```
exit_code: 0
--- stdout ---
{ "status": "created", "name": "test-agent", ... }
```

#### 判断: PASS
状态为 created，符合期望。

---

### [Step 6] resolve - Resolve Agent workspace

#### 输入
```
node packages/cli/dist/bin/actant.js agent resolve test-agent
```

#### 输出
```
exit_code: 0
--- stdout ---
Instance:  test-agent
Backend:   cursor
Workspace: C:\Users\black\AppData\Local\Temp\ac-qa-20260302-144127\instances\test-agent
Command:   cursor.cmd
Args:      C:\Users\black\AppData\Local\Temp\ac-qa-20260302-144127\instances\test-agent
```

#### 判断: PASS
Resolve 成功，展示了完整的 workspace 路径和 cursor 后端信息。

---

### [Step 7] status-after-resolve - 确认 Resolve 后状态

#### 输入
```
node packages/cli/dist/bin/actant.js agent status test-agent -f json
```

#### 输出
```
exit_code: 0
--- stdout ---
{ "status": "created", ... }
```

#### 判断: PASS
Resolve 是只读操作，状态仍为 created，符合期望。

---

### [Step 8] stop - 停止 Agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent stop test-agent
```

#### 输出
```
exit_code: 0
--- stdout ---
Stopped test-agent
```

#### 判断: PASS
成功停止，退出码 0。

---

### [Step 9] status-stopped - 确认 Agent 状态为 stopped

#### 输入
```
node packages/cli/dist/bin/actant.js agent status test-agent -f json
```

#### 输出
```
exit_code: 0
--- stdout ---
{ "status": "stopped", ... }
```

#### 判断: PASS
状态已变为 stopped。

---

### [Step 10] destroy-no-force - 不带 --force 销毁应失败

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy test-agent
```

#### 输出
```
exit_code: 1
--- stdout ---
Destroying agent "test-agent" will remove its entire workspace. Use --force to skip this warning.
```

#### 判断: PASS
退出码 1，正确提示需要 --force。

---

### [Step 11] destroy - 带 --force 销毁 Agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy test-agent --force
```

#### 输出
```
exit_code: 0
--- stdout ---
Destroyed test-agent
```

#### 判断: PASS
销毁成功。

---

### [Step 12] list-after-destroy - 确认 Agent 已不存在

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
exit_code: 0
--- stdout ---
[]
```

#### 判断: PASS
列表为空，test-agent 已被完全清理。

---

### basic-lifecycle 小结: 12/12 PASS, 0 WARN, 0 FAIL

---

